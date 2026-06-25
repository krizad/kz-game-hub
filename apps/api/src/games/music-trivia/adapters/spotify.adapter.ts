import { TrackResult, MusicSourceAdapter, MusicSourceSearchOptions } from '../music-source-adapter';
import { MusicSourceType } from '@repo/types';

export interface SpotifyItem {
  id: string;
  name: string;
  artists: { name: string }[];
  preview_url?: string;
  album?: { images?: { url: string }[] };
  external_urls?: { spotify?: string };
}

export class SpotifyAdapter implements MusicSourceAdapter {
  readonly sourceType: MusicSourceType = 'SPOTIFY';

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required in .env');
    }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    console.log('[SpotifyAdapter] Requesting Access Token...');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authString}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      console.error('[SpotifyAdapter] Auth failed:', response.status, response.statusText);
      throw new Error(`Spotify Auth Error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SpotifyAdapter] Access Token received.');
    return data.access_token;
  }

  async search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]> {
    const token = await this.getAccessToken();

    // Default to fetching more results because we need to filter out tracks without preview URLs
    const fetchLimit = limit * 3;
    
    // Construct search URL
    let searchQuery = encodeURIComponent(query);
    if (options?.attribute === 'artistTerm') {
      searchQuery = encodeURIComponent(`artist:${query}`);
    } else if (options?.attribute === 'albumTerm') {
      searchQuery = encodeURIComponent(`album:${query}`);
    } else if (options?.attribute === 'songTerm') {
      searchQuery = encodeURIComponent(`track:${query}`);
    }

    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.append('q', searchQuery);
    url.searchParams.append('type', 'track');
    url.searchParams.append('limit', fetchLimit.toString());
    
    // Always use the configured country or default to TH to get playable preview URLs
    const market = options?.country || 'TH';
    url.searchParams.append('market', market);

    console.log(`[SpotifyAdapter] Searching for: ${searchQuery} (Market: ${market}, Limit: ${fetchLimit})`);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SpotifyAdapter] Search API failed:', response.status, response.statusText, errorText);
      throw new Error(`Spotify API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const tracks = data.tracks?.items || [];
    console.log(`[SpotifyAdapter] Found ${tracks.length} raw tracks from Spotify API.`);

    // Filter tracks to ONLY include those with a preview URL
    const validTracks = tracks.filter((t: SpotifyItem) => t.preview_url !== null && t.preview_url !== undefined);
    console.log(`[SpotifyAdapter] ${validTracks.length} tracks have preview URLs.`);

    return validTracks.slice(0, limit).map((t: SpotifyItem) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map((a: { name: string }) => a.name).join(', '),
      previewUrl: t.preview_url,
      durationMs: 30000, // Spotify previews are always 30 seconds
      artworkUrl: t.album?.images?.[0]?.url,
      trackViewUrl: t.external_urls?.spotify,
      sourceType: this.sourceType,
    }));
  }
}
