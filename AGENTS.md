# AGENTS.md — KZ Game Hub

## Quick commands

```bash
pnpm install            # pnpm@9.1.0 required, Node >=20.19.0
docker compose up -d    # PostgreSQL 15 (postgres:password@localhost:5432/kz_game_hub)
pnpm db:push            # push schema (no migration file needed in dev)
pnpm db:seed            # seed SoundsFishyQuestion (150+ Thai trivia)
pnpm dev                # turbo dev (web:3000 + api:3001)
pnpm -F api test        # run all API tests (Jest)
pnpm -F api test -- --testPathPattern=sounds-fishy   # single test file
pnpm format             # Prettier (no custom config; default settings)
```

## Env loading gotcha

A single root `.env` feeds ALL apps. Do NOT create per-app `.env` files — the code won't read them:

| Consumer | Loading code |
|----------|-------------|
| `apps/web` | `next.config.mjs` → `dotenv.config({ path: '../../.env' })` |
| `apps/api` | `src/main.ts` → `dotenv.config({ path: '../../../.env' })` |
| `packages/database` | `prisma.config.ts` → `dotenv.config({ path: '../../.env' })` |

Copy `.env.example` to `.env` at the repo root.

## Build order matters

`pnpm dev` depends on `^build` in turbo.json. This means packages build first, then apps. When you change `@repo/types` or `@repo/database`, run `pnpm build --filter=@repo/types` (or `@repo/database`) before the apps will see the changes.

`@repo/database` build runs `prisma generate && tsc` — the Prisma Client must be generated for `@prisma/client` imports to resolve in apps.

## Architecture constraints

- **WebSocket-only backend**: `apps/api` has zero REST controllers. All communication is via Socket.io events through `GamesGateway`. Do not add `@Controller` classes.
- **In-memory game state**: Room state lives in `Map<string, RoomState>` inside `GamesService`. Only Sounds Fishy trivia questions touch PostgreSQL. Do not persist game state to DB during play.
- **Server-authoritative**: Client never mutates state directly. Client emits actions → server processes → broadcasts `room_state_updated`. Zustand store (`useGameStore`) is a read-only mirror of server state.
- **Private data**: Roles and secret words are sent via `server.to(socketId).emit('role_assigned')`, NOT in broadcasted `RoomState`. Do not add sensitive fields to broadcast payloads.
- **Single-page frontend**: `apps/web/src/app/page.tsx` is a `"use client"` component that conditionally renders the correct game view based on `room.gameType`. There are no separate routes per game.

## Adding or changing Socket events — update all 4 locations

1. `packages/types/src/core.ts` — add to `SOCKET_EVENTS` constant
2. `apps/api/src/games/games.gateway.ts` — add `@SubscribeMessage` handler
3. `apps/api/src/games/games.service.ts` — add business logic method
4. `apps/web/src/store/useGameStore.ts` — add listener + action

Missing any one breaks the chain. Also rebuild `@repo/types` after changing event constants.

## Monorepo boundaries

| Package | What it contains | Import rules |
|---------|-----------------|--------------|
| `@repo/types` | All shared types, enums, `SOCKET_EVENTS` | Imported by both `api` and `web` |
| `@repo/database` | Prisma client + schema | Imported by `api` only |
| `apps/web` | Next.js frontend | Must NOT import from `apps/api` |
| `apps/api` | NestJS backend | Must NOT import from `apps/web` |

## Game module pattern

Each game (`who-know`, `tic-tac-toe`, `rps`, `gobbler`, `sounds-fishy`, `detective-club`) follows:

- `apps/api/src/games/<game>/` — service class with init/handle/reset logic, plus `*.spec.ts`
- `apps/web/src/components/games/<game>/` — view components + rules modal
- `packages/types/src/<game>.ts` — game-specific state interfaces

`GamesService` delegates to per-game services. `GamesGateway` routes Socket events to `GamesService` methods.

## Tests

API tests use Jest + `@nestjs/testing` `Test.createTestingModule`. Sounds Fishy tests mock `@repo/database` with `jest.mock()`. Run from `apps/api`:

```bash
pnpm -F api test                          # all tests
pnpm -F api test -- --testPathPattern=rps  # single game
```

No frontend tests exist.

## Existing agent docs

Detailed docs live in `.agent/`:
- `.agent/agent.md` — identity, behavior guidelines, key file refs
- `.agent/architecture.md` — full architecture with data flow diagram
- `.agent/infrastructure.md` — scripts, ports, deployment
- `.agent/rules.md` — naming, style, do's/don'ts

## Git conventions

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- Branches: `feature/<name>`, `fix/<name>`, `docs/<name>`
