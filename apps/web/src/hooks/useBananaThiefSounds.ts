'use client';

import { useCallback } from 'react';
import { createSoundBoard } from '@/lib/soundBoard';

export type BananaThiefSound =
  | 'ready'
  | 'night'
  | 'hour-1'
  | 'hour-2'
  | 'hour-3'
  | 'hour-4'
  | 'hour-5'
  | 'hour-6'
  | 'hour-end-1'
  | 'hour-end-2'
  | 'hour-end-3'
  | 'hour-end-4'
  | 'hour-end-5'
  | 'hour-end-6'
  | 'choose-follower'
  | 'choose-follower-end'
  | 'morning'
  | 'countdown'
  | 'vote'
  | 'result-mice-win'
  | 'result-thief-win'
  | 'result-fled'
  | 'result-goat-win';

const playBananaThiefSound = createSoundBoard<BananaThiefSound>({
  ready: { src: '/sounds/banana-thief/ready.wav', volume: 0.8 },
  night: { src: '/sounds/banana-thief/night.wav', volume: 0.85 },
  'hour-1': { src: '/sounds/banana-thief/hour-1.wav', volume: 0.85 },
  'hour-2': { src: '/sounds/banana-thief/hour-2.wav', volume: 0.85 },
  'hour-3': { src: '/sounds/banana-thief/hour-3.wav', volume: 0.85 },
  'hour-4': { src: '/sounds/banana-thief/hour-4.wav', volume: 0.85 },
  'hour-5': { src: '/sounds/banana-thief/hour-5.wav', volume: 0.85 },
  'hour-6': { src: '/sounds/banana-thief/hour-6.wav', volume: 0.85 },
  'hour-end-1': { src: '/sounds/banana-thief/hour-end-1.wav', volume: 0.8 },
  'hour-end-2': { src: '/sounds/banana-thief/hour-end-2.wav', volume: 0.8 },
  'hour-end-3': { src: '/sounds/banana-thief/hour-end-3.wav', volume: 0.8 },
  'hour-end-4': { src: '/sounds/banana-thief/hour-end-4.wav', volume: 0.8 },
  'hour-end-5': { src: '/sounds/banana-thief/hour-end-5.wav', volume: 0.8 },
  'hour-end-6': { src: '/sounds/banana-thief/hour-end-6.wav', volume: 0.8 },
  'choose-follower': { src: '/sounds/banana-thief/choose-follower.wav', volume: 0.85 },
  'choose-follower-end': { src: '/sounds/banana-thief/choose-follower-end.wav', volume: 0.85 },
  morning: { src: '/sounds/banana-thief/morning.wav', volume: 0.85 },
  countdown: { src: '/sounds/banana-thief/countdown.wav', volume: 0.8 },
  vote: { src: '/sounds/banana-thief/vote.wav', volume: 0.85 },
  'result-mice-win': { src: '/sounds/banana-thief/result-mice-win.wav', volume: 0.85 },
  'result-thief-win': { src: '/sounds/banana-thief/result-thief-win.wav', volume: 0.85 },
  'result-fled': { src: '/sounds/banana-thief/result-fled.wav', volume: 0.85 },
  'result-goat-win': { src: '/sounds/banana-thief/result-goat-win.wav', volume: 0.85 },
});

/** Fire-and-forget Banana Thief sound board that no-ops when muted. */
export function useBananaThiefSounds(enabled: boolean) {
  return useCallback(
    (name: BananaThiefSound) => {
      if (enabled) playBananaThiefSound(name);
    },
    [enabled],
  );
}
