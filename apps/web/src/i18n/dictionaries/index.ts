import { en } from './en';
import { th } from './th';
import type { Dictionary } from './schema';

export type Language = 'en' | 'th';

export const dictionaries: Record<Language, Dictionary> = {
  en,
  th,
};
