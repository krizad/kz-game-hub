# แฟนพันธุ์แท้เสียงเพลง / Music Trivia Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** เริ่มเล่นจาก artist preset ได้จริง และให้คนที่เสียงไม่เล่นหรือค้นหาไม่สำเร็จกู้สถานะเองได้

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

- สถานะ: MT-1 ส่ง start eligibility แล้ว; MT-2/MT-3 ยัง Proposed นอกเหนือจาก reconnect fix
- [ผลส่งงานและการตรวจ](../../qa/2026-10-13-urgent-fixes.md)
- ความสำคัญหลัก: **P1**; ขนาดงาน **L** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: มีห้า adapters, typing/host judge, ready gate, sync timestamps, timer commands และ artist presets แล้ว; no-buzzer timeout เคยแก้ใน issue 0005
- หลักฐาน: CODE: LobbyStartButton ปิดปุ่มเมื่อ musicTriviaQuery ว่างโดยไม่ตรวจ artistPresetId แต่ configure ของ service รองรับ preset โดยไม่ต้อง query. MusicTriviaView log media onError/play failure ไป console; volume aria-label อังกฤษ hardcoded. UI audit เห็น PREPARING MUSIC แต่ไม่ได้ฟังเสียงจริงทุก adapter.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/lobby/LobbyStartButton.tsx](../../../apps/web/src/components/lobby/LobbyStartButton.tsx)
- Modify: [apps/web/src/components/games/music-trivia/MusicTriviaSettings.tsx](../../../apps/web/src/components/games/music-trivia/MusicTriviaSettings.tsx)
- Modify: [apps/web/src/components/games/music-trivia/MusicTriviaView.tsx](../../../apps/web/src/components/games/music-trivia/MusicTriviaView.tsx)
- Modify: [apps/api/src/games/music-trivia/music-trivia.service.ts](../../../apps/api/src/games/music-trivia/music-trivia.service.ts)
- Modify: [apps/api/src/games/music-trivia/music-source-adapter.ts](../../../apps/api/src/games/music-trivia/music-source-adapter.ts)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/music-trivia/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/musictrivia.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/music-trivia-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='music-trivia'
pnpm -F web exec playwright test --grep='musictrivia'
E2E_SIM_GAMES='music-trivia-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task MT-1: แก้ start guard ของ preset และ empty catalog

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `music-trivia-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] free search ต้องมี query; preset ต้องมีรายการที่ enabled และเพลงใน level ที่เลือก ไม่บังคับ query. เมื่อไม่มี presets อย่าให้เลือกแล้วกลับ free เงียบ ๆ; บอกเหตุผลและทางค้นหาเอง. รักษา artistPresetId:null semantics.
- [ ] ตรวจผลตามเกณฑ์นี้: **preset+query ว่างกดเริ่มได้; free+query ว่างกดไม่ได้พร้อมเหตุผล; disabled/empty preset ถูก server ปฏิเสธอย่างอธิบายได้.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('lobby-start-game')).toBeEnabled();
```

### Task MT-2: สถานะเสียง local และทางแก้ที่มองเห็น

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `music-trivia-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] จับ HTMLAudio/ReactPlayer error แสดง loading/blocked/failed/playing ต่อเครื่อง; ปุ่มเปิดเสียงและ retry ใช้เพลงรอบเดิมไม่ reset scoreboard. ready gesture ต้องเชื่อม unlock จริง; volume/pause local ชัดเจน. Adapter search failure กลับ SETUP พร้อมลองใหม่.
- [ ] ตรวจผลตามเกณฑ์นี้: **mock play() rejection แล้วเห็น Enable audio; retry ไม่เฉลยชื่อเพลง; guest ทำเสียงตนเองได้โดยไม่หยุดทั้งห้อง; iOS Safari ต้องตรวจบนเครื่องจริงเพิ่ม.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('music-audio-recovery')).toBeVisible();
```

### Task MT-3: ทำ readiness, judging และ timeout โปร่งใส

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `music-trivia-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แสดงคนที่พร้อม/ยังไม่ได้ยินเพลง; typing กับ host-judge ใช้คนละคำสั่ง. คง SCHEDULE/CANCEL timerCommands และ stale callback guards. เพิ่ม integration test ready→countdown→PLAYING→no buzzer→reveal และผิด→ให้คนอื่น buzz.
- [ ] ตรวจผลตามเกณฑ์นี้: **ไม่ต้องอาศัย host skip เพื่อจบรอบที่ไม่มีคนตอบ; เพลงโหลดใหม่ไม่เฉลย track answer ก่อน REVEAL; external adapters แยก test group ไม่กล่าวว่าผ่านจาก iTunes.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('music-round-status')).toContainText(/revealed|answer/i);
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
