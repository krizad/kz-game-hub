import { TrackResult, MusicSourceAdapter, MusicSourceSearchOptions } from '../music-source-adapter';
import { MusicSourceType } from '@repo/types';
export interface SpotifyItem {
    id: string;
    name: string;
    artists: {
        name: string;
    }[];
    preview_url?: string;
    album?: {
        images?: {
            url: string;
        }[];
    };
    external_urls?: {
        spotify?: string;
    };
}
export declare class SpotifyAdapter implements MusicSourceAdapter {
    readonly sourceType: MusicSourceType;
    private getAccessToken;
    search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]>;
}
