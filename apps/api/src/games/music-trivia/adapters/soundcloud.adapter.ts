import scdl from 'soundcloud-downloader';
import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';

/**
 * SoundCloud Search API adapter.
 * Uses soundcloud-downloader to search tracks.
 */
export class SoundcloudAdapter implements MusicSourceAdapter {
  readonly sourceType = 'SOUNDCLOUD' as const;

  async search(
    query: string,
    limit: number,
    options?: MusicSourceSearchOptions,
  ): Promise<TrackResult[]> {
    try {
      const results = await scdl.search({
        query,
        resourceType: 'tracks',
        limit: 50, // fetch more for randomization
      });

      if (!results.collection) return [];

      const tracks: TrackResult[] = results.collection
        .filter((item: any) => item.kind === 'track' && item.permalink_url)
        .map((item: any) => ({
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
