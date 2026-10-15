# โป๊กเกอร์ / Poker — Online และ Chips Ledger Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** แก้ minimum raise และ short all-in ใน engine ร่วม แล้วทำสองโหมดแสดงยอดและสิทธิ์เดิมพันตรง server

**Architecture:** คง game service เดิมเป็นผู้ตัดสินและใช้ public/private state ที่ส่งอยู่แล้ว. แยกการเปลี่ยนกติกาที่ระบุไว้จากการเปลี่ยน presentation; views ไม่ import backend. ใช้ shared UI จาก SH-2/SH-3 เท่าที่ต้องใช้.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand, Socket.io, Tailwind, Framer Motion; Jest + Playwright

## Global Constraints

- Node >=20.19.0, pnpm@9.1.0; ใช้ React/Next.js, Tailwind และ Framer Motion ที่มีอยู่
- Server-authoritative; client เก็บได้เฉพาะ draft/selection/presentation ห้ามแก้ game state
- ใช้ Socket.io เดิม; ไม่เพิ่ม REST controller หรือบันทึก room state ระหว่างเล่นลง DB
- role/word/hand/vote ที่ยังไม่เฉลยอยู่ใน private channel; viewer ต้องไม่ได้ private data
- ทั้งไทยและอังกฤษ; แก้ schema.ts/th.ts/en.ts พร้อมกันเมื่อเพิ่มข้อความ
- เพิ่มหรือแก้ event ต้อง sync types → gateway → service → useGameStore และ rebuild @repo/types
- field ใหม่ที่มี socket ID ต้องอยู่ใน reconnection remap; ใช้ timer service และ revalidate callbacks
- ทดสอบ DB ด้วย disposable local MySQL เท่านั้น ดู SH-1; `.env` ที่ root ปัจจุบันชี้ production
- รายการหลักฐานเป็น baseline ก่อนแก้; สถานะด้านล่างระบุส่วนที่ส่งแล้ว. งาน P2/P3 ยังเป็นข้อเสนอ

---

## สถานะและหลักฐาน ณ 13 ตุลาคม 2026

- สถานะ: PK-1, PK-2, PK-3 เสร็จสมบูรณ์และผ่านการตรวจ regression และ simulation tests (5/5 tests passed, 4/4 sim plays passed)
- [ผลส่งงานและการตรวจ](../../qa/2026-10-13-urgent-fixes.md)
- ความสำคัญหลัก: **P1**; ขนาดงาน **L** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: มี shared betting engine, private hole cards, showdown show/muck, side pots, host award ใน ledger, rebuy และ virtual chips. แผน UI วันที่ 8 ยังไม่มี Poker จึงเพิ่มแผนเฉพาะ
- หลักฐาน: UI/CODE: SB10/BB20 เสนอ Raise to21. startHand ตั้ง minRaiseTo=BB×2 แต่เขียนทับเป็น BB หลังโพสต์ blinds. BET/ALL_IN คำนวณ raiseSize จากยอดของ seat ก่อนเติมแทน previous currentBet. legalMoves clamp minimum ลงเท่า short stack ทำให้แยก full/short raise ใน service ไม่ได้. UI แสดง POKER.ACTION.ALLIN เพราะใช้ key allin ต่างจาก dictionary allIn; shared phase แสดง PREFLOP และ seat BIG_BLIND raw.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/api/src/games/poker/poker.service.ts](../../../apps/api/src/games/poker/poker.service.ts)
- Modify: [apps/api/src/games/poker/poker-engine.ts](../../../apps/api/src/games/poker/poker-engine.ts)
- Modify: [packages/types/src/poker.ts](../../../packages/types/src/poker.ts)
- Modify: [apps/web/src/components/games/poker/PokerView.tsx](../../../apps/web/src/components/games/poker/PokerView.tsx)
- Modify: [apps/web/src/components/lobby/GameViewManager.tsx](../../../apps/web/src/components/lobby/GameViewManager.tsx)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/poker/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/poker.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/poker-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='poker'
pnpm -F web exec playwright test --grep='poker'
E2E_SIM_GAMES='poker-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task PK-1: แก้ raise contract ทั้ง Online/Ledger ก่อน UI

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `poker-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [x] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [x] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [x] รักษา preflop minRaiseTo=2×BB; ใช้ previous currentBet คำนวณ increment; เก็บ fullRaiseMinimum แยกจาก capped legal amount ของ short stack. BET ที่ผิดต้อง reject/แสดงเหตุผลตาม contract ที่ทดสอบ ไม่เปลี่ยนยอดเงียบ ๆ. รักษา raiseLocked หลัง short all-in และเปิดใหม่หลัง full raise ตาม rules.
- [x] ตรวจผลตามเกณฑ์นี้: **BB20→minimum40; raise40→next minimum60; re-raise100 จาก 40→next minimum160; short all-in50 หลัง 40 ไม่ reopen ผู้ที่ acted และไม่ลด full increment20; ทำซ้ำทั้งสองโหมด.**
- [x] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
expect(legalMoves(room.pokerState!, actorId)?.minRaiseTo).toBe(40);
```

### Task PK-2: UI ใช้ legal actions ตรง server และแปลครบ

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `poker-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [x] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [x] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [x] คง toCall แต่แสดง callAmount=min(toCall,chips); hide/disable raise เมื่อ raiseLocked หรือไม่มี opponent ACTIVE. ใช้ typed dictionary map allIn, blind/action/phase keys ไม่แปลง lowercase แบบเดา. reset betAmount เมื่อ hand/street/active seat เปลี่ยน; ส่ง action เพียงครั้งเดียวและมี pending UI.
- [x] ตรวจผลตามเกณฑ์นี้: **ไม่มี POKER.ACTION.ALLIN/PREFLOP/BIG_BLIND raw; short call บอกยอดที่จ่ายจริง; board5 ใบไม่ถูกตัดที่ 360px; amount preset ไม่ค้างข้ามมือ.**
- [x] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('poker-quick-allin')).toHaveText('All-in');
```

### Task PK-3: settlement ที่ตรวจสอบได้และ ledger award ปลอดการเลือกผิด

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `poker-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [x] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [x] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [x] แสดงแต่ละ main/side pot: ยอด/eligible players/winner/payout. Ledger award เลือกได้เฉพาะ eligible และยืนยัน pot/ผู้รับ; แยก rebuy กับแก้ chip balance พร้อมเหตุผลใน log. Show/Muck ไม่เปลี่ยน payout.
- [x] ตรวจผลตามเกณฑ์นี้: **3+คน all-in หลายยอด, split pot, odd chip, disconnect, rebuy และ timer check/fold ผ่าน; chip conserved หลัง award; Online ไม่มี host manual award; Ledger ไม่มี deck/hole cards.**
- [x] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('poker-pot-breakdown')).toBeVisible();
```

## Definition of done

- [x] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [x] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [x] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [x] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [x] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
