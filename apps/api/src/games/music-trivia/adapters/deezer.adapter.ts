import { MusicSourceAdapter, TrackResult } from '../music-source-adapter';

/**
 * Deezer Search API adapter.
 * Uses the public Deezer API — no API key required.
 * Filters tracks that have a preview available.
 */
export interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  duration: number;
  artist: {
    name: string;
  };
  album: {
    title: string;
    cover_xl: string;
  };
}

export class DeezerAdapter implements MusicSourceAdapter {
  readonly sourceType = 'DEEZER' as const;

  async search(query: string, limit: number): Promise<TrackResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: '50', // fetch more to allow randomization
    });

    const response = await fetch(`https://api.deezer.com/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const tracks: TrackResult[] = (data.data || [])
      .filter((item: DeezerTrack) => {
        if (!item.preview) return false;
        // Note: Deezer search API doesn't cleanly filter by year in standard query easily
        // We'd have to parse release dates if we fetched full track info, but search doesn't return release dates usually.
        return true;
      })
      .map((item: DeezerTrack) => ({
        id: String(item.id),
        title: item.title || 'Unknown',
        artist: item.artist?.name || 'Unknown',
        previewUrl: item.preview, // direct .mp3 stream
        durationMs: 30000, // Deezer previews are exactly 30 seconds
        artworkUrl: item.album?.cover_xl,
        trackViewUrl: `https://www.deezer.com/track/${item.id}`,
        sourceType: 'DEEZER' as const,
        album: item.album?.title,
      }));

    // Randomize the tracks (Fisher-Yates shuffle)
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    return tracks.slice(0, limit);
  }
}
