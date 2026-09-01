import { MusicSourceType } from '@repo/types';
import { MusicSourceAdapter, MusicSourceSearchOptions, TrackResult } from '../music-source-adapter';
export declare class YouTubeAdapter implements MusicSourceAdapter {
    readonly sourceType: MusicSourceType;
    private innertube;
    private creating;
    init(): Promise<void>;
    private getInnertube;
    search(query: string, limit: number, options?: MusicSourceSearchOptions): Promise<TrackResult[]>;
}
