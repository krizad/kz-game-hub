import type { MusicTriviaLevel } from '@repo/types';

/**
 * i18n keys are camelCase (`levelEasy`), so the level must never be run
 * through `.toLowerCase()` when building the key — `level` + `easy` resolves
 * to nothing and the raw key renders on screen.
 */
export const MUSIC_TRIVIA_LEVEL_KEY: Record<MusicTriviaLevel, string> = {
  EASY: 'gameMusicTrivia.lobby.levelEasy',
  MEDIUM: 'gameMusicTrivia.lobby.levelMedium',
  HARD: 'gameMusicTrivia.lobby.levelHard',
};

export function musicTriviaLevelKey(level?: string | null): string {
  return (
    MUSIC_TRIVIA_LEVEL_KEY[(level ?? 'EASY') as MusicTriviaLevel] ?? MUSIC_TRIVIA_LEVEL_KEY.EASY
  );
}
