import { useCallback, useEffect, useState } from 'react';
import { useI18nStore } from '@/store/useI18nStore';
import { dictionaries, Language } from '@/i18n/dictionaries';

export function useTranslate() {
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);

  // Fix hydration mismatch by only rendering dict after mounting
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const t = useCallback(
    (keyString: string, params?: Record<string, string | number>) => {
      // Return english fallback or empty during hydration to prevent mismatch
      // But since the store is persisted, we can just use the store value if mounted, otherwise 'en'

      const activeLanguage = mounted ? language : 'en';
      const keys = keyString.split('.');

      // Fallback to English if key is missing in Thai or other language
      const getTranslation = (lang: Language): any => {
        let current: any = dictionaries[lang];
        for (const key of keys) {
          if (current?.[key] === undefined) return undefined;
          current = current[key];
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
          translation = (translation as string).replace(new RegExp(`{${key}}`, 'g'), String(value));
        });
      }

      return translation;
    },
    [language, mounted],
  );

  return { t, language: mounted ? language : 'en', setLanguage, mounted };
}
