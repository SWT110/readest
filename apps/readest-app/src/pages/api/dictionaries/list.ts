import fs from 'fs/promises';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';
import { getDictionaryDir } from '@/services/dictionaries/mdict';

type DictionaryListItem = {
  name: string;
  file: string;
  type: 'json' | 'mdx';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dir = getDictionaryDir();
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const jsonDictionaries = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => ({
        name: entry.name.replace(/\.json$/i, ''),
        file: entry.name,
        type: 'json',
      }));

    const folderDictionaries = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const folderPath = path.join(dir, entry.name);
          const children = await fs.readdir(folderPath, { withFileTypes: true }).catch(() => []);
          const mdx = children.find(
            (child) => child.isFile() && child.name.toLowerCase().endsWith('.mdx'),
          );
          if (!mdx) return null;
          const item: DictionaryListItem = {
            name: entry.name,
            file: mdx.name,
            type: 'mdx',
          };
          return item;
        }),
    );

    const isDictionaryListItem = (
      value: DictionaryListItem | null,
    ): value is DictionaryListItem => value !== null;

    const dictionaries = [...jsonDictionaries, ...folderDictionaries.filter(isDictionaryListItem)]
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ dictionaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
