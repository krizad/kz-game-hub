# ⚙️ Infrastructure — KZ Game Hub

## Local Development

### Prerequisites

| Tool      | Version  | Purpose                      |
| --------- | -------- | ---------------------------- |
| Node.js   | ≥20.19.0 | Runtime                      |
| pnpm      | 9.1.0    | Package Manager              |
| Docker    | Latest   | PostgreSQL Database          |
| Turborepo | ^2.0.0   | Monorepo Build Orchestration |

### Quick Start

```bash
pnpm install
docker compose up -d
pnpm db:push
pnpm dev
```

### Available Scripts

| Command            | Description                                |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Start all apps in dev mode (via Turborepo) |
| `pnpm build`       | Build all apps for production              |
| `pnpm lint`        | Lint all apps                              |
| `pnpm format`      | Format all files with Prettier             |
| `pnpm db:generate` | Generate Prisma Client                     |
| `pnpm db:migrate`  | Run Prisma migrations                      |
| `pnpm db:push`     | Push schema to DB (no migration)           |
| `pnpm db:studio`   | Open Prisma Studio GUI                     |
| `pnpm db:seed`     | Seed database (Sounds Fishy questions)     |
| `pnpm start`       | Start all apps in production mode          |

### Turborepo Pipeline

- `dev` depends on `^build` — packages (types, database) ต้อง build ก่อนที่ apps จะ start
- `dev` ไม่ cache และเป็น persistent task

### Default Ports

| App           | Port | URL                           |
| ------------- | ---- | ----------------------------- |
| Web (Next.js) | 3000 | `http://localhost:3000`       |
| API (NestJS)  | 3001 | `http://localhost:3001`       |
| PostgreSQL    | 5432 | `postgresql://localhost:5432` |

---

## Environment Variables

### Root `.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/kz-game-hub"
```

### `apps/web/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `apps/api/.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/kz-game-hub"
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

> ⚠️ ห้าม commit `.env` ไฟล์ — ใช้ `.env.example` เป็น template

---

## Production Deployment (Recommended Free Stack)

### 1. Database — Supabase (or Neon)

- สร้าง Supabase Project → Connection String → URI
- ใช้ **Session** connection pooling (Port `5432`)
- ตั้ง `DATABASE_URL` ใน production environment

### 2. API Backend — Render

- Deploy NestJS → ต้องรองรับ WebSocket
- Build Command: `pnpm build --filter=api`
- Set: `DATABASE_URL`, `CORS_ORIGIN`

### 3. Web Frontend — Vercel

- Connect GitHub repo → auto-detect Next.js in Turborepo
- Set: `NEXT_PUBLIC_API_URL` → deployed API URL

---

## Database Schema

| Model                 | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `Room`                | ห้องเกม (reference — ใช้ In-Memory Map เป็นหลัก) |
| `User`                | ผู้เล่นในห้อง ผูกกับ socketId                    |
| `SoundsFishyQuestion` | คลังคำถามเกม Sounds Fishy (seed data)            |

> Room state จริงเก็บใน In-Memory `Map<string, RoomState>` ภายใน `GamesService`
