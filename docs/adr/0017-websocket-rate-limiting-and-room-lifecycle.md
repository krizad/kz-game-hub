# 0017. WebSocket Rate Limiting, Admin Auth Hardening, and Room Lifecycle Caps

Status: Accepted
Date: 2026-11-24

## Context

The API runs as a single-instance NestJS process with in-memory room state (`GamesService.rooms: Map<string, RoomState>`). Several security and availability gaps exist:

1. **Unthrottled WebSocket endpoints**: `ADMIN_VERIFY_KEY`, `CREATE_ROOM`, `WHO_AM_I` AI word generation (`@google/genai`), and Music Trivia external search adapters have no rate limiting. A malicious or malfunctioning client can brute-force `ADMIN_SECRET`, exhaust server memory by creating unbounded rooms, or drain external API quotas.
2. **Timing-unsafe admin secret comparison**: `GamesService.verifyAdminKey` and `GamesGateway` compare `ADMIN_SECRET` with plain `===`.
3. **HTTP / WebSocket CORS mismatch**: `apps/api/src/main.ts` calls `app.enableCors()` unconditionally (`*`), whereas `GamesGateway` restricts origins via `process.env.CORS_ORIGIN`.
4. **Unbounded room retention**: Rooms whose host stays connected indefinitely without gameplay activity remain in memory forever, with no `MAX_ROOMS` cap or idle-room TTL.

A key party-game constraint is that **5–10 friends playing together in the same room or office commonly share a single Wi-Fi / public IP address**. Blanket per-IP rate limiting on gameplay events would cause false-positive lockouts for legitimate party groups.

## Decision

1. **Split-key In-Memory Sliding-Window Rate Limiter (`WsRateLimitService`)**:
   - **IP-keyed bucket (privileged endpoints only)**: `ADMIN_VERIFY_KEY`, `SET_GAME_ENABLED`, `SET_ARTIST_ENABLED`, `DELETE_ARTIST` — default **5 attempts per 60 seconds per client IP** (respecting `x-forwarded-for` first hop when behind reverse proxy), with a **5-minute lockout** upon exceeding the limit.
   - **Socket-keyed buckets (gameplay & room creation)**:
     - `CREATE_ROOM`: default **5 requests per 60 seconds per `socket.id`**.
     - External API / AI actions (`WHO_AM_I` `AI_GENERATED` word generation, `MUSIC_TRIVIA` search): default **10 requests per 60 seconds per `socket.id`**.
     - General mutating socket events: burst protection (e.g., **60 requests per 10 seconds per `socket.id`**) excluding quiet/polling events.
   - All thresholds support env override and can be relaxed/disabled in E2E tests via `DISABLE_RATE_LIMIT=1`.
   - Rejected requests emit `SOCKET_EVENTS.ERROR` with localized error codes (`RATE_LIMITED`, `ADMIN_RATE_LIMITED`) mapped in `apps/web/src/i18n/serverErrors.ts`.

2. **Timing-Safe Admin Key Verification**:
   - Centralize admin key verification in `GamesService.verifyAdminKey` (remove duplicate inline checks in `GamesGateway`).
   - Use `crypto.timingSafeEqual` over SHA-256 digests (or equal-length UTF-8 buffers) so length mismatches do not leak timing information.

3. **Unified CORS Configuration**:
   - Extract shared CORS origin parser (`CORS_ORIGIN` comma-separated list, fallback `*`) and apply it identically to both `app.enableCors({ origin })` in `main.ts` and `@WebSocketGateway({ cors: { origin } })` in `GamesGateway`.

4. **Room Cap and Idle Room TTL**:
   - Enforce `MAX_ROOMS` (default `200`, configurable via `process.env.MAX_ROOMS`). When full, `createRoom` rejects with error code `SERVER_ROOM_LIMIT_REACHED`.
   - Track `lastActivityAt` per room (updated on any valid room/game action).
   - Run a periodic sweep (or `RoomTimerService` idle timer) that closes rooms with zero activity for `IDLE_ROOM_TTL_MS` (default `7_200_000` ms = 2 hours, configurable via `process.env.IDLE_ROOM_TTL_MS`, `0` disables). Closed rooms emit `ROOM_DELETED` and run full cleanup (`PrivateStateService`, `RoomTimerService`, `lastBroadcastSnapshot`).

## Consequences

- **Positive**: Protects `ADMIN_SECRET` against brute-force, prevents RAM exhaustion and Gemini/YouTube quota abuse, and eliminates HTTP/WS CORS drift without penalizing co-located party players on shared Wi-Fi.
- **Negative**: In-memory rate-limit counters reset on API restart (acceptable for single-instance Plesk deployment).
- **Follow-up**: Update `.env.example` with `MAX_ROOMS`, `IDLE_ROOM_TTL_MS`, and `DISABLE_RATE_LIMIT`, and add unit tests covering every bucket, lockout, and room expiry path.
