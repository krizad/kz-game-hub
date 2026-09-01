import type { Innertube, YTNodes } from 'youtubei.js';
import { MusicSourceType } from '@repo/types';
import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';

const MAX_DURATION_MS = 10 * 60 * 1000;
const DEFAULT_DURATION_MS = 180000;

export class YouTubeAdapter implements MusicSourceAdapter {
  readonly sourceType: MusicSourceType = 'YOUTUBE';

  private innertube: Innertube | null = null;
  private creating: Promise<Innertube> | null = null;

  async init() {
    await this.getInnertube();
  }

  /**
   * Lazily create the InnerTube session once and memoize it so repeated
   * searches reuse the same session (no API key / quota required).
   */
  private async getInnertube(): Promise<Innertube> {
    if (this.innertube) return this.innertube;
    if (!this.creating) {
      // Dynamic import keeps the ESM-only package out of module-eval, so the
      // adapter (and its tests) load cleanly under CommonJS.
      const { Innertube } = await import('youtubei.js');
      this.creating = Innertube.create().then((yt) => {
        this.innertube = yt;
        return yt;
      });
    }
    return this.creating;
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
      const yt = await this.getInnertube();
      const search = await yt.search(searchQuery, { type: 'video' });

      const videos = search.results.filter((r): r is YTNodes.Video => r.type === 'Video');

      if (videos.length === 0) {
        console.warn('[YouTubeAdapter] No videos found on YouTube:', searchQuery);
        return [];
      }

      // Filter out overly long videos (mixes, full albums) - keep it under 10 minutes
      let results = videos.filter((video) => {
        const seconds = video.duration?.seconds;
        return !seconds || seconds * 1000 < MAX_DURATION_MS;
      });

      // If filtering removed everything, just fallback to whatever we found
      if (results.length === 0) {
        results = videos;
      }

      results = results.slice(0, limit);
      console.log(`[YouTubeAdapter] Search completed. Returning ${results.length} videos.`);

      return results.map((item) => {
        const title = item.title?.toString() || 'Unknown Title';
        const artist = item.author?.name || 'Unknown Artist';
        const videoId = item.video_id;

        const thumbnail = item.best_thumbnail || item.thumbnails?.[0];

        return {
          id: videoId || Math.random().toString(),
          title: title,
          artist: artist,
          previewUrl: videoId || '',
          durationMs: item.duration?.seconds ? item.duration.seconds * 1000 : DEFAULT_DURATION_MS,
          artworkUrl: thumbnail?.url,
          trackViewUrl: `https://www.youtube.com/watch?v=${videoId}`,
          sourceType: this.sourceType,
        };
      });
    } catch (error) {
      console.error('[YouTubeAdapter] Search error:', error);
      return [];
    }
  }
}
