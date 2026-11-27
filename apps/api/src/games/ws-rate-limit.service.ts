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
 * Resolve the client IP for rate limiting.
 *
 * By default the socket's own address is used and `x-forwarded-for` is
 * IGNORED: clients can send any header they like, so trusting it unprompted
 * would let one client rotate keys and defeat the IP-keyed admin bucket.
 *
 * Set `TRUSTED_PROXY_HOPS=N` only when the API sits behind exactly N reverse
 * proxies that append to the header. The client is then taken N hops left of
 * the socket's peer in the full chain `[..., x-forwarded-for entries, peer]`.
 */
export function extractClientIp(handshake?: {
  headers?: Record<string, string | string[] | undefined>;
  address?: string;
}): string {
  const address = handshake?.address || 'unknown';
  const rawHops = process.env.TRUSTED_PROXY_HOPS;
  const hops = rawHops ? Number.parseInt(rawHops, 10) : 0;
  if (!Number.isFinite(hops) || hops <= 0) return address;

  const raw = handshake?.headers?.['x-forwarded-for'];
  const rawList = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const forwarded = rawList
    .flatMap((value) => value.split(','))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const chain = [...forwarded, address];
  const index = chain.length - hops - 1;
  return chain[index] ?? chain[0] ?? address;
}

@Injectable()
export class WsRateLimitService {
  private readonly adminBuckets = new Map<string, BucketEntry>();
  private readonly socketBuckets = new Map<string, BucketEntry>();
  /**
   * Admin buckets are keyed by attacker-controllable values (IP behind a
   * proxy), so unlike socket buckets they never receive a disconnect
   * callback. Once the map passes this soft cap, stale entries are pruned to
   * keep memory bounded while preserving the lockout for live attackers.
   */
  private static readonly ADMIN_BUCKET_SOFT_CAP = 512;

  private pruneAdminBuckets(now: number, windowMs: number): void {
    if (this.adminBuckets.size <= WsRateLimitService.ADMIN_BUCKET_SOFT_CAP) return;
    for (const [key, entry] of this.adminBuckets) {
      const lastSeen = entry.timestamps[entry.timestamps.length - 1] ?? 0;
      const recentlyActive = lastSeen > now - windowMs;
      const locked = entry.lockedUntil !== undefined && entry.lockedUntil > now;
      if (!recentlyActive && !locked) this.adminBuckets.delete(key);
    }
  }

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
  checkBucket(bucket: RateLimitBucket, key: string, now: number = Date.now()): RateLimitResult {
    if (this.isDisabled()) {
      return { allowed: true };
    }

    const config = this.getBucketConfig(bucket);
    const store = bucket === 'admin' ? this.adminBuckets : this.socketBuckets;
    if (bucket === 'admin') this.pruneAdminBuckets(now, config.windowMs);
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

  /** Visible for testing: how many admin buckets are currently tracked. */
  getAdminBucketCount(): number {
    return this.adminBuckets.size;
  }
}
