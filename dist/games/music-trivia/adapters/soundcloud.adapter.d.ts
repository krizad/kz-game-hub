import { MusicSourceAdapter, TrackResult } from '../music-source-adapter';
export declare class SoundcloudAdapter implements MusicSourceAdapter {
    readonly sourceType: "SOUNDCLOUD";
    private readonly logger;
    search(query: string, limit: number): Promise<TrackResult[]>;
}
