'use client';

import { useCallback } from 'react';
import { createSoundBoard } from '@/lib/soundBoard';

export type CoupSound =
  | 'income'
  | 'foreign-aid'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange'
  | 'coup'
  | 'win';

const playCoupSound = createSoundBoard<CoupSound>({
  income: { src: '/sounds/coup/income.wav', volume: 0.42 },
  'foreign-aid': { src: '/sounds/coup/foreign-aid.wav', volume: 0.45 },
  tax: { src: '/sounds/coup/tax.wav', volume: 0.5 },
  assassinate: { src: '/sounds/coup/assassinate.wav', volume: 0.6 },
  steal: { src: '/sounds/coup/steal.wav', volume: 0.45 },
  exchange: { src: '/sounds/coup/exchange.wav', volume: 0.4 },
  coup: { src: '/sounds/coup/coup.wav', volume: 0.68 },
  win: { src: '/sounds/coup/win.wav', volume: 0.55 },
});

/** Fire-and-forget Coup cues that no-op while muted. */
export function useCoupSounds(enabled: boolean) {
  return useCallback(
    (name: CoupSound) => {
      if (enabled) playCoupSound(name);
    },
    [enabled],
  );
}
