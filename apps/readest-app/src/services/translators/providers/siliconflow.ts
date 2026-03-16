import { getAPIBaseUrl } from '@/services/environment';
import { stubTranslation as _ } from '@/utils/misc';
import { normalizeToShortLang } from '@/utils/lang';
import { TranslationProvider } from '../types';

const SILICONFLOW_API_ENDPOINT = getAPIBaseUrl() + '/siliconflow/translate';

export const SILICONFLOW_TRANSLATION_MODELS = [
  {
    value: 'tencent/Hunyuan-MT-7B',
    label: 'Hunyuan-MT-7B',
  },
  {
    value: 'deepseek-ai/DeepSeek-V3.2',
    label: 'DeepSeek-V3.2',
  },
  {
    value: 'Qwen/Qwen2.5-72B-Instruct',
    label: 'Qwen2.5-72B-Instruct',
  },
  {
    value: 'THUDM/glm-4-9b-chat',
    label: 'GLM-4-9B-Chat',
  },
] as const;

export const siliconflowProvider: TranslationProvider = {
  name: 'siliconflow',
  label: _('SiliconFlow AI'),
  authRequired: false,
  quotaExceeded: false,
  translate: async (
    text: string[],
    sourceLang: string,
    targetLang: string,
    _token?: string | null,
    _useCache: boolean = false,
    model?: string,
  ): Promise<string[]> => {
    if (!text.length) return [];

    const response = await fetch(SILICONFLOW_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        source_lang: normalizeToShortLang(sourceLang).toUpperCase(),
        target_lang: normalizeToShortLang(targetLang).toUpperCase(),
        model,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(data.error || `Translation failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data?.translations || !Array.isArray(data.translations)) {
      throw new Error('Invalid response from SiliconFlow translation service');
    }

    return text.map((line, index) => {
      if (!line?.trim()) return line;
      return data.translations[index]?.text || line;
    });
  },
};
