import fs from 'fs/promises';
import { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';
import {
  getDictionaryJsonPath,
  getMdictHtml,
  lookupMdxDefinition,
  rewriteMdictLinks,
} from '@/services/dictionaries/mdict';
import { buildWordLookupCandidates } from '@/utils/wordLookup';

type Definition = {
  definition: string;
  examples?: string[];
};

type Result = {
  partOfSpeech: string;
  definitions: Definition[];
  language: string;
};

const toDefinition = (input: unknown): Definition[] => {
  if (typeof input === 'string') {
    return [{ definition: input }];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => toDefinition(item));
  }
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (typeof record['definition'] === 'string') {
      return [
        {
          definition: record['definition'],
          examples: Array.isArray(record['examples'])
            ? record['examples'].filter((x): x is string => typeof x === 'string')
            : undefined,
        },
      ];
    }
  }
  return [];
};

const normalizeEntry = (entry: unknown, fallbackLanguage = 'Unknown'): Result[] => {
  if (!entry) return [];

  if (Array.isArray(entry) && entry.every((item) => item && typeof item === 'object')) {
    return entry.flatMap((item) => normalizeEntry(item, fallbackLanguage));
  }

  if (typeof entry === 'string' || Array.isArray(entry)) {
    const definitions = toDefinition(entry);
    return definitions.length
      ? [{ partOfSpeech: 'Definition', definitions, language: fallbackLanguage }]
      : [];
  }

  if (entry && typeof entry === 'object') {
    const record = entry as Record<string, unknown>;

    if (Array.isArray(record['results'])) {
      return normalizeEntry(record['results'], fallbackLanguage);
    }

    if (Array.isArray(record['definitions'])) {
      return [
        {
          partOfSpeech:
            typeof record['partOfSpeech'] === 'string' ? record['partOfSpeech'] : 'Definition',
          definitions: toDefinition(record['definitions']),
          language: typeof record['language'] === 'string' ? record['language'] : fallbackLanguage,
        },
      ].filter((result) => result.definitions.length > 0);
    }

    return Object.entries(record)
      .flatMap(([partOfSpeech, value]) => {
        const definitions = toDefinition(value);
        if (!definitions.length) return [];
        return [
          {
            partOfSpeech,
            definitions,
            language: fallbackLanguage,
          },
        ];
      })
      .filter((result) => result.definitions.length > 0);
  }

  return [];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dictionary = String(req.query['dictionary'] || '').trim();
  const word = String(req.query['word'] || '').trim();

  if (!dictionary || !word) {
    return res.status(400).json({ error: 'dictionary and word are required' });
  }

  try {
    const jsonPath = getDictionaryJsonPath(dictionary);
    const hasJson = await fs
      .stat(jsonPath)
      .then((entry) => entry.isFile())
      .catch(() => false);

    if (!hasJson) {
      const mdxRecord = await lookupMdxDefinition(dictionary, word);
      const rawHtml = getMdictHtml(mdxRecord);
      const html = rewriteMdictLinks(dictionary, rawHtml);
      const results = html
        ? [
            {
              partOfSpeech: 'Definition',
              language: 'Dictionary',
              definitions: [{ definition: html }],
            },
          ]
        : [];

      return res.status(200).json({ word, dictionary, results });
    }

    const content = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(content) as Record<string, unknown> | unknown[];

    const candidates = buildWordLookupCandidates(word);
    let matchedWord = word;
    let entry: unknown;
    if (Array.isArray(parsed)) {
      for (const candidate of candidates) {
        const target = candidate.toLowerCase();
        const found = parsed.find((item) => {
          if (!item || typeof item !== 'object') return false;
          const record = item as Record<string, unknown>;
          const direct =
            typeof record['word'] === 'string' ? record['word'].trim().toLowerCase() : '';
          const aliases = Array.isArray(record['aliases'])
            ? record['aliases']
                .filter((alias): alias is string => typeof alias === 'string')
                .map((alias) => alias.trim().toLowerCase())
            : [];
          return direct === target || aliases.includes(target);
        });
        if (found) {
          entry = found;
          matchedWord = candidate;
          break;
        }
      }
    } else {
      for (const candidate of candidates) {
        const found =
          parsed[candidate] ||
          parsed[candidate.toLowerCase()] ||
          parsed[candidate.toUpperCase()] ||
          parsed[candidate.trim()];
        if (found) {
          entry = found;
          matchedWord = candidate;
          break;
        }
      }
    }

    const results = normalizeEntry(entry);
    return res.status(200).json({ word: matchedWord, dictionary, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
