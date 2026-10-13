# Tic-Tac-Toe — Classic, Gobbler, Ultimate Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ให้ทั้งสามโหมดเลือกและลงหมากได้แม่นยำด้วยสัมผัสและคีย์บอร์ด

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
- งานนี้เป็นแผนที่ยังไม่ลงมือแก้ผลิตภัณฑ์; งาน P2/P3 คือข้อเสนอ ไม่ใช่บั๊กที่พิสูจน์แล้ว

---

## สถานะและหลักฐาน ณ 13 ตุลาคม 2026

- สถานะ: Proposed — ยังไม่ได้แก้ implementation
- ความสำคัญหลัก: **P1**; ขนาดงาน **L** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: รวมเป็น GameType.TIC_TAC_TOE แล้วตาม ADR 0006; เลือกโหมดในห้อง มี bot สำหรับ Classic และตรวจตา/ช่องที่ลงได้ก่อนส่ง action
- หลักฐาน: CODE: Classic และ Ultimate ช่องว่างเป็น button ไม่มี accessible name; Gobbler inventory เป็น div onClick; Ultimate preview ใช้ onMouseEnter. UI: ขั้นเลือกฝั่งบนมือถือยาวและซ้ำกับกล่อง mode/player list. ความเล็กของ 81 ช่องต้องใช้หลักฐาน active-board แยกจาก lobby.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/games/tic-tac-toe/TicTacToeView.tsx](../../../apps/web/src/components/games/tic-tac-toe/TicTacToeView.tsx)
- Modify: [apps/web/src/components/games/gobbler/GobblerView.tsx](../../../apps/web/src/components/games/gobbler/GobblerView.tsx)
- Modify: [apps/web/src/components/games/ultimate-tic-tac-toe/UltimateTicTacToeView.tsx](../../../apps/web/src/components/games/ultimate-tic-tac-toe/UltimateTicTacToeView.tsx)
- Modify: [apps/web/src/components/games/tic-tac-toe/TicTacToeUnifiedView.tsx](../../../apps/web/src/components/games/tic-tac-toe/TicTacToeUnifiedView.tsx)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/tic-tac-toe/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: `apps/web/e2e/tictactoe.spec.ts`, `tictactoe-bot.spec.ts`, `gobbler.spec.ts`, `ultimatetictactoe.spec.ts`; เพิ่ม `apps/web/e2e/tic-tac-toe-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='tic-tac-toe|gobbler|ultimate-tic-tac-toe'
pnpm -F web exec playwright test tictactoe.spec.ts tictactoe-bot.spec.ts gobbler.spec.ts ultimatetictactoe.spec.ts tic-tac-toe-experience.spec.ts
E2E_SIM_GAMES='ttt-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task TT-1: Classic: ตั้งชื่อช่องและย่อหน้ารอเลือกฝั่ง

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `tic-tac-toe-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] เพิ่ม aria-label ช่องเป็นแถว/คอลัมน์/ค่าปัจจุบัน และ focus-visible. วางเลือก X/O ในแถวที่ reflow ได้; ทำคะแนน/ผลชนะ/เสมอเด่นกว่าข้อมูลตั้งค่า. ใช้ ttt-cell-\* ที่มีอยู่.
- [ ] ตรวจผลตามเกณฑ์นี้: **Tab → Space ลงช่องที่ถูกตาได้; ไม่ส่ง action เมื่อตา O; PVP/bot easy/god และ rematch ยังทำงาน.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('ttt-cell-0')).toHaveAccessibleName(/row 1.*column 1/i);
```

### Task TT-2: Gobbler: เลือกตัวหมากและปลายทางอย่างเข้าใจได้

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `tic-tac-toe-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] เปลี่ยน inventory div เป็น button โดยไม่เปลี่ยน testid. aria-pressed ระบุการเลือก, label บอกขนาด/จำนวน, เพิ่มปุ่มยกเลิก. ไฮไลต์ปลายทางที่ถูกกติกาจาก public board; ยังคงให้ server ตัดสินการเปิดหมากที่ซ่อนอยู่ใต้ตัวบน.
- [ ] ตรวจผลตามเกณฑ์นี้: **เลือกตัวใหญ่→ยกเลิก→เลือกตัวเล็กได้ทั้ง touch/keyboard; ไม่เปิดการ์ดหรือข้อมูลที่ server ไม่ได้ส่ง; inventory test flow เดิมผ่าน.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('gobbler-inventory-X-stack-0')).toHaveRole('button');
```

### Task TT-3: Ultimate: เลือกกระดานย่อยก่อนช่องบนมือถือ

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `tic-tac-toe-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] คงภาพรวม 9 กระดาน แต่เปิดแผง 3×3 สำหรับกระดานย่อยที่เลือกบนจอเล็ก; ช่องในแผงตั้งเป้า 44×44px. แสดง next-board preview เมื่อ focus/เลือก ไม่พึ่ง hover. ใช้ utttMakeMove(macroIndex,microIndex) เดิม; no duplicate board state.
- [ ] ตรวจผลตามเกณฑ์นี้: **360px เลือกครบ 81 ตำแหน่งที่ถูกกติกาได้ผ่านภาพรวม+แผงขยาย; FREE_MOVE/กระดานที่ชนะแล้วส่งต่อถูก; desktop ยังลงจากภาพรวมได้.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('uttt-mobile-subboard')).toBeVisible();
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
