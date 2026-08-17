"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoundcloudAdapter = void 0;
const soundcloud_downloader_1 = require("soundcloud-downloader");
function isSoundCloudTrack(value) {
    if (!value || typeof value !== 'object')
        return false;
    const item = value;
    return (item.kind === 'track' &&
        (typeof item.id === 'string' || typeof item.id === 'number') &&
        typeof item.permalink_url === 'string');
}
class SoundcloudAdapter {
    constructor() {
        this.sourceType = 'SOUNDCLOUD';
    }
    async search(query, limit) {
        try {
            const results = await soundcloud_downloader_1.default.search({
                query,
                resourceType: 'tracks',
                limit: 50,
            });
            if (!results.collection)
                return [];
            const collection = results.collection;
            const tracks = collection.filter(isSoundCloudTrack).map((item) => ({
                id: String(item.id),
                title: item.title || 'Unknown',
                artist: item.user?.username || 'Unknown',
                previewUrl: item.permalink_url,
                durationMs: item.duration || 30000,
                artworkUrl: item.artwork_url ? item.artwork_url.replace('large', 't500x500') : undefined,
                trackViewUrl: item.permalink_url,
                sourceType: 'SOUNDCLOUD',
            }));
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
            return tracks.slice(0, limit);
        }
        catch (error) {
            console.error('SoundCloud search error:', error);
            throw new Error('Failed to search SoundCloud');
        }
    }
}
exports.SoundcloudAdapter = SoundcloudAdapter;
//# sourceMappingURL=soundcloud.adapter.js.map