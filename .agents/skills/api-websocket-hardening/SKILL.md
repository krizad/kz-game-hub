---
name: api-websocket-hardening
description: >-
  Backend NestJS and Socket.io development, security, and refactoring standards for apps/api in KZ Game Hub. Trigger when editing GamesGateway, GamesService, rate limiting, CORS, admin auth, health checks, logging, timers, or Socket.io events.
---

# API & WebSocket Hardening — KZ Game Hub

## Core Architecture Rules (`apps/api`)

1. **WebSocket-only backend**: All gameplay/lobby communication flows through `GamesGateway` (`apps/api/src/games/games.gateway.ts`). The only REST endpoint is `GET /health` (`HealthController`). Do not add new `@Controller` classes.
2. **4-Location Socket Event Contract**: Whenever adding or renaming a Socket event, update all 4 files and rebuild `@repo/types`:
   1. `packages/types/src/core.ts` (`SOCKET_EVENTS`)
   2. `apps/api/src/games/games.gateway.ts` (`@SubscribeMessage` + `isValidPayload`)
   3. `apps/api/src/games/games.service.ts` (business logic)
   4. `apps/web/src/store/useGameStore.ts` (listener + action)
3. **Zero Private-State Leaks**: Secret roles, hands, cards, and hidden words MUST live in `PrivateStateService` and be emitted only to the entitled socket via `server.to(socketId).emit(...)`. Never place private data in broadcasted `RoomState`.
4. **Timer Safety**: Never call raw `setTimeout`/`setInterval` inside per-game services. Use `RoomTimerService` (with `timer.unref()` and try/catch wrapping) or return `timerCommands` executed by the gateway. Every timer callback MUST re-validate room existence and phase before mutating state.
5. **Reconnect Remapping**: Any new socket-ID field added to `RoomState` or a game state MUST be remapped in `GamesService.joinRoom` on reconnect and cleaned up on room deletion.

## Security & Reliability Standards (ADR 0017)

- **Rate Limiting (`WsRateLimitService`)**:
  - **IP-keyed ONLY for privileged admin events** (`ADMIN_VERIFY_KEY`, `SET_GAME_ENABLED`, `SET_ARTIST_ENABLED`, `DELETE_ARTIST`) — e.g. 5/60s with 5m lockout (`ADMIN_RATE_LIMITED`).
  - **Socket-keyed for gameplay & room creation** (`CREATE_ROOM`, AI word gen, Music Trivia search, general burst) so co-located party players sharing Wi-Fi / NAT IP never block each other.
  - Support `DISABLE_RATE_LIMIT=1` for E2E runs.
- **Timing-Safe Admin Auth**: Compare `ADMIN_SECRET` exclusively through `GamesService.verifyAdminKey()` using `crypto.timingSafeEqual` over equal-length SHA-256 digests. Never duplicate inline `===` checks in `GamesGateway`.
- **Unified CORS**: Parse `process.env.CORS_ORIGIN` with one shared helper and apply it to both HTTP (`app.enableCors` in `main.ts`) and WebSocket (`@WebSocketGateway` in `games.gateway.ts`).
- **Room Lifecycle Caps**: Enforce `MAX_ROOMS` (env-configurable, default 200) and `IDLE_ROOM_TTL_MS` (env-configurable, default 2h) with full cleanup (`PrivateStateService`, `RoomTimerService`, `lastBroadcastSnapshot`, `ROOM_DELETED`).
- **Logging**: Always use NestJS `Logger` (never raw `console.log`/`warn`/`error`) so logs flow into `AppLogger` / `game-hub.logs`.
- **Health Check**: Verify live DB connectivity with `prisma.$queryRaw\`SELECT 1\`` inside a bounded timeout (never rely on `prisma.$connect()` alone).

## Incremental Refactoring Guidelines

When slimming `games.gateway.ts` or `games.service.ts`:
- Extract pure/stateless logic first (e.g., `gateway/payload-validator.ts`, `gateway/admin-gateway.helper.ts`) with dedicated `*.spec.ts` unit tests.
- Preserve exact Socket.io event names, error payloads, and broadcast order.
- Run `pnpm -F api test` and `pnpm lint` after every extraction step.
