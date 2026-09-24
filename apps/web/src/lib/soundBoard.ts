export interface SoundSpec {
  src: string;
  volume?: number;
}

export type SoundPlayer<S extends string> = (name: S) => void;

/**
 * Builds a fire-and-forget sound board over an audio asset map. Clips are
 * preloaded lazily on first use; overlapping plays clone the element so rapid
 * cues never cut each other off. Playback failures (autoplay policy, missing
 * file) are non-fatal.
 */
export function createSoundBoard<S extends string>(specs: Record<S, SoundSpec>): SoundPlayer<S> {
  const loaded = new Map<S, HTMLAudioElement>();
  return (name: S) => {
    try {
      let base = loaded.get(name);
      if (!base) {
        base = new Audio(specs[name].src);
        base.preload = 'auto';
        base.volume = specs[name].volume ?? 0.5;
        loaded.set(name, base);
      }
      const clip = base.cloneNode(true) as HTMLAudioElement;
      clip.volume = base.volume;
      void clip.play().catch(() => {
        // autoplay policy or missing file — non-fatal
      });
    } catch {
      // non-fatal
    }
  };
}
