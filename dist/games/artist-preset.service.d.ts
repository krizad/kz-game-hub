import { ArtistPresetSummary } from '@repo/types';
export interface ArtistCatalogTrack {
    videoId: string;
    title: string;
    viewCount: number;
    releaseYear: number | null;
    durationMs: number;
    thumbnailUrl: string | null;
}
export interface ArtistCatalog {
    id: string;
    name: string;
    tracks: ArtistCatalogTrack[];
}
export declare class ArtistPresetService {
    private readonly logger;
    listPresets(includeDisabled: boolean): Promise<ArtistPresetSummary[]>;
    setEnabled(artistId: string, enabled: boolean): Promise<void>;
    deleteArtist(artistId: string): Promise<void>;
    getCatalog(artistId: string): Promise<ArtistCatalog | null>;
    private catalogTrackSelect;
}
