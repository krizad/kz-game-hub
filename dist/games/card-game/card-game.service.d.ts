import { CardGameAction, CardGamePublicState, RoomState } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export declare class CardGameService {
    private readonly privateStateService;
    private readonly cardRuntimes;
    constructor(privateStateService: PrivateStateService);
    startCardRound(room: RoomState, requesterId: string): RoomState | null;
    startPokDeng(room: RoomState, requesterId: string): RoomState | null;
    handleAction(room: RoomState, socketId: string, action: CardGameAction): RoomState | null;
    cancelRound(room: RoomState): void;
    remapSocketId(state: CardGamePublicState, oldSocketId: string, newSocketId: string): void;
    private appendLog;
    private configFor;
    private refreshTurnDeadline;
    resolveAutoAction(room: RoomState): {
        playerId: string;
        action: CardGameAction;
    } | null;
    private advance;
    private resolve;
    private createDeck;
    private shuffle;
    private setHand;
    private getHand;
    private setPiles;
    private pilesFor;
    private remapRecord;
}
