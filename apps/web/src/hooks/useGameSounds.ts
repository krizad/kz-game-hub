'use client';

import { useCallback, useRef } from 'react';
import useSound from 'use-sound';

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

const SABOTEUR_SOUNDS: Record<SaboteurSound, string> = {
  place: '/sounds/saboteur/place.wav',
  break: '/sounds/saboteur/break.wav',
  repair: '/sounds/saboteur/repair.wav',
  map: '/sounds/saboteur/map.wav',
  rockfall: '/sounds/saboteur/rockfall.wav',
  discard: '/sounds/saboteur/discard.wav',
  pass: '/sounds/saboteur/pass.wav',
  gold: '/sounds/saboteur/gold.wav',
  win: '/sounds/saboteur/win.wav',
  lose: '/sounds/saboteur/lose.wav',
};

/**
 * Preloads every Saboteur effect once and exposes a fire-and-forget play()
 * that silently no-ops when sounds are muted or the browser blocks playback.
 */
export function useSaboteurSounds(enabled: boolean) {
  const players = useRef<Partial<Record<SaboteurSound, ReturnType<typeof useSound>>>>({});
  void players;

  // use-sound is a hook: one call per sound at the top level
  const place = useSound(SABOTEUR_SOUNDS.place, { soundEnabled: enabled, volume: 0.55 });
  const brk = useSound(SABOTEUR_SOUNDS.break, { soundEnabled: enabled, volume: 0.6 });
  const repair = useSound(SABOTEUR_SOUNDS.repair, { soundEnabled: enabled, volume: 0.5 });
  const map = useSound(SABOTEUR_SOUNDS.map, { soundEnabled: enabled, volume: 0.45 });
  const rockfall = useSound(SABOTEUR_SOUNDS.rockfall, { soundEnabled: enabled, volume: 0.65 });
  const discard = useSound(SABOTEUR_SOUNDS.discard, { soundEnabled: enabled, volume: 0.4 });
  const pass = useSound(SABOTEUR_SOUNDS.pass, { soundEnabled: enabled, volume: 0.35 });
  const gold = useSound(SABOTEUR_SOUNDS.gold, { soundEnabled: enabled, volume: 0.5 });
  const win = useSound(SABOTEUR_SOUNDS.win, { soundEnabled: enabled, volume: 0.55 });
  const lose = useSound(SABOTEUR_SOUNDS.lose, { soundEnabled: enabled, volume: 0.55 });

  const byName: Record<SaboteurSound, [() => void, unknown]> = {
    place: place as unknown as [() => void, unknown],
    break: brk as unknown as [() => void, unknown],
    repair: repair as unknown as [() => void, unknown],
    map: map as unknown as [() => void, unknown],
    rockfall: rockfall as unknown as [() => void, unknown],
    discard: discard as unknown as [() => void, unknown],
    pass: pass as unknown as [() => void, unknown],
    gold: gold as unknown as [() => void, unknown],
    win: win as unknown as [() => void, unknown],
    lose: lose as unknown as [() => void, unknown],
  };

  return useCallback(
    (name: SaboteurSound) => {
      try {
        const [play] = byName[name];
        play();
      } catch {
        // playback failures (autoplay policy, missing file) are non-fatal
      }
    },
    [enabled],
  );
}
