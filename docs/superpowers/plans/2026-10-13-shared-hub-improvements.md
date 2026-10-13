# Shared Hub Reliability and Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> ชื่อ skill ที่มีใน environment นี้คือ `subagent-driven-development` / `executing-plans`; เริ่มชุดงานด่วนตามคำสั่งผู้ใช้แล้ว; ดูบันทึกส่งงาน

**Goal:** ทุกเกมเข้าห้อง เริ่ม เล่น และกู้สถานะได้ด้วย interaction ที่สม่ำเสมอ โดยฐานทดสอบไม่แตะ production

**Architecture:** คง Next.js single-page + Socket.io + in-memory server state. Shared UI รับ state ที่ตัดสินแล้วและมี local draft/presentation เท่านั้น. เพิ่ม protocol เฉพาะ snapshot recovery ที่พิสูจน์แล้วว่าจำเป็น; private state ใช้ private events เดิม.

**Tech Stack:** Next.js14/React18, Zustand, Socket.io, Tailwind/Framer Motion, native HTML dialog หรือ shared wrapper ที่ใช้ primitives ปัจจุบัน, Jest/Playwright/MySQL local

## Global Constraints

- Node >=20.19.0, pnpm@9.1.0; ไม่เปลี่ยน stack/engine เพื่อแก้ UX
- root `.env` เดียว; ไม่สร้าง per-app `.env`; แยก test environment ด้วย process env ที่ส่งถึง child จริง
- server-authoritative; room state ไม่ลง DB ระหว่างเล่น; ไม่เพิ่ม REST controller
- secret roles/words/hands/votes ไม่อยู่ใน public snapshot/log/telemetry
- event ใหม่ sync types/gateway/service/store; rebuild types ก่อน apps
- สองภาษา TH/EN, keyboard/touch, mute/reduced-motion และ viewer permissions
- ผลที่มีอยู่แล้ว: catalog metadata, status header, session tokens, RoomTimerService, E2E/sim และ nightly workflow. ไม่สร้างระบบเหล่านี้ซ้ำ

สถานะชุดด่วน: SH-1 ส่ง runner/config/env แล้ว; SH-2 ส่ง Home Join; SH-3 ส่ง Rules; SH-4 ส่ง connection/retry/offline guard. ขอบเขตอื่นคง unchecked; [ผลและข้อจำกัด](../../qa/2026-10-13-urgent-fixes.md).

## Task SH-1 — P0: แยก DB และ env สำหรับการทดสอบ (M)

**Files:** Create `scripts/test-isolated.mjs`; Modify `turbo.json`, `apps/web/playwright.config.ts`, `playwright.sim.config.ts`, `playwright.poker.config.ts`, `docs/agents/issue-tracker.md` เฉพาะคำสั่งอ้างอิงเมื่อจำเป็น; Review `.github/workflows/test-nightly.yml` ที่มี local MySQL อยู่แล้ว

**Interfaces:** runner รับ `TEST_DATABASE_URL`; validate hostname เป็น localhost/127.0.0.1/::1 ของ disposable DB; ส่งเป็น DATABASE_URL ให้ทุก child. ถ้าไม่มี/ไม่ใช่ local ให้ exit ก่อน startup/seed. `.env` ไม่ใช่แหล่ง fallback สำหรับ write-capable tests. Test DB guard อยู่ก่อน Playwright webServer เพื่อไม่ reuse server ที่ชี้ production.

- [x] เพิ่ม negative checks: ไม่มี TEST_DATABASE_URL, remote hostname, ไม่มี browser tests ที่ match → exit nonzero พร้อมเหตุผล
- [x] ใช้ MySQL disposable ที่ชื่อ DB เฉพาะ tests; build types→database, db:push/seed เฉพาะ URL ที่ตรวจแล้ว; runner ไม่ log credentials
- [x] กำหนด Turbo env allowlist สำหรับ DATABASE_URL/DISABLE_GAME_SETTINGS_DB/PORT/NEXT_PUBLIC_API_URL และค่าที่แต่ละ task ต้องใช้. ตรวจ child PORT/health และ API URL จริง; ไม่ใช้เพียง shell prefix แล้วเชื่อว่า Turbo ส่งครบ
- [x] ตั้ง test runner fail closed เมื่อจะ reuse server ที่ตรวจ environment ไม่ได้; isolation marker ใน test health/runner ต้องไม่เผย URL/secret
- [ ] คง nightly+manual workflow ตามที่ทีมเลือก ไม่เปลี่ยนเป็น PR-gating; เช็กผล GitHub run จริงแยกจากสิ่งที่ตรวจได้บนเครื่อง

```bash
# ไม่มี URL ต้องปฏิเสธก่อนเริ่ม server — เป็น acceptance ของ runner ใหม่
env -u TEST_DATABASE_URL node scripts/test-isolated.mjs
# ค่า example เป็น local disposable เท่านั้น; สร้าง container/schema ตาม runner ก่อน
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_test' node scripts/test-isolated.mjs --list
```

**ผ่านเมื่อ:** test ที่จำเป็นต้องเขียน GameResult/query_count ทำใน local DB และตรวจ table ก่อน/หลังได้; root `.env` ไม่เป็นแหล่ง DB ของ tests. ไม่เรียก production db:push/seed/reset.

## Task SH-2 — P1: มือถือไม่ตัดคำสั่งสำคัญ (S)

**Files:** Modify `apps/web/src/components/lobby/HomeView.tsx`, `RoomHeader.tsx`, `PlayerGrid.tsx`, `apps/web/src/app/page.tsx`; Test `apps/web/e2e/lobby.spec.ts` + new `hub-experience.spec.ts`

**Interfaces:** ตำแหน่งปุ่ม/ชื่อ/disabled ไม่เปลี่ยน createRoom/joinRoom semantics. เพิ่ม `data-testid="hub-join-room"` และ `room-primary-actions`; `input` ใน flex ใช้ min-w-0/w-0 flex-1; ไม่แก้ด้วยการซ่อน overflow ของ CTA.

- [ ] เก็บ baseline360px EN และ TH หลัง language state settle; assert ขอบปุ่ม Join ก่อนแก้
- [ ] ให้ input+Join reflow เป็นสองแถวได้; min-width ของ input ไม่ดันปุ่มนอก max-w-md; แสดงชื่อเกมที่กำลังเล่นบนมือถือในพื้นที่ที่ไม่เบียด controls
- [ ] ขยาย touch area ของ utility buttons ที่จำเป็น; target44×44px สำหรับ primary actions โดยไม่ขยาย artwork ทุกอย่าง; scroll เฉพาะพื้นที่ board/hand ที่ตั้งใจ
- [ ] ตรวจ 320/360/390px, long Thai names, zoom200% และ keyboard open; Home disabled cards ยังคงอ่านคำอธิบายได้

```ts
await page.setViewportSize({ width: 360, height: 800 });
const join = page.getByTestId('hub-join-room');
const box = await join.boundingBox();
expect(box!.x).toBeGreaterThanOrEqual(0);
expect(box!.x + box!.width).toBeLessThanOrEqual(360);
```

**ผ่านเมื่อ:** primary controls มองเห็นและกดได้ทั้งภาษา โดยไม่ต้องเลื่อนหน้าแนวนอน; screenshots review ไม่มีข้อความถูกตัด.

## Task SH-3 — P1: Dialog, focus และ feedback ที่เข้าถึงได้ (M)

**Files:** Create `apps/web/src/components/core/GameDialog.tsx`; Modify `RulesModal.tsx`, `lobby/RoomHeader.tsx`, `LobbyStartButton.tsx`, `SecretWordModal.tsx`, `core/ActionLoadingOverlay.tsx`, `apps/web/src/app/globals.css`; migrate per-game dialogs ใน task ของเกมนั้น; Test `rules-modal.spec.ts`, new `hub-experience.spec.ts`

**Interfaces:** `GameDialog({open,onClose,title,children,initialFocusRef?})`; ใช้ `<dialog>.showModal()` เมื่อ open เพื่อ native modality/focus management, ป้องกัน double show ใน StrictMode; onCancel ปิด state ผ่าน onClose, restore focus เมื่อปิด; server state ไม่อยู่ใน component นี้.

- [x] เพิ่ม test เปิด Rules→Tab/Shift+Tab อยู่ภายใน→Escape→คืน focus ที่ trigger; baseline Escape ไม่ปิดยืนยันแล้ว
- [ ] สร้าง shared dialog และเริ่ม migrate Rules/QR/Leave/host-input ก่อน; ใช้ aria-labelledby/title ภาษาเดียวกับผู้ใช้; modal หลายชั้นไม่ชนกัน
- [ ] ทำ loading overlay มี role=status/aria-busy และ copy ผ่าน dictionary; primary action ไม่หายจาก focus ขณะอัปเดต
- [ ] ใช้ MotionConfig reducedMotion="user" หรือ useReducedMotion สำหรับ Motion และ CSS media query สำหรับ animate-spin/bounce/pulse; อย่าลบ state feedback ที่จำเป็น. RoleCard ที่ทำแล้วคงไว้
- [ ] ตรวจ muted/reduced-motion+keyboard ด้วย screenshot และ hard assertions; ไม่ทดสอบ animation ด้วยจำนวนเฟรม

```ts
await page.getByRole('button', { name: 'How to Play' }).click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.keyboard.press('Escape');
await expect(page.getByRole('dialog')).toHaveCount(0);
await expect(page.getByRole('button', { name: 'How to Play' })).toBeFocused();
```

**ผ่านเมื่อ:** dialog ทุกชุดที่ migrate ปิด/คืน focus ถูก, ไม่มี focus หลุดไป action เกมที่อยู่ใต้ modal, no-sound/reduced-motion ยังอ่านสถานะได้ครบ.

## Task SH-4 — P1: Reconnect และ pending action ที่กู้ได้ (L)

**Files:** Modify `apps/web/src/store/useGameStore.ts`, `apps/web/src/app/page.tsx`; Create `apps/web/src/components/core/ConnectionStatus.tsx`; Test `apps/web/e2e/reconnect.spec.ts`, `apps/api/src/games/games.gateway.spec.ts` / `games.service.spec.ts`. ถ้าต้องใช้ snapshot request ให้แก้ `packages/types/src/core.ts`, `apps/api/src/games/games.gateway.ts` / `games.service.ts` ด้วย

**Interfaces:** local connection phase `connecting|connected|reconnecting|failed`; `ConnectionStatus` รับ phase/last room code/retry callback ไม่รับ secrets. emitGameAction ตรวจ connected และ socket.connected ก่อน emit. UI pending แยก accepted/rejected/unknown; timeout ไม่ถือว่า action ล้มเหลวแน่นอนและไม่ replay อัตโนมัติ.

- [ ] regression offline→click action→online ต้องไม่ replay stale action; forced server drop และ initial API unavailable ต้องมีข้อความ/ปุ่มกู้; preserved reconnect token คง seat เดิม
- [ ] เก็บ room surface หรือภาพสรุปที่ไม่เปิด secrets ขณะ reconnect พร้อมปิด controls; connect_error มี retry และทางกลับหน้าเลือกเกมที่ต้องยืนยันถ้าจะทิ้ง session
- [ ] เปลี่ยน emitter ให้หยุดส่งเมื่อ disconnected. Pending action ไม่ clear เพียงเพราะ broadcast อื่นมา; ใช้ acknowledgement/requestId เฉพาะ action ที่นำร่อง แล้วตรวจเป็นชุดก่อนขยาย 14 เกม
- [ ] หาก timeout แล้วยังไม่ทราบผล เพิ่ม `ROOM_SYNC_REQUEST='room_sync_request'` payload `{code,requestId}`: gateway ตรวจสมาชิก→`GamesService.syncRoomForSocket(code,socketId)`→ส่ง public projection ด้วย ROOM_STATE_UPDATED และ secrets ของเจ้าของผ่าน private events เดิม. ack `{requestId,ok,serverNow}` ไม่มี secrets. ห้ามใช้ joinRoom/token ซ้ำเพื่ออ่าน snapshot
- [ ] membership/observer authorization ใช้ guard เดิม; invalid code/ไม่ใช่สมาชิกได้ error โดยไม่เปลี่ยน state. snapshot ไม่ start timer/reset hand/rotate host
- [ ] จัด server-time offset จาก serverNow เฉพาะการแสดงเวลา; winner/timer deadlines ยังอยู่ที่ server. ทดสอบ clock skew ±5s และ refresh กลาง vote/deadline

```ts
await page.context().setOffline(true);
await expect(page.getByTestId('connection-status')).toContainText('Reconnecting');
await expect(page.getByTestId('ttt-cell-0')).toBeDisabled();
await page.context().setOffline(false);
await expect(page.getByTestId('connection-status')).toContainText('Connected');
await expect(page.getByTestId('ttt-cell-0')).toHaveText('');
```

**ผ่านเมื่อ:** UI บอกสถานะที่ถูก, online recovery คืน public/private state ของคนเดิม, ไม่มี buffered action รอบเก่า, uncertain outcome ไม่ชวนผู้เล่นส่งคำสั่งซ้ำ. พฤติกรรม stale replay ต้องพิสูจน์ด้วย test ก่อนเลือก protocol เพิ่ม.

## Task SH-5 — P2: Start validation, phase prompts และ copy (M)

**Files:** Modify `lobby/LobbyStartButton.tsx`, `GameViewManager.tsx`, `games/GameStatusHeader.tsx`, `core/ActionLoadingOverlay.tsx`, `i18n/dictionaries/{schema,th,en}.ts`; Test `lobby-options.spec.ts`, `i18n.spec.ts`, game experience specs

**Interfaces:** `getStartEligibility(room)` คืน `{canStart,reasonKey?,reasonParams?}` จาก public config; UI และ tests อิง reason เดียว, server ยัง revalidate. ปุ่ม `data-testid="lobby-start-game"`; error `data-testid="game-start-error"`. Prompts เฉพาะ role/phase ใช้ข้อมูลที่ผู้ใช้มีสิทธิ์รู้อยู่แล้ว.

- [ ] แสดงเหตุผลปุ่ม disabled แบบ inline และผูก aria-describedby: คนไม่ครบ/คน offline/ไม่มี category/ไม่มี query หรือ preset ที่ใช้ได้
- [ ] จำนวนผู้เล่นนับ active non-viewer ตาม service และ exception bot/moderator; ใช้ helper Banana Thief ที่มีอยู่. ปุ่ม starting disabled ตลอด pending จริง
- [ ] Music preset eligibility ส่งต่อ MT-1; Sounds Fishy DB/empty library error ส่งต่อ SF-1; อย่าแก้ด้วย generic Need more players ทั้งหมด
- [ ] เติม prompts ให้ผู้ทาย/ผู้โหวต/คนพัก/คนเลือก gold/showdown; result ไม่แสดง Your turn หรือ group action ที่ชวนกดผิด
- [ ] ตรวจ raw keys/enums: PREFLOP, PLAYER_TURNS, BIG_BLIND, allin/allIn; เพิ่ม explicit dictionary mappings และ test ภาษาไทยใน host/guess modal

| Copy contract         | ไทย                                              | English                                                 |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| reconnecting          | กำลังเชื่อมต่อกลับห้อง…                          | Reconnecting to your room…                              |
| action unknown        | ยังยืนยันผลคำสั่งไม่ได้ กำลังตรวจสถานะห้อง       | Action result is not confirmed. Checking room state     |
| query missing         | ใส่ชื่อเพลงหรือศิลปินก่อนเริ่ม                   | Enter a song or artist before starting                  |
| preset empty          | รายการนี้ไม่มีเพลงในระดับที่เลือก                | This preset has no tracks at the selected level         |
| questions unavailable | คลังคำถามยังใช้งานไม่ได้ ลองใหม่หรือเลือกเกมอื่น | Questions are unavailable. Retry or choose another game |

```ts
await expect(page.getByTestId('lobby-start-game')).toBeDisabled();
await expect(page.getByTestId('lobby-start-reason')).toContainText('Enter a song or artist');
```

**ผ่านเมื่อ:** ผู้เล่นใหม่ระบุ phase/หน้าที่/สิ่งที่ต้องทำได้จากหน้าเกม; ทั้งสองภาษาไม่แสดง translation key; private prompt ไม่กลายเป็น public progress.

## Task SH-6 — P2 แบบมีเงื่อนไข: วัด performance และคุณภาพการเล่น (M)

**Files:** Review `GameViewManager.tsx`, `useGameStore.ts`, `apps/web/src/app/layout.tsx`, assets ใน `apps/web/public/`; Modify เฉพาะส่วนที่ผลวัดชี้; Create `docs/qa/game-experience-baseline.md`

**Interfaces:** performance metrics เป็น aggregate ไม่มี room code/name/role/word/hand. ไม่ติดตั้ง analytics/ส่งข้อมูลออกบริการใหม่ในงานนี้; baseline ใช้ local traces หรือ metrics ที่มีอยู่.

- [ ] วัด initial JS, route load, long tasks ตอน reveal, render frequency ตอน room update และ asset load ก่อนแก้; eager game imports/full-store subscriptions เป็นข้อสังเกต ไม่ใช่ข้อพิสูจน์ว่าช้า
- [ ] หาก payload ใหญ่ ใช้ dynamic imports ต่อ game view และ loading fallback เดิม; test switching/reconnect ระหว่าง lazy load. หาก rerender สูง ใช้ Zustand selectors เฉพาะ fields ที่ component ต้องใช้
- [ ] playtest ผู้เล่นใหม่อย่างน้อย 2 กลุ่ม กลุ่มละ 3–5 คนในเกม social และคู่ 2 คนในเกมแข่งขัน; เก็บเวลาตั้งห้อง→เริ่มรอบ, จำนวนครั้งถามว่าต้องทำอะไร, miss-tap, start failure/recovery. ตัวเลขนี้เป็นโปรโตคอลเสนอ ไม่ใช่ผลที่วัดแล้ว
- [ ] ทดลองแนะนำเกมตามจำนวนคน/ความยากหลังฐาน interaction ผ่าน; กำหนดว่าจะทำเมื่อปัญหาเลือกเกมเด่นกว่าปัญหา in-game

**เป้าหมายเสนอ:** first-time users ≥80% เริ่ม action แรกได้โดยไม่ถามผู้ดำเนิน test; ไม่มี critical miss-tap ในชุด 360px; interaction ถึง server-confirmed feedback p95 ต้องวัด baseline แยก LAN/อินเทอร์เน็ตก่อนตั้ง threshold. ไม่รับรอง performance จาก dev build.

## ปิดงานร่วม

- [ ] targeted tests ไม่แตะ production และไม่ green จากศูนย์ test
- [ ] UI เข้าถึงได้ทั้ง pointer/keyboard/TH/EN/reduced-motion
- [ ] reconnect/host rotation/private-state/timer regression ผ่านสำหรับเกมที่เปลี่ยน
- [ ] บันทึก evidence พร้อม commit ใน roadmap; หลังเปลี่ยน code รัน `graphify update .`

อ้างอิง: [WCAG target sizes](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/). ผลตรวจปัจจุบันอยู่ใน [audit evidence](2026-10-13-game-audit-evidence.md).
