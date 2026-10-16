import { RoomState } from '@repo/types';
export declare function buildDogRelayResultRows(room: RoomState): {
    playerName: string;
    score: number;
    rank: number;
}[];
