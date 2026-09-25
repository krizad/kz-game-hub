# ⚙️ Infrastructure — KZ Game Hub

## Local Development

### Prerequisites

| Tool      | Version  | Purpose                                                        |
| --------- | -------- | -------------------------------------------------------------- |
| Node.js   | ≥20.19.0 | Runtime                                                        |
| pnpm      | 9.1.0    | Package Manager                                                |
| MySQL     | 8.x+     | Database (remote prod หรือ local instance ผ่าน `DATABASE_URL`) |
| Turborepo | ^2.0.0   | Monorepo Build Orchestration                                   |

### Quick Start

```bash
pnpm install
# ชี้ DATABASE_URL (root .env) ไปที่ MySQL ก่อน เช่น
#   mysql://user:password@localhost:3306/kz_game_hub
pnpm db:push     # ⚠️ เขียนลง DB ตาม DATABASE_URL — เช็คก่อนรัน
pnpm db:seed
pnpm dev
```

> ผู้ใช้สลับ provider ได้: `pnpm db:use:mysql` / `pnpm db:use:pg` (script `sync-schema.ts` จะแก้ `provider` ใน schema.prisma ตาม URL แล้ว regenerate client)

### Available Scripts

| Command                                | Description                                             |
| -------------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                             | Start all apps in dev mode (via Turborepo)              |
| `pnpm build`                           | Build all apps for production                           |
| `pnpm lint`                            | Lint all apps                                           |
| `pnpm format`                          | Format all files with Prettier                          |
| `pnpm db:generate`                     | Generate Prisma Client                                  |
| `pnpm db:migrate`                      | Run Prisma migrations                                   |
| `pnpm db:push`                         | Push schema to DB (no migration)                        |
| `pnpm db:studio`                       | Open Prisma Studio GUI                                  |
| `pnpm db:seed`                         | Seed database (Sounds Fishy questions + Who Am I words) |
| `pnpm db:use:mysql` / `pnpm db:use:pg` | Switch prisma datasource provider                       |
| `pnpm start`                           | Start all apps in production mode                       |
| `pnpm test:e2e`                        | Playwright E2E (auto-starts api:3001 + web:3000)        |
| `pnpm deploy:ftp`                      | Deploy API build via FTP (`scripts/deploy-api-ftp.mjs`) |

### Turborepo Pipeline

- `dev` depends on `^build` — packages (types, database) ต้อง build ก่อนที่ apps จะ start
- `dev` ไม่ cache และเป็น persistent task

### Default Ports

| App           | Port | URL                         |
| ------------- | ---- | --------------------------- |
| Web (Next.js) | 3000 | `http://localhost:3000`     |
| API (NestJS)  | 3001 | `http://localhost:3001`     |
| Swagger UI    | 3001 | `http://localhost:3001/api` |

---

## Environment Variables

A single root `.env` feeds ALL apps. **Do NOT create per-app `.env` files** — the code won't read them.

Copy `.env.example` to `.env` at the repo root:

```env
DATABASE_URL="mysql://user:password@localhost:3306/kz_game_hub"
NEXT_PUBLIC_API_URL=http://localhost:3001
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
GEMINI_API_KEY=your-gemini-api-key    # optional, for Who Am I AI word generation
ADMIN_SECRET=change-me                # optional, enables the lobby admin panel
SPOTIFY_CLIENT_ID=...                 # optional, Music Trivia Spotify source
SPOTIFY_CLIENT_SECRET=...
DETECTIVE_CLUB_CARDS_DIR=             # optional, custom Detective Club card images
```

| Variable                                      | Used By     | Purpose                                                  |
| --------------------------------------------- | ----------- | -------------------------------------------------------- |
| `DATABASE_URL`                                | api, DB pkg | MySQL connection (provider auto-detected)                |
| `NEXT_PUBLIC_API_URL`                         | web         | API/WS URL                                               |
| `PORT`                                        | api         | API listen port (default 3001)                           |
| `CORS_ORIGIN`                                 | api         | Allowed browser origins (comma-separated)                |
| `GEMINI_API_KEY`                              | api         | Google Gemini SDK (Who Am I AI mode)                     |
| `ADMIN_SECRET`                                | api         | Gate for `set_game_enabled` (unset = admin endpoint off) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | api         | Music Trivia Spotify adapter                             |
| `DETECTIVE_CLUB_CARDS_DIR`                    | api         | Custom card image directory                              |

| Consumer            | Env Loading Code                                             |
| ------------------- | ------------------------------------------------------------ |
| `apps/web`          | `next.config.mjs` → `dotenv.config({ path: '../../.env' })`  |
| `apps/api`          | `src/main.ts` → `dotenv.config({ path: '../../../.env' })`   |
| `packages/database` | `prisma.config.ts` → `dotenv.config({ path: '../../.env' })` |

> ⚠️ ห้าม commit `.env` — ใช้ `.env.example` เป็น template

---

## Production Deployment

### 1. Database — MySQL

- Production ใช้ **remote MySQL** (`DATABASE_URL` เป็น `mysql://...`) — สร้าง DB + user แล้วรัน `pnpm db:push` + `pnpm db:seed` ครั้งแรกครั้งเดียว
- `packages/database/prisma/migrations/` เป็น legacy จากยุค PostgreSQL (แค่ `pnpm db:push` อยู่ในทางปฏิบัติ)

### 2. API Backend — Node host ที่รองรับ WebSocket

- Deploy NestJS (Render, Koyeb, Fly.io หรือ server ตัวเอง — repo มี `pnpm deploy:ftp` สำหรับ FTP deploy)
- Build Command: `pnpm build --filter=api`
- Set: `DATABASE_URL`, `CORS_ORIGIN`, และ env เสริมที่ต้องการ (`ADMIN_SECRET`, `GEMINI_API_KEY`, Spotify keys)

### 3. Web Frontend — Vercel

- Connect GitHub repo → auto-detect Next.js in Turborepo
- Set: `NEXT_PUBLIC_API_URL` → deployed API URL

---

## Database Schema

| Model                 | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `Room`                | ห้องเกม (reference — ใช้ In-Memory Map เป็นหลัก)                             |
| `User`                | ผู้เล่นในห้อง ผูกกับ socketId                                                |
| `SoundsFishyQuestion` | คลังคำถามเกม Sounds Fishy (seed data, นับ `query_count` เพื่อหมุนเวียนคำถาม) |
| `Word`                | คลังคำศัพท์ Who Am I (seed data, มี index `[category, lang]`)                |
| `GameResult`          | ผลจบเกมสำหรับ leaderboard (gameType, roomCode, playerName, score, rank)      |
| `GameSetting`         | Flag ติด/ปิดเกมต่อ `gameType` (ใช้โดยแผง admin ใน lobby)                     |

> Room state จริงเก็บใน In-Memory `Map<string, RoomState>` ภายใน `GamesService`
