'use client';

import { useCallback } from 'react';
import { createSoundBoard } from '@/lib/soundBoard';

export type DetectiveClubSound =
  | 'word'
  | 'card'
  | 'discussion'
  | 'vote'
  | 'scoring'
  | 'detective-win'
  | 'conspirator-win';

const playDetectiveClubSound = createSoundBoard<DetectiveClubSound>({
  word: { src: '/sounds/detective-club/word.wav', volume: 0.5 },
  card: { src: '/sounds/detective-club/card.wav', volume: 0.45 },
  discussion: { src: '/sounds/detective-club/discussion.wav', volume: 0.3 },
  vote: { src: '/sounds/detective-club/vote.wav', volume: 0.45 },
  scoring: { src: '/sounds/detective-club/scoring.wav', volume: 0.5 },
  'detective-win': { src: '/sounds/detective-club/detective-win.wav', volume: 0.5 },
  'conspirator-win': { src: '/sounds/detective-club/conspirator-win.wav', volume: 0.5 },
});

/** Fire-and-forget Detective Club cues that no-op while muted. */
export function useDetectiveClubSounds(enabled: boolean) {
  return useCallback(
    (name: DetectiveClubSound) => {
      if (enabled) playDetectiveClubSound(name);
    },
    [enabled],
  );
}
