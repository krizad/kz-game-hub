import { CardGameAction, CardGameConfig, DeckPolicy, PlayingCard, RoomState } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
type DeckBuilder = (policy: DeckPolicy) => PlayingCard[];
export declare class OldMaidRuntime {
    private readonly privateStateService;
    private readonly buildShuffledDeck;
    constructor(privateStateService: PrivateStateService, buildShuffledDeck?: DeckBuilder);
    startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState | null;
    handleAction(room: RoomState, socketId: string, action: CardGameAction, config: CardGameConfig): RoomState | null;
    private settle;
    private nextHolder;
    private removeRankPairs;
    private setHand;
    private getHand;
    private setPiles;
    private pilesFor;
}
export {};
