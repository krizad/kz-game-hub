import { audioManager } from './audioManager';

export interface SoundSpec {
  src: string;
  volume?: number;
}

export type SoundPlayer<S extends string> = (name: S) => void;

/**
 * Builds a fire-and-forget sound board over an audio asset map.
 * Integrates with audioManager singleton bus to respect global mute and volume sliders.
 * Reuses audio elements safely to prevent DOM memory leaks on mobile browsers.
 */
export function createSoundBoard<S extends string>(specs: Record<S, SoundSpec>): SoundPlayer<S> {
  const loaded = new Map<S, HTMLAudioElement[]>();

  return (name: S) => {
    if (typeof window === 'undefined' || !audioManager.isEnabled()) {
      return;
    }

    try {
      let pool = loaded.get(name);
      if (!pool) {
        pool = [];
        loaded.set(name, pool);
      }

      // Reuse an idle audio element from the pool or create a new one (max 4 per cue)
      let clip = pool.find((el) => el.paused || el.ended);
      if (!clip) {
        if (pool.length < 4) {
          clip = new Audio(specs[name].src);
          clip.preload = 'auto';
          pool.push(clip);
        } else {
          clip = pool[0];
          clip.currentTime = 0;
        }
      }

      const masterVol = audioManager.getVolume();
      const specVol = specs[name].volume ?? 0.5;
      clip.volume = Math.max(0, Math.min(1, specVol * masterVol));

      void clip.play().catch(() => {
        // Autoplay policy or missing file — non-fatal
      });
    } catch {
      // non-fatal
    }
  };
}
