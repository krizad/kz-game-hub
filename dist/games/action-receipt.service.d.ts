import { ActionReceipt } from '@repo/types';
export interface CachedReceiptEntry {
    receipt: ActionReceipt;
    fingerprint: string;
    timestamp: number;
}
export type ReceiptCheckResult = {
    kind: 'HIT';
    receipt: ActionReceipt;
} | {
    kind: 'CONFLICT';
    receipt: ActionReceipt;
} | {
    kind: 'MISS';
};
export declare function computePayloadFingerprint(payload: unknown): string;
export declare class ActionReceiptService {
    private readonly TTL_MS;
    private readonly MAX_ENTRIES_PER_SEAT;
    private readonly rooms;
    isValidRequestId(requestId: unknown): requestId is string;
    check(code: string, playerId: string, event: string, requestId: string, payload: unknown, now?: number): ReceiptCheckResult;
    record(code: string, playerId: string, event: string, requestId: string, payload: unknown, receipt: ActionReceipt, now?: number): void;
    clearRoom(code: string): void;
    getSeatEntryCount(code: string, playerId: string): number;
}
