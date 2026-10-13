# ลิงแอบกล้วย / Banana Thief Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ทำให้คืนที่มีเสียงบรรยายเล่นได้เมื่อไม่มีเสียง และลดการพลาดช่วงตื่น/ผลตรวจ

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
- ความสำคัญหลัก: **P2**; ขนาดงาน **L** (ใช้เทียบงาน ไม่ใช่กำหนดส่ง)
- สิ่งที่มีแล้ว: มี special roles, ready gate, reroll, auto/host narrator, private peek, role artwork, subtitles ที่เป็นข้อความสาธารณะ และคะแนนผลโหวต
- หลักฐาน: CODE/UI: UI มี force-start ของ host ก่อนทุกคน ready; peek แสดงชั่วคราวตามกติกา; narrator ใช้เสียงไฟล์และ speech fallback. เป็นจุดเสี่ยง onboarding ต้องทดสอบกับผู้เล่นจริง ไม่ใช่หลักฐานว่า timer/peek ผิด. audit ได้ SETUP role/die/ready เท่านั้น.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/games/banana-thief/BananaThiefView.tsx](../../../apps/web/src/components/games/banana-thief/BananaThiefView.tsx)
- Modify: [apps/web/src/components/games/banana-thief/BananaThiefSettings.tsx](../../../apps/web/src/components/games/banana-thief/BananaThiefSettings.tsx)
- Modify: [apps/web/src/components/games/banana-thief/RoleArtwork.tsx](../../../apps/web/src/components/games/banana-thief/RoleArtwork.tsx)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/banana-thief/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/banana-thief.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/banana-thief-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='banana-thief'
pnpm -F web exec playwright test --grep='banana-thief'
E2E_SIM_GAMES='banana-thief-' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task BT-1: พร้อมเล่นและเริ่มคืนแบบไม่ข้ามผู้เล่นเงียบ ๆ

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `banana-thief-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] แสดง audio ready ต่อเครื่อง/คำอธิบายกด ready; force-start เป็น secondary action พร้อม dialog รายชื่อที่ยังไม่พร้อม. บอกว่าตัวละครตื่นเมื่อใดเฉพาะเจ้าของ; number of specials/min players อ้าง getBananaThiefRequiredPlayerCount.
- [ ] ตรวจผลตามเกณฑ์นี้: **mute/blocked audio ยังเห็นข้อความ public clock; host force start ต้องเห็นผลต่อคนไม่พร้อม; ไม่เปิด die/role ในรายชื่อ public.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('banana-thief-force-start-confirm')).toBeVisible();
```

### Task BT-2: สัญญาณตื่นและผล peek ที่อ่านทัน

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `banana-thief-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ใช้ awake/sleep state แบบข้อความ+ภาพ ไม่ใช้เสียงล้วน; peek font/contrast และ focus ชัด ขณะหน้าต่างเดิมเปิด. รักษาระยะเวลาที่ service/rules กำหนด; ถ้าจะเพิ่ม notebook/history ต้องแยกทดลองกติกา ห้ามทำเป็น QoL โดยอัตโนมัติ.
- [ ] ตรวจผลตามเกณฑ์นี้: **DETECTIVE/TWINS/SYCOPHANT/SCAPEGOAT/FOLLOWER ต่างเห็นข้อมูลตามสิทธิ์; no-sound และ reduced-motion ไม่พลาดเพราะสัญญาณหาย; background tab ไม่เล่นเสียงชั่วโมงเก่ารัว.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('banana-thief-awake-status')).toContainText(/awake|sleeping/i);
```

### Task BT-3: อภิปราย โหวต และเฉลยทีม

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `banana-thief-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ทำ countdown discussion/voting ชัด; หลังส่ง vote แสดงยืนยันจาก private/server ไม่ใช่ local flag อย่างเดียว. ผลบอก wrong target/tie/thief caught/scapegoat และแต้มรายคน.
- [ ] ตรวจผลตามเกณฑ์นี้: **refresh ขณะ vote ยังส่งแล้ว; host rotation ใน narrator mode ไปต่อได้; follower1/2 และทุก special มีผลถูก; no private night events ใน public result ก่อนเวลา.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('banana-thief-vote-status')).toContainText(/submitted|waiting/i);
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
