import { MusicTriviaLevel } from '@repo/types';

/**
 * Difficulty bands judged against each track's stored view snapshot (ADR 0007).
 * Keep in sync with the informational summary in apps/api/scripts/scrape-artist.ts.
 */
export const EASY_MIN_VIEWS = 50_000_000;
export const MEDIUM_MIN_VIEWS = 5_000_000;

export function levelOfViewCount(viewCount: number): MusicTriviaLevel {
  if (viewCount >= EASY_MIN_VIEWS) return 'EASY';
  if (viewCount >= MEDIUM_MIN_VIEWS) return 'MEDIUM';
  return 'HARD';
}

/** Selection order: the chosen level first, then the nearest bands outward. */
export const LEVEL_BORROW_ORDER: Record<MusicTriviaLevel, MusicTriviaLevel[]> = {
  EASY: ['EASY', 'MEDIUM', 'HARD'],
  MEDIUM: ['MEDIUM', 'EASY', 'HARD'],
  HARD: ['HARD', 'MEDIUM', 'EASY'],
};

/** Fisher-Yates in-place shuffle (same helper the free-search path uses). */
export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
