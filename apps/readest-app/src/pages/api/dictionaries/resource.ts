import fs from 'fs/promises';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';
import { getDictionaryFolderPath, locateMddResource } from '@/services/dictionaries/mdict';

const getContentType = (key: string) => {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'css':
      return 'text/css; charset=utf-8';
    case 'js':
      return 'application/javascript; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dictionary = String(req.query['dictionary'] || '').trim();
  const key = String(req.query['key'] || '').trim();

  if (!dictionary || !key) {
    return res.status(400).json({ error: 'dictionary and key are required' });
  }

  try {
    const record = await locateMddResource(dictionary, key);
    if (record?.definition) {
      const data = Buffer.from(record.definition, 'base64');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', getContentType(key));
      return res.status(200).send(data);
    }

    const dictionaryDir = getDictionaryFolderPath(dictionary);
    const cleanedKey = key.replace(/^[/\\]+/, '');
    const filePath = path.resolve(dictionaryDir, cleanedKey);
    const normalizedDir = path.resolve(dictionaryDir) + path.sep;
    if (!filePath.startsWith(normalizedDir)) {
      return res.status(400).json({ error: 'invalid resource key' });
    }

    const data = await fs.readFile(filePath).catch(() => null);
    if (!data) {
      return res.status(404).json({ error: 'resource not found' });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', getContentType(cleanedKey));
    return res.status(200).send(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
