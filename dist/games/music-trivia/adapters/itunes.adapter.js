"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITunesAdapter = void 0;
class ITunesAdapter {
    constructor() {
        this.sourceType = 'ITUNES';
    }
    async search(query, limit, options) {
        const params = new URLSearchParams({
            term: query,
            media: 'music',
            entity: 'song',
            limit: '200',
        });
        if (options?.country) {
            params.append('country', options.country);
        }
        if (options?.attribute) {
            params.append('attribute', options.attribute);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let data;
        try {
            const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`iTunes API error: ${response.status} ${response.statusText}`);
            }
            data = await response.json();
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('iTunes API request timed out after 5 seconds');
            }
            throw new Error(`Failed to fetch from iTunes: ${error.message}`);
        }
        finally {
            clearTimeout(timeoutId);
        }
        const tracks = (data.results || [])
            .filter((item) => {
            if (!item.previewUrl || item.kind !== 'song')
                return false;
            if (options?.yearStart || options?.yearEnd) {
                if (!item.releaseDate)
                    return false;
                const year = new Date(item.releaseDate).getFullYear();
                if (options.yearStart && year < options.yearStart)
                    return false;
                if (options.yearEnd && year > options.yearEnd)
                    return false;
            }
            return true;
        })
            .map((item) => ({
            id: String(item.trackId),
            title: item.trackName || 'Unknown',
            artist: item.artistName || 'Unknown',
            previewUrl: item.previewUrl,
            durationMs: item.trackTimeMillis || 30000,
            artworkUrl: item.artworkUrl100
                ? item.artworkUrl100.replace('100x100', '300x300')
                : undefined,
            trackViewUrl: item.trackViewUrl,
            sourceType: 'ITUNES',
            album: item.collectionName,
            releaseYear: item.releaseDate
                ? new Date(item.releaseDate).getFullYear().toString()
                : undefined,
        }));
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        return tracks.slice(0, limit);
    }
}
exports.ITunesAdapter = ITunesAdapter;
//# sourceMappingURL=itunes.adapter.js.map