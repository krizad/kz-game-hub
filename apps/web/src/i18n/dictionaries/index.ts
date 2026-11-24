import { en } from './en';
import type { Dictionary } from './schema';

export type Language = 'en' | 'th';

const loadedDictionaries: Partial<Record<Language, Dictionary>> = {
  en,
};

let thLoadPromise: Promise<Dictionary> | null = null;

/**
 * Synchronous accessor returning the requested dictionary if loaded,
 * falling back to English while the Thai chunk is still loading.
 */
export function getLoadedDictionary(lang: Language): Dictionary {
  return loadedDictionaries[lang] ?? en;
}

/**
 * Lazily loads the Thai dictionary chunk on the client so initial `/` First Load JS
 * does not ship both full 20-game dictionaries upfront.
 */
export function loadDictionary(lang: Language): Promise<Dictionary> {
  const existing = loadedDictionaries[lang];
  if (existing) return Promise.resolve(existing);

  if (lang === 'th') {
    if (!thLoadPromise) {
      thLoadPromise = import('./th').then((mod) => {
        loadedDictionaries.th = mod.th;
        return mod.th;
      });
    }
    return thLoadPromise;
  }

  return Promise.resolve(en);
}

/** Backwards-compatible proxy for callers accessing `dictionaries[lang]`. */
export const dictionaries: Record<Language, Dictionary> = {
  get en() {
    return en;
  },
  get th() {
    return loadedDictionaries.th ?? en;
  },
};
