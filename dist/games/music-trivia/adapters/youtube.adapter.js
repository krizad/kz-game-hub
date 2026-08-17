"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeAdapter = void 0;
const YouTube = require('youtube-sr').default;
class YouTubeAdapter {
    constructor() {
        this.sourceType = 'YOUTUBE';
    }
    async init() {
    }
    async search(query, limit, options) {
        let searchQuery = query;
        if (options?.yearStart || options?.yearEnd) {
            const start = options.yearStart || 1900;
            const end = options.yearEnd || new Date().getFullYear();
            searchQuery += ` ${start}-${end}`;
        }
        console.log(`[YouTubeAdapter] Searching YouTube for: ${searchQuery} (Limit: ${limit})`);
        try {
            const videos = await YouTube.search(searchQuery, {
                type: 'video',
                limit: limit + 5,
            });
            if (!videos || videos.length === 0) {
                console.warn('[YouTubeAdapter] No videos found on YouTube:', searchQuery);
                return [];
            }
            let results = videos.filter((video) => video.duration && video.duration < 600000);
            if (results.length === 0) {
                results = videos;
            }
            results = results.slice(0, limit);
            console.log(`[YouTubeAdapter] Search completed. Returning ${results.length} videos.`);
            return results.map((item) => {
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
        }
        catch (error) {
            console.error('[YouTubeAdapter] Search error:', error);
            return [];
        }
    }
}
exports.YouTubeAdapter = YouTubeAdapter;
//# sourceMappingURL=youtube.adapter.js.map