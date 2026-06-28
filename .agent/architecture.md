# 🏗 Architecture — KZ Game Hub

## Tech Stack

| Layer            | Technology                   | Version              |
| ---------------- | ---------------------------- | -------------------- |
| Monorepo         | Turborepo + pnpm             | turbo ^2.0, pnpm 9.1 |
| Backend          | NestJS + Socket.io           | -                    |
| Frontend         | Next.js (App Router)         | 14+                  |
| State Management | Zustand                      | -                    |
| ORM              | Prisma + PostgreSQL          | -                    |
| UI Components    | Tailwind CSS + Framer Motion | -                    |
| Icons            | Lucide React                 | -                    |
| Language         | TypeScript                   | ^5.4                 |
| Node.js          | -                            | ≥20.19               |
| AI               | Google Gemini (GenAI SDK)    | -                    |
| i18n             | Custom dictionaries (th/en)  | -                    |

---

## Monorepo Structure

```text
kz-game-hub/
├── apps/
│   ├── api/                    # NestJS Backend (The Brain)
│   │   └── src/
│   │       ├── main.ts         # Bootstrap + CORS setup
│   │       ├── app.module.ts   # Root module
│   │       └── games/          # Core game module
│   │           ├── games.module.ts
│   │           ├── games.gateway.ts   # Socket.io WebSocket Gateway
│   │           ├── games.service.ts   # Room & Game state logic
│   │           ├── who-know/          # Who Know game logic
│   │           ├── tic-tac-toe/       # Classic TTT logic
│   │           ├── gobbler/           # Gobbler TTT logic
│   │           ├── rps/               # Rock Paper Scissors logic
│   │           ├── sounds-fishy/      # Sounds Fishy logic
│   │           ├── detective-club/    # Detective Club logic
│   │           └── who-am-i/          # Who Am I logic
│   │       └── health/               # GET /health REST endpoint
│   │
│   └── web/                    # Next.js Frontend (Player's Screen)
│       └── src/
│           ├── app/            # App Router pages (single page SPA-like)
│           │   ├── layout.tsx
│           │   ├── page.tsx    # Main game page (lobby + game rendering)
│           │   └── globals.css
│           ├── components/
│           │   ├── core/       # Shared UI (CountdownTimer, utils)
│           │   ├── games/      # Game-specific components
│           │   │   ├── who-know/
│           │   │   ├── tic-tac-toe/
│           │   │   ├── gobbler/
│           │   │   ├── rps/
│           │   │   ├── sounds-fishy/
│           │   │   ├── detective-club/
│           │   │   └── who-am-i/
│           │   ├── RoleCard.tsx
│           │   └── RulesModal.tsx
│           ├── store/
│           │   ├── useGameStore.ts    # Zustand + Socket.io state
│           │   └── useI18nStore.ts    # i18n language state
│           ├── hooks/
│           ├── lib/
│           └── i18n/dictionaries/    # th/en translations
│
├── packages/
│   ├── types/                  # Shared TypeScript Definitions
│   │   └── src/
│   │       ├── core.ts         # RoomState, UserState, GameType, SOCKET_EVENTS
│   │       ├── tic-tac-toe.ts
│   │       ├── gobbler-tic-tac-toe.ts
│   │       ├── rps.ts
│   │       ├── who-know.ts
│       │       ├── sounds-fishy.ts
│   │       ├── detective-club.ts
│   │       └── who-am-i.ts
│   ├── database/               # Prisma Client & Schema
│   │   └── prisma/schema.prisma
│   └── config/                 # Shared ESLint, TSConfig, Prettier
│
├── .agent/                     # AI Agent instructions
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │  Next.js UI   │◄──│ Zustand Store     │◄──│ Socket.io │  │
│  │  (Components) │──►│ (useGameStore.ts) │──►│ Client    │  │
│  └──────────────┘    └──────────────────┘    └─────┬─────┘  │
└────────────────────────────────────────────────────│─────────┘
                                                     │ WebSocket
                                                     │
┌────────────────────────────────────────────────────│─────────┐
│                        Server (NestJS)             │         │
│                                                     │         │
│  ┌──────────────────┐    ┌──────────────────────┐  │         │
│  │ GamesGateway     │◄──►│ Socket.io Server     │◄─┘         │
│  │ (@SubscribeMsg)  │    └──────────────────────┘            │
│  └────────┬─────────┘                                        │
│           │                                                   │
│  ┌────────▼─────────┐    ┌──────────────────────┐            │
│  │ GamesService     │──►│ Game Logic Modules    │            │
│  │ (Room Map)       │    │ (who-know, rps, etc.) │            │
│  └────────┬─────────┘    └──────────────────────┘            │
│           │                                                   │
│  ┌────────▼─────────┐                                        │
│  │ Prisma (DB)      │  ← ใช้เฉพาะ Sounds Fishy (seed data)  │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Room-Based Session Management

- ห้องเก็บใน **In-Memory Map** (`Map<string, RoomState>`) ภายใน `GamesService`
- Key = Room Code (6-character uppercase)
- Room Host ควบคุม Game Lifecycle (start, reset, config)
- ทุกการเปลี่ยนแปลง state → broadcast `ROOM_STATE_UPDATED` ไปยังทุกคนในห้อง

### 2. Multi-Game Hub Pattern

- `RoomState.gameType` (enum `GameType`) กำหนดว่าห้องนี้เล่นเกมอะไร
- Game-specific state เก็บใน optional fields: `ticTacToeState?`, `rpsState?`, `gobblerState?`, `soundsFishyState?`, `detectiveClubState?`
- สร้างห้องเดียว สลับเกมได้ — Frontend render component ตาม `gameType`

### 3. Socket Event Lifecycle

```
Client                          Server
  │                               │
  │── create_room ──────────────►│  สร้างห้อง + เข้าห้อง
  │◄── ROOM_STATE_UPDATED ──────│
  │                               │
  │── join_room ────────────────►│  เข้าห้องด้วย code
  │◄── ROOM_STATE_UPDATED ──────│
  │                               │
  │── START_GAME ───────────────►│  Host เริ่มเกม
  │◄── ROLE_ASSIGNED ───────────│  (private per-user)
  │◄── ROOM_STATE_UPDATED ──────│
  │                               │
  │── [game_action] ────────────►│  ส่ง action เฉพาะเกม
  │◄── ROOM_STATE_UPDATED ──────│  broadcast ผลลัพธ์
  │                               │
  │── RESET_GAME ───────────────►│  กลับ Lobby
  │◄── ROOM_STATE_UPDATED ──────│
```

### 4. Private Information Dispatch

สำหรับเกม Social Deduction (Who Know, Detective Club) — ข้อมูลลับ (บทบาท, คำลับ) ถูกส่ง **เฉพาะผู้เล่นที่ควรรู้** ผ่าน `server.to(socketId).emit()` ป้องกันการดักจับฝั่ง Client

### 5. Adding a New Game (Pattern)

เมื่อต้องการเพิ่มเกมใหม่:

1. **`packages/types/src/<game-name>.ts`** — สร้าง interface สำหรับ game state
2. **`packages/types/src/core.ts`** — เพิ่ม `GameType` enum, `SOCKET_EVENTS`, และ optional field ใน `RoomState`
3. **`apps/api/src/games/<game-name>/`** — สร้าง logic module (init, actions, reset)
4. **`apps/api/src/games/games.service.ts`** — เพิ่ม methods สำหรับเกมใหม่
5. **`apps/api/src/games/games.gateway.ts`** — เพิ่ม `@SubscribeMessage` handlers
6. **`apps/web/src/components/games/<game-name>/`** — สร้าง UI components
7. **`apps/web/src/store/useGameStore.ts`** — เพิ่ม socket listeners + actions
8. **`apps/web/src/app/page.tsx`** — เพิ่ม rendering condition ตาม `GameType`

---

### 6. Who Am I — `game_action` Pattern

Who Am I ใช้ pattern ที่แตกต่างจากเกมอื่นๆ:

- **Single `game_action` event** แทนที่ per-action events (เช่น `ttt_make_move`)
- `GameActionType` discriminator (`SUBMIT_GUESS`, `VOTE_GUESS`, `END_TURN`, `GUESS_WORD`, `NEXT_TURN`, `END_MATCH`)
- **Category Events** (`WHO_AM_I_GET_CATEGORIES`, `WHO_AM_I_CATEGORIES_LIST`) — request-response โดยตรงไปยัง socket ที่ร้องขอ ไม่ broadcast ผ่าน `ROOM_STATE_UPDATED`
- **4 Word Modes:** `HOST_INPUT`, `RANDOM`, `PLAYER_INPUT`, `AI_GENERATED`

### 7. Reconnection & Socket Migration

เมื่อ player disconnect แล้ว reconnect ด้วย socket ใหม่ `GamesService.joinRoom()` จะ remap socket ID ทั้งหมด:

```
votes, ticTacToeState, rpsState, gobblerState,
soundsFishyState, detectiveClubState, whoAmIState
```

- `UserState.connected?: boolean` — tracking สถานะการเชื่อมต่อ
- `UserState.hasBeenHost?: boolean` — ใช้สำหรับ host rotation เมื่อ host disconnect

### 8. Swagger & Health Endpoint

- NestJS Swagger (`@nestjs/swagger`) ตั้งค่าใน `main.ts` เปิดเฉพาะ non-production
- `GET /health` → `{ status, uptime, timestamp }` (ใน `HealthModule`)
- Swagger UI ที่ `http://localhost:3001/api` (dev only)

### 9. i18n Architecture

| File                                        | Purpose                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/web/src/i18n/dictionaries/schema.ts`  | ทั้ง `Dictionary` interface                                                      |
| `apps/web/src/i18n/dictionaries/{th,en}.ts` | Translation dictionaries                                                         |
| `apps/web/src/hooks/useTranslate.ts`        | Hook `useTranslate()` — dot-path keys, parameter interpolation, English fallback |
| `apps/web/src/store/useI18nStore.ts`        | Zustand store + `persist` middleware (localStorage key: `who-know-language`)     |
| `apps/web/src/app/page.tsx`                 | `<LanguageSwitcher>` component                                                   |

Default language = `th` (Thai). `RoomConfig.language` ส่งค่า language ไป server สำหรับเกมที่ต้องการ language-aware logic.

### 10. Google Gemini AI Integration

- Package: `@google/genai` (เฉพาะใน `apps/api`)
- Env var: `GEMINI_API_KEY` (ใน root `.env`)
- ใช้ใน `WhoAmIService.startGameAiGenerated()` สำหรับสร้างคำจาก category
- Prompts ถูกสร้างตาม `room.config.language`

### 11. Detective Club — Cross-App File Dependency

`DetectiveClubService.loadAvailableCards()` อ่านชื่อไฟล์รูปภาพจาก `apps/web/public/images/detective-club/` โดยตรง:

```typescript
const imagesDir = path.join(process.cwd(), '..', 'web', 'public', 'images', 'detective-club');
```

Server โหลด filenames ตอน startup และใช้เป็น image paths ในการแจกการ์ดให้ผู้เล่น
