# นับในใจ / Countaline (The Mind) Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ทำให้พร้อมเล่น เลือกกอง และอ่านผลชัดโดยไม่ช่วยเปิดเผยไพ่ลับของทีม

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
- ความสำคัญหลัก: **P2**; ขนาดงาน **M** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: Normal/Extreme/Blind/Time Attack, readiness และ shuriken vote มีแล้ว; private hand แยกจาก room; มีภาพไพ่ตอน SETUP
- หลักฐาน: CODE: TheMindView ชะลอ displayPhase 2s และ blind reveal ไพ่ทีละ 800ms; เกมจึงมี local presentation phase แยกจาก phase จริง. TheMindView/TheMindGameView resolve identity ซ้ำและ fallback ตามชื่อ. UI audit เห็น hand/ready gate แล้ว ยังไม่ได้วัด blind reveal จบรอบ.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/games/the-mind/TheMindView.tsx](../../../apps/web/src/components/games/the-mind/TheMindView.tsx)
- Modify: [apps/web/src/components/games/the-mind/TheMindGameView.tsx](../../../apps/web/src/components/games/the-mind/TheMindGameView.tsx)
- Modify: [apps/api/src/games/the-mind/the-mind.service.ts](../../../apps/api/src/games/the-mind/the-mind.service.ts)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/the-mind/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/themind.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/the-mind-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='the-mind'
pnpm -F web exec playwright test --grep='themind'
E2E_SIM_GAMES='the-mind-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task TM-1: พร้อมเล่นและเลือกกองให้ชัด

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `the-mind-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แสดง ready ของผู้ร่วมเล่นเท่านั้น; เก็บคำอธิบาย no talking สั้น ๆ; Extreme ใช้ UP/DOWN พร้อมลูกศรและตัวเลข ไม่ใช้สีอย่างเดียว. แสดง selected card และยกเลิกก่อนเลือกกองโดยไม่แนะนำไพ่ของเพื่อน.
- [ ] ตรวจผลตามเกณฑ์นี้: **Normal เริ่มหลังครบ ready; Extreme ลงกองถูกได้; Blind ไม่มีค่าไพ่เพื่อนใน DOM; ไม่เพิ่ม countdown แนะนำจังหวะลงแทนทักษะผู้เล่น.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('mind-pile-UP')).toHaveAccessibleName(/ascending/i);
```

### Task TM-2: ผลรอบและ reduced motion ไม่ขวางการเล่นต่อ

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `the-mind-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แยก authority phase กับ presentation ชัด; action enable ตาม room phase จริง. ผู้ขอลด motion เห็นผลทันที/รายการไพ่แทน sequential reveal. เมื่อ reload ใน result ต้องเห็นผลที่ครบ ไม่เริ่ม animation ที่บังคับรอนาน.
- [ ] ตรวจผลตามเกณฑ์นี้: **blind 20+ cards ไม่บังคับรอ 800ms×จำนวนไพ่ก่อนเข้าใจผล; server ไป next level แล้ว local timer เก่าไม่เปิด result ทับ.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('mind-result-summary')).toBeVisible();
```

### Task TM-3: reconnect identity และ shuriken vote

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `the-mind-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ใช้ playerId/socketId เป็นหลักตาม session; ทดสอบ fallback ชื่อซ้ำและลบ duplication เฉพาะ identity resolver เมื่อมี regression. แสดง pending shuriken, ใครต้องตอบ และ accepted/rejected จาก server; ห้ามรวมไพ่ทีมเพื่อแนะนำการเล่น.
- [ ] ตรวจผลตามเกณฑ์นี้: **reload หลัง ready/ขณะโหวตยังเป็น seat เดิม; ไม่ดึง hand ของชื่อซ้ำ; unanimous vote และ disconnect ตรง service.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('mind-shuriken-status')).toContainText(/waiting|accepted|rejected/i);
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
