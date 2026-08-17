import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';
export interface ItunesItem {
    trackId?: number;
    trackName?: string;
    artistName?: string;
    previewUrl?: string;
    trackTimeMillis?: number;
    artworkUrl100?: string;
    trackViewUrl?: string;
    kind?: string;
    releaseDate?: string;
    collectionName?: string;
}
export declare class ITunesAdapter implements MusicSourceAdapter {
    readonly sourceType: "ITUNES";
    search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]>;
}
