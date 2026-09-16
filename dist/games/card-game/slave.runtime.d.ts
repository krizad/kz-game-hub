import { CardGameAction, CardGameConfig, DeckPolicy, PlayingCard, RoomState } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
type DeckBuilder = (policy: DeckPolicy) => PlayingCard[];
export declare class SlaveRuntime {
    private readonly privateStateService;
    private readonly buildShuffledDeck;
    constructor(privateStateService: PrivateStateService, buildShuffledDeck?: DeckBuilder);
    startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState;
    handleAction(room: RoomState, socketId: string, action: CardGameAction, config: CardGameConfig): RoomState | null;
    private resolvePlayedCards;
    private nextCardHolder;
    private nextActiveAfterPass;
    private everyoneElsePassed;
    private settle;
    private setHand;
    private getHand;
    private setFirstPlayed;
    private hasFirstPlayed;
}
export {};
