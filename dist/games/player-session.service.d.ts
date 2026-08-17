export declare class PlayerSessionService {
    private static readonly SESSION_TTL_MS;
    private readonly sessions;
    private readonly pendingTokens;
    issue(roomCode: string, playerId: string, socketId: string): void;
    consume(roomCode: string, token: string): string | null;
    takePendingToken(socketId: string): string | null;
    revokePlayer(roomCode: string, playerId: string): void;
    clearRoom(roomCode: string): void;
    clearAll(): void;
    private hash;
}
