---
name: create-new-game
description: >-
  Use this skill when the user asks to "create a new game", "add a game", or "build a new mini-game" 
  for the KZ Game Hub platform. It guides you through the full-stack process of scaffolding and wiring up 
  a new game using the established Socket.io + Zustand architecture, including privacy hardening and server-authoritative state.
---

# Create New Game - KZ Game Hub

Follow these steps to scaffold and integrate a new real-time multiplayer game into the KZ Game Hub platform. 
Before writing code, ALWAYS use the `create-implementation-plan` skill to plan the specific game logic with the user.

## Game Module File Structure
When building a new game (e.g., `my-game`), you will be creating/modifying files across three main areas of the Turborepo:

```text
kz-game-hub/
├── packages/types/src/
│   ├── core.ts                     <-- (Modify) Add GameType and SOCKET_EVENTS
│   └── my-game.ts                  <-- (New) Define game state & socket payloads interfaces
│
├── apps/api/src/games/
│   ├── games.gateway.ts            <-- (Modify) Route socket events to your service
│   ├── games.service.ts            <-- (Modify) Initialize and route room state to your service
│   └── my-game/
│       ├── my-game.service.ts      <-- (New) Core backend logic (init, handle events, timers)
│       └── my-game.service.spec.ts <-- (New) Unit tests for the game logic
│
└── apps/web/src/
    ├── store/
    │   └── useGameStore.ts         <-- (Modify) Add socket listeners and action dispatchers
    ├── components/
    │   ├── lobby/
    │   │   ├── HomeView.tsx        <-- (Modify) Add game selection card
    │   │   └── GameViewManager.tsx <-- (Modify) Render your View based on GameType
    │   └── games/my-game/
    │       ├── MyGameView.tsx      <-- (New) Main React view component for the game
    │       └── MyGameRules.tsx     <-- (New) Rules modal content
    └── i18n/dictionaries/          <-- (Modify) Add translations in schema, en.ts, th.ts
```

## Step 1: Types & Boilerplate (`@repo/types`)
1. Create `packages/types/src/<game>.ts`. Define your specific game state interface (e.g. `MyGameState`), private state, and any socket payloads.
2. In `packages/types/src/core.ts`:
   - Add your game to the `GameType` enum.
   - Add your game's state to `RoomState` as an optional field (e.g. `myGameState?: MyGameState`).
   - Add your game's socket events to the `SOCKET_EVENTS` constant.
3. **IMPORTANT**: Rebuild `@repo/types` with `pnpm build --filter=@repo/types`.

## Step 2: Server-Side Logic (`apps/api`)
1. Create the folder `apps/api/src/games/<game>/`.
2. Create the service `apps/api/src/games/<game>/<game>.service.ts`.
   - **MUST USE**: Inject `PrivateStateService` for any sensitive data (e.g. secret words, roles) instead of putting them in `RoomState`. Send private data directly via `server.to(socketId).emit()`.
   - **MUST USE**: Inject `RoomTimerService` for any server-side timers (do not use `setInterval` or `setTimeout` manually).
3. Inject your new service into `apps/api/src/games/games.service.ts`:
   - Call your service's `resetState()` when a room is created or reset.
   - Map reconnecting players in `joinRoom()` if applicable.
4. Route Socket events in `apps/api/src/games/games.gateway.ts`:
   - Add `@SubscribeMessage()` handlers for your game's specific events, extracting `socket.data.roomId` and `socket.id`.

## Step 3: Client-Side State (`apps/web`)
1. In `apps/web/src/store/useGameStore.ts`:
   - Add socket event listeners inside `setupListeners()` to handle private events specific to your game.
   - Add dispatch actions (e.g. `myGameMakeMove: (data) => get().socket?.emit('my_game_event', data)`).
2. Note: The public `RoomState` is automatically mirrored to `useGameStore`, so you don't need to manually update it for broadcasted state.

## Step 4: Client-Side UI (`apps/web`)
1. Create `apps/web/src/components/games/<game>/<Game>View.tsx`.
   - Read `room.<game>State` from `useGameStore()`.
   - Render the game based on the current player's role, turn, etc.
   - Use Tailwind CSS and Framer Motion for rich aesthetics and micro-animations. Use `lucide-react` for icons.
2. Add a rules component (`<Game>Rules.tsx`) for the rules modal.
3. Integrate the view into `apps/web/src/components/lobby/GameViewManager.tsx`:
   - Add the new `GameType` to the switch statement to render your view.
4. Add the game to `apps/web/src/components/lobby/HomeView.tsx`:
   - Add a game card button so users can create rooms for this game.

## Step 5: Localization
1. Update `apps/web/src/i18n/dictionaries/schema.ts` with your new game's keys.
2. Provide translations in `th.ts` and `en.ts`.

## Constraints & Rules
- **Server-Authoritative**: The client NEVER mutates state directly. Always emit an action to the server, and rely on `ROOM_STATE_UPDATED` or private emits to reflect changes.
- **No Direct API calls**: Everything uses WebSocket events. Do not add REST controllers for game logic.
- **Single Root `.env`**: Environment variables are located at the root of the monorepo.
