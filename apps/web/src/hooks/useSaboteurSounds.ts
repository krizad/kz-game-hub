'use client';

import { useCallback } from 'react';
import { createSoundBoard } from '@/lib/soundBoard';

export type SaboteurSound =
  | 'place'
  | 'break'
  | 'repair'
  | 'map'
  | 'rockfall'
  | 'discard'
  | 'pass'
  | 'gold'
  | 'win'
  | 'lose';

const playSaboteurSound = createSoundBoard<SaboteurSound>({
  place: { src: '/sounds/saboteur/place.wav', volume: 0.55 },
  break: { src: '/sounds/saboteur/break.wav', volume: 0.6 },
  repair: { src: '/sounds/saboteur/repair.wav', volume: 0.5 },
  map: { src: '/sounds/saboteur/map.wav', volume: 0.45 },
  rockfall: { src: '/sounds/saboteur/rockfall.wav', volume: 0.65 },
  discard: { src: '/sounds/saboteur/discard.wav', volume: 0.4 },
  pass: { src: '/sounds/saboteur/pass.wav', volume: 0.35 },
  gold: { src: '/sounds/saboteur/gold.wav', volume: 0.5 },
  win: { src: '/sounds/saboteur/win.wav', volume: 0.55 },
  lose: { src: '/sounds/saboteur/lose.wav', volume: 0.55 },
});

/** Fire-and-forget Saboteur cues that no-op while muted. */
export function useSaboteurSounds(enabled: boolean) {
  return useCallback(
    (name: SaboteurSound) => {
      if (enabled) playSaboteurSound(name);
    },
    [enabled],
  );
}
