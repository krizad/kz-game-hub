import { MusicSourceAdapter, TrackResult } from '../music-source-adapter';
export declare class SoundcloudAdapter implements MusicSourceAdapter {
    readonly sourceType: "SOUNDCLOUD";
    search(query: string, limit: number): Promise<TrackResult[]>;
}
