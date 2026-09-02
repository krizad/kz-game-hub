# ADR 0001 — Coup Classic Rules

**Date:** 2026-09-02
**Status:** Accepted
**Context:** KZ Game Hub — เพิ่มเกมที่ 9

## Context

ต้องการเพิ่มเกม Coup แบบ bluff/social deduction เข้า hub ที่มีอยู่ 8 เกม (who-know, tic-tac-toe, rps, gobbler, sounds-fishy, detective-club, who-am-i, music-trivia) โดยต้องคง architecture constraints เดิม: WebSocket-only, in-memory RoomState, server-authoritative, private data แยกส่ง, reconnection remap

## Decision

เลือก **Coup Classic** เต็มรูปแบบ:

- **Deck:** 5 Roles × 3 = 15 ใบ (Duke, Assassin, Captain, Ambassador, Contessa)
- **Players:** 2–6 คน, min 3 คนเริ่มเกมได้ — วนเทิร์นตาม `room.players` ข้าม Spectator, เทิร์นแรก = host
- **Economy:** เริ่ม 2 coins, Income +1, Foreign Aid +2, Coup 7 coins (บังคับที่ 10+)
- **Actions 7 แบบ + mapping:**
  - Income — ไม่ claim, ไม่ block/challenge
  - Foreign Aid — block ได้ด้วย Duke
  - Coup — ไม่ claim, block/challenge ไม่ได้
  - Tax — claim Duke +3
  - Assassinate — claim Assassin จ่าย 3 สังหาร 1, block ได้ด้วย Contessa
  - Steal — claim Captain ขโมย 2, block ได้ด้วย Captain/Ambassador
  - Exchange — claim Ambassador จั่ว 2 คืน 2
- **Bluff engine:** Declare → Challenge window 7s (priority สูงกว่า Block) → Block window 7s → Resolve — ใช้ `RoomTimerService` (ไม่ใช่ setTimeout), challenge แพ้เสีย Influence 1 ใบ (เลือกเอง), ถ้าผู้ถูกท้ามีการ์ดจริง: ผู้ท้าเสีย 1 ใบ + ผู้ถูกท้าสับใบที่เปิดคืนกองจั่วใหม่, dead pile โชว์สาธารณะ — อ้างอิง https://www.online-station.net/entertainment/698461/
- **Help UI:** ปุ่ม Summary Card (?) เปิด modal ตาราง 5 Roles + General Actions ได้ตลอดเวลา (ทุก state รวม Spectator) — component `CoupHelpModal.tsx` แยกจาก `CoupRules.tsx`, i18n th/en
- **State:** `CoupState` สาธารณะ (coins, influence count, dead pile, turn) + private hand ผ่าน `PrivateStateService` (`server.to(socketId).emit`)
- **Reconnection:** private hand ผูก `userId`, `GamesService.joinRoom` remap ทุก field

## Alternatives Considered

- ตัด Exchange ออกเพื่อลด scope — ตัดทิ้งเพราะ Classic ต้องครบ 7 actions ตั้งแต่ MVP ตาม grill Q6
- Coup 5 coins เพื่อจบไว — ตัดทิ้งเพราะขัด rulebook ไทยที่แปลไว้ (Q4 มาตรฐาน 7)
- สุ่มใบเมื่อเสีย Influence — ตัดทิ้งเพราะ Classic ให้เลือกเอง (Q5)

## Consequences

- ต้องสร้าง `packages/types/src/coup.ts` + เพิ่ม `GameType.COUP` + `SOCKET_EVENTS` + `RoomState.coupState?`
- ต้องสร้าง `apps/api/src/games/coup/coup.service.ts` (+ spec) และ inject ใน `games.service.ts` / `games.gateway.ts`
- ต้องแก้ `apps/web/src/store/useGameStore.ts` + `components/games/coup/` + `lobby/GameViewManager.tsx` + `HomeView.tsx` + `i18n/dictionaries`
- ต้อง rebuild `@repo/types` หลังแก้ types
- ต้อง remap private state ตอน reconnect — เพิ่ม test สำหรับ bluff/challenge/block flow
