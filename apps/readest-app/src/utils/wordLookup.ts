const normalizeApostrophes = (value: string) => value.replace(/[\u2018\u2019\u02bc]/g, "'");

const stripWordWrappers = (value: string) =>
  value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/^'+|'+$/g, '');

const shouldAppendSilentE = (stem: string) => {
  if (stem.length < 3) return false;
  if (!/[aeiou][^aeiou]$/i.test(stem)) return false;
  if (/[wxy]$/i.test(stem)) return false;
  if (/(er|or|ar|ir|ur|en)$/i.test(stem)) return false;
  return true;
};

const trimDoubleTailConsonant = (stem: string) => {
  if (stem.length < 3) return stem;
  const last = stem.at(-1);
  const prev = stem.at(-2);
  if (!last || last !== prev) return stem;
  if (!/[bcdfghjklmnpqrstvwxyz]/i.test(last)) return stem;
  return stem.slice(0, -1);
};

const normalizeLookupWord = (word: string) => stripWordWrappers(normalizeApostrophes(word).trim());

const addCandidate = (bucket: Set<string>, value: string) => {
  const normalized = normalizeLookupWord(value);
  if (!normalized) return;
  bucket.add(normalized);
  bucket.add(normalized.toLowerCase());
};

export const buildWordLookupCandidates = (word: string) => {
  const candidates = new Set<string>();
  const normalizedRaw = normalizeLookupWord(word);
  const normalized = normalizedRaw.toLowerCase();

  addCandidate(candidates, word);
  addCandidate(candidates, normalizedRaw);
  addCandidate(candidates, normalized);

  if (!normalized) return Array.from(candidates);

  const apostropheFree = normalized.replace(/'/g, '');
  if (apostropheFree !== normalized) {
    addCandidate(candidates, apostropheFree);
  }

  if (normalized.endsWith("'s") && normalized.length > 3) {
    addCandidate(candidates, normalized.slice(0, -2));
  }

  if (normalized.endsWith('ies') && normalized.length > 4) {
    addCandidate(candidates, `${normalized.slice(0, -3)}y`);
  }

  if (normalized.endsWith('ied') && normalized.length > 4) {
    addCandidate(candidates, `${normalized.slice(0, -3)}y`);
  }

  if (normalized.endsWith('ing') && normalized.length > 4) {
    const stem = normalized.slice(0, -3);
    addCandidate(candidates, stem);
    addCandidate(candidates, trimDoubleTailConsonant(stem));
    if (shouldAppendSilentE(stem)) {
      addCandidate(candidates, `${stem}e`);
    }
  }

  if (normalized.endsWith('ed') && normalized.length > 3) {
    const stem = normalized.slice(0, -2);
    addCandidate(candidates, stem);
    addCandidate(candidates, trimDoubleTailConsonant(stem));
    if (stem.endsWith('i') && stem.length > 2) {
      addCandidate(candidates, `${stem.slice(0, -1)}y`);
    }
    if (shouldAppendSilentE(stem)) {
      addCandidate(candidates, `${stem}e`);
    }
  }

  if (/(ses|xes|zes|ches|shes)$/i.test(normalized) && normalized.length > 4) {
    addCandidate(candidates, normalized.slice(0, -2));
  }

  if (normalized.endsWith('es') && normalized.length > 3) {
    addCandidate(candidates, normalized.slice(0, -2));
  }

  if (normalized.endsWith('s') && !/(ss|us|is|ous)$/i.test(normalized) && normalized.length > 3) {
    addCandidate(candidates, normalized.slice(0, -1));
  }

  return Array.from(candidates);
};
