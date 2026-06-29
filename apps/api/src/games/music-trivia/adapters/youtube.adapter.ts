import { MusicSourceType } from '@repo/types';
import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import YTMusic from 'ytmusic-api';

interface YTMusicSong {
  name?: string;
  artist?: { name?: string };
  videoId?: string;
  duration?: number;
  thumbnails?: { url: string }[];
}

export class YouTubeAdapter implements MusicSourceAdapter {
  readonly sourceType: MusicSourceType = 'YOUTUBE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ytmusic: any;
  private initialized = false;

  constructor() {
    this.ytmusic = new YTMusic();
  }

  async init() {
    if (!this.initialized) {
      await this.ytmusic.initialize();
      this.initialized = true;
    }
  }

  async search(
    query: string,
    limit: number,
    options?: MusicSourceSearchOptions,
  ): Promise<TrackResult[]> {
    await this.init();
    let searchQuery = query;

    if (options?.yearStart || options?.yearEnd) {
      const start = options.yearStart || 1900;
      const end = options.yearEnd || new Date().getFullYear();
      searchQuery += ` ${start}-${end}`;
    }

    console.log(`[YouTubeAdapter] Searching YT Music for: ${searchQuery} (Limit: ${limit})`);

    try {
      // Use searchSongs to ensure we only get songs (which inherently excludes shorts and most non-music videos)
      const songs = await this.ytmusic.searchSongs(searchQuery);

      if (!songs || songs.length === 0) {
        console.warn('[YouTubeAdapter] No songs found in YouTube Music:', searchQuery);
        return [];
      }

      const results = songs.slice(0, limit);
      console.log(`[YouTubeAdapter] Search completed. Returning ${results.length} songs.`);

      return results.map((item: YTMusicSong) => {
        const title = item.name || 'Unknown Title';
        const artist = item.artist?.name || 'Unknown Artist';
        const videoId = item.videoId;

        let artworkUrl = '';
        if (item.thumbnails && item.thumbnails.length > 0) {
          // get highest res thumbnail
          artworkUrl = item.thumbnails.at(-1)?.url || '';
        }

        return {
          id: videoId || Math.random().toString(),
          title: title,
          artist: artist,
          previewUrl: videoId || '',
          durationMs: (item.duration || 180) * 1000,
          artworkUrl: artworkUrl,
          trackViewUrl: `https://music.youtube.com/watch?v=${videoId}`,
          sourceType: this.sourceType,
        };
      });
    } catch (error) {
      console.error('[YouTubeAdapter] Search error:', error);
      return [];
    }
  }
}
