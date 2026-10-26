import { RoomState, UserState, RoomConfig, BattleshipState, BattleshipGridPreset, BattleshipPlaceShipsPayload, BattleshipFirePayload, BattleshipPingPayload, ShipPlacement, ShipConfig } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
export type BattleshipOutcome = {
    room: RoomState;
    error?: undefined;
} | {
    room?: undefined;
    error: string;
};
export declare class BattleshipService {
    private readonly privateState;
    private readonly logger;
    private readonly pendingShots;
    constructor(privateState: PrivateStateService);
    getFleetConfig(preset: BattleshipGridPreset): ShipConfig[];
    getGridSize(preset: BattleshipGridPreset): number;
    initLobby(room: RoomState): void;
    createInitialState(players: UserState[], config?: RoomConfig): BattleshipState;
    generateRandomShipPlacement(gridSize: number, preset: BattleshipGridPreset): ShipPlacement[];
    startGame(room: RoomState, requesterId: string): RoomState | null;
    placeShips(room: RoomState, socketId: string, payload: BattleshipPlaceShipsPayload): BattleshipOutcome;
    private validatePlacements;
    private saveOceanGrid;
    private getOceanGrid;
    private transitionToPlaying;
    fireShot(room: RoomState, socketId: string, payload: BattleshipFirePayload): BattleshipOutcome;
    private resolveSimultaneousVolley;
    private checkHit;
    private advanceSequentialTurn;
    private checkWinCondition;
    private finishGame;
    pingCoordinate(room: RoomState, socketId: string, payload: BattleshipPingPayload): BattleshipOutcome;
    handleTimeout(room: RoomState, deadline: number): RoomState | null;
    private pickRandomTargetAndCoordinate;
    handlePlayerDisconnect(room: RoomState, socketId: string): void;
    handleReconnect(room: RoomState, playerId: string): void;
    remapSocketId(state: BattleshipState, oldSocketId: string, newSocketId: string): void;
    reset(room: RoomState, requesterId: string): RoomState | null;
    private resolveTargetId;
    private resolveTargetName;
}
