# 0018. Frontend Dynamic Game Loading, Lobby Prefetch, and Two-Layer Error Boundaries

Status: Accepted
Date: 2026-11-24

## Context

`apps/web` is a single-page Next.js App Router application (`apps/web/src/app/page.tsx`) where `GameViewManager.tsx` switches across 20+ games. Currently:

1. **Monolithic initial JS bundle**: `GameViewManager.tsx` statically imports all 20+ game view components (and their dependencies such as `react-player`, `canvas-confetti`, and game-specific helpers). As a result, `next build` reports **371 kB page size / 459 kB First Load JS** for `/`, forcing mobile users visiting the lobby to download code for every game before creating or joining a room.
2. **Unnecessary store re-renders**: 64 call sites invoke `useGameStore()` without a selector, causing root components (`page.tsx`, `GameViewManager.tsx`) and game views to re-render on unrelated store updates (e.g., `serverTimeOffset`, `availableRooms`, `liveTyping`).
3. **No React Error Boundaries**: Neither `apps/web/src/app/error.tsx` nor a per-game boundary exists. An unhandled render exception inside any single game view crashes the entire application with no recovery path back to the lobby.

## Decision

1. **Dynamic Imports for All Game Views (`next/dynamic`)**:
   - Convert all per-game view imports in `GameViewManager.tsx` (and heavy lobby settings panels where appropriate) to `next/dynamic(() => import(...), { ssr: false, loading: () => <GameChunkFallback /> })`.
   - Keep `ssr: false` because every game view depends on live client-side Socket.io state and browser APIs.
   - Provide a lightweight Neo-brutalist `GameChunkFallback` skeleton matching the hub's visual system so chunk loading feels seamless.

2. **Lobby-Phase Prefetching**:
   - Maintain a loader map `GAME_VIEW_LOADERS: Record<GameType, () => Promise<unknown>>` shared between `next/dynamic` and a `useEffect` hook in `GameViewManager.tsx`.
   - While `room.status === RoomStatus.LOBBY`, trigger the loader for `room.gameType` in the background (e.g., via `requestIdleCallback` with `setTimeout` fallback).
   - Home page visitors download **zero** game chunks; players inside a room lobby have the active game's chunk pre-warmed before the host clicks Start.

3. **Two-Layer React Error Boundaries**:
   - **Outer layer (`apps/web/src/app/error.tsx`)**: Catches app-level crashes outside gameplay and offers a localized (`th`/`en`) full-page reload recovery UI.
   - **Inner layer (`GameErrorBoundary` wrapping `GameViewManager`)**: Catches render errors inside the active game view while preserving the live Socket.io connection. Displays localized (`th`/`en`) recovery actions:
     - **Retry (`ลองโหลดเกมใหม่` / `Reload Game View`)**: Resets boundary error state to re-mount the game view.
     - **Leave Room (`ออกจากห้องกลับหน้าหลัก` / `Leave Room`)**: Calls `leaveRoom()` cleanly and returns to the home lobby.

4. **Zustand Selector Discipline**:
   - Refactor selectorless `useGameStore()` calls in core shell components (`page.tsx`, `GameViewManager.tsx`, `RoomHeader.tsx`, `PlayerGrid.tsx`, `HomeView.tsx`) and high-frequency game views to use atomic selectors or `useShallow` from `zustand/react/shallow`.

## Consequences

- **Positive**: Dramatically lowers First Load JS for `/` (target: under 200 kB First Load JS), eliminates loading flicker when starting a match via lobby prefetch, cuts avoidable re-renders, and isolates per-game crashes.
- **Negative**: Slightly more boilerplate when registering a new game (add one entry to `GAME_VIEW_LOADERS`). Document this in `.agents/skills/create-new-game/SKILL.md`.
- **Verification**: Compare `next build` First Load JS before/after, verify E2E suites pass (including `demo.spec.ts` and `playwright.sim.config.ts`), and test `GameErrorBoundary` fallback + recovery flow.
