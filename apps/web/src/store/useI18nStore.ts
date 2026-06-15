import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language } from '@/i18n/dictionaries';

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'th',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'who-know-language',
    },
  ),
);
