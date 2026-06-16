# 📏 Coding Rules — KZ Game Hub

## Language & Style

1. **TypeScript เท่านั้น** — ห้ามใช้ `any` ยกเว้นจำเป็นจริงๆ (เช่น Socket event payload ที่ต้อง cast)
2. **Strict Mode** — ใช้ `strict: true` ใน `tsconfig.json`
3. **Naming Conventions:**
   - Files: `kebab-case.ts` / `PascalCase.tsx` (React components)
   - Variables/Functions: `camelCase`
   - Types/Interfaces/Enums: `PascalCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Socket Events: `snake_case` strings (e.g., `"rps_make_choice"`)
4. **Formatting:** Prettier (config ใน `packages/config`)

---

## Architecture Rules

### Monorepo Boundaries

- **`packages/types`** — เป็น Single Source of Truth สำหรับ shared types ทั้งหมด
- **`packages/database`** — Prisma schema และ generated client เท่านั้น
- **`apps/api`** — ห้าม import จาก `apps/web`
- **`apps/web`** — ห้าม import จาก `apps/api`
- ทั้ง `api` และ `web` import ได้จาก `packages/*` เท่านั้น

### Socket.io Event Convention

เมื่อเพิ่ม Socket event ใหม่ ต้อง update 4 จุดเสมอ:

1. `packages/types/src/core.ts` → เพิ่มใน `SOCKET_EVENTS` constant
2. `apps/api/src/games/games.gateway.ts` → เพิ่ม `@SubscribeMessage` handler
3. `apps/api/src/games/games.service.ts` → เพิ่ม business logic method
4. `apps/web/src/store/useGameStore.ts` → เพิ่ม listener / action

> **หมายเหตุ:** `create_room` และ `leave_room` เป็น hardcoded strings ใน gateway (ไม่ได้อยู่ใน `SOCKET_EVENTS` constant) — pattern นี้ไม่แนะนำสำหรับเกมใหม่
>
> **Who Am I exception:** Who Am I ใช้ `game_action` event แบบ generic (ไม่ per-action) และ `WHO_AM_I_GET_CATEGORIES`/`WHO_AM_I_CATEGORIES_LIST` เป็น request-response แทน broadcast

### State Management

- **Server-Side:** `GamesService` เก็บ room state ใน `Map<string, RoomState>` (in-memory)
- **Client-Side:** Zustand store (`useGameStore`) — state มาจาก server ผ่าน `ROOM_STATE_UPDATED` event
- **Rule:** Client ไม่ modify state เอง — ส่ง action ไป server แล้วรับ state กลับมา (Server-Authoritative)

---

## Game Module Pattern

### Backend (`apps/api/src/games/<game-name>/`)

แต่ละเกมต้องมี functions พื้นฐาน:

```typescript
// <game-name>.logic.ts
export function initGameState(players: UserState[]): GameState { ... }
export function handleAction(state: GameState, action: Action): GameState { ... }
export function resetGameState(): void { ... }
```

### Frontend (`apps/web/src/components/games/<game-name>/`)

- ใช้ `useGameStore()` hook เพื่อ access room state
- ส่ง action ผ่าน `socket.emit()`
- Render ตาม `roomState.gameType` ใน `page.tsx`

---

## UI Rules

1. **Tailwind CSS** — ใช้ utility classes, ไม่เขียน custom CSS ยกเว้นจำเป็น
2. **Framer Motion** — ใช้สำหรับ animations (RoleCard flip, overlays)
3. **Lucide React** — icon library for all icons
4. **react-hot-toast** — toast notifications
5. **qrcode.react** — QR code generation for room invites
6. **Responsive First** — ต้อง responsive ทั้ง mobile และ desktop
7. **สี Theme:** ใช้ warm palette (amber/white base) — ดูสดใส board-game friendly
8. **i18n:** รองรับ `th` (ไทย — default) และ `en` (English) ผ่าน dictionary files

---

## Git Conventions

- **Commit Message:** ใช้ Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Branch:** `feature/<name>`, `fix/<name>`, `docs/<name>`
- **PR:** ต้อง build ผ่านก่อน merge

---

## Do's and Don'ts

### ✅ Do

- ใช้ `@repo/types` สำหรับ shared types เสมอ
- Broadcast `ROOM_STATE_UPDATED` ทุกครั้งที่ state เปลี่ยน
- ส่งข้อมูลลับ (role, secret word) แบบ private ด้วย `server.to(socketId).emit()`
- Update `AVAILABLE_ROOMS_UPDATED` เมื่อห้องถูกสร้าง/ลบ/เปลี่ยนสถานะ
- ทดสอบด้วย `pnpm dev` ก่อนบอกว่าเสร็จ

### ❌ Don't

- อย่าเก็บ sensitive data (role, secret word) ใน broadcasted `RoomState`
- อย่าให้ client modify game state โดยตรง — ต้องผ่าน server เสมอ
- อย่าสร้าง Socket event โดยไม่เพิ่มใน `SOCKET_EVENTS` constant
- อย่าแก้ `packages/types` โดยไม่ rebuild (`pnpm build --filter=@repo/types`)
- อย่าใช้ `console.log` ที่ไม่จำเป็นใน production code
