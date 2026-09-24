'use client';

import { useCallback } from 'react';
import useSound from 'use-sound';

export type DetectiveClubSound =
  | 'word'
  | 'card'
  | 'discussion'
  | 'vote'
  | 'scoring'
  | 'detective-win'
  | 'conspirator-win';

const DC_SOUNDS: Record<DetectiveClubSound, string> = {
  word: '/sounds/detective-club/word.wav',
  card: '/sounds/detective-club/card.wav',
  discussion: '/sounds/detective-club/discussion.wav',
  vote: '/sounds/detective-club/vote.wav',
  scoring: '/sounds/detective-club/scoring.wav',
  'detective-win': '/sounds/detective-club/detective-win.wav',
  'conspirator-win': '/sounds/detective-club/conspirator-win.wav',
};

/**
 * Preloads every Detective Club effect once and exposes fire-and-forget play().
 * Playback failures (autoplay policy, missing file) are non-fatal.
 */
export function useDetectiveClubSounds(enabled: boolean) {
  const word = useSound(DC_SOUNDS.word, { soundEnabled: enabled, volume: 0.5 });
  const card = useSound(DC_SOUNDS.card, { soundEnabled: enabled, volume: 0.45 });
  const discussion = useSound(DC_SOUNDS.discussion, { soundEnabled: enabled, volume: 0.3 });
  const vote = useSound(DC_SOUNDS.vote, { soundEnabled: enabled, volume: 0.45 });
  const scoring = useSound(DC_SOUNDS.scoring, { soundEnabled: enabled, volume: 0.5 });
  const detectiveWin = useSound(DC_SOUNDS['detective-win'], { soundEnabled: enabled, volume: 0.5 });
  const conspiratorWin = useSound(DC_SOUNDS['conspirator-win'], {
    soundEnabled: enabled,
    volume: 0.5,
  });

  const byName: Record<DetectiveClubSound, () => void> = {
    word: () => word[0](),
    card: () => card[0](),
    discussion: () => discussion[0](),
    vote: () => vote[0](),
    scoring: () => scoring[0](),
    'detective-win': () => detectiveWin[0](),
    'conspirator-win': () => conspiratorWin[0](),
  };

  return useCallback(
    (name: DetectiveClubSound) => {
      try {
        byName[name]();
      } catch {
        // non-fatal
      }
    },
    [enabled],
  );
}
