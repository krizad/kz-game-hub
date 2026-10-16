import { ResultRevealActionPayload, RoomState } from '@repo/types';
export declare function syncResultReveal(room: RoomState, now?: number): void;
export declare function applyResultRevealAction(room: RoomState, socketId: string, payload: ResultRevealActionPayload, now?: number): boolean;
