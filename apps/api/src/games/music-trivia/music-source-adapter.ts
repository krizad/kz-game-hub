import { MusicSourceType } from '@repo/types';

/**
 * Standard result from any music source adapter.
 * title + artist are SECRET — only stored server-side, never broadcast.
 */
export interface TrackResult {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  durationMs: number;
  artworkUrl?: string;
  trackViewUrl?: string;
  sourceType: MusicSourceType;
  album?: string;
  releaseYear?: string;
}

export interface MusicSourceSearchOptions {
  country?: string;
  attribute?: string;
  yearStart?: number;
  yearEnd?: number;
}

/**
 * Interface that every music source adapter must implement.
 * To add a new source: create a class implementing this interface,
 * then register it in the MusicSourceFactory.
 */
export interface MusicSourceAdapter {
  readonly sourceType: MusicSourceType;
  search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]>;
}

/**
 * Factory for creating music source adapters.
 * Provides a clean extension point — register new adapters without
 * touching game logic.
 */
export class MusicSourceFactory {
  private adapters = new Map<MusicSourceType, MusicSourceAdapter>();

  register(adapter: MusicSourceAdapter): void {
    this.adapters.set(adapter.sourceType, adapter);
  }

  get(type: MusicSourceType): MusicSourceAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`No music source adapter registered for type: ${type}`);
    }
    return adapter;
  }

  has(type: MusicSourceType): boolean {
    return this.adapters.has(type);
  }

  getAvailableTypes(): MusicSourceType[] {
    return Array.from(this.adapters.keys());
  }
}
