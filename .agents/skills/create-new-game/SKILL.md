---
name: create-new-game
description: >-
  Scaffold and wire up a new real-time multiplayer game in KZ Game Hub. Trigger when the user asks to "create a new game", "add a game", "build a new mini-game", "สร้างเกมใหม่", "เพิ่มเกม", "สร้างมินิเกม", "implement a game", or add any new game module to the platform. Guides full-stack integration across @repo/types, NestJS backend, Next.js frontend, Zustand store, Socket.io events, lobby setup, rules modal, and i18n dictionaries.
---

# Create New Game — KZ Game Hub

This skill provides the comprehensive full-stack workflow for adding a new multiplayer game to KZ Game Hub. It ensures adherence to the platform's strict architectural constraints: **server-authoritative state**, **zero private-state leaks**, **reconnection resilience**, **in-memory room state**, and **neo-brutalism design aesthetics**.

Before writing code, ALWAYS review requirements and design with the user (or create an implementation plan).

---

## 🗺️ Touchpoints Architecture & File Map

When adding a game (referred to below as `<game>`, e.g., `the-mind`, `coup`, `my-game`), you will create or modify files across **3 packages/apps**:

```text
kz-game-hub/
├── packages/types/src/
│   ├── <game>.ts                           <-- [NEW] State, action, and payload interfaces
│   ├── core.ts                             <-- [MODIFY] GameType enum, RoomState field, SOCKET_EVENTS
│   └── index.ts                            <-- [MODIFY] Re-export types from ./<game>
│
├── apps/api/src/games/
│   ├── <game>/
│   │   ├── <game>.service.ts               <-- [NEW] Core backend game logic (turns, validation, timers)
│   │   └── <game>.service.spec.ts          <-- [NEW] Jest unit tests
│   ├── games.module.ts                     <-- [MODIFY] Register <Game>Service in providers!
│   ├── games.gateway.ts                    <-- [MODIFY] @SubscribeMessage Socket.io handlers
│   └── games.service.ts                    <-- [MODIFY] Room lifecycle: resetState, joinRoom reconnect, timer cleanup
│
└── apps/web/
    ├── src/
    │   ├── store/
    │   │   └── useGameStore.ts             <-- [MODIFY] Action dispatchers & private state listeners
    │   ├── components/
    │   │   ├── games/<game>/
    │   │   │   ├── <Game>View.tsx          <-- [NEW] Main game screen component
    │   │   │   ├── <Game>Rules.tsx         <-- [NEW] Rules modal content component
    │   │   │   └── <Game>Settings.tsx      <-- [OPTIONAL NEW] Custom lobby settings panel
    │   │   ├── lobby/
    │   │   │   ├── HomeView.tsx            <-- [MODIFY] Add to getGameName() and create-room card button
    │   │   │   ├── GameViewManager.tsx     <-- [MODIFY] Render <Game>View in game switch
    │   │   │   ├── LobbyStartButton.tsx    <-- [MODIFY] Set minPlayers count in getMinPlayers()
    │   │   │   └── GameSettingsManager.tsx <-- [OPTIONAL MODIFY] Render settings if game has custom config
    │   │   └── RulesModal.tsx              <-- [MODIFY] Add tab button & switch case in renderContent()
    │   └── i18n/dictionaries/
    │       ├── schema.ts                   <-- [MODIFY] TypeScript schema for translation keys
    │       ├── th.ts                       <-- [MODIFY] Thai translations (default language)
    │       └── en.ts                       <-- [MODIFY] English translations
    └── e2e/
        └── <game>.spec.ts                  <-- [NEW] Playwright multiplayer E2E test
```

---

## 🚀 Step-by-Step Implementation Guide

### Step 1: Types Definition (`packages/types`)

1. **Create `packages/types/src/<game>.ts`**:
   - Define `<Game>State` representing public room state (e.g. board, phase, turn, scores).
   - Define private state (if any) sent only to individual players (e.g. player hand, hidden role).
   - Define action payload interfaces (e.g. `MakeMovePayload`, `SelectCardPayload`).
2. **Update `packages/types/src/core.ts`**:
   - Add `<GAME_NAME> = '<GAME_NAME>'` to the `GameType` enum.
   - Add optional `<game>State?: <Game>State` to `RoomState`.
   - Add socket event names to `SOCKET_EVENTS` (e.g. `<GAME>_ACTION: '<game>_action'`).
3. **Update `packages/types/src/index.ts`**:
   - Add `export * from './<game>';`.
4. **CRITICAL BUILD STEP**:
   ```bash
   pnpm build --filter=@repo/types
   ```
   _Both `api` and `web` rely on the compiled output of `@repo/types`. If you skip this, TypeScript compiler will throw errors in subsequent steps._

---

### Step 2: Backend Implementation (`apps/api`)

1. **Create `apps/api/src/games/<game>/<game>.service.ts`**:
   - Implement methods:
     - `initState(players: UserState[], config?: RoomConfig): <Game>State`
     - `handleAction(room: RoomState, socketId: string, payload: any): void`
     - `resetState(room: RoomState): void`
     - `handleReconnect(state: <Game>State, oldSocketId: string, newSocketId: string): void`
   - **Privacy Hardening**: If the game has secret roles or hidden cards, NEVER put them in `room.<game>State`. Inject and use `PrivateStateService`:
     ```typescript
     this.privateStateService.setPrivateState(roomId, socketId, privateData);
     this.server.to(socketId).emit(SOCKET_EVENTS.PRIVATE_STATE_UPDATED, privateData);
     ```
   - **Timers**: If the game has timed rounds or auto-advancing turns, NEVER use raw `setInterval`/`setTimeout`. Inject `RoomTimerService`:
     ```typescript
     this.roomTimerService.startTimer(roomId, durationSec, () => this.handleTimeout(roomId));
     ```
2. **Register in `apps/api/src/games/games.module.ts`**:
   - Add `<Game>Service` to the `providers` array of `GamesModule`. _(Failing to do this causes NestJS dependency injection failure at runtime)._
3. **Wire into `apps/api/src/games/games.service.ts`**:
   - Inject `<Game>Service` into `GamesService` constructor.
   - In `resetRoom()` / `createRoom()`: call `this.<game>Service.resetState(room)`.
   - In `joinRoom()`: handle player reconnection by remapping socket IDs in state:
     ```typescript
     if (room.gameType === GameType.<GAME> && room.<game>State) {
       this.<game>Service.handleReconnect(room.<game>State, oldSocketId, newSocketId);
     }
     ```
   - In `deleteRoom()`: cancel any active timers via `this.roomTimerService.clearTimer(roomId)`.
4. **Route Events in `apps/api/src/games/games.gateway.ts`**:
   - Add `@SubscribeMessage(SOCKET_EVENTS.<EVENT_NAME>)` handlers:
     ```typescript
     @SubscribeMessage(SOCKET_EVENTS.<EVENT_NAME>)
     handle<EventName>(
       @ConnectedSocket() client: Socket,
       @MessageBody() payload: <PayloadType>,
     ) {
       const roomId = client.data.roomId;
       if (!roomId) return;
       this.gamesService.handle<EventName>(roomId, client.id, payload);
     }
     ```
5. **Unit Tests**:
   - Create `apps/api/src/games/<game>/<game>.service.spec.ts`.
   - Test initialization, turn order, valid actions, invalid actions, win conditions, and reconnects.
   - Run tests:
     ```bash
     pnpm -F api test -- --testPathPattern=<game>
     ```

---

### Step 3: Client Store & Actions (`apps/web/src/store/useGameStore.ts`)

1. **Add actions to `useGameStore`**:
   - Define action functions (e.g. `<game>MakeMove: (payload) => { get().socket?.emit(SOCKET_EVENTS.<GAME_ACTION>, payload); }`).
2. **Handle private state listeners (if applicable)**:
   - In `setupListeners()` inside `useGameStore.ts`, ensure `SOCKET_EVENTS.PRIVATE_STATE_UPDATED` or game-specific private events are caught and stored in a store field.
3. _Note_: Public room state updates (`SOCKET_EVENTS.ROOM_STATE_UPDATED`) are automatically handled and set to `useGameStore.getState().room`.

---

### Step 4: Client UI Components (`apps/web/src/components/games/<game>/`)

1. **Create `<Game>View.tsx`**:
   - Neo-brutalism design style: thick black borders (`border-4 border-black`), sharp drop shadows (`shadow-[4px_4px_0_0_#000]`), bold vibrant colors, bold typography (`font-black`), and micro-interactions.
   - Use `useGameStore()` to read `room`, `myName`, `myRole`, or private state.
   - Use `lucide-react` for icons and `framer-motion` for fluid animations.
2. **Create `<Game>Rules.tsx`**:
   - Component rendering formatted rules, roles, win conditions, and turn progression for the rules modal.
3. **Optional `<Game>Settings.tsx`**:
   - If the host can configure options (rounds, timer speed, difficulty), create a settings component with inputs/toggles.

---

### Step 5: Lobby & Modal Integrations

1. **`apps/web/src/components/lobby/HomeView.tsx`**:
   - In `getGameName(gameType, t)`: add case for `GameType.<GAME>` returning translated or styled title.
   - In the game selection grid: add a button/card allowing players to create a room with `onClick={() => createRoom(GameType.<GAME>)}`.
2. **`apps/web/src/components/lobby/GameViewManager.tsx`**:
   - Add condition to `renderGameView()` to render `<Game>View`.
   - If the game uses the standard waiting lobby, ensure it checks `room.status !== RoomStatus.LOBBY` before rendering the active game board.
3. **`apps/web/src/components/lobby/LobbyStartButton.tsx`**:
   - In `getMinPlayers()`: add case for `GameType.<GAME>` returning minimum required players (e.g., 2, 3, or 4).
   - If start requires specific room configuration (like queries or categories), add validation to `isDisabled`.
4. **`apps/web/src/components/RulesModal.tsx`**:
   - Add tab button in the tab bar for `GameType.<GAME>`.
   - Add case in `renderContent()` returning `<GameRules />`.
5. **`apps/web/src/components/lobby/GameSettingsManager.tsx` (if game has config)**:
   - Include `<GameSettings />` in `hasSettings` check and render condition.

---

### Step 6: Localization (`apps/web/src/i18n/dictionaries/`)

1. **`schema.ts`**: Update `Dictionary` interface with any new keys needed (e.g. under `lobby.gameNames`, `rules.modal.tabs`, or `<game>` namespace).
2. **`th.ts`**: Add Thai translations (Thai is the default language of the application).
3. **`en.ts`**: Add English translations.

---

### Step 7: Verification & Testing

1. **Compile shared types**:
   ```bash
   pnpm build --filter=@repo/types
   ```
2. **Run Backend Unit Tests**:
   ```bash
   pnpm -F api test -- --testPathPattern=<game>
   ```
3. **E2E Testing with Playwright**:
   - Add `apps/web/e2e/<game>.spec.ts` testing room creation, player join, and game progression using multi-browser contexts.
   - Run E2E test:
     ```bash
     pnpm test:e2e
     ```
4. **Formatting & Typecheck**:
   ```bash
   pnpm format
   pnpm dev
   ```

---

## ⚠️ Common Pitfalls & Invariant Checklist

| Checkpoint                 | Requirement / Gotcha                                                                                                                         |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-Authoritative**   | Never calculate game outcomes on client. Client emits action -> server validates and mutates -> server broadcasts `room_state_updated`.      |
| **Private State Security** | Never include secret words, traitor identities, or hidden cards in broadcasted `RoomState`. Use `PrivateStateService` or direct socket emit. |
| **Build Order**            | Always run `pnpm build --filter=@repo/types` immediately after modifying `packages/types`.                                                   |
| **NestJS Registration**    | Always register `<Game>Service` in `GamesModule.providers`.                                                                                  |
| **Reconnection Handling**  | When a player reconnects (`joinRoom`), remap their socket ID in the game state (`oldSocketId` -> `newSocketId`).                             |
| **Timer Cleanup**          | Always use `RoomTimerService` so timers don't leak in memory when a game ends or room is reset.                                              |
| **Lobby Start Button**     | Always define minimum player count in `LobbyStartButton.tsx`. Default is 2.                                                                  |
