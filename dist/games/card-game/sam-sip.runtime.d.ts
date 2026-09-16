import { CardGameAction, CardGameConfig, DeckPolicy, PlayingCard, RoomState } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
type DeckBuilder = (policy: DeckPolicy) => PlayingCard[];
export declare class SamSipRuntime {
    private readonly privateStateService;
    private readonly buildShuffledDeck;
    constructor(privateStateService: PrivateStateService, buildShuffledDeck?: DeckBuilder);
    startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState | null;
    handleAction(room: RoomState, socketId: string, action: CardGameAction, config: CardGameConfig): RoomState | null;
    private finishAcquire;
    private endRoundByExhaustion;
    private settle;
    private canClaim;
    private removeSumTenPairs;
    private nextPlayer;
    private setHand;
    private getHand;
    private setPiles;
    private pilesFor;
}
export {};
