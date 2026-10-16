import { DogRelayAction, DogRelayPair, DogRelayPhase, DogRelayPublicState, DogRelayRole, RoomState } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
type CancellationReason = NonNullable<DogRelayPublicState['cancellationReason']>;
export interface DogRelaySecrets {
    roundId: string;
    roles: Record<string, DogRelayRole>;
    truePair: DogRelayPair;
    candidateIds: string[];
    ballots: Record<string, string>;
}
export declare class DogRelayDomainError extends Error {
}
export declare class DogRelayService {
    private readonly privateState;
    constructor(privateState: PrivateStateService);
    initLobby(room: RoomState): void;
    startRound(room: RoomState, actorPlayerId: string): void;
    act(room: RoomState, actorPlayerId: string, action: DogRelayAction, now: number): void;
    onDisconnect(room: RoomState, playerId: string, now: number): void;
    onReconnect(room: RoomState, playerId: string, now: number): void;
    onRemoved(room: RoomState, playerId: string, reason: CancellationReason): void;
    onPhaseDeadline(room: RoomState, roundId: string, phase: DogRelayPhase, deadline: number, now: number): boolean;
    cancelRound(room: RoomState, reason: CancellationReason): void;
    refreshPrivateStates(room: RoomState): void;
    clear(room: RoomState): void;
    private finish;
    private secrets;
    private assertGame;
    private assertHost;
    private exactPermutation;
}
export {};
