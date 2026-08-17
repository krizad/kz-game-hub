import { RoomState } from '@repo/types';
export declare class TheMindService {
    private shuffleArray;
    private getMaxLevel;
    startGame(room: RoomState, requesterId: string): RoomState | null;
    private dealCards;
    ready(room: RoomState, clientId: string): RoomState | null;
    playCard(room: RoomState, clientId: string, card: number, pile?: 'UP' | 'DOWN'): RoomState | null;
    nextLevel(room: RoomState, clientId: string): RoomState | null;
    proposeShuriken(room: RoomState, clientId: string): RoomState | null;
    voteShuriken(room: RoomState, clientId: string, agree: boolean): RoomState | null;
    cancelShurikenProposal(room: RoomState, clientId: string): RoomState | null;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
    handleTimeout(room: RoomState): RoomState | null;
}
