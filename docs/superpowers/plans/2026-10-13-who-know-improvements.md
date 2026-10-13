# รู้แล้วเงียบ / Knowguise Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ใน environment นี้ชื่อ skill ที่มีคือ `subagent-driven-development` / `executing-plans`; การอ่านแผนนี้ยังไม่ใช่คำสั่งให้เริ่ม implementation

**Goal:** ทำให้คนตั้งคำ คนรู้ และผู้ทายเข้าใจหน้าที่ พร้อมป้องกันการเปิดบทบาทค้างข้ามรอบ

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
- สิ่งที่มีแล้ว: มี phase stepper, private role card แบบกดเปิด, sealed vote, ผลโหวต และ reduced motion แล้ว จึงไม่สร้างสิ่งเหล่านี้ซ้ำตามแผนวันที่ 8 ตุลาคม
- หลักฐาน: CODE: RoleCard เก็บ isRevealed ใน local state และไม่มี effect ปิดเมื่อ role/word เปลี่ยน; WhoKnowView ใช้ hostPlayerId และ privateState.wkVote ถูกต้องอยู่แล้ว. UI: หน้าตั้งคำของผู้เล่นบอกให้รอ Word Keeper และไม่มีข้อมูลคำของคนอื่น.
- [บันทึกการตรวจและข้อจำกัด](2026-10-13-game-audit-evidence.md) / [แผนภาพรวม](2026-10-13-game-hub-improvement-roadmap.md)

## ขอบเขตไฟล์

- Modify: [apps/web/src/components/RoleCard.tsx](../../../apps/web/src/components/RoleCard.tsx)
- Modify: [apps/web/src/components/games/who-know/WhoKnowView.tsx](../../../apps/web/src/components/games/who-know/WhoKnowView.tsx)
- Modify: [apps/web/src/components/lobby/SecretWordModal.tsx](../../../apps/web/src/components/lobby/SecretWordModal.tsx)
- Modify copy: `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- Test API: `apps/api/src/games/who-know/` ใช้ spec ที่มีอยู่ตามคำสั่งด้านล่าง
- Test UI: existing `apps/web/e2e/whoknow.spec.ts` เมื่อชื่อเป็น pattern ให้เลือกไฟล์ตาม pattern; เพิ่ม `apps/web/e2e/who-know-experience.spec.ts` สำหรับ assertions ใหม่
- Test simulation: `apps/web/e2e/sim/matrix.ts`, `play.ts` — reuse driver เดิม ไม่เปลี่ยน selector โดยไม่มีเหตุผล

## คำสั่งตรวจเมื่อ implement

เตรียมฐานทดสอบตาม SH-1 ก่อนเรียกชุด E2E; ไม่ใช้ root production DB โดยปริยาย.

```bash
pnpm -F api test -- --testPathPatterns='who-know'
pnpm -F web exec playwright test --grep='whoknow'
E2E_SIM_GAMES='who-know-4p' E2E_SIM_PLAYS=2 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

คำสั่ง `--grep` เป็นตัวกรองชื่อ test; ถ้า spec ไม่ตั้งชื่อด้วย slug ให้ส่งไฟล์จริงแทน. ตรวจ `--list` ก่อนทุกครั้งเพื่อไม่รับผล green จากศูนย์ tests. E2E_SIM_GAMES เป็น prefix filter จึงรวม variants ภายใต้ prefix ที่ระบุ.

## งานที่ส่งได้แยกกัน

### Task WK-1: ปิดการ์ดลับเมื่อเปลี่ยนรอบหรือออกจากหน้าจอ

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `who-know-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] RoleCard รับ role/word เหมือนเดิม; ปิด isRevealed เมื่อ role หรือ word เปลี่ยน และเมื่อ document.visibilityState เป็น hidden. การกดเปิดเป็น local UI เท่านั้น. เพิ่ม data-testid="who-know-role-toggle" และ aria-pressed ต่อจากที่มีอยู่.
- [ ] ตรวจผลตามเกณฑ์นี้: **เปิดคำ → เปลี่ยนรอบ → การ์ดกลับด้านปิด; กลับจากสลับแท็บต้องกดดูใหม่; word ไม่ปรากฏใน DOM ขณะปิด.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('who-know-role-toggle')).toHaveAttribute('aria-pressed', 'false');
```

### Task WK-2: บอกหน้าที่ของคนตั้งคำแยกจากเจ้าของห้อง

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `who-know-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] ให้คำสั่งตั้งคำ/หยุดถาม/ประกาศทายถูกอิง hostPlayerId; ผู้ดูแลห้องควบคุมเฉพาะ lifecycle ที่ server อนุญาต. เพิ่มคำอธิบายสั้นว่าโหมดนี้พูดถามกันนอกเว็บ; แสดงรายชื่อคนที่ยังต้องโหวตเฉพาะข้อมูลสาธารณะที่มี.
- [ ] ตรวจผลตามเกณฑ์นี้: **โหมด RANDOM/FIXED/ROUND_ROBIN และ host reconnect ยังเห็น CTA ตามหน้าที่จริง; ระหว่างโหวตไม่มี target ของคนอื่นก่อน RESULT.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('who-know-phase-help')).toContainText('Ask aloud');
```

### Task WK-3: อธิบายเหตุผลชนะและการเล่นต่อ

**Files:** ใช้ไฟล์ในขอบเขตด้านบนที่เป็นเจ้าของ behavior นี้; test ที่ `who-know-experience.spec.ts` และ API spec ของ service เมื่อกติกาเปลี่ยน

**Interfaces:** รับ `room`, `socketId` และ `privateState` จาก `useGameStore`; ส่งผ่าน action เดิมของเกม. `data-testid` ในตัวอย่างด้านล่างเป็น UI contract ที่ task นี้สร้าง; label ต้องแปล TH/EN. ไม่เพิ่ม field หรือ event เพื่อข้อมูลที่ derive ได้อยู่แล้ว.

- [ ] อ่าน service/view และ spec ปัจจุบันสำหรับกรณีนี้; ยืนยัน baseline ก่อนเปลี่ยน
- [ ] เพิ่ม regression assertion หรือ capture ก่อนแก้สำหรับปัญหาที่ระบุ; สำหรับ polish ที่ไม่เปลี่ยน behavior ใช้ keyboard/touch verification แทน unit test ที่ตรวจ CSS
- [ ] คงผลโหวตเดิมและเพิ่มบรรทัดเหตุผลของ TIMEOUT/INSIDER/ชนะผู้ทาย รวมกรณีเสมอให้ตรง service. CTA กลับ lobby ของ host แยกจากข้อความรอของ guest. ไม่เปลี่ยนการให้คะแนน.
- [ ] ตรวจผลตามเกณฑ์นี้: **คนที่แพ้บอกได้ว่าแพ้เพราะหมดเวลาหรือจับคนรู้ไม่ถูก; ผลรอบใหม่ไม่แสดงคำเก่า.**
- [ ] รัน targeted suite ด้านบนและตรวจ screenshot ที่ 360×800, 390×844, 1280×900 ทั้ง TH/EN; commit เฉพาะงานนี้ด้วย `fix:` หรือ `feat:` ตามผลที่เปลี่ยน

ตัวอย่าง assertion สำหรับใส่หลัง fixture เดิมเข้า phase ที่เกี่ยวข้องแล้ว (ยังไม่ใช่ standalone test):

```ts
await expect(page.getByTestId('who-know-result-reason')).toBeVisible();
```

## Definition of done

- [ ] ทุก task มี screenshot/ผล assertions ที่ review ได้; ระบุ variants ที่ยังไม่ได้เล่นแยกชัดเจน
- [ ] เล่นจบรอบและกลับเริ่มใหม่ได้; reconnect ที่ phase ซึ่งเปลี่ยนไม่สลับตัวตนหรือสิทธิ์
- [ ] private payload regression ของเกมผ่าน; ไม่มีข้อมูลลับเพิ่มใน public room/log/aria-label
- [ ] แสดง state change แม้ปิดเสียงและขอลด motion; board/action ไม่ถูก modal หรือ keyboard บัง
- [ ] อัปเดตสถานะงานใน roadmap พร้อม commit/test evidence; ถ้าเปลี่ยน code รัน `graphify update .`
