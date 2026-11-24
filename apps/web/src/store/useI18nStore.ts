import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language } from '@/i18n/dictionaries';

function syncDocumentLang(lang: Language): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'th',
      setLanguage: (language) => {
        syncDocumentLang(language);
        set({ language });
      },
    }),
    {
      name: 'kz-language',
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          syncDocumentLang(state.language);
        }
      },
    },
  ),
);
