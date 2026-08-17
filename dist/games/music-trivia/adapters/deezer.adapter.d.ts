import { MusicSourceAdapter, TrackResult } from '../music-source-adapter';
export interface DeezerTrack {
    id: number;
    title: string;
    preview: string;
    duration: number;
    artist: {
        name: string;
    };
    album: {
        title: string;
        cover_xl: string;
    };
}
export declare class DeezerAdapter implements MusicSourceAdapter {
    readonly sourceType: "DEEZER";
    search(query: string, limit: number): Promise<TrackResult[]>;
}
