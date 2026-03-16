import { BookDoc } from '@/libs/document';

export type VocabularyWordFrequency = {
  word: string;
  count: number;
};

export type VocabularyStatsResult = {
  wordCount: number;
  vocabularyCount: number;
  vocabularyRatio: number;
  topWords: VocabularyWordFrequency[];
};

const WORD_PATTERN = /[\p{L}]+(?:['\u2018\u2019\u02bc][\p{L}]+)*/gu;

const normalizeApostrophe = (value: string) =>
  value.replace(/[\u2018\u2019\u02bc]/g, "'").replace(/'+/g, "'");

const trimDoubleTailConsonant = (stem: string) => {
  if (stem.length < 3) return stem;
  const last = stem.at(-1);
  const prev = stem.at(-2);
  if (!last || last !== prev) return stem;
  if (!/[bcdfghjklmnpqrstvwxyz]/i.test(last)) return stem;
  if (/[lsz]/i.test(last)) return stem;
  return stem.slice(0, -1);
};

const shouldAppendSilentE = (stem: string) => {
  if (stem.length < 3) return false;
  if (!/[aeiou][^aeiou]$/i.test(stem)) return false;
  if (/[wxy]$/i.test(stem)) return false;
  if (/(er|or|ar|ir|ur|en)$/i.test(stem)) return false;
  return true;
};

const applyInflectionHeuristics = (word: string) => {
  if (word.length <= 2) return word;

  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith('ied') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith('ing') && word.length > 4) {
    let stem = word.slice(0, -3);
    stem = trimDoubleTailConsonant(stem);
    if (shouldAppendSilentE(stem)) {
      stem = `${stem}e`;
    }
    return stem;
  }

  if (word.endsWith('ed') && word.length > 3) {
    let stem = word.slice(0, -2);
    if (stem.endsWith('i') && stem.length > 2) {
      stem = `${stem.slice(0, -1)}y`;
    } else {
      stem = trimDoubleTailConsonant(stem);
    }
    if (shouldAppendSilentE(stem)) {
      stem = `${stem}e`;
    }
    return stem;
  }

  if (/(ses|xes|zes|ches|shes)$/i.test(word) && word.length > 4) {
    return word.slice(0, -2);
  }

  if (word.endsWith('s') && !/(ss|us|is|ous)$/.test(word) && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
};

export const normalizeVocabularyWord = (token: string) => {
  const normalized = normalizeApostrophe(token)
    .toLowerCase()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    .replace(/^'+|'+$/g, '');
  if (!normalized) return '';
  if (normalized.includes("'")) return normalized;
  return applyInflectionHeuristics(normalized);
};

const tokenize = (text: string) => {
  return text.match(WORD_PATTERN) || [];
};

export const computeTextVocabularyStats = (text: string): VocabularyStatsResult => {
  const frequency = new Map<string, number>();
  let wordCount = 0;

  for (const token of tokenize(text)) {
    const normalized = normalizeVocabularyWord(token);
    if (!normalized) continue;
    wordCount += 1;
    frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
  }

  const topWords = Array.from(frequency.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => (b.count === a.count ? a.word.localeCompare(b.word) : b.count - a.count))
    .slice(0, 10);

  const vocabularyCount = frequency.size;
  return {
    wordCount,
    vocabularyCount,
    vocabularyRatio: wordCount > 0 ? vocabularyCount / wordCount : 0,
    topWords,
  };
};

export const computeBookVocabularyStats = async (
  bookDoc: BookDoc,
  maxSections: number = 400,
): Promise<VocabularyStatsResult> => {
  const frequency = new Map<string, number>();
  let wordCount = 0;

  for (const section of bookDoc.sections.slice(0, maxSections)) {
    try {
      const doc = await section.createDocument();
      const text = doc?.body?.textContent || doc?.documentElement?.textContent || '';
      for (const token of tokenize(text)) {
        const normalized = normalizeVocabularyWord(token);
        if (!normalized) continue;
        wordCount += 1;
        frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
      }
    } catch (error) {
      console.warn('Failed to parse section for vocabulary stats:', error);
    }
  }

  const topWords = Array.from(frequency.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => (b.count === a.count ? a.word.localeCompare(b.word) : b.count - a.count))
    .slice(0, 10);

  const vocabularyCount = frequency.size;
  return {
    wordCount,
    vocabularyCount,
    vocabularyRatio: wordCount > 0 ? vocabularyCount / wordCount : 0,
    topWords,
  };
};
