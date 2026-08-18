export declare class PrivateStateService {
    private readonly data;
    private roomStore;
    set(roomCode: string, socketId: string, key: string, value: unknown): void;
    setMany(roomCode: string, socketId: string, values: Record<string, unknown>): void;
    get<T>(roomCode: string, socketId: string, key: string): T | undefined;
    has(roomCode: string, socketId: string, key: string): boolean;
    delete(roomCode: string, socketId: string, key: string): void;
    getSocketData(roomCode: string, socketId: string): Record<string, unknown>;
    getRoomData<T>(roomCode: string, key: string): Map<string, T>;
    takeRoomData<T>(roomCode: string, key: string): Map<string, T>;
    remapSocketId(roomCode: string, oldSocketId: string, newSocketId: string): void;
    clearSocket(roomCode: string, socketId: string): void;
    clearRoom(roomCode: string): void;
}
