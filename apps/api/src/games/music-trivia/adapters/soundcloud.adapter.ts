import scdl from 'soundcloud-downloader';
import { MusicSourceAdapter, TrackResult } from '../music-source-adapter';

interface SoundCloudTrack {
  id: string | number;
  kind: 'track';
  title?: string;
  permalink_url: string;
  duration?: number;
  artwork_url?: string;
  user?: { username?: string };
}

function isSoundCloudTrack(value: unknown): value is SoundCloudTrack {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    item.kind === 'track' &&
    (typeof item.id === 'string' || typeof item.id === 'number') &&
    typeof item.permalink_url === 'string'
  );
}

/**
 * SoundCloud Search API adapter.
 * Uses soundcloud-downloader to search tracks.
 */
export class SoundcloudAdapter implements MusicSourceAdapter {
  readonly sourceType = 'SOUNDCLOUD' as const;

  async search(query: string, limit: number): Promise<TrackResult[]> {
    try {
      const results = await scdl.search({
        query,
        resourceType: 'tracks',
        limit: 50, // fetch more for randomization
      });

      if (!results.collection) return [];

      const collection: unknown[] = results.collection;
      const tracks: TrackResult[] = collection.filter(isSoundCloudTrack).map((item) => ({
        id: String(item.id),
        title: item.title || 'Unknown',
        artist: item.user?.username || 'Unknown',
        previewUrl: item.permalink_url,
        durationMs: item.duration || 30000,
        artworkUrl: item.artwork_url ? item.artwork_url.replace('large', 't500x500') : undefined,
        trackViewUrl: item.permalink_url,
        sourceType: 'SOUNDCLOUD' as const,
      }));

      // Randomize the tracks (Fisher-Yates shuffle)
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }

      return tracks.slice(0, limit);
    } catch (error) {
      console.error('SoundCloud search error:', error);
      throw new Error('Failed to search SoundCloud');
    }
  }
}
