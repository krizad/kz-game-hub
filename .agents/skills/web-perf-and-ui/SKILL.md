---
name: web-perf-and-ui
description: >-
  Frontend Next.js 14 App Router, Zustand state, bundle optimization, error boundaries, i18n, and Neo-brutalist UI standards for apps/web in KZ Game Hub. Trigger when editing apps/web components, GameViewManager, useGameStore, next.config.mjs, layout.tsx, i18n dictionaries, or public/images assets.
---

# Web Performance & UI Standards — KZ Game Hub

## Bundle & Code-Splitting (ADR 0018)

1. **Dynamic Game Views**: Never statically import per-game views in `apps/web/src/components/lobby/GameViewManager.tsx`. Register them in `game-view-loaders.ts` using `next/dynamic(..., { ssr: false, loading: () => <GameChunkFallback /> })`.
2. **Lobby Prefetching**: While `room.status === RoomStatus.LOBBY`, prefetch `GAME_VIEW_LOADERS[room.gameType]` via `requestIdleCallback` (with `setTimeout` fallback) so clicking Start opens the game immediately while keeping the Home `/` First Load JS small.
3. **Assets & Fonts**:
   - Prefer `.webp` for all game artwork and covers under `apps/web/public/images/`.
   - Keep `apps/web/src/app/icon.png` and `apple-icon.png` under 50 KB each.
   - Load only used `IBM_Plex_Sans_Thai` weights (`400`, `500`, `600`, `700`) in `layout.tsx`.
   - Keep `poweredByHeader: false` and standard non-breaking security headers in `apps/web/next.config.mjs`.

## Zustand Store Discipline (`useGameStore`)

- **Always use selectors**: Avoid selectorless `const { ... } = useGameStore();` in components. Use atomic selectors (`useGameStore((s) => s.room)`) or `useShallow` from `zustand/react/shallow` to prevent cascading re-renders on unrelated updates (`serverTimeOffset`, `availableRooms`, `liveTyping`).
- **Read-only mirror**: Never mutate server-owned `RoomState` optimistically in client components; emit Socket actions and let `room_state_updated` drive UI state.
- **Slice organization**: When refactoring `useGameStore.ts`, split into composable slices (`store/slices/connection.slice.ts`, `lobby.slice.ts`, `game-actions.slice.ts`) while keeping the `useGameStore` export backwards-compatible.

## Resilience & Error Boundaries (ADR 0018)

- Maintain two layers:
  1. `apps/web/src/app/error.tsx` — app-level crash recovery (localized `th`/`en` reload).
  2. `GameErrorBoundary` wrapping `GameViewManager` — isolates single-game render crashes while preserving the Socket.io connection, offering **Retry** and **Leave Room** actions.

## i18n & Testing Conventions

- **Zero hardcoded UI strings**: Every user-facing label belongs in `apps/web/src/i18n/dictionaries/{schema,th,en}.ts` (Thai is default).
- **Server error localization**: Map all API error strings/codes in `apps/web/src/i18n/serverErrors.ts` (`th` & `en`).
- **Keep `<html lang>` synced**: Default to `th` and sync `document.documentElement.lang` when the user toggles language.
- **Playwright & Demo selectors**: Add stable `data-testid` attributes to interactive buttons/controls (never rely on visible text, which is localized or CSS-uppercased).
- **Visual identity**: Follow `DESIGN.md` — Neo-brutalist Party Game Arcade (`border-2`/`border-4 border-black`, hard offset shadows `shadow-[4px_4px_0_0_#000]`, warm `#FEF08A` canvas, mobile-first `min-h-[100dvh]` with safe-area padding).
