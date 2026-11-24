import { useCallback, useEffect, useState } from 'react';
import { useI18nStore } from '@/store/useI18nStore';
import { getLoadedDictionary, loadDictionary, Language } from '@/i18n/dictionaries';

export function useTranslate() {
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);

  // Fix hydration mismatch by only rendering dict after mounting
  const [mounted, setMounted] = useState(false);
  const [dictVersion, setDictVersion] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    void loadDictionary(language).then(() => {
      if (active) setDictVersion((v) => v + 1);
    });
    return () => {
      active = false;
    };
  }, [language]);

  const t = useCallback(
    (keyString: string, params?: Record<string, string | number>) => {
      // Return english fallback or empty during hydration to prevent mismatch
      // But since the store is persisted, we can just use the store value if mounted, otherwise 'en'
      void dictVersion;
      const activeLanguage = mounted ? language : 'en';
      const keys = keyString.split('.');

      // Fallback to English if key is missing in Thai or other language
      const getTranslation = (lang: Language): unknown => {
        let current: unknown = getLoadedDictionary(lang);
        for (const key of keys) {
          if (
            !current ||
            typeof current !== 'object' ||
            (current as Record<string, unknown>)[key] === undefined
          ) {
            return undefined;
          }
          current = (current as Record<string, unknown>)[key];
        }
        return current;
      };

      let translation = getTranslation(activeLanguage);

      // Fallback
      if (translation === undefined && activeLanguage !== 'en') {
        translation = getTranslation('en');
      }

      if (typeof translation !== 'string') {
        // If still not a string or not found, just return the key string
        return keyString;
      }

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          translation = (translation as string).replace(new RegExp(`{${key}}`, 'g'), () =>
            String(value),
          );
        });
      }

      return translation;
    },
    [language, mounted, dictVersion],
  );

  return { t, language: mounted ? language : 'en', setLanguage, mounted };
}
