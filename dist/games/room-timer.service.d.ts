import { OnModuleDestroy } from '@nestjs/common';
export declare class RoomTimerService implements OnModuleDestroy {
    private readonly timers;
    schedule(roomCode: string, timerName: string, deadline: number, callback: () => void): void;
    cancel(roomCode: string, timerName: string): void;
    clearRoom(roomCode: string): void;
    onModuleDestroy(): void;
    private key;
}
