import { MusicSourceType } from '@repo/types';
import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YouTube = require('youtube-sr').default;

export class YouTubeAdapter implements MusicSourceAdapter {
  readonly sourceType: MusicSourceType = 'YOUTUBE';

  async init() {
    // youtube-sr does not require initialization
  }

  async search(
    query: string,
    limit: number,
    options?: MusicSourceSearchOptions,
  ): Promise<TrackResult[]> {
    let searchQuery = query;

    if (options?.yearStart || options?.yearEnd) {
      const start = options.yearStart || 1900;
      const end = options.yearEnd || new Date().getFullYear();
      searchQuery += ` ${start}-${end}`;
    }

    console.log(`[YouTubeAdapter] Searching YouTube for: ${searchQuery} (Limit: ${limit})`);

    try {
      // Search for videos. We append 'official audio' or 'lyrics' optionally but just query is fine
      // youtube-sr handles normal youtube search which yields highly embeddable videos
      const videos = await YouTube.search(searchQuery, { type: 'video', limit: limit + 5 });

      if (!videos || videos.length === 0) {
        console.warn('[YouTubeAdapter] No videos found on YouTube:', searchQuery);
        return [];
      }

      // Filter out overly long videos (mixes, full albums) - keep it under 10 minutes
      let results = videos.filter((v: any) => v.duration && v.duration < 600000);

      // If filtering removed everything, just fallback to whatever we found
      if (results.length === 0) {
        results = videos;
      }

      results = results.slice(0, limit);
      console.log(`[YouTubeAdapter] Search completed. Returning ${results.length} videos.`);

      return results.map((item: any) => {
        const title = item.title || 'Unknown Title';
        const artist = item.channel?.name || 'Unknown Artist';
        const videoId = item.id;

        let artworkUrl = '';
        if (item.thumbnail && item.thumbnail.url) {
          artworkUrl = item.thumbnail.url;
        }

        return {
          id: videoId || Math.random().toString(),
          title: title,
          artist: artist,
          previewUrl: videoId || '',
          durationMs: item.duration || 180000,
          artworkUrl: artworkUrl,
          trackViewUrl: item.url || `https://www.youtube.com/watch?v=${videoId}`,
          sourceType: this.sourceType,
        };
      });
    } catch (error) {
      console.error('[YouTubeAdapter] Search error:', error);
      return [];
    }
  }
}
