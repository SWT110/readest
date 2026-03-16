import { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

const DEFAULT_SILICONFLOW_API_BASE_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_SILICONFLOW_TRANSLATION_MODEL = 'tencent/Hunyuan-MT-7B';

const normalizeLang = (lang?: string) => {
  if (!lang || lang === 'AUTO') return 'auto';
  return lang.toLowerCase();
};

const buildPrompt = (text: string, sourceLang: string, targetLang: string) => {
  return [
    `Translate the following text from ${sourceLang} to ${targetLang}.`,
    'Return only the translated text.',
    'Preserve formatting, punctuation, and line breaks when possible.',
    '',
    text,
  ].join('\n');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env['SILICONFLOW_API_KEY'];
  const apiBaseUrl =
    process.env['SILICONFLOW_API_BASE_URL'] || DEFAULT_SILICONFLOW_API_BASE_URL;

  if (!apiKey) {
    return res.status(500).json({ error: 'SiliconFlow API key is not configured' });
  }

  const {
    text,
    source_lang: sourceLang = 'AUTO',
    target_lang: targetLang = 'EN',
    model = process.env['SILICONFLOW_TRANSLATION_MODEL'] || DEFAULT_SILICONFLOW_TRANSLATION_MODEL,
  }: {
    text: string[];
    source_lang?: string;
    target_lang?: string;
    model?: string;
  } = req.body;

  if (!Array.isArray(text)) {
    return res.status(400).json({ error: 'text must be an array' });
  }

  try {
    const translations = await Promise.all(
      text.map(async (entry) => {
        if (!entry?.trim()) {
          return { text: '' };
        }

        const response = await fetch(`${apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  'You are a precise literary translation engine. Output translation only.',
              },
              {
                role: 'user',
                content: buildPrompt(entry, normalizeLang(sourceLang), normalizeLang(targetLang)),
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SiliconFlow API error (${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const translated = data.choices?.[0]?.message?.content?.trim();
        return { text: translated || entry };
      }),
    );

    return res.status(200).json({ translations, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
