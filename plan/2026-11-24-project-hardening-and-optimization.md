# Implementation Plan — KZ Game Hub Hardening, Performance & Maintainability

- **Date**: 2026-11-24
- **Status**: Completed (Phases 1–5 implemented and verified)
- **ADRs**:
  - [ADR 0017: WebSocket Rate Limiting, Admin Auth Hardening, and Room Lifecycle Caps](../docs/adr/0017-websocket-rate-limiting-and-room-lifecycle.md)
  - [ADR 0018: Frontend Dynamic Game Loading, Lobby Prefetch, and Two-Layer Error Boundaries](../docs/adr/0018-frontend-dynamic-game-loading-and-error-boundaries.md)
- **Scratch Issues**: `.scratch/0001` through `.scratch/0010`

## Guiding Principles

1. **Independently mergeable phases**: Each phase ships as its own PR/branch with passing lint, build, and tests before moving to the next.
2. **No destructive production DB changes**: Add non-destructive indexes only; keep legacy `Room`/`User` models untouched for now.
3. **Party-game ergonomics first**: Rate limiting never locks out co-located players sharing Wi-Fi (IP-keyed for admin only; socket-keyed for gameplay/room creation).
4. **Graph freshness**: Run `graphify update .` at the end of each phase that modifies code.

---

## Phase 1 — Security, CI Gate & Lint Baseline

**Goal**: Restore green `pnpm lint`, add automated CI/deploy gates, and close API security/DoS gaps.

### Tasks

1. **Fix 7 API ESLint errors** (`Refs .scratch/0001`)
   - Remove unused imports in:
     - `apps/api/src/games/battleship/battleship.service.ts:13` (`BattleshipPhase`)
     - `apps/api/src/games/cipher-grid/cipher-grid.service.ts:18-19` (`CIPHER_GRID_PICTURES`, `CIPHER_GRID_PICTURES_CLASSIC`)
     - `apps/api/src/games/games.service.ts:64-66` (`BattleshipMode`, `BattleshipTeamFleetMode`, `BattleshipGridPreset`)
   - Replace explicit `any` in `apps/api/src/games/gobbler/gobbler-ai.spec.ts:100` with proper typed helper/cast.

2. **Add CI & Deploy Quality Gates** (`Refs .scratch/0001`)
   - Create `.github/workflows/ci.yml` triggered on `pull_request` and `push` to `main`:
     - Node `22`, `pnpm@9.1.0`, `pnpm install --frozen-lockfile --ignore-scripts`
     - `pnpm build --filter=@repo/types --filter=@repo/database`
     - `pnpm lint`
     - `pnpm -F api test`
     - `pnpm build`
   - Update `.github/workflows/deploy.yml` to run `pnpm lint` and `pnpm -F api test` before `node scripts/deploy-api-ftp.mjs --skip-upload`.
   - Align Node version in `.github/workflows/test-nightly.yml` from `20.19` to `22`.

3. **WebSocket Rate Limiter, Timing-Safe Admin Auth, Unified CORS & Room Caps** (`Refs .scratch/0002`, `ADR 0017`)
   - Extract shared `parseCorsOrigin()` helper and apply to both `apps/api/src/main.ts` (`app.enableCors({ origin })`) and `GamesGateway`.
   - Update `GamesService.verifyAdminKey()` to use `crypto.timingSafeEqual` (SHA-256 normalized buffers) and remove duplicate inline checks in `GamesGateway`.
   - Implement `WsRateLimitService` (in-memory sliding window):
     - Admin events (`ADMIN_VERIFY_KEY`, `SET_GAME_ENABLED`, `SET_ARTIST_ENABLED`, `DELETE_ARTIST`): **5 / 60s per IP**, **5m lockout** (`ADMIN_RATE_LIMITED`).
     - `CREATE_ROOM`: **5 / 60s per `socket.id`** (`RATE_LIMITED`).
     - External AI/Music search (`WHO_AM_I` AI gen, `MUSIC_TRIVIA` search): **10 / 60s per `socket.id`** (`RATE_LIMITED`).
     - General mutating events: **60 / 10s per `socket.id`** (`RATE_LIMITED`), excluding `QUIET_EVENTS`.
     - Support `DISABLE_RATE_LIMIT=1` for E2E suites.
   - Add `MAX_ROOMS` cap (default `200`, env `MAX_ROOMS`) returning `SERVER_ROOM_LIMIT_REACHED`.
   - Track `lastActivityAt` on each room and sweep idle rooms past `IDLE_ROOM_TTL_MS` (default `7200000` = 2h, `0` disables), emitting `ROOM_DELETED` and running full cleanup.
   - Localize `RATE_LIMITED`, `ADMIN_RATE_LIMITED`, and `SERVER_ROOM_LIMIT_REACHED` in `apps/web/src/i18n/serverErrors.ts` (`th` & `en`).
   - Document `MAX_ROOMS`, `IDLE_ROOM_TTL_MS`, and `DISABLE_RATE_LIMIT` in `.env.example`.
   - Add Jest specs: `ws-rate-limit.service.spec.ts` + room cap & idle TTL specs in `games.service.spec.ts`.

### Verification Gate (Phase 1)
- `pnpm lint` exits 0 across all 5 packages.
- `pnpm -F api test` passes all existing + new security/rate-limit/TTL specs.
- `pnpm build` passes.

---

## Phase 2 — Frontend Bundle, Render Performance & Crash Resilience

**Goal**: Cut initial `/` First Load JS (currently 459 kB), eliminate unnecessary Zustand re-renders, and isolate per-game render crashes.

### Tasks

1. **Dynamic Game View Code-Splitting + Lobby Prefetch** (`Refs .scratch/0003`, `ADR 0018`)
   - Create `apps/web/src/components/lobby/game-view-loaders.ts` exporting `GAME_VIEW_LOADERS` and `next/dynamic(..., { ssr: false, loading: () => <GameChunkFallback /> })` wrappers for all 20+ game views (and heavy lobby settings panels).
   - Create lightweight Neo-brutalist `GameChunkFallback` component.
   - Refactor `apps/web/src/components/lobby/GameViewManager.tsx` to use dynamic components and trigger `GAME_VIEW_LOADERS[room.gameType]?.()` in a `useEffect` while `room.status === RoomStatus.LOBBY` (via `requestIdleCallback` with `setTimeout` fallback).
   - Update `.agents/skills/create-new-game/SKILL.md` to document registering new games in `game-view-loaders.ts`.

2. **Zustand Selector Optimization** (`Refs .scratch/0004`, `ADR 0018`)
   - Refactor selectorless `useGameStore()` calls in shell components (`page.tsx`, `GameViewManager.tsx`, `RoomHeader.tsx`, `PlayerGrid.tsx`, `HomeView.tsx`, `InviteView.tsx`, `GameSettingsManager.tsx`, `LobbyStartButton.tsx`) and high-frequency game views to use atomic selectors or `useShallow`.

3. **Two-Layer React Error Boundaries** (`Refs .scratch/0005`, `ADR 0018`)
   - Add `apps/web/src/app/error.tsx` (outer app-level boundary with localized `th`/`en` reload CTA).
   - Add `apps/web/src/components/core/GameErrorBoundary.tsx` wrapping `GameViewManager` (auto-reset on `roomCode`/`gameType` change) with **Retry** (remount view) and **Leave Room** (`leaveRoom()` back to Home).
   - Add i18n keys to `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`.

### Verification Gate (Phase 2)
- `pnpm build` shows `/` First Load JS reduced from `459 kB` to `< 220 kB`.
- `pnpm lint` exits 0.
- Playwright smoke & E2E tests pass against local `kz_game_hub_test` DB.

---

## Phase 3 — Asset & Font Optimization

**Goal**: Shrink favicon/image payload and trim unused font weights without breaking any game artwork or E2E selectors.

### Tasks

1. **Compress App Icons** (`Refs .scratch/0006`)
   - Resize/optimize `apps/web/src/app/icon.png` (512×512 PNG/optimized) and `apps/web/src/app/apple-icon.png` (180×180) from `1.64 MB` each down to `< 50 KB` each.

2. **Convert `public/images/` PNG/JPG to WebP** (`Refs .scratch/0006`)
   - Batch-convert PNG/JPG files in:
     - `apps/web/public/images/detective-club/` (80 JPGs, 34 MB)
     - `apps/web/public/images/covers/` (18 JPGs, 9.4 MB)
     - `apps/web/public/images/banana-thief/` (7 PNGs, 14 MB)
     - `apps/web/public/images/saboteur/` (10 PNGs, 480 KB)
   - Update references in `game-catalog.ts`, `RoleArtwork.tsx`, `PathTileSvg.tsx`, `detective-club/manifest.json`, and any other consumer files (verify with `grep`).
   - Keep `apps/web/public/demo/` unchanged.

3. **Trim Font Weights & Sync `<html lang>`** (`Refs .scratch/0006`)
   - Update `apps/web/src/app/layout.tsx` `IBM_Plex_Sans_Thai` weights to `['400', '500', '600', '700']` and default `<html lang="th">`.
   - Sync `document.documentElement.lang` in `useI18nStore` / language switcher effect.

### Verification Gate (Phase 3)
- `du -sh apps/web/public/images` shows major reduction (target > 60% smaller on converted folders); zero broken image links (`grep` + Playwright check).
- `pnpm -F web check:cipher-grid-pictures` and `pnpm build` pass.

---

## Phase 4 — Observability, Health Check & Database Indexes

**Goal**: Route all API logs through `AppLogger`, make `/health` verify actual DB query liveness, and add non-destructive DB indexes.

### Tasks

1. **Unify API Logging on NestJS `Logger`** (`Refs .scratch/0007`)
   - Replace all 15 `console.log`/`console.warn`/`console.error` calls in:
     - `apps/api/src/games/who-am-i/who-am-i.service.ts`
     - `apps/api/src/games/music-trivia/adapters/{youtube,spotify,soundcloud}.adapter.ts`

2. **Fix DB Health Check** (`Refs .scratch/0007`)
   - Replace `prisma.$connect()` with `prisma.$queryRaw\`SELECT 1\`` inside the 3s timeout race in `apps/api/src/health/health.controller.ts`.
   - Remove dead `getPackageVersion()` method.
   - Add `apps/api/src/health/health.controller.spec.ts`.

3. **Add Composite Prisma Indexes (Non-Destructive)** (`Refs .scratch/0008`)
   - Update `packages/database/prisma/schema.prisma`:
     - `SoundsFishyQuestion`: `@@index([lang, query_count])`
     - `GameResult`: `@@index([gameType, playerName])`, `@@index([playerName, createdAt])`
   - Leave legacy `Room` / `User` models untouched.
   - Rebuild `@repo/database` and verify `db:push` on local `kz_game_hub_test` first.

### Verification Gate (Phase 4)
- Zero `console.(log|warn|error)` calls remaining in `apps/api/src/` (excluding specs).
- `pnpm -F @repo/database build && pnpm -F api test` passes.
- Local `kz_game_hub_test` `db:push` succeeds cleanly.

---

## Phase 5 — Incremental God-File Refactor, Security Headers & Repo Hygiene

**Goal**: Improve long-term maintainability with low-risk incremental extractions and clean up headers/dependencies/root clutter.

### Tasks

1. **Incremental Extraction from `GamesGateway` & `useGameStore`** (`Refs .scratch/0009`)
   - Extract payload validation (`isValidPayload`, `hasSafeValues`, `isValidName`, `isSettingsKey`) from `apps/api/src/games/games.gateway.ts` into `apps/api/src/games/gateway/payload-validator.ts` + `payload-validator.spec.ts`.
   - Extract admin/settings/artist-preset handlers into `apps/api/src/games/gateway/admin-gateway.helper.ts`.
   - Split `apps/web/src/store/useGameStore.ts` into Zustand slices under `apps/web/src/store/slices/` (`connection.slice.ts`, `lobby.slice.ts`, `game-actions.slice.ts`) keeping `useGameStore` public API 100% identical.

2. **Security Headers, Package Dependencies & Repo Root Cleanup** (`Refs .scratch/0010`)
   - Update `apps/web/next.config.mjs`: add `poweredByHeader: false` and `headers()` returning `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`.
   - Move `@types/fs-extra` from `dependencies` to `devDependencies` in `apps/api/package.json`.
   - Add `.zcode/` to `.gitignore`.
   - Verify no script references root paths, then move `KZ-Game-Hub-Team-Play.pptx`, `KZ-Game-Hub-Presenter-Script.md`, `thai_lookthung_songs_dataset.csv`, `thai_music_game_master_dataset.xlsx`, and `AGENT_HANDOFF.md` into `docs/archive/`.

### Verification Gate (Phase 5)
- `pnpm lint`, `pnpm build`, `pnpm -F api test` all pass.
- Playwright E2E main suite passes against local `kz_game_hub_test`.
- `graphify update .` refreshes the knowledge graph.

---

## Execution Order Summary

| Phase | Issues | Primary Outcome | Risk |
| ----- | ------ | --------------- | ---- |
| **Phase 1** | `.scratch/0001`–`0002` | Green lint, CI/Deploy gate, WS rate limit, CORS, room caps | Low |
| **Phase 2** | `.scratch/0003`–`0005` | First Load JS < 220 kB, faster re-renders, crash isolation | Low–Med |
| **Phase 3** | `.scratch/0006` | Tiny icons, WebP images, lighter fonts, proper `lang` | Low |
| **Phase 4** | `.scratch/0007`–`0008` | Unified file logging, real DB health check, DB indexes | Low |
| **Phase 5** | `.scratch/0009`–`0010` | Cleaner Gateway/Store slices, security headers, tidy root | Low–Med |
