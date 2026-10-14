import { Injectable } from '@nestjs/common';
import { ActionReceipt } from '@repo/types';

export interface CachedReceiptEntry {
  receipt: ActionReceipt;
  fingerprint: string;
  timestamp: number;
}

export type ReceiptCheckResult =
  | { kind: 'HIT'; receipt: ActionReceipt }
  | { kind: 'CONFLICT'; receipt: ActionReceipt }
  | { kind: 'MISS' };

export function computePayloadFingerprint(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return String(payload);
  }
  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([key]) => key !== 'requestId')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

@Injectable()
export class ActionReceiptService {
  /** TTL for cached receipts: 60 seconds (TASK-SH-002) */
  private readonly TTL_MS = 60_000;
  /** Maximum cached receipt entries per seat (stable playerId) */
  private readonly MAX_ENTRIES_PER_SEAT = 64;

  /**
   * Structure: roomCode -> stablePlayerId -> requestKey (`${event}:${requestId}`) -> CachedReceiptEntry
   */
  private readonly rooms = new Map<string, Map<string, Map<string, CachedReceiptEntry>>>();

  /**
   * Validates requestId: must be non-empty string between 1 and 64 characters.
   */
  isValidRequestId(requestId: unknown): requestId is string {
    return typeof requestId === 'string' && requestId.length >= 1 && requestId.length <= 64;
  }

  /**
   * Looks up the cache for an existing receipt.
   * If a receipt exists for the same requestId with matching payload fingerprint, returns HIT.
   * If requestId is reused with a different payload, returns CONFLICT (REQUEST_ID_REUSED).
   * Otherwise returns MISS.
   */
  check(
    code: string,
    playerId: string,
    event: string,
    requestId: string,
    payload: unknown,
    now: number = Date.now(),
  ): ReceiptCheckResult {
    if (!this.isValidRequestId(requestId)) {
      return { kind: 'MISS' };
    }

    const normalizedCode = code.toUpperCase();
    const seatMap = this.rooms.get(normalizedCode)?.get(playerId);
    if (!seatMap) {
      return { kind: 'MISS' };
    }

    const requestKey = `${event}:${requestId}`;
    const entry = seatMap.get(requestKey);
    if (!entry) {
      return { kind: 'MISS' };
    }

    // Check TTL expiration
    if (now - entry.timestamp > this.TTL_MS) {
      seatMap.delete(requestKey);
      return { kind: 'MISS' };
    }

    const currentFingerprint = computePayloadFingerprint(payload);
    if (entry.fingerprint === currentFingerprint) {
      return { kind: 'HIT', receipt: entry.receipt };
    }

    // Conflicting payload for the same requestId
    const conflictReceipt: ActionReceipt = {
      code: normalizedCode,
      requestId,
      event,
      status: 'rejected',
      reason: 'REQUEST_ID_REUSED',
      serverNow: now,
    };

    return { kind: 'CONFLICT', receipt: conflictReceipt };
  }

  /**
   * Records a receipt in the cache for this room seat.
   * Handles 60s TTL eviction and per-seat max 64 entries limit.
   */
  record(
    code: string,
    playerId: string,
    event: string,
    requestId: string,
    payload: unknown,
    receipt: ActionReceipt,
    now: number = Date.now(),
  ): void {
    if (!this.isValidRequestId(requestId)) {
      return;
    }

    const normalizedCode = code.toUpperCase();
    let seatMapByPlayer = this.rooms.get(normalizedCode);
    if (!seatMapByPlayer) {
      seatMapByPlayer = new Map();
      this.rooms.set(normalizedCode, seatMapByPlayer);
    }

    let requestMap = seatMapByPlayer.get(playerId);
    if (!requestMap) {
      requestMap = new Map();
      seatMapByPlayer.set(playerId, requestMap);
    }

    // Evict expired entries for this seat
    for (const [key, item] of requestMap.entries()) {
      if (now - item.timestamp > this.TTL_MS) {
        requestMap.delete(key);
      }
    }

    // If still at or exceeding max capacity, evict the oldest entry
    if (requestMap.size >= this.MAX_ENTRIES_PER_SEAT) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, item] of requestMap.entries()) {
        if (item.timestamp < oldestTime) {
          oldestTime = item.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        requestMap.delete(oldestKey);
      }
    }

    const requestKey = `${event}:${requestId}`;
    requestMap.set(requestKey, {
      receipt,
      fingerprint: computePayloadFingerprint(payload),
      timestamp: now,
    });
  }

  /**
   * Clears all cached receipts for a room (e.g. on room deletion).
   */
  clearRoom(code: string): void {
    this.rooms.delete(code.toUpperCase());
  }

  /**
   * Visible for testing: count cached entries for a seat.
   */
  getSeatEntryCount(code: string, playerId: string): number {
    return this.rooms.get(code.toUpperCase())?.get(playerId)?.size ?? 0;
  }
}
