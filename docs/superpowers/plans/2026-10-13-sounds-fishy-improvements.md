# คำตอบพราง / GuiseGuess (Sounds Fishy) Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ทำให้สร้างรอบจากคลังคำถามล้มเหลวแล้วกู้ได้ และแยกเปิดคำตอบ/คัดออก/เก็บแต้มชัดเจน

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
- ความสำคัญหลัก: **P1**; ขนาดงาน **M** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: ซ่อน true answer จาก picker, ส่ง draft typing แบบ private และมี bank/reveal/eliminate อยู่แล้ว
- หลักฐาน: CODE: assignRoles คืน null เมื่อคลังไม่มีคำถามหรือ DB error; view มี effect ล้าง answerInput ซ้ำสองชุด. UI audit ใช้ DB ที่ต่อไม่ได้ จึงจับได้แค่หน้ารอเริ่ม ไม่ใช่หลักฐานว่า gameplay ปกติพัง. Blue Fish ต้องพิมพ์คำตอบจริงตรงตามข้อกำหนด.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/games/sounds-fishy/SoundsFishyView.tsx](../../../apps/web/src/components/games/sounds-fishy/SoundsFishyView.tsx)
- Modify: [apps/api/src/games/sounds-fishy/sounds-fishy.service.ts](../../../apps/api/src/games/sounds-fishy/sounds-fishy.service.ts)
- Modify: [apps/api/src/games/games.gateway.ts](../../../apps/api/src/games/games.gateway.ts)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/sounds-fishy/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/soundsfishy.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/sounds-fishy-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='sounds-fishy'
pnpm -F web exec playwright test --grep='soundsfishy'
E2E_SIM_GAMES='sounds-fishy-3p' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task SF-1: แสดงเหตุผลเริ่มไม่ได้และปลด loading

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `sounds-fishy-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แยกผลคลังว่าง/ภาษาไม่มีข้อมูล/DB ใช้ไม่ได้เป็น error ที่ gateway ส่งกลับตามกลไก ERROR เดิม; คืน lobby และปลด loading เสมอ. ใช้ข้อความไทย/อังกฤษ พร้อมลองใหม่หรือเปลี่ยนเกม. ห้ามเติมคำถามสมมติอัตโนมัติ.
- [ ] ตรวจผลตามเกณฑ์นี้: **mock DB timeout และ empty result แล้วไม่มี STARTING ค้าง; retry หลัง DB กลับมาได้; picker ไม่เห็น answer จาก error.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('game-start-error')).toContainText('Questions are unavailable');
```

### Task SF-2: ลดการพิมพ์ผิดของคนตอบจริง

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `sounds-fishy-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] Blue Fish ใช้ปุ่มส่งคำตอบจริงจาก sfTrueAnswer ของตัวเอง; Red Herring ยังพิมพ์คำลวง. รวม effect ล้าง draft เหลือหนึ่งชุด; จำกัด input 200 ตัวตาม server และบอกข้อความส่งแล้ว.
- [ ] ตรวจผลตามเกณฑ์นี้: **Blue Fish ไม่ถูกติดขัดเพราะช่องว่าง/สะกดต่าง; picker ไม่มีปุ่มหรือคำตอบจริง; draft เปลี่ยนรอบแล้วว่าง.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('fishy-submit-true-answer')).toBeVisible();
```

### Task SF-3: แยกการตัดสินใจของ picker และผลแต้ม

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `sounds-fishy-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ทำแต่ละคำตอบเป็นแถวเดียว: เปิดดู → คัดออก; bank แสดงแต้มที่จะเก็บและความเสี่ยงอ่านง่าย. ผลรอบแสดงเลือกใคร/บทบาทที่เฉลย/แต้มแต่ละคน โดยคงสูตร service.
- [ ] ตรวจผลตามเกณฑ์นี้: **picker ไม่เผลอคัดออกขณะตั้งใจเปิด; keyboard เล่นจน Round Over ได้; มือถือไม่ต้องเลื่อนกลับหาปุ่ม bank ซ้ำ.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('fishy-bank-summary')).toContainText(/points/i);
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
