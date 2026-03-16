import React, { useEffect, useState } from 'react';
import Popup from '@/components/Popup';
import { Position } from '@/utils/sel';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTranslator } from '@/hooks/useTranslator';
import { TRANSLATOR_LANGS } from '@/services/constants';
import { UseTranslatorOptions, getTranslators } from '@/services/translators';
import { SILICONFLOW_TRANSLATION_MODELS } from '@/services/translators/providers/siliconflow';
import Select from '@/components/Select';

const notSupportedLangs = [''];

const generateTranslatorLangs = () => {
  return Object.fromEntries(
    Object.entries(TRANSLATOR_LANGS).filter(([code]) => !notSupportedLangs.includes(code)),
  );
};

const translatorLangs = generateTranslatorLangs();

interface TranslatorPopupProps {
  bookKey: string;
  text: string;
  position: Position;
  trianglePosition: Position;
  popupWidth: number;
  popupHeight: number;
  onDismiss?: () => void;
}

interface TranslatorType {
  name: string;
  label: string;
}

const TranslatorPopup: React.FC<TranslatorPopupProps> = ({
  bookKey,
  text,
  position,
  trianglePosition,
  popupWidth,
  popupHeight,
  onDismiss,
}) => {
  const _ = useTranslation();
  const { token } = useAuth();
  const { settings, setSettings } = useSettingsStore();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);
  const [providers, setProviders] = useState<TranslatorType[]>([]);
  const [sourceLang, setSourceLang] = useState('AUTO');
  const [targetLang, setTargetLang] = useState(
    viewSettings?.translateTargetLang || settings.globalReadSettings.translateTargetLang,
  );
  const [provider, setProvider] = useState(
    viewSettings?.translationProvider || settings.globalReadSettings.translationProvider,
  );
  const [model, setModel] = useState(
    viewSettings?.translationModel || settings.globalReadSettings.translationModel,
  );
  const [translation, setTranslation] = useState<string | null>(null);
  const [detectedSourceLang, setDetectedSourceLang] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { translate, translators } = useTranslator({
    provider,
    sourceLang,
    targetLang,
    model,
  } as UseTranslatorOptions);

  const handleSourceLangChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceLang(event.target.value);
  };

  const handleTargetLangChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    settings.globalReadSettings.translateTargetLang = event.target.value;
    setSettings(settings);
    setTargetLang(event.target.value);
  };

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const requestedProvider = event.target.value;
    const availableTranslators = getTranslators().filter(
      (t) => (t.authRequired ? !!token : true) && !t.quotaExceeded,
    );
    const selectedTranslator =
      availableTranslators.find((t) => t.name === requestedProvider) || availableTranslators[0]!;
    if (selectedTranslator) {
      settings.globalReadSettings.translationProvider = selectedTranslator.name;
      setSettings(settings);
      setProvider(selectedTranslator.name);
    }
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    settings.globalReadSettings.translationModel = event.target.value;
    setSettings(settings);
    setModel(event.target.value);
  };

  useEffect(() => {
    const availableProviders = translators.map((t) => {
      let label = t.label;
      if (t.authRequired && !token) {
        label = `${label} (${_('Login Required')})`;
      } else if (t.quotaExceeded) {
        label = `${label} (${_('Quota Exceeded')})`;
      }
      return { name: t.name, label };
    });
    setProviders(availableProviders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translators]);

  useEffect(() => {
    setLoading(true);
    const fetchTranslation = async () => {
      setError(null);
      setTranslation(null);

      try {
        const input = text.replaceAll('\n', '').trim();
        const result = await translate([input]);
        const translatedText = result[0];
        const detectedSource = null;

        if (!translatedText) {
          throw new Error('No translation found');
        }

        setTranslation(translatedText);
        if (sourceLang === 'AUTO' && detectedSource) {
          setDetectedSourceLang(detectedSource);
        }
      } catch (err) {
        console.error(err);
        const selectedTranslator = translators.find((item) => item.name === provider);
        if (selectedTranslator?.authRequired && !token) {
          setError(_('Unable to fetch the translation. Please log in first and try again.'));
        } else {
          setError(_('Unable to fetch the translation. Try again later.'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTranslation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, token, sourceLang, targetLang, provider, translate]);

  const selectedProviderLabel = providers.find((item) => item.name === provider)?.label || provider;

  return (
    <div>
      <Popup
        trianglePosition={trianglePosition}
        width={popupWidth}
        minHeight={popupHeight}
        maxHeight={720}
        position={position}
        className='not-eink:text-white flex h-full select-text flex-col bg-gray-600'
        triangleClassName='text-gray-600'
        onDismiss={onDismiss}
      >
        <div className='border-gray-500/30 flex items-center justify-between gap-2 border-b px-4 py-2'>
          <div className='line-clamp-1 text-xs opacity-75'>{selectedProviderLabel}</div>
          <div className='flex flex-wrap items-center justify-end gap-2'>
            {provider === 'siliconflow' && (
              <Select
                className='not-eink:bg-gray-600 not-eink:text-white eink:bg-base-100'
                value={model}
                onChange={handleModelChange}
                options={SILICONFLOW_TRANSLATION_MODELS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
            )}
            <Select
              className='not-eink:bg-gray-600 not-eink:text-white eink:bg-base-100'
              value={provider}
              onChange={handleProviderChange}
              options={providers.map(({ name: value, label }) => ({ value, label }))}
            />
          </div>
        </div>

        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='min-h-0 flex-1 overflow-y-auto p-4 font-sans'>
            <div className='mb-2 flex items-center justify-between'>
              <h1 className='text-sm font-normal'>{_('Original Text')}</h1>
              <Select
                className='not-eink:bg-gray-600 not-eink:text-white eink:bg-base-100'
                value={sourceLang}
                onChange={handleSourceLangChange}
                options={[
                  { value: 'AUTO', label: _('Auto Detect') },
                  ...Object.entries(translatorLangs)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([code, name]) => {
                      const label =
                        detectedSourceLang && sourceLang === 'AUTO' && code === 'AUTO'
                          ? `${translatorLangs[detectedSourceLang] || detectedSourceLang} ` +
                            _('(detected)')
                          : name;
                      return { value: code, label };
                    }),
                ]}
              />
            </div>
            <p className='not-eink:text-white/90 text-base'>{text}</p>
          </div>

          <div className='mx-4 flex-shrink-0 border-t border-gray-500/30'></div>

          <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 font-sans'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-sm font-normal'>{_('Translated Text')}</h2>
              <Select
                className='not-eink:bg-gray-600 not-eink:text-white eink:bg-base-100'
                value={targetLang}
                onChange={handleTargetLangChange}
                options={[
                  { value: '', label: _('System Language') },
                  ...Object.entries(translatorLangs)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([code, name]) => ({ value: code, label: name })),
                ]}
              />
            </div>
            {loading ? (
              <p className='text-base italic text-gray-500'>{_('Loading...')}</p>
            ) : (
              <div>
                {error ? (
                  <p className='text-base text-red-600'>{error}</p>
                ) : (
                  <p className='not-eink:text-white/90 text-base'>
                    {translation || _('No translation available.')}
                  </p>
                )}
              </div>
            )}
            {provider && !loading && !error && (
              <div className='mt-2 line-clamp-1 text-xs opacity-60'>
                {_('Translated by {{provider}}.', { provider: selectedProviderLabel })}
              </div>
            )}
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default TranslatorPopup;
