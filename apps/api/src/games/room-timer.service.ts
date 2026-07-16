import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class RoomTimerService implements OnModuleDestroy {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  schedule(roomCode: string, timerName: string, deadline: number, callback: () => void): void {
    const key = this.key(roomCode, timerName);
    this.cancel(roomCode, timerName);

    const delay = Math.max(0, deadline - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, delay);
    timer.unref();
    this.timers.set(key, timer);
  }

  cancel(roomCode: string, timerName: string): void {
    const key = this.key(roomCode, timerName);
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  clearRoom(roomCode: string): void {
    const prefix = `${roomCode}:`;
    for (const [key, timer] of this.timers.entries()) {
      if (key.startsWith(prefix)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private key(roomCode: string, timerName: string): string {
    return `${roomCode}:${timerName}`;
  }
}
