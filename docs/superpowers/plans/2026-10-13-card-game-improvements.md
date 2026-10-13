# เกมไพ่ไทย — ป๊อกเด้ง และ Slave Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ให้เห็นและเลือกไพ่บนมือถือครบ อธิบายกติกาที่ตั้งไว้ และแสดง chip settlement ที่ตรวจสอบได้

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

- สถานะ: CA-1 ส่งส่วน scroll/selection semantics แล้ว; sort และ CA-2/CA-3 ยัง Proposed
- [ผลส่งงานและการตรวจ](../../qa/2026-10-13-urgent-fixes.md)
- ความสำคัญหลัก: **P1**; ขนาดงาน **L** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: มี configurable engine/presets/allowedOptions/virtual chips/timer/log; Slave รองรับ single/pair/triple และ 3♣ opener ตาม ADR ไม่ใช่ครบทุกกติกาไพ่สลาฟเชิงพาณิชย์
- หลักฐาน: UI: Slave 2 คนได้คนละ 26 ใบ แต่ CardHand flex แถวเดียวไม่มี scroll container; screenshot 360px ไพ่ส่วนใหญ่ถูกตัด. CODE: เล่น Slave ตรวจ local แค่จำนวน/หน้าเดียวกัน ไม่บอกความสูงเทียบ trick; PokDengView/SlaveView แสดง raw PLAYER_TURNS แม้ shared header แปลแล้ว.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/games/card-game/CardHand.tsx](../../../apps/web/src/components/games/card-game/CardHand.tsx)
- Modify: [apps/web/src/components/games/card-game/SlaveView.tsx](../../../apps/web/src/components/games/card-game/SlaveView.tsx)
- Modify: [apps/web/src/components/games/card-game/PokDengView.tsx](../../../apps/web/src/components/games/card-game/PokDengView.tsx)
- Modify: [apps/web/src/components/games/card-game/CardGameActionPanel.tsx](../../../apps/web/src/components/games/card-game/CardGameActionPanel.tsx)
- Modify: [apps/web/src/components/games/card-game/CardGameRuleSummary.tsx](../../../apps/web/src/components/games/card-game/CardGameRuleSummary.tsx)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/card-game/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: `apps/web/e2e/card-game-pok-deng.spec.ts`, `card-game-presets.spec.ts`; เพิ่ม `apps/web/e2e/card-game-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='card-game|pok-deng|slave|card-engine'
pnpm -F web exec playwright test card-game-pok-deng.spec.ts card-game-presets.spec.ts card-game-experience.spec.ts
E2E_SIM_GAMES='card-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task CA-1: มือไพ่แบบเลื่อนได้และเลือกเป็นชุด

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `card-game-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] CardHand เพิ่ม scroll/wrap mode ไม่ย่อไพ่จนอ่าน rank/suit ไม่ได้; sort เฉพาะลำดับแสดงผลแต่ส่ง stable card.id เดิม. selectable card มี aria-pressed และชื่อ rank/suit ที่แปล; hand container เลื่อนได้ด้วย touch/keyboard และแสดงจำนวนทั้งหมด.
- [ ] ตรวจผลตามเกณฑ์นี้: **26 ใบเข้าถึงได้ครบที่ 360px; selection คงตรง id หลัง sort; ไม่ส่ง hand คนอื่น; shared CardHand ไม่ทำ Poker community cards ล้น.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('card-hand-scroll')).toHaveAttribute('tabindex', '0');
```

### Task CA-2: Slave: preview ความถูกต้องและรักษา selection เมื่อ reject

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `card-game-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แสดงชุดที่เลือก/ชุดที่ต้องตี/3♣ opening/pass-leading rule; ใช้ contract validation จาก types ที่ไม่ import backend. UI hint เป็นเพียง preview, server ยืนยัน. เก็บ selected cards จน authoritative turn/hand เปลี่ยน แทนล้างก่อนทราบผล.
- [ ] ตรวจผลตามเกณฑ์นี้: **ชุดหน้าไม่เท่ากัน/จำนวนไม่เท่ากับ trick/ต่ำกว่า trick/ไม่มี 3♣ตอนเปิด มีเหตุผล; reject แล้วมือเดิมยังเลือก; pass reset ถูก; ไม่เพิ่มห้าชุด/Joker/exchange นอก MVP.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('slave-selection-reason')).toContainText(
  /three of clubs|higher|same rank/i,
);
```

### Task CA-3: ป๊อกเด้ง: rule summary และการชำระ chip

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `card-game-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แปล phase ผ่าน dictionary, แสดง preset/tie/dealer/multipliers ที่เปิดจริง. ผลแจกแจงคะแนน dealer/player, multiplier, delta และ chip ก่อน→หลัง; time expiry ระบุ auto action ที่กติกาเลือก. คง natural 8/9 และ virtual chips.
- [ ] ตรวจผลตามเกณฑ์นี้: **natural dealer จบทันที; DRAW/STAND/tie/multiplier/rotation ตรง engine; ผลรวม chip conservation ตามกติกาและ debt policy; host skip/reset ไม่สร้างผลซ้ำ.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('pok-deng-settlement')).toContainText(/before|after|chips/i);
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
