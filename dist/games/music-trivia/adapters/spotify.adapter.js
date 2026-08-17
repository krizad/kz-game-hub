"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyAdapter = void 0;
class SpotifyAdapter {
    constructor() {
        this.sourceType = 'SPOTIFY';
    }
    async getAccessToken() {
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
    async search(query, limit, options) {
        const token = await this.getAccessToken();
        const fetchLimit = limit * 3;
        let baseQuery = query;
        if (options?.yearStart || options?.yearEnd) {
            const start = options.yearStart || 1900;
            const end = options.yearEnd || new Date().getFullYear();
            baseQuery += ` year:${start}-${end}`;
        }
        let searchQuery = baseQuery;
        if (options?.attribute === 'artistTerm') {
            searchQuery = `artist:${baseQuery}`;
        }
        else if (options?.attribute === 'albumTerm') {
            searchQuery = `album:${baseQuery}`;
        }
        else if (options?.attribute === 'songTerm') {
            searchQuery = `track:${baseQuery}`;
        }
        const url = new URL('https://api.spotify.com/v1/search');
        url.searchParams.append('q', searchQuery);
        url.searchParams.append('type', 'track');
        url.searchParams.append('limit', fetchLimit.toString());
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
        const validTracks = tracks.filter((t) => t.preview_url !== null && t.preview_url !== undefined);
        console.log(`[SpotifyAdapter] ${validTracks.length} tracks have preview URLs.`);
        return validTracks.slice(0, limit).map((t) => ({
            id: t.id,
            title: t.name,
            artist: t.artists.map((a) => a.name).join(', '),
            previewUrl: t.preview_url,
            durationMs: 30000,
            artworkUrl: t.album?.images?.[0]?.url,
            trackViewUrl: t.external_urls?.spotify,
            sourceType: this.sourceType,
        }));
    }
}
exports.SpotifyAdapter = SpotifyAdapter;
//# sourceMappingURL=spotify.adapter.js.map