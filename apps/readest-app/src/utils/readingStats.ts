import { Book } from '@/types/book';
import { BookDoc } from '@/libs/document';
import {
  computeBookVocabularyStats,
  computeTextVocabularyStats,
  VocabularyStatsResult,
} from './vocabularyStats';

export type ReadingStats = {
  wordCount?: number;
  vocabularyCount?: number;
  readingTimeMs?: number;
};

export const computeTextReadingStats = (text: string) => {
  const stats = computeTextVocabularyStats(text);
  return {
    wordCount: stats.wordCount,
    vocabularyCount: stats.vocabularyCount,
  };
};

export const computeBookReadingStats = async (bookDoc: BookDoc, maxSections: number = 400) => {
  const stats: VocabularyStatsResult = await computeBookVocabularyStats(bookDoc, maxSections);
  return {
    wordCount: stats.wordCount,
    vocabularyCount: stats.vocabularyCount,
  };
};

export const getBookReadingStats = (book: Book): Required<ReadingStats> => {
  const metadataStats = book.metadata?.readingStats || {};
  return {
    wordCount: book.wordCount ?? metadataStats.wordCount ?? 0,
    vocabularyCount: book.vocabularyCount ?? metadataStats.vocabularyCount ?? 0,
    readingTimeMs: book.readingTimeMs ?? metadataStats.readingTimeMs ?? 0,
  };
};

export const mergeBookReadingStats = (book: Book, partial: ReadingStats): Book => {
  const current = getBookReadingStats(book);
  const next = {
    wordCount: partial.wordCount ?? current.wordCount,
    vocabularyCount: partial.vocabularyCount ?? current.vocabularyCount,
    readingTimeMs: partial.readingTimeMs ?? current.readingTimeMs,
  };

  return {
    ...book,
    wordCount: next.wordCount,
    vocabularyCount: next.vocabularyCount,
    readingTimeMs: next.readingTimeMs,
    metadata: book.metadata
      ? {
          ...book.metadata,
          readingStats: {
            ...(book.metadata.readingStats || {}),
            ...next,
          },
        }
      : book.metadata,
  };
};

export const formatReadingDuration = (milliseconds: number) => {
  if (!milliseconds || milliseconds <= 0) return '0m';
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};
