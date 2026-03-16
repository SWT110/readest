import fs from 'fs/promises';
import path from 'path';
import { MDD, MDX } from 'js-mdict';
import { buildWordLookupCandidates } from '@/utils/wordLookup';

type MdictLikeRecord = {
  keyText?: string;
  definition?: string;
};

type MdictBundle = {
  mdx: MDX;
  mdd?: MDD;
};

const mdictCache = new Map<string, MdictBundle>();

export const getDictionaryDir = () => process.env['DICTIONARY_DIR'] || '/app/dictionaries';

export const getDictionaryJsonPath = (dictionary: string) =>
  path.join(getDictionaryDir(), `${dictionary}.json`);

export const getDictionaryFolderPath = (dictionary: string) =>
  path.join(getDictionaryDir(), dictionary);

const ensureMdictBundle = async (dictionary: string) => {
  const cached = mdictCache.get(dictionary);
  if (cached) return cached;

  const dictionaryDir = getDictionaryFolderPath(dictionary);
  const entries = await fs.readdir(dictionaryDir, { withFileTypes: true });
  const mdxFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mdx'))
    .map((entry) => entry.name)
    .sort();

  if (!mdxFiles.length) {
    throw new Error(`No .mdx file found in dictionary folder: ${dictionary}`);
  }

  const mdxName = mdxFiles[0]!;
  const baseName = mdxName.replace(/\.mdx$/i, '');
  const mddName = entries.find(
    (entry) => entry.isFile() && entry.name.toLowerCase() === `${baseName.toLowerCase()}.mdd`,
  )?.name;

  const mdx = new MDX(path.join(dictionaryDir, mdxName));
  const mdd = mddName ? new MDD(path.join(dictionaryDir, mddName)) : undefined;

  const bundle = { mdx, mdd };
  mdictCache.set(dictionary, bundle);
  return bundle;
};

const normalizeRecord = (input: unknown): MdictLikeRecord | null => {
  if (!input) return null;
  if (Array.isArray(input)) {
    const first = input[0];
    return normalizeRecord(first);
  }
  if (typeof input === 'object') {
    return input as MdictLikeRecord;
  }
  if (typeof input === 'string') {
    return { definition: input };
  }
  return null;
};

const readDirectRecord = (mdx: MDX, word: string): MdictLikeRecord | null => {
  if (!word.trim()) return null;
  const result = normalizeRecord(mdx.lookup(word));
  return result?.definition ? result : null;
};

const resolveMdxLink = (mdx: MDX, record: MdictLikeRecord, depth = 0): MdictLikeRecord | null => {
  if (!record.definition || depth > 3) return record;

  const trimmed = record.definition.trim();
  const linkMatch = trimmed.match(/^@@@LINK=(.+)$/i);
  if (!linkMatch) return record;

  const linked = readLookupRecord(mdx, linkMatch[1]!.trim());
  if (!linked) return null;
  return resolveMdxLink(mdx, linked, depth + 1);
};

const normalizeWord = (word: string) => word.trim().toLowerCase();

const hasInflectionOrExactWord = (record: MdictLikeRecord, query: string) => {
  const definition = record.definition?.toLowerCase();
  const normalized = normalizeWord(query);
  if (!definition || !normalized) return false;
  if (definition.includes(`<inflection>${normalized}</inflection>`)) return true;
  return false;
};

const getCandidateKey = (item: unknown): string | null => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    if (typeof record['keyText'] === 'string') return record['keyText'];
    if (typeof record['key'] === 'string') return record['key'];
    if (typeof record['word'] === 'string') return record['word'];
  }
  return null;
};

const findFromSearchMethods = (mdx: MDX, word: string, normalizedInput: string) => {
  const normalizedWord = normalizeWord(word);
  const searchMethods = ['associate', 'prefix', 'fuzzy_search'] as const;
  for (const methodName of searchMethods) {
    const method = (mdx as unknown as Record<string, unknown>)[methodName];
    if (typeof method !== 'function') continue;

    try {
      const result = (method as (query: string) => unknown)(word);
      const items = Array.isArray(result) ? result : [];
      for (const item of items) {
        const key = getCandidateKey(item);
        if (!key) continue;
        const normalizedKey = normalizeWord(key);
        const record = readDirectRecord(mdx, key);
        if (!record) continue;
        if (normalizedKey === normalizedWord || normalizedKey === normalizedInput) {
          return record;
        }
        if (hasInflectionOrExactWord(record, normalizedInput)) {
          return record;
        }
      }
    } catch {
      // Ignore provider-specific errors and continue fallback chain.
    }
  }
  return null;
};

const readLookupRecord = (mdx: MDX, word: string): MdictLikeRecord | null => {
  const candidates = buildWordLookupCandidates(word);
  const normalizedInput = normalizeWord(word);
  let firstFallback: MdictLikeRecord | null = null;

  for (const candidate of candidates) {
    const record = readDirectRecord(mdx, candidate);
    if (!record) continue;
    if (normalizeWord(candidate) === normalizedInput) return record;
    if (hasInflectionOrExactWord(record, normalizedInput)) return record;
    if (!firstFallback) firstFallback = record;
  }

  for (const candidate of candidates) {
    const record = findFromSearchMethods(mdx, candidate, normalizedInput);
    if (!record) continue;
    return record;
  }

  return firstFallback;
};

export const lookupMdxDefinition = async (dictionary: string, word: string) => {
  const { mdx } = await ensureMdictBundle(dictionary);
  const record = readLookupRecord(mdx, word);
  if (!record) return null;
  return resolveMdxLink(mdx, record);
};

const tryLocateResource = (mdd: MDD, key: string) => {
  const candidates = [key, key.replace(/^\/+/, ''), key.replace(/^\\+/, '')]
    .flatMap((item) => [item, `\\${item}`])
    .filter((item) => item.trim() !== '');

  for (const candidate of candidates) {
    const located = (mdd as unknown as { locate: (k: string) => unknown }).locate(candidate);
    const record = normalizeRecord(located);
    if (record?.definition) return record;
  }
  return null;
};

export const locateMddResource = async (dictionary: string, key: string) => {
  const { mdd } = await ensureMdictBundle(dictionary);
  if (!mdd) return null;
  return tryLocateResource(mdd, key);
};

export const getMdictHtml = (record: MdictLikeRecord | null) =>
  typeof record?.definition === 'string' ? record.definition : '';

export const rewriteMdictLinks = (dictionary: string, html: string) => {
  const rewrite = (_match: string, quote: string, rawValue: string) => {
    const value = rawValue.trim();
    if (
      !value ||
      value.startsWith('#') ||
      /^(https?:|data:|javascript:|mailto:|sound:|entry:)/i.test(value)
    ) {
      return `=${quote}${rawValue}${quote}`;
    }

    const key = value.replace(/^\.?\//, '');
    const url = `/api/dictionaries/resource?dictionary=${encodeURIComponent(
      dictionary,
    )}&key=${encodeURIComponent(key)}`;
    return `=${quote}${url}${quote}`;
  };

  return html
    .replace(/\s(href)=("([^"]*)"|'([^']*)')/gi, (_all, attr, wrapped, _dq, _sq) => {
      const quote = wrapped[0]!;
      const raw = wrapped.slice(1, -1);
      return ` ${attr}${rewrite('', quote, raw)}`;
    })
    .replace(/\s(src)=("([^"]*)"|'([^']*)')/gi, (_all, attr, wrapped, _dq, _sq) => {
      const quote = wrapped[0]!;
      const raw = wrapped.slice(1, -1);
      return ` ${attr}${rewrite('', quote, raw)}`;
    });
};
