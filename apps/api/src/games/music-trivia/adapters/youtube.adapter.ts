import { TrackResult, MusicSourceAdapter, MusicSourceSearchOptions } from '../music-source-adapter';
import { MusicSourceType } from '@repo/types';

export interface YouTubeItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      high?: { url: string };
      default?: { url: string };
    };
  };
}

export class YouTubeAdapter implements MusicSourceAdapter {
  readonly sourceType: MusicSourceType = 'YOUTUBE';

  async search(
    query: string,
    limit: number,
    options?: MusicSourceSearchOptions,
  ): Promise<TrackResult[]> {
    let searchQuery = query;

    // Add negative keywords to avoid compilations (user requested to avoid compilations > 10 mins etc)
    const negativeKeywords = '-compilation -"full album" -"1 hour" -"2 hours" -mix';

    if (options?.attribute === 'artistTerm') {
      searchQuery = `${query} official audio ${negativeKeywords}`;
    } else if (options?.attribute === 'songTerm') {
      searchQuery = `${query} official audio ${negativeKeywords}`;
    } else if (options?.attribute === 'albumTerm') {
      searchQuery = `${query} album`;
    } else {
      searchQuery = `${query} ${negativeKeywords}`;
    }

    console.log(`[YouTubeAdapter] Searching for: ${searchQuery} (Limit: ${limit})`);

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('[YouTubeAdapter] Missing YOUTUBE_API_KEY in environment variables.');
      return [];
    }

    try {
      // Use YouTube Data API v3 instead of youtube-sr
      // videoCategoryId=10 ensures we get music content
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=${limit}&q=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.error('[YouTubeAdapter] No items in response:', data);
        return [];
      }

      console.log(`[YouTubeAdapter] Search completed. Found ${data.items.length} videos.`);

      return data.items.map((item: YouTubeItem) => {
        // Decode HTML entities in title (YouTube API returns encoded titles like &#39;)
        let title = item.snippet?.title || 'Unknown Title';
        title = title.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');

        const artist = item.snippet?.channelTitle || 'Unknown Artist';
        const videoId = item.id?.videoId;

        return {
          id: videoId || Math.random().toString(),
          title: title,
          artist: artist,
          previewUrl: videoId || '',
          durationMs: 600000, // Default to a large duration since search endpoint doesn't return duration
          artworkUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
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
