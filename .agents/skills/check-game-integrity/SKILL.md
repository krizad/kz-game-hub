---
name: check-game-integrity
description: >-
  Audit and verify the completeness and integrity of any game implementation in KZ Game Hub. Trigger when the user asks to "check a game", "audit game", "ตรวจเช็คเกม", "เช็คเกมตกหล่น", "verify game implementation", "check game touchpoints", "audit codebase for game inconsistencies", or before concluding any new game development task. Checks types, database seed, backend services, frontend lobby/header/rules, i18n dictionaries, and tests.
---

# Check Game Integrity — KZ Game Hub

This skill provides a rigorous audit procedure to verify that a game (or all games) in KZ Game Hub is 100% complete, free of missing touchpoints, properly localized, and architecturally compliant with the platform standards.

When adding or refactoring a game, subtle touchpoints (like database seeds, header title banners, or admin toggles) are frequently overlooked. Use this skill to run automated grep checks and systematic reviews.

---

## 🔍 The 8-Point Integrity Audit Matrix

Every game with enum key `<GAME_TYPE>` (e.g., `BANANA_THIEF`) and slug `<game>` (e.g., `banana-thief`) must pass all 8 checkpoints below:

| # | Dimension | Required Touchpoints & Verification Rule |
| :--- | :--- | :--- |
| **1** | **Types & Enums** | • `GameType.<GAME_TYPE>` in `packages/types/src/core.ts`<br>• `RoomState.<game>State?` in `packages/types/src/core.ts`<br>• Exported from `packages/types/src/index.ts`<br>• Verified: `pnpm build --filter=@repo/types` succeeds. |
| **2** | **Database Seed & Admin** | • `<GAME_TYPE>` present in `packages/database/prisma/seed.ts` inside `gameTypes` array.<br>• Registered in `apps/web/src/components/lobby/AdminGameSettings.tsx` in `ALL_FLAGS` with a `labelKey`. |
| **3** | **Backend Lifecycle** | • Registered in `GamesModule.providers` (`apps/api/src/games/games.module.ts`).<br>• Injected and initialized in `GamesService.createRoom` / `resetRoom`.<br>• `remapSocketId()` called during player reconnect in `GamesService.joinRoom`.<br>• Active timers cleared in `GamesService.deleteRoom`.<br>• `this.maybeRecordGameResult(room)` called in gateway upon reaching `RoomStatus.RESULT`. |
| **4** | **Socket Routing** | • `@SubscribeMessage` handlers exist in `apps/api/src/games/games.gateway.ts` for all action events.<br>• Timer synchronization helper (`sync<Game>Timer`) properly validates state before advancing. |
| **5** | **Frontend Lobby & Header** | • `HomeView.tsx`: added to `getGameName()` and `games` array.<br>• **CRITICAL**: `HomeView.tsx` card name **MUST** use `t('lobby.gameNames.<game>')` (no hardcoded English strings!).<br>• **CRITICAL**: `RoomHeader.tsx` **MUST** have an explicit case for `room.gameType === GameType.<GAME_TYPE>` with `t('lobby.gameNames.<game>')`. Failing this causes it to display **"Who Know!"**.<br>• `GameViewManager.tsx`: renders `<Game>View` when status !== `LOBBY`.<br>• `LobbyStartButton.tsx`: minimum player count defined in `getMinPlayers()`.<br>• `RulesModal.tsx`: tab button and content renderer added. |
| **6** | **Localization (i18n)** | • `schema.ts`: `lobby.gameNames.<game>` and `rules.modal.tabs.<game>` defined.<br>• `th.ts`: Thai translations provided.<br>• `en.ts`: English translations provided. |
| **7** | **Testing & E2E** | • Unit test exists: `apps/api/src/games/<game>/<game>.service.spec.ts`.<br>• Dedicated E2E spec exists: `apps/web/e2e/<game>.spec.ts`.<br>• Simulation registered in `apps/web/e2e/sim/matrix.ts` & `play.ts`. |
| **8** | **Documentation & Knowledge Graph** | • Game listed in `README.md` under `## 🚀 Available Games`.<br>• Module name listed in `AGENTS.md` under `Game module pattern`.<br>• Knowledge graph updated via `graphify update .`. |

---

## ⚡ Quick Automated Audit Script

Run these bash commands in your terminal or subagent to audit a game by replacing `<GAME_TYPE>` and `<game>`:

```bash
GAME_TYPE="BANANA_THIEF"
GAME_SLUG="banana-thief"

echo "=== 1. Checking Database Seed ==="
grep -n "$GAME_TYPE" packages/database/prisma/seed.ts || echo "❌ MISSING in seed.ts!"

echo "=== 2. Checking RoomHeader Title Banner ==="
grep -n "$GAME_TYPE" apps/web/src/components/lobby/RoomHeader.tsx || echo "❌ MISSING in RoomHeader.tsx (Will fallback to Who Know!)"

echo "=== 3. Checking Admin Settings Flag ==="
grep -n "$GAME_TYPE" apps/web/src/components/lobby/AdminGameSettings.tsx || echo "❌ MISSING in AdminGameSettings.tsx"

echo "=== 4. Checking HomeView Card & i18n ==="
grep -n "$GAME_TYPE" apps/web/src/components/lobby/HomeView.tsx || echo "❌ MISSING in HomeView.tsx"

echo "=== 5. Checking Dedicated E2E Spec ==="
ls "apps/web/e2e/${GAME_SLUG}.spec.ts" 2>/dev/null || echo "❌ MISSING apps/web/e2e/${GAME_SLUG}.spec.ts"

echo "=== 6. Checking README.md & AGENTS.md ==="
grep -in "$GAME_SLUG" README.md || echo "❌ MISSING in README.md"
grep -in "$GAME_SLUG" AGENTS.md || echo "❌ MISSING in AGENTS.md"
```

---

## 📋 Comprehensive Audit Procedure

Follow this checklist step-by-step when conducting a manual audit:

### Step 1: Scan for Hardcoded English Strings in Lobby & Header
Open `apps/web/src/components/lobby/HomeView.tsx` and `apps/web/src/components/lobby/RoomHeader.tsx`.
Check for strings like:
```tsx
// ❌ WRONG: Hardcoded English breaks i18n when player switches to Thai
name: 'Banana Thief',
room.gameType === GameType.BANANA_THIEF ? 'Banana Thief' : ...

// ✅ CORRECT: Always use t()
name: t('lobby.gameNames.bananaThief'),
room.gameType === GameType.BANANA_THIEF ? t('lobby.gameNames.bananaThief') : ...
```

### Step 2: Verify RoomHeader Fallback Safety
In `RoomHeader.tsx`, check the ternary chain for `room.gameType`. Ensure every `GameType` enum variant has a branch. If any game falls through to the final `: t('lobby.gameNames.whoKnow')`, mark it as a defect and fix immediately.

### Step 3: Verify Database Seed Upsert
Check `packages/database/prisma/seed.ts`. Ensure the game type string is present in the `gameTypes` array so `prisma.gameSetting.upsert()` seeds the default enabled state row.

### Step 4: Verify Reconnect Remapping
In `apps/api/src/games/games.service.ts`:
Search for `joinRoom` and verify that when a reconnect occurs (`oldSocketId !== user.socketId`), the game's `remapSocketId` method is called. Without this, reconnected players lose control of their turn or actions.

### Step 5: Verify Result Recording for Leaderboard
In `apps/api/src/games/games.gateway.ts`:
Check all event handlers where the game can end (e.g. game over, victory condition, timer timeout). Ensure `this.maybeRecordGameResult(room)` is called after state transition.

### Step 6: Verify Tests & Compilation
Run:
```bash
# 1. API Unit tests
pnpm -F api test -- --testPathPattern=<game>

# 2. Typecheck and build
pnpm build

# 3. E2E test
pnpm -F web exec playwright test apps/web/e2e/<game>.spec.ts
```
