"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeezerAdapter = void 0;
class DeezerAdapter {
    constructor() {
        this.sourceType = 'DEEZER';
    }
    async search(query, limit) {
        const params = new URLSearchParams({
            q: query,
            limit: '50',
        });
        const response = await fetch(`https://api.deezer.com/search?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Deezer API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const tracks = (data.data || [])
            .filter((item) => {
            if (!item.preview)
                return false;
            return true;
        })
            .map((item) => ({
            id: String(item.id),
            title: item.title || 'Unknown',
            artist: item.artist?.name || 'Unknown',
            previewUrl: item.preview,
            durationMs: 30000,
            artworkUrl: item.album?.cover_xl,
            trackViewUrl: `https://www.deezer.com/track/${item.id}`,
            sourceType: 'DEEZER',
            album: item.album?.title,
        }));
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        return tracks.slice(0, limit);
    }
}
exports.DeezerAdapter = DeezerAdapter;
//# sourceMappingURL=deezer.adapter.js.map