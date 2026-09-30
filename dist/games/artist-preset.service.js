"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ArtistPresetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtistPresetService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@repo/database");
const music_trivia_levels_1 = require("./music-trivia/music-trivia-levels");
let ArtistPresetService = ArtistPresetService_1 = class ArtistPresetService {
    constructor() {
        this.logger = new common_1.Logger(ArtistPresetService_1.name);
    }
    async listPresets(includeDisabled) {
        const artists = await database_1.prisma.artistPreset.findMany({
            ...(includeDisabled ? {} : { where: { enabled: true } }),
            orderBy: { name: 'asc' },
            select: { id: true, name: true, enabled: true, tracks: { select: { viewCount: true } } },
        });
        return artists.map((artist) => {
            const trackCounts = { easy: 0, medium: 0, hard: 0, total: artist.tracks.length };
            for (const track of artist.tracks) {
                trackCounts[(0, music_trivia_levels_1.levelOfViewCount)(track.viewCount).toLowerCase()] += 1;
            }
            return {
                id: artist.id,
                name: artist.name,
                enabled: artist.enabled,
                trackCounts,
            };
        });
    }
    async setEnabled(artistId, enabled) {
        await database_1.prisma.artistPreset.update({
            where: { id: artistId },
            data: { enabled },
        });
    }
    async deleteArtist(artistId) {
        await database_1.prisma.artistPreset.delete({
            where: { id: artistId },
        });
    }
    async getCatalog(artistId) {
        const artist = await database_1.prisma.artistPreset.findUnique({
            where: { id: artistId },
            include: { tracks: { select: this.catalogTrackSelect() } },
        });
        if (!artist || !artist.enabled || artist.tracks.length === 0)
            return null;
        return {
            id: artist.id,
            name: artist.name,
            tracks: artist.tracks.map((track) => ({
                videoId: track.videoId,
                title: track.title,
                viewCount: track.viewCount,
                releaseYear: track.releaseYear,
                durationMs: track.durationMs,
                thumbnailUrl: track.thumbnailUrl,
            })),
        };
    }
    catalogTrackSelect() {
        return {
            videoId: true,
            title: true,
            viewCount: true,
            releaseYear: true,
            durationMs: true,
            thumbnailUrl: true,
        };
    }
};
exports.ArtistPresetService = ArtistPresetService;
exports.ArtistPresetService = ArtistPresetService = ArtistPresetService_1 = __decorate([
    (0, common_1.Injectable)()
], ArtistPresetService);
//# sourceMappingURL=artist-preset.service.js.map