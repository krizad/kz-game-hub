import { Injectable } from '@nestjs/common';
import { SOCKET_EVENTS } from '@repo/types';

export type RateLimitBucket = 'admin' | 'create_room' | 'external' | 'general';

export interface RateLimitResult {
  allowed: boolean;
  errorCode?: 'RATE_LIMITED' | 'ADMIN_RATE_LIMITED';
  retryAfterMs?: number;
}

interface BucketConfig {
  limit: number;
  windowMs: number;
  lockoutMs?: number;
  errorCode: 'RATE_LIMITED' | 'ADMIN_RATE_LIMITED';
}

interface BucketEntry {
  timestamps: number[];
  lockedUntil?: number;
}

const ADMIN_EVENTS = new Set<string>([
  SOCKET_EVENTS.ADMIN_VERIFY_KEY,
  SOCKET_EVENTS.SET_GAME_ENABLED,
  SOCKET_EVENTS.SET_ARTIST_ENABLED,
  SOCKET_EVENTS.DELETE_ARTIST,
]);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Extract the client IP from a Socket.io handshake, honoring the first hop of
 * x-forwarded-for when behind a reverse proxy.
 */
export function extractClientIp(handshake?: {
  headers?: Record<string, string | string[] | undefined>;
  address?: string;
}): string {
  const forwarded = handshake?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const firstHop = forwarded.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const firstHop = forwarded[0]?.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  }
  return handshake?.address || 'unknown';
}

@Injectable()
export class WsRateLimitService {
  private readonly adminBuckets = new Map<string, BucketEntry>();
  private readonly socketBuckets = new Map<string, BucketEntry>();

  isDisabled(): boolean {
    const flag = process.env.DISABLE_RATE_LIMIT;
    return flag === '1' || flag === 'true';
  }

  isAdminEvent(event: string): boolean {
    return ADMIN_EVENTS.has(event);
  }

  getBucketConfig(bucket: RateLimitBucket): BucketConfig {
    switch (bucket) {
      case 'admin':
        return {
          limit: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_MAX, 5),
          windowMs: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS, 60_000),
          lockoutMs: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_LOCKOUT_MS, 300_000),
          errorCode: 'ADMIN_RATE_LIMITED',
        };
      case 'create_room':
        return {
          limit: parsePositiveInt(process.env.RATE_LIMIT_CREATE_ROOM_MAX, 5),
          windowMs: parsePositiveInt(process.env.RATE_LIMIT_CREATE_ROOM_WINDOW_MS, 60_000),
          errorCode: 'RATE_LIMITED',
        };
      case 'external':
        return {
          limit: parsePositiveInt(process.env.RATE_LIMIT_EXTERNAL_MAX, 10),
          windowMs: parsePositiveInt(process.env.RATE_LIMIT_EXTERNAL_WINDOW_MS, 60_000),
          errorCode: 'RATE_LIMITED',
        };
      case 'general':
        return {
          limit: parsePositiveInt(process.env.RATE_LIMIT_GENERAL_MAX, 60),
          windowMs: parsePositiveInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS, 10_000),
          errorCode: 'RATE_LIMITED',
        };
    }
  }

  /**
   * Check a specific bucket using sliding-window timestamps.
   * Admin buckets are keyed by IP; gameplay/room buckets are keyed by socketId.
   */
  checkBucket(
    bucket: RateLimitBucket,
    key: string,
    now: number = Date.now(),
  ): RateLimitResult {
    if (this.isDisabled()) {
      return { allowed: true };
    }

    const config = this.getBucketConfig(bucket);
    const store = bucket === 'admin' ? this.adminBuckets : this.socketBuckets;
    const compositeKey = `${bucket}:${key}`;
    let entry = store.get(compositeKey);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(compositeKey, entry);
    }

    // Active lockout check (admin bucket)
    if (entry.lockedUntil && now < entry.lockedUntil) {
      return {
        allowed: false,
        errorCode: config.errorCode,
        retryAfterMs: entry.lockedUntil - now,
      };
    }
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      entry.lockedUntil = undefined;
      entry.timestamps = [];
    }

    // Evict timestamps outside sliding window
    const windowStart = now - config.windowMs;
    while (entry.timestamps.length > 0 && entry.timestamps[0] <= windowStart) {
      entry.timestamps.shift();
    }

    if (entry.timestamps.length >= config.limit) {
      if (config.lockoutMs) {
        entry.lockedUntil = now + config.lockoutMs;
        return {
          allowed: false,
          errorCode: config.errorCode,
          retryAfterMs: config.lockoutMs,
        };
      }
      const oldest = entry.timestamps[0] ?? now;
      return {
        allowed: false,
        errorCode: config.errorCode,
        retryAfterMs: Math.max(1, oldest + config.windowMs - now),
      };
    }

    entry.timestamps.push(now);
    return { allowed: true };
  }

  /**
   * High-level check for an incoming Socket.io event.
   * Admin events use IP-keyed bucket; CREATE_ROOM and general mutating events use socketId.
   */
  checkEvent(params: {
    event: string;
    socketId: string;
    clientIp: string;
    isQuietEvent: boolean;
    isExternalApiEvent?: boolean;
    now?: number;
  }): RateLimitResult {
    if (this.isDisabled()) {
      return { allowed: true };
    }
    const now = params.now ?? Date.now();

    if (this.isAdminEvent(params.event)) {
      return this.checkBucket('admin', params.clientIp, now);
    }

    if (params.event === SOCKET_EVENTS.CREATE_ROOM) {
      const createRes = this.checkBucket('create_room', params.socketId, now);
      if (!createRes.allowed) return createRes;
    }

    if (params.isExternalApiEvent) {
      const extRes = this.checkBucket('external', params.socketId, now);
      if (!extRes.allowed) return extRes;
    }

    if (!params.isQuietEvent) {
      return this.checkBucket('general', params.socketId, now);
    }

    return { allowed: true };
  }

  /** Clean up per-socket rate-limit buckets on disconnect to prevent memory growth. */
  clearSocket(socketId: string): void {
    this.socketBuckets.delete(`create_room:${socketId}`);
    this.socketBuckets.delete(`external:${socketId}`);
    this.socketBuckets.delete(`general:${socketId}`);
  }
}
