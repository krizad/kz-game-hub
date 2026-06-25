import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';

/**
 * iTunes Search API adapter.
 * Uses the public iTunes Search API — no API key required.
 * Filters tracks that have a previewUrl available.
 *
 * @see https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */
export interface ItunesItem {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  trackViewUrl?: string;
  kind?: string;
}

export class ITunesAdapter implements MusicSourceAdapter {
  readonly sourceType = 'ITUNES' as const;

  async search(
    query: string,
    limit: number,
    options?: MusicSourceSearchOptions,
  ): Promise<TrackResult[]> {
    const params = new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'song',
      limit: '200', // fetch up to 200 to allow randomization
    });

    if (options?.country) {
      params.append('country', options.country);
    }
    if (options?.attribute) {
      params.append('attribute', options.attribute);
    }

    const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const tracks: TrackResult[] = (data.results || [])
      .filter((item: ItunesItem) => item.previewUrl && item.kind === 'song')
      .map((item: ItunesItem) => ({
        id: String(item.trackId),
        title: item.trackName || 'Unknown',
        artist: item.artistName || 'Unknown',
        previewUrl: item.previewUrl,
        durationMs: item.trackTimeMillis || 30000,
        artworkUrl: item.artworkUrl100
          ? item.artworkUrl100.replace('100x100', '300x300')
          : undefined,
        trackViewUrl: item.trackViewUrl,
        sourceType: 'ITUNES' as const,
      }));

    // Randomize the tracks (Fisher-Yates shuffle)
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    return tracks.slice(0, limit);
  }
}
