# 🔍 KZ Game Hub: Real-time Multi-Game Hub

**"Who knows the secret? Who's acting sus?"** โปรเจกต์เว็บแอปสำหรับคุมเกม Multiplayer แบบ Real-time ที่แต่ก่อนเริ่มต้นจากเกม Insider ตอนนี้ถูกพัฒนาให้เป็น Game Hub ที่รวบรวมเกมไว้หลายแบบ (Who Know, Gobbler, Tic Tac Toe, Hand Duel) เน้นความ Minimalist และ Real-time Experience สูงสุด พัฒนาด้วยสถาปัตยกรรม Monorepo

**Live Demo:** [who-know-web.vercel.app](https://who-know-web.vercel.app/)

## 🎮 Available Games

- **Who Know!:** เกมทายคำแนว Social Deduction ตามหาว่าใครคือ Insider ("Who knows the secret? Who's acting sus?")
- **Gobbler Tic-Tac-Toe:** เกม XO เวอร์ชั่นใหม่ที่สามารถเอาตัวที่ใหญ่กว่าทับตัวที่เล็กกว่าได้
- **Classic Tic-Tac-Toe:** เกม XO คลาสสิก
- **Hand Duel (Rock Paper Scissors):** เกมเป่ายิ้งฉุบแบบ Competitive เลือกจำนวนรอบและโหมดแข่งได้

## 🛠 Tech Stack

- **Monorepo:** `Turborepo` + `pnpm`
- **Backend:** `NestJS` + `Socket.io`
- **Frontend:** `Next.js 14+ (App Router)` + `Zustand`
- **ORM:** `Prisma` + `PostgreSQL`
- **UI:** `Shadcn/UI` + `Tailwind CSS` + `Framer Motion`

---

## 🏗 Project Structure

```text
kz-game-hub/
├── apps/
│   ├── web/                # Next.js Frontend (The Player's Screen & Game Lobby)
│   │   ├── src/app/
│   │   ├── src/components/games/ # Component ย่อยของแต่ละเกม
│   │   └── src/store/      # Zustand store for real-time game state
│   └── api/                # NestJS Backend (The Brain)
│       ├── src/games/      # Game Logic & Socket.io Gateway
│       └── src/rooms/      # Room & Player Management
├── packages/
│   ├── database/           # Shared Prisma Client & Schema
│   ├── types/              # Shared TS Interfaces & Game Constants
│   └── config/             # Shared ESLint, Prettier, TSConfig
├── docker-compose.yml
└── pnpm-workspace.yaml
```

---

## 💾 Database Schema (Prisma)

วางไฟล์นี้ไว้ที่ `packages/database/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum RoomStatus {
  LOBBY
  WORD_SETTING
  QUESTIONING
  VOTING
  RESULT
}

enum Role {
  Host
  Know
  Unknow
}

model Room {
  id         String     @id @default(uuid())
  code       String     @unique
  status     RoomStatus @default(LOBBY)
  roomHostId String
  players    User[]
  createdAt  DateTime   @default(now())
}

model User {
  id       String  @id @default(uuid())
  name     String
  socketId String  @unique
  role     Role?
  score    Int     @default(0)
  roomId   String
  room     Room    @relation(fields: [roomId], references: [id])
}
```

---

## 🎮 Game Logic: Multi-Game Protocol

### 1. Flexible Hub System
เกมถูกพัฒนาให้เป็น Hub ศูนย์กลางด้วย Socket ห้องเดียว ที่แจกจ่ายลอจิกเฉพาะแต่ละเกม (GameType) ได้ เพียงแค่สร้างห้องเดียวก็สลับไปเล่นเกมอื่นได้

### 2. Secret Dispatcher
เวลาเล่น Who Know, ใช้ NestJS Gateway ในการแยกส่งข้อมูลบทบาทและคำลับ (Secret Word) เพื่อไม่ให้ผู้เล่นคนอื่นดักจับฝั่ง Client ได้

```typescript
// apps/api/src/games/games.gateway.ts
@SubscribeMessage('start_game')
async handleStartGame(@MessageBody() data: { roomId: string }) {
  // สุ่มแล้วส่งบทบาทแบบ Private
  this.server.to(host.socketId).emit('assign_role', { role: 'Host' });
  this.server.to(know.socketId).emit('assign_role', { role: 'Know' }); // Insider
  // ... แจก Unknow
}
```

### 3. Live State Processing
รวบรวม Event โหวต, การลงหมาก (XO, Gobbler), และการออกสิทธิ์เป่ายิ้งฉุบ (RPS) ไปรวมที่ Server แล้ว Broadcast สถานะห้องล่าสุด (Room State) กลับให้ทุกคนด้วยความเร็วสูง สร้างความลื่นไหลระดับ Real-time

---

## 🚀 Future Roadmap

- [ ] **Custom Game Rules:** ปรับเวลาถาม กฎกติกาเฉพาะแต่ละเกมได้
- [ ] **Global Leaderboard:** เก็บสถิตินักเนียนมือทอง / แชมป์ XO
- [ ] **More Party Games:** สร้างและนำเข้าบอร์ดเกมอื่น ๆ ต่อไป

## 📌 Getting Started

1. `pnpm install`
2. `pnpm db:push`
3. `pnpm dev`
