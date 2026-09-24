'use client';

import { useCallback } from 'react';
import useSound from 'use-sound';

export type CoupSound =
  | 'income'
  | 'foreign-aid'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange'
  | 'coup'
  | 'win';

const COUP_SOUNDS: Record<CoupSound, string> = {
  income: '/sounds/coup/income.wav',
  'foreign-aid': '/sounds/coup/foreign-aid.wav',
  tax: '/sounds/coup/tax.wav',
  assassinate: '/sounds/coup/assassinate.wav',
  steal: '/sounds/coup/steal.wav',
  exchange: '/sounds/coup/exchange.wav',
  coup: '/sounds/coup/coup.wav',
  win: '/sounds/coup/win.wav',
};

/**
 * Preloads every Coup effect once and exposes fire-and-forget play().
 * Playback failures (autoplay policy, missing file) are non-fatal.
 */
export function useCoupSounds(enabled: boolean) {
  const income = useSound(COUP_SOUNDS.income, { soundEnabled: enabled, volume: 0.42 });
  const foreignAid = useSound(COUP_SOUNDS['foreign-aid'], { soundEnabled: enabled, volume: 0.45 });
  const tax = useSound(COUP_SOUNDS.tax, { soundEnabled: enabled, volume: 0.5 });
  const assassinate = useSound(COUP_SOUNDS.assassinate, { soundEnabled: enabled, volume: 0.6 });
  const steal = useSound(COUP_SOUNDS.steal, { soundEnabled: enabled, volume: 0.45 });
  const exchange = useSound(COUP_SOUNDS.exchange, { soundEnabled: enabled, volume: 0.4 });
  const coup = useSound(COUP_SOUNDS.coup, { soundEnabled: enabled, volume: 0.68 });
  const win = useSound(COUP_SOUNDS.win, { soundEnabled: enabled, volume: 0.55 });

  const byName: Record<CoupSound, () => void> = {
    income: () => income[0](),
    'foreign-aid': () => foreignAid[0](),
    tax: () => tax[0](),
    assassinate: () => assassinate[0](),
    steal: () => steal[0](),
    exchange: () => exchange[0](),
    coup: () => coup[0](),
    win: () => win[0](),
  };

  return useCallback(
    (name: CoupSound) => {
      try {
        byName[name]();
      } catch {
        // non-fatal
      }
    },
    [enabled],
  );
}
