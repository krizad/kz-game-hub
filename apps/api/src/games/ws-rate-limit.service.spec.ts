import { SOCKET_EVENTS } from '@repo/types';
import { WsRateLimitService, extractClientIp } from './ws-rate-limit.service';

describe('WsRateLimitService', () => {
  let service: WsRateLimitService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DISABLE_RATE_LIMIT;
    delete process.env.RATE_LIMIT_ADMIN_MAX;
    delete process.env.RATE_LIMIT_ADMIN_WINDOW_MS;
    delete process.env.RATE_LIMIT_ADMIN_LOCKOUT_MS;
    delete process.env.RATE_LIMIT_CREATE_ROOM_MAX;
    delete process.env.RATE_LIMIT_EXTERNAL_MAX;
    delete process.env.RATE_LIMIT_GENERAL_MAX;
    delete process.env.TRUSTED_PROXY_HOPS;
    service = new WsRateLimitService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('ignores spoofable x-forwarded-for unless TRUSTED_PROXY_HOPS is set', () => {
    // Default: the header is client-controlled, so the socket address wins.
    expect(
      extractClientIp({
        headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
        address: '192.168.1.5',
      }),
    ).toBe('192.168.1.5');
    expect(extractClientIp({ headers: {}, address: '192.168.1.5' })).toBe('192.168.1.5');
    expect(extractClientIp(undefined)).toBe('unknown');

    // One trusted proxy: the proxy appends the client to x-forwarded-for and
    // appears as the socket peer, so the client is one hop left of the peer.
    process.env.TRUSTED_PROXY_HOPS = '1';
    expect(
      extractClientIp({
        headers: { 'x-forwarded-for': '203.0.113.10' },
        address: '10.0.0.1',
      }),
    ).toBe('203.0.113.10');

    // Two trusted proxies: x-forwarded-for holds "client, firstProxy" and the
    // second proxy is the peer.
    process.env.TRUSTED_PROXY_HOPS = '2';
    expect(
      extractClientIp({
        headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
        address: '10.0.0.9',
      }),
    ).toBe('203.0.113.10');

    // More hops claimed than hops present: fall back to the leftmost entry.
    process.env.TRUSTED_PROXY_HOPS = '4';
    expect(
      extractClientIp({ headers: { 'x-forwarded-for': '203.0.113.10' }, address: '10.0.0.1' }),
    ).toBe('203.0.113.10');
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it('a spoofed header cannot escape the admin bucket', () => {
    const t0 = 500_000;
    // Exactly what the gateway does: extractClientIp(handshake) feeds checkEvent.
    // With no trusted proxy configured, every rotated header resolves to the
    // same socket address, so the bucket cannot be escaped.
    const handshakeWithSpoof = (spoof: string) => ({
      headers: { 'x-forwarded-for': spoof },
      address: '10.0.0.1',
    });
    for (let i = 0; i < 5; i++) {
      const res = service.checkEvent({
        event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
        socketId: `spoof-${i}`,
        clientIp: extractClientIp(handshakeWithSpoof(`203.0.113.${100 + i}`)),
        isQuietEvent: false,
        now: t0 + i * 1_000,
      });
      expect(res.allowed).toBe(true);
    }
    // The 6th attempt is still blocked even with yet another spoofed header.
    const blocked = service.checkEvent({
      event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
      socketId: 'spoof-new',
      clientIp: extractClientIp(handshakeWithSpoof('203.0.113.200')),
      isQuietEvent: false,
      now: t0 + 10_000,
    });
    expect(blocked.allowed).toBe(false);
  });

  it('prunes stale admin buckets once the soft cap is exceeded', () => {
    const t0 = 600_000;
    // Fill far beyond the soft cap with keys last seen 2 minutes ago (outside
    // the 60s admin window, no lockout) — every one of them is stale.
    for (let i = 0; i < 1_000; i++) {
      service.checkBucket('admin', `prune-key-${i}`, t0 - 120_000);
    }
    // One live entry with a fresh timestamp must survive pruning.
    service.checkBucket('admin', 'prune-live', t0);
    // The next admin event from yet another key trips the cap and prunes.
    service.checkBucket('admin', 'prune-trigger', t0 + 1_000);
    const size = service.getAdminBucketCount();
    expect(size).toBeLessThan(512);
    // The live entry remains usable within its window (no rate-limit false hit).
    const live = service.checkBucket('admin', 'prune-live', t0 + 2_000);
    expect(live.allowed).toBe(true);
  });

  it('enforces IP-keyed admin limit (5/60s) with 5m lockout', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      const res = service.checkEvent({
        event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
        socketId: `sock-${i}`,
        clientIp: '198.51.100.1',
        isQuietEvent: false,
        now: t0 + i * 1_000,
      });
      expect(res.allowed).toBe(true);
    }

    // 6th attempt from same IP (even on a new socket) triggers 5-minute lockout
    const blocked = service.checkEvent({
      event: SOCKET_EVENTS.SET_GAME_ENABLED,
      socketId: 'sock-new',
      clientIp: '198.51.100.1',
      isQuietEvent: false,
      now: t0 + 10_000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.errorCode).toBe('ADMIN_RATE_LIMITED');
    expect(blocked.retryAfterMs).toBe(300_000);

    // Still locked 4 minutes later
    const stillBlocked = service.checkEvent({
      event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
      socketId: 'sock-later',
      clientIp: '198.51.100.1',
      isQuietEvent: false,
      now: t0 + 10_000 + 240_000,
    });
    expect(stillBlocked.allowed).toBe(false);
    expect(stillBlocked.errorCode).toBe('ADMIN_RATE_LIMITED');

    // Different IP is unaffected
    const otherIp = service.checkEvent({
      event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
      socketId: 'sock-other',
      clientIp: '198.51.100.2',
      isQuietEvent: false,
      now: t0 + 10_000,
    });
    expect(otherIp.allowed).toBe(true);

    // Unlocks after 5 minutes
    const unlocked = service.checkEvent({
      event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
      socketId: 'sock-after',
      clientIp: '198.51.100.1',
      isQuietEvent: false,
      now: t0 + 10_000 + 300_001,
    });
    expect(unlocked.allowed).toBe(true);
  });

  it('enforces socket-keyed CREATE_ROOM limit (5/60s) without blocking shared-WiFi peers', () => {
    const t0 = 2_000_000;
    const sharedIp = '203.0.113.50';
    for (let i = 0; i < 5; i++) {
      const res = service.checkEvent({
        event: SOCKET_EVENTS.CREATE_ROOM,
        socketId: 'player-a',
        clientIp: sharedIp,
        isQuietEvent: false,
        now: t0 + i * 500,
      });
      expect(res.allowed).toBe(true);
    }

    const blocked = service.checkEvent({
      event: SOCKET_EVENTS.CREATE_ROOM,
      socketId: 'player-a',
      clientIp: sharedIp,
      isQuietEvent: false,
      now: t0 + 3_000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.errorCode).toBe('RATE_LIMITED');

    // Co-located friend on the same IP can still create a room
    const friend = service.checkEvent({
      event: SOCKET_EVENTS.CREATE_ROOM,
      socketId: 'player-b',
      clientIp: sharedIp,
      isQuietEvent: false,
      now: t0 + 3_000,
    });
    expect(friend.allowed).toBe(true);
  });

  it('enforces socket-keyed external API bucket (10/60s)', () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 10; i++) {
      const res = service.checkEvent({
        event: SOCKET_EVENTS.START_GAME,
        socketId: 'sock-ext',
        clientIp: '10.0.0.2',
        isQuietEvent: false,
        isExternalApiEvent: true,
        now: t0 + i * 1_000,
      });
      expect(res.allowed).toBe(true);
    }
    const blocked = service.checkEvent({
      event: SOCKET_EVENTS.START_GAME,
      socketId: 'sock-ext',
      clientIp: '10.0.0.2',
      isQuietEvent: false,
      isExternalApiEvent: true,
      now: t0 + 11_000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.errorCode).toBe('RATE_LIMITED');
  });

  it('enforces general burst limit (60/10s) and exempts quiet events', () => {
    const t0 = 4_000_000;
    for (let i = 0; i < 60; i++) {
      const res = service.checkEvent({
        event: SOCKET_EVENTS.JOIN_ROOM,
        socketId: 'sock-burst',
        clientIp: '10.0.0.3',
        isQuietEvent: false,
        now: t0 + i * 50,
      });
      expect(res.allowed).toBe(true);
    }
    const blocked = service.checkEvent({
      event: SOCKET_EVENTS.JOIN_ROOM,
      socketId: 'sock-burst',
      clientIp: '10.0.0.3',
      isQuietEvent: false,
      now: t0 + 3_500,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.errorCode).toBe('RATE_LIMITED');

    // Quiet events are never blocked by general bucket
    const quiet = service.checkEvent({
      event: SOCKET_EVENTS.SERVER_TIME_REQUEST,
      socketId: 'sock-burst',
      clientIp: '10.0.0.3',
      isQuietEvent: true,
      now: t0 + 3_500,
    });
    expect(quiet.allowed).toBe(true);

    // Clearing socket resets its buckets
    service.clearSocket('sock-burst');
    const afterClear = service.checkEvent({
      event: SOCKET_EVENTS.JOIN_ROOM,
      socketId: 'sock-burst',
      clientIp: '10.0.0.3',
      isQuietEvent: false,
      now: t0 + 3_600,
    });
    expect(afterClear.allowed).toBe(true);
  });

  it('bypasses all limits when DISABLE_RATE_LIMIT=1', () => {
    process.env.DISABLE_RATE_LIMIT = '1';
    for (let i = 0; i < 100; i++) {
      const res = service.checkEvent({
        event: SOCKET_EVENTS.ADMIN_VERIFY_KEY,
        socketId: 'e2e-sock',
        clientIp: '127.0.0.1',
        isQuietEvent: false,
      });
      expect(res.allowed).toBe(true);
    }
  });
});
