import { MusicSourceType } from '@repo/types';
export interface TrackResult {
    id: string;
    title: string;
    artist: string;
    previewUrl: string;
    durationMs: number;
    artworkUrl?: string;
    trackViewUrl?: string;
    sourceType: MusicSourceType;
    album?: string;
    releaseYear?: string;
}
export interface MusicSourceSearchOptions {
    country?: string;
    attribute?: string;
    yearStart?: number;
    yearEnd?: number;
}
export interface MusicSourceAdapter {
    readonly sourceType: MusicSourceType;
    search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]>;
}
export declare class MusicSourceFactory {
    private adapters;
    register(adapter: MusicSourceAdapter): void;
    get(type: MusicSourceType): MusicSourceAdapter;
    has(type: MusicSourceType): boolean;
    getAvailableTypes(): MusicSourceType[];
}
