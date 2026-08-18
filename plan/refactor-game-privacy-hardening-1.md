---
goal: Refactor all 10 games — privacy hardening, server-side timers, input validation, test coverage
version: 1.0
date_created: 2026-08-18
last_updated: 2026-08-18
owner: KZ Game Hub
status: 'In progress'
tags: [refactor, architecture, security, bug]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

แผนปรับปรุงโค้ดทั้ง 10 เกมจากผล code review: ปิดช่อง private data รั่วใน broadcast, ย้าย timer มาฝั่ง server, เพิ่ม input validation + membership check, แก้ soft-lock/bug เกมละจุด และเติม test coverage

## 1. Requirements & Constraints

- **REQ-001**: ข้อมูลลับ (มือไพ่/คำลับ/role/คำตอบ) ต้องไม่อยู่ใน broadcast `RoomState`
- **REQ-002**: Timer ทั้งหมดต้องทำงานฝั่ง server (ใช้ `RoomTimerService` เดิม)
- **REQ-003**: ทุก game action ต้อง validate: membership + input shape + status precondition
- **CON-001**: WebSocket-only — ห้ามเพิ่ม `@Controller`
- **CON-002**: Server-authoritative — client emit เท่านั้น, store เป็น read-only mirror
- **CON-003**: Socket event ใหม่ต้องแก้ครบ 4 จุด (`core.ts` → gateway → service → store)
- **CON-004**: State เกมใน memory (`Map`) ไม่ persist ระหว่างเล่น
- **PAT-001**: Private data ส่งแบบ `role_assigned` pattern (per-socket emit)

## 2. Implementation Steps

### Implementation Phase 0 — Infrastructure

- GOAL-001: สร้าง `PrivateStateService` (deep module) + gateway hardening + cross-cutting fixes

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | สร้าง `apps/api/src/games/private-state.service.ts` + spec | | |
| TASK-002 | `PRIVATE_STATE_UPDATED` ลง `SOCKET_EVENTS` (4 จุด) + rebuild types | | |
| TASK-003 | Gateway: WsExceptionFilter + try/catch + `assertMember()` + `broadcastRoomState()` helper | | |
| TASK-004 | `create_room`/`leave_room` ลง SOCKET_EVENTS, leaderboard dedup, แยก config `maxRounds`, ลบ `whoFirstCooldownMs` | | |
| TASK-005 | `leaveRoom` ล้าง ghost state: `ticTacToeState.playerXId/OId`, `theMindState`, private data | | |

### Implementation Phase 1 — เกมชุด A (HIGH severity)

- GOAL-002: The Mind → Sounds Fishy → Detective Club → RPS → Gobbler

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-101 | The Mind: hands+deck → private, reset `levelEndTime` ทุก transition, shuriken soft-lock, disconnect กลางเลเวล | | |
| TASK-102 | Sounds Fishy: answer/pickerId/blueFishId → private, disconnect deadlock, picker reassign, blue fish validate | | |
| TASK-103 | Detective Club: word/role/hand → private, vote deadlock, vote validation, deck loader | | |
| TASK-104 | RPS: choices → private, score+leaderboard, choice locked+enum validate, both-disconnect | | |
| TASK-105 | Gobbler: index validation, membership, inventory dedup, score source เดียว | | |

### Implementation Phase 2 — เกมชุด B

- GOAL-003: Who-Know → Who-First → Tic-Tac-Toe → Who Am I → Music Trivia

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-201 | Who-Know: role → private, vote validation, server timer, i18n | | |
| TASK-202 | Who-First: countdown → server, preconditions, phase flow, spec ใหม่ | | |
| TASK-203 | Tic-Tac-Toe: membership, index validate, ghost seat, e2e เดินหมากจริง | | |
| TASK-204 | Who Am I: playerWords → private, Gemini timeout/validate, lang default, dead types, i18n | | |
| TASK-205 | Music Trivia: rules-of-hooks, errorMessage/retry, timer → server, adapter hardening, spec | | |

### Implementation Phase 3 — ปิดท้าย

- GOAL-004: i18n กวาดรอบ, E2E smoke, test/format/build, graphify update

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-301 | i18n กวาดรอบสุดท้าย (th/en ครบทุก key) | | |
| TASK-302 | E2E: แก้ tictactoe, เพิ่ม gobbler, smoke ทุกเกม | | |
| TASK-303 | `pnpm -F api test` + `pnpm test:e2e` + `pnpm format` + `pnpm build` | | |
| TASK-304 | `graphify update .` | | |

## 3. Alternatives

- **ALT-001**: Per-player redaction (strip ตอน broadcast) — ถูกปฏิเสธ: ลืม strip จุดเดียว = รั่ว; server-only Map ปิดช่องตั้งแต่แรก
- **ALT-002**: ข้อมูลลับรวมไว้ใน RoomState field `private` เดียว — ถูกปฏิเสธ: รูปร่างข้อมูลต่างกันมากต่อเกม, ลด locality ของแต่ละ game service

## 4. Dependencies

- **DEP-001**: `RoomTimerService` (มีอยู่แล้ว ใช้สำหรับ who-know/who-first/music-trivia timers)
- **DEP-002**: `@repo/types` ต้อง rebuild หลังแก้ `core.ts`/เกม types
- **DEP-003**: Prisma client (sounds-fishy ไม่เปลี่ยน)

## 5. Files

- **FILE-001**: สร้าง `apps/api/src/games/private-state.service.ts` + `.spec.ts`
- **FILE-002**: สร้าง `apps/web/src/store/privateStateSlice.ts`
- **FILE-003**: แก้ `packages/types/src/core.ts` + 10 เกม types
- **FILE-004**: แก้ `apps/api/src/games/games.gateway.ts`, `games.service.ts`
- **FILE-005**: แก้ทุก `apps/api/src/games/*/*.service.ts`
- **FILE-006**: แก้ `apps/web/src/store/useGameStore.ts` + ทุก `*View.tsx`
- **FILE-007**: แก้ i18n `apps/web/src/i18n/dictionaries/{th,en}.ts`, `schema.ts`

## 6. Testing

- **TEST-001**: Private data ไม่ปรากฏใน payload ของ `room_state_updated` (assert ต่อเกม)
- **TEST-002**: `private_state` ส่งถึงเฉพาะ socket ที่ตั้งใจ
- **TEST-003**: Spec เติมตามช่องโหว่ที่ review เจอ (Gobbler index crash, The Mind timeout loop, Detective Club vote deadlock, etc.)
- **TEST-004**: E2E: แก้ tictactoe "full game", เพิ่ม gobbler move/win + smoke ทุกเกม

## 7. Risks & Assumptions

- **RISK-001**: Reconnect remap พลาด field ใหม่ → ผู้เล่นเห็นข้อมูลลับคนอื่น (mitigate: TASK-005 + TEST-002)
- **RISK-002**: Refactor 10 เกมรวดเดียว conflict สูง → commit แยกต่อชุดงาน (conventional commits)
- **ASSUMPTION-001**: ไม่เปลี่ยน UX/กติกาเกม — แค่ย้ายตำแหน่งเก็บข้อมูล

## 8. Related Specifications / Further Reading

[.agent/architecture.md](.agent/architecture.md)
[AGENTS.md](AGENTS.md)
