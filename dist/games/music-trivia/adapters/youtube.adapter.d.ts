import { MusicSourceType } from '@repo/types';
import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';
export declare class YouTubeAdapter implements MusicSourceAdapter {
    readonly sourceType: MusicSourceType;
    init(): Promise<void>;
    search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]>;
}
