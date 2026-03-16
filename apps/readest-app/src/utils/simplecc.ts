import { ConvertChineseVariant } from '@/types/book';

type SimpleCCModule = {
  default: (moduleOrPath?: string) => Promise<void>;
  simplecc: (text: string, variant: ConvertChineseVariant) => string;
};

let initialized = false;
let initializingPromise: Promise<void> | null = null;
let simpleccImpl: SimpleCCModule['simplecc'] | null = null;

const loadSimpleCCModule = async (): Promise<SimpleCCModule | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const dynamicImport = new Function(
      'path',
      'return import(/* webpackIgnore: true */ path)',
    ) as (path: string) => Promise<SimpleCCModule>;
    return await dynamicImport('/vendor/simplecc/simplecc_wasm.js');
  } catch (error) {
    console.warn('Failed to load SimpleCC wasm module:', error);
    return null;
  }
};

const initSimpleCC = async () => {
  if (initialized) return;
  if (initializingPromise) return initializingPromise;

  initializingPromise = (async () => {
    const simpleccModule = await loadSimpleCCModule();
    if (!simpleccModule) return;

    await simpleccModule.default('/vendor/simplecc/simplecc_wasm_bg.wasm');
    simpleccImpl = simpleccModule.simplecc;
    initialized = true;
  })();

  await initializingPromise;
};

const convertReverseMap: Record<ConvertChineseVariant, ConvertChineseVariant> = {
  none: 'none',
  s2t: 't2s',
  t2s: 's2t',
  s2tw: 'tw2s',
  s2hk: 'hk2s',
  s2twp: 'tw2sp',
  tw2s: 's2tw',
  hk2s: 's2hk',
  tw2sp: 's2twp',
};

const runSimpleCC = (text: string, variant: ConvertChineseVariant, reverse = false): string => {
  if (!simpleccImpl) return text;

  try {
    return reverse ? simpleccImpl(text, convertReverseMap[variant]) : simpleccImpl(text, variant);
  } catch (error) {
    console.warn('Failed to run SimpleCC conversion:', error);
    return text;
  }
};

export { initSimpleCC, runSimpleCC };
