# ฉันคือใคร / Who Am I Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ให้การตั้งคำทั้งสี่แบบ การทาย และการโหวตไม่ติดขัดและรองรับภาษาไทยครบ

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
- สิ่งที่มีแล้ว: HOST_INPUT/RANDOM/PLAYER_INPUT/AI_GENERATED ผ่าน generic game_action; host-input mode ให้ host เป็น moderator และใช้ขั้นต่ำ 3 คนตาม catalog
- หลักฐาน: CODE/UI: host modal ใน LobbyStartButton มีข้อความอังกฤษ hardcoded; WhoAmIView มี Secret Word Selection/Waiting for Host hardcoded. ที่ PLAYER_INPUT ล้าง draft ทันทีหลัง emit ก่อนทราบว่าคำถูกปฏิเสธ; RANDOM ต้องมี category.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/games/who-am-i/WhoAmIView.tsx](../../../apps/web/src/components/games/who-am-i/WhoAmIView.tsx)
- Modify: [apps/web/src/components/games/who-am-i/WhoAmISettings.tsx](../../../apps/web/src/components/games/who-am-i/WhoAmISettings.tsx)
- Modify: [apps/web/src/components/lobby/LobbyStartButton.tsx](../../../apps/web/src/components/lobby/LobbyStartButton.tsx)
- Modify: [apps/api/src/games/who-am-i/who-am-i.service.ts](../../../apps/api/src/games/who-am-i/who-am-i.service.ts)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/who-am-i/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/whoami.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/who-am-i-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='who-am-i'
pnpm -F web exec playwright test --grep='whoami'
E2E_SIM_GAMES='whoami-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task WA-1: ตั้งคำครบทุกโหมดและบอกเหตุผลเริ่มไม่ได้

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `who-am-i-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ย้าย host modal/copy และ aria labels เข้าพจนานุกรม. ระบุ minimum active participants โดยไม่นับ host ที่เป็น moderator/viewer. แสดง category missing, empty DB, AI failure และให้ host เลือก PLAYER_INPUT/HOST_INPUT ได้หลัง failure โดยผ่าน updateConfig เดิม.
- [ ] ตรวจผลตามเกณฑ์นี้: **HOST_INPUT มี host+ผู้ทาย 2 คน; RANDOM ไม่มี category แจ้งเหตุผล; AI error กลับตั้งค่าและ retry ได้; TH ไม่มีอังกฤษหลุดใน modal.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByRole('dialog')).toContainText('กำหนดคำ');
```

### Task WA-2: เก็บ draft ที่ถูกปฏิเสธและทำ guess dialog ใช้งานคีย์บอร์ด

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `who-am-i-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ไม่ล้าง playerWordInput ก่อน wordSubmittedIds มี socketId ยืนยัน; duplicate word error เก็บข้อความให้แก้ได้. Guess modal ใช้ shared dialog และส่ง GameActionType เดิม; แสดง submitted/vote waiting.
- [ ] ตรวจผลตามเกณฑ์นี้: **คำซ้ำแก้แล้วส่งได้; Enter และ click ไม่ส่งซ้ำ; Escape คืน focus; ผู้เล่นไม่เห็นคำของตัวเองใน client payload.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.locator('#playerWordInput')).toHaveValue('cat');
```

### Task WA-3: แยกทายเอกลักษณ์กับลงคะแนนตัดสิน

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `who-am-i-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แสดงชื่อคนที่กำลังทาย/ลำดับเทิร์น, pending guess และคำสั่งของคนโหวตแยกจากคนทาย. ผู้ดูแลจบ turn/match ตามสิทธิ์จริง. แสดงประวัติรอบที่ server อนุญาตหลังเฉลย.
- [ ] ตรวจผลตามเกณฑ์นี้: **submit guess → ทุกคนที่มีสิทธิ์โหวต → resolve → next turn; refresh ตอน vote ไม่คืนคำลับผิดคน; จบครบ maxRounds.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('whoami-guess-status')).toContainText(/vote|submitted/i);
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
