import { Injectable } from '@nestjs/common';

@Injectable()
export class PrivateStateService {
  private readonly data = new Map<string, Map<string, Record<string, unknown>>>();

  private roomStore(
    roomCode: string,
    create: boolean = false,
  ): Map<string, Record<string, unknown>> | undefined {
    let store = this.data.get(roomCode);
    if (!store && create) {
      store = new Map();
      this.data.set(roomCode, store);
    }
    return store;
  }

  set(roomCode: string, socketId: string, key: string, value: unknown): void {
    const store = this.roomStore(roomCode, true)!;
    const socketData = store.get(socketId) ?? {};
    socketData[key] = value;
    store.set(socketId, socketData);
  }

  setMany(roomCode: string, socketId: string, values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(roomCode, socketId, key, value);
    }
  }

  get<T>(roomCode: string, socketId: string, key: string): T | undefined {
    const store = this.roomStore(roomCode);
    return store?.get(socketId)?.[key] as T | undefined;
  }

  has(roomCode: string, socketId: string, key: string): boolean {
    const store = this.roomStore(roomCode);
    const socketData = store?.get(socketId);
    return !!socketData && key in socketData;
  }

  delete(roomCode: string, socketId: string, key: string): void {
    const store = this.roomStore(roomCode);
    const socketData = store?.get(socketId);
    if (socketData) {
      delete socketData[key];
      if (Object.keys(socketData).length === 0) {
        store!.delete(socketId);
      }
    }
  }

  getSocketData(roomCode: string, socketId: string): Record<string, unknown> {
    const store = this.roomStore(roomCode);
    return { ...(store?.get(socketId) ?? {}) };
  }

  getRoomData<T>(roomCode: string, key: string): Map<string, T> {
    const result = new Map<string, T>();
    const store = this.roomStore(roomCode);
    if (!store) return result;
    for (const [socketId, socketData] of store.entries()) {
      if (key in socketData) {
        result.set(socketId, socketData[key] as T);
      }
    }
    return result;
  }

  takeRoomData<T>(roomCode: string, key: string): Map<string, T> {
    const result = this.getRoomData<T>(roomCode, key);
    for (const socketId of result.keys()) {
      this.delete(roomCode, socketId, key);
    }
    return result;
  }

  remapSocketId(roomCode: string, oldSocketId: string, newSocketId: string): void {
    const store = this.roomStore(roomCode);
    if (!store) return;
    const socketData = store.get(oldSocketId);
    if (!socketData) return;
    store.delete(oldSocketId);
    store.set(newSocketId, { ...(store.get(newSocketId) ?? {}), ...socketData });
  }

  clearSocket(roomCode: string, socketId: string): void {
    this.roomStore(roomCode)?.delete(socketId);
  }

  clearRoom(roomCode: string): void {
    this.data.delete(roomCode);
  }
}
