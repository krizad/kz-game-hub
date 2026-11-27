# ผลตรวจสุขภาพโปรเจกต์ KZ Game Hub — 26 พฤศจิกายน 2026

> Baseline `6043846e` (branch `main` ตรงกับ `origin/main` หลัง fast-forward จาก `975c9aa2`) · working tree สะอาดทั้งก่อนและหลังตรวจ
> เอกสารนี้บันทึกเฉพาะสิ่งที่ตรวจพบและหลักฐาน **ไม่มีการแก้โค้ด** ข้อที่ยังไม่ยืนยันระบุไว้ตรงจุด เลขบรรทัดทั้งหมดอ้างอิง baseline นี้

## สรุป

- แผน hardening ใน `.scratch/0001`–`0010` ถูก implement ครบทั้ง 5 เฟสแล้วบน `origin/main` (`df8f181f` ถึง `d80eb931`) แต่เครื่องที่ใช้ตรวจยังอยู่ที่โค้ดก่อน hardening 8 commit และ issue เดิมยังค้าง `open` จึงดูเหมือนว่ายังไม่ได้ทำ (ดู [สถานะ issue เดิม](#สถานะ-issue-เดิม-scratch00010010))
- Gate ที่ CI ครอบคลุมผ่านทั้งหมด: lint ผ่าน 4/4 workspace, API tests ผ่าน 1045/1045 (48 suites), build ผ่าน; หน้าแรกลดจาก First Load JS 459 kB เหลือ 199 kB
- ปัญหาสำคัญที่สุดอยู่นอกสิ่งที่ CI ครอบคลุม: **Nightly E2E ถูก cancel ด้วย timeout ทุกครั้งนับตั้งแต่ 14 พ.ย.** ทำให้ไม่มีผล E2E จาก CI เลย (AUD-01) และการรันในเครื่องบนโค้ดก่อน hardening พบ E2E fail จำนวนมาก ซึ่งยังต้องรันซ้ำบน baseline นี้
- Rate limit ของ admin ที่ phase 1 เพิ่มมา bypass ได้ด้วยการปลอม header `x-forwarded-for` (AUD-02)
- Dependency ที่ใช้งานจริงมี security advisory ที่ควรอัปเดต: `mariadb`, stack ของ `socket.io`, `next` (AUD-03)
- โครงสร้างหลักแข็งแรง: reconnection, การแยก private data, timer, validation ของ payload และเกมใหม่ "ไพ่ 31" ตรวจแล้วไม่พบปัญหา

## สถานะ gate บน baseline

| Gate                         | ผล                 | หมายเหตุ                                                                                           |
| ---------------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `pnpm lint`                  | ผ่าน               | 4/4 workspace ผ่าน (turbo)                                                                         |
| `tsc --noEmit` (api)         | ผ่าน               |                                                                                                    |
| `tsc --noEmit` (web)         | **ไม่ผ่าน**        | 2 errors ใน `e2e/demo.spec.ts` (TS2802) — AUD-09; CI ไม่ครอบคลุมเพราะ `next build` ผ่าน            |
| `pnpm -F api test`           | ผ่าน               | 48 suites, 1045/1045 tests, ประมาณ 24 วินาที; coverage รวม 74.3% statements / 63.5% branches       |
| `pnpm -F web build`          | ผ่าน               | route `/` ขนาด 61.9 kB, First Load JS 199 kB (ก่อน hardening 371 kB / 459 kB)                      |
| GitHub `CI`                  | ผ่าน               | run `45536961722` บน `6043846e` (lint, API tests, build)                                           |
| GitHub `Nightly tests`       | **cancelled**      | 12 ครั้งล่าสุด (14–26 พ.ย.) ถูก cancel ที่ `timeout-minutes: 75` ระหว่าง "E2E main suite" — AUD-01 |
| `pnpm audit --prod`          | **198 advisories** | critical 4 / high 77 / moderate 105 / low 12 — AUD-03                                              |
| E2E (Playwright) บน baseline | **ยังไม่ได้รัน**   | รันแล้ว 1 รอบบนโค้ด `975c9aa2` เท่านั้น — ดู [ผล E2E](#ผล-e2e-รอบที่รันบนโค้ด-975c9aa2)            |

คำสั่ง Jest รันโดย override `DATABASE_URL` ไปที่ MySQL test ในเครื่องเสมอ (spec ที่แตะ DB ทั้ง 5 ไฟล์ใช้ `jest.mock('@repo/database')` อยู่แล้ว) และ**ไม่ได้**ตั้ง `DISABLE_GAME_SETTINGS_DB` เพราะค่านั้นทำให้ `game-settings.service.spec.ts` fail 1 เคส (workflow nightly มี comment กำกับเรื่องนี้ไว้แล้ว)

## ขอบเขตและข้อจำกัด

ตรวจดังนี้

- รัน gate ทั้งหมดในตารางข้างต้นบน baseline (หลัง `pnpm install --frozen-lockfile --ignore-scripts` และ rebuild `@repo/types` + `@repo/database`)
- อ่านโค้ด core: `main.ts`, `health.controller.ts`, `games.gateway.ts` (validation, broadcast, timer sync, join/leave), `games.service.ts` (`joinRoom`, `leaveRoom`, `deleteRoomData`, `resetGame`), `ws-rate-limit.service.ts`, `player-session.service.ts`, `room-timer.service.ts`, `useGameStore`, `playwright*.config.ts`, workflow ทั้ง 3 ไฟล์, `schema.prisma`, deploy script
- ตรวจแบบเชิงกล: เทียบ `remapSocketId` ของทุกเกมกับฟิลด์ที่เป็น id ใน state type, เทียบ env ที่โค้ดอ่านกับ `.env.example`, เทียบ migration กับ `schema.prisma`, นับ coverage รายไฟล์
- ดูประวัติ GitHub Actions ผ่าน `gh run list` / `gh run view`
- รีวิวแบบเจาะจงเฉพาะจุดเสี่ยงของเกมใหม่ "ไพ่ 31" (ความลับของไพ่ในมือ, การให้แต้ม, การจั่ว, showdown) และของ Banana Thief (ที่เก็บตัวโจร)
- รัน E2E 1 รอบบนโค้ด `975c9aa2` (ดูหมายเหตุด้านล่าง)

ข้อจำกัด

- **ไม่ได้อ่าน logic ของทุกเกมทีละบรรทัด** subagent ที่จะใช้แบ่งงานตรวจใช้ไม่ได้ในรอบนี้ จึงตรวจเฉพาะ core และ spot-check เกมที่มีความลับ; เกมอื่นยังไม่มีการรีวิวเชิงลึก
- **E2E ยังไม่ได้รันบน baseline** ผล E2E ทั้งหมดในเอกสารนี้มาจากโค้ด `975c9aa2` ซึ่งเก่ากว่า 8 commit และผ่านการเปลี่ยน frontend ครั้งใหญ่ (phase 2–3) จึงยังสรุปไม่ได้ว่าเป็น regression ของโค้ดล่าสุด
- ไม่ได้ทดสอบกับ production, อุปกรณ์จริง หรือ Safari
- ไม่ได้ประเมิน reachability ของ advisory แต่ละตัว (ดู AUD-03)

## ข้อค้นพบ

ระดับ: **P1** ควรแก้ก่อน · **P2** ควรวางแผนแก้ · **P3** ปรับปรุงเมื่อมีเวลา

### P1 — ควรแก้ก่อน

#### AUD-01 Nightly E2E ถูก cancel ทุกครั้ง ทำให้ไม่มีผล E2E จาก CI

**หลักฐาน**

- `gh run list -w "Nightly tests"`: 12 ครั้งล่าสุด (14 ถึง 26 พ.ย. เวลา UTC) มีสถานะ `cancelled` ทั้งหมด แต่ละครั้งใช้เวลาประมาณ 75 นาที
- run ล่าสุด (`45743967548`): step "Jest (API)" ผ่าน, step "E2E main suite" ถูก cancelled, step "E2E sim suite" ถูก skipped
- `.github/workflows/test-nightly.yml:19` ตั้ง `timeout-minutes: 75` ให้ทั้ง job; step ที่ 80–84 รัน main suite แล้วต่อด้วย sim suite ใน job เดียว
- `apps/web/playwright.config.ts:7` ใช้ `testDir: './e2e'` และไม่มี `testIgnore`/`testMatch` ชุด "main" จึงรวม `e2e/demo.spec.ts` (งานอัดวิดีโอ 20 เกม) และ `e2e/sim/` (57 เคส play-to-completion) เข้าไปด้วย ทั้งที่ทั้งสองส่วนมีการรันแยกอยู่แล้ว (`playwright test demo` และ `playwright.sim.config.ts`)
- ในเครื่อง sim suite เดียวใช้เวลา 1.5 ชั่วโมง (`E2E_SIM_PLAYS=1`, 2 workers) และ main suite ยังไม่จบเมื่อพ้น 1 ชั่วโมง

**ผลกระทบ** ไม่มีใครเห็นผล E2E มาอย่างน้อย 12 วัน; sim suite ไม่เคยได้รันใน CI; `pnpm test:e2e` ในเครื่องรันงานอัดวิดีโอไปด้วย ซึ่งเขียนทับไฟล์ `apps/web/public/demo/*-demo.mp4` ที่ git track ไว้ (เกิดจริงระหว่างการตรวจ — ดู [หมายเหตุด้านการดำเนินงาน](#หมายเหตุด้านการดำเนินงาน))

**ที่เสนอ**

1. เพิ่ม `testIgnore: ['**/demo.spec.ts', '**/sim/**']` ใน `apps/web/playwright.config.ts` ให้ demo รันเฉพาะเมื่อเรียก `playwright test demo` ตามที่ AGENTS.md ระบุ
2. แยก nightly เป็น 2 job (`e2e-main`, `e2e-sim`) ที่มี `timeout-minutes` ของตัวเอง และอัปโหลด artifact เมื่อ fail
3. รันชุด E2E บน baseline นี้ให้จบ แล้ว triage ตาม [ผล E2E](#ผล-e2e-รอบที่รันบนโค้ด-975c9aa2) เป็นงานแรกหลังแก้ config

#### AUD-02 Rate limit ของ admin bypass ได้ และ bucket ไม่มีการเก็บกวาด

**หลักฐาน**

- `apps/api/src/games/ws-rate-limit.service.ts:41-56` — `extractClientIp()` อ่าน hop **แรก** (ซ้ายสุด) ของ header `x-forwarded-for` ที่ client ส่งมาเองเสมอ ไม่มีเงื่อนไขเรื่อง trusted proxy
- `apps/api/src/games/games.gateway.ts:181` ส่ง `extractClientIp(client.handshake)` เป็น key ของ bucket `admin`
- bucket `admin` (5 ครั้ง/นาที + ล็อก 5 นาที ตามค่า default) ใช้ป้องกัน `ADMIN_VERIFY_KEY`, `SET_GAME_ENABLED`, `SET_ARTIST_ENABLED`, `DELETE_ARTIST` (`ws-rate-limit.service.ts:24`)
- `adminBuckets` (`ws-rate-limit.service.ts:58`) ไม่มีการลบ entry: `checkBucket` สร้าง entry ต่อ key ใหม่ (`:116-120`) และ `clearSocket()` (`:201-205`) ลบเฉพาะ `socketBuckets`

**ผลกระทบ** client ที่ไม่ใช่ browser เปลี่ยนค่า `x-forwarded-for` ทุกครั้งที่เชื่อมต่อได้ จึงได้ bucket ใหม่เสมอ: ตัวล็อกที่กัน brute-force `ADMIN_SECRET` ไม่มีผล และการหมุน header ยังสร้าง entry ที่ไม่มีวันถูกลบ ทำให้ memory โตได้ไม่จำกัด เมื่อวางหลัง reverse proxy ที่เติม header (ไม่ได้แทนที่) ค่า hop แรกก็ยังเป็นค่าที่ client ควบคุมอยู่ดี

**ที่เสนอ**

1. ใช้ `handshake.address` เป็นค่าเริ่มต้น และอ่าน `x-forwarded-for` เฉพาะเมื่อตั้งค่าจำนวน trusted proxy hop (เช่น `TRUSTED_PROXY_HOPS`) โดยนับ hop จากขวา ไม่ใช่ hop แรก
2. เก็บกวาด `adminBuckets` (ลบ entry ที่พ้น window + lockout หรือจำกัดขนาด map)
3. เพิ่ม spec: socket เดิมที่หมุน `x-forwarded-for` ต้องยังถูก limit; และกรณี key ไม่ซ้ำเลยต้องไม่ทำให้ map โตไม่จำกัด
4. เมื่อไปเปิด `trust proxy` ของ Express ในอนาคต ให้ปรับ `proxy-addr` เป็น `>=2.0.8` พร้อมกัน (มี advisory critical เรื่อง IP spoofing — AUD-03)

#### AUD-03 Dependency ที่ใช้งานจริงมี security advisory

**หลักฐาน** `pnpm audit --prod` ณ วันที่ตรวจ: 198 advisories (critical 4 / high 77 / moderate 105 / low 12) ส่วนใหญ่เป็น dependency ลึกที่โปรเจกต์ไม่ได้เรียกตรง (`hono`, `undici`, `axios` ผ่าน `youtubei.js` และ `@google/genai`) ตัวที่เกี่ยวกับ runtime จริงคือ

| Package (เวอร์ชันที่ติดตั้ง)             | Advisory ที่เกี่ยง                                                                        | แก้ที่                 | ประกาศที่                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| `mariadb@3.5.3` (มี `3.4.5` แฝงอีกสำเนา) | SQL injection, หลุดข้อมูลที่ยังไม่ได้ init, cleartext password — driver ต่อ DB production | `>=3.5.4`              | `packages/database/package.json:27` (`^3.5.3`) |
| `engine.io@6.6.5`                        | DoS ผ่าน polling transport (API เปิด polling และ websocket)                               | `>=6.6.10`             | ผ่าน `socket.io`                               |
| `socket.io-parser@4.2.5`                 | Memory exhaustion จาก binary attachment                                                   | `>=4.2.7`              | ผ่าน `socket.io`                               |
| `ws@8.18.3`                              | Memory exhaustion DoS, หลุดข้อมูลใน memory                                                | `>=8.21.0`             | ผ่าน `engine.io`                               |
| `proxy-addr@2.0.7`                       | IP spoofing (critical) ผ่าน Express                                                       | `>=2.0.8`              | ผ่าน `@nestjs/platform-express`                |
| `next@14.2.35` (latest 16.4.6)           | ประมาณ 28 รายการ รวม critical: RCE ใน Image Optimization API เมื่อมีไฟล์ SVG/AVIF         | แพตช์เฉพาะ `>=15.5.29` | `apps/web/package.json:26` (`^14.2.35`)        |

สำหรับ `next`: แอปไม่ได้ใช้ `next/image` (0 import) แต่ `apps/web/public` มีไฟล์ SVG 7 ไฟล์ และ `next.config.mjs` ไม่ได้จำกัด `images` endpoint `/_next/image` จึงเปิดอยู่ตามค่า default; Next.js 14 ไม่ได้รับแพตช์เหล่านี้

**ผลกระทบ** ตามรายการข้างต้น; ความรุนแรงจริงของแต่ละ advisory ในบริบทของโปรเจกต์ (โดยเฉพาะบน Vercel ที่ image optimization อาจทำที่ platform) ยังไม่ได้ประเมิน

**ที่เสนอ**

1. อัปเดตระดับ patch ก่อน: `mariadb` เป็น `>=3.5.4`, `socket.io`/`socket.io-client` เป็น 4.8.x ล่าสุดที่ดึง `engine.io`/`socket.io-parser`/`ws` ที่แก้แล้ว, และ `overrides` สำหรับ `proxy-addr >=2.0.8`
2. ปิด image optimizer ชั่วคราว (`images: { unoptimized: true }` หรือจำกัด `images.localPatterns`) จนกว่าจะ upgrade Next
3. วางแผน upgrade Next 14 → 16 (เกี่ยวกับ React 19) เป็นแผนแยกพร้อม E2E ที่รันได้
4. เพิ่ม `pnpm audit --prod --audit-level=high` ใน CI หรือเปิด Dependabot/Renovate

#### AUD-04 `pnpm dev` ในเครื่องต่อ DB production โดยตรง

**หลักฐาน** `AGENTS.md` ระบุว่า `DATABASE_URL` ใน root `.env` เป็น remote production MySQL; `packages/database/src/index.ts` และ `apps/api/src/main.ts` โหลด root `.env` เดียวกัน และ `prisma.config.ts` ใช้ `DATABASE_URL` เดียวกันสำหรับทุกคำสั่ง `db:*`

**ผลกระทบ** การทดสอบในเครื่อง (สร้างผล leaderboard, สลับ flag เกม, seed) เขียนลงข้อมูล production; ความผิดพลาดจาก `pnpm db:push`/`db:seed` ครั้งเดียวมีผลกับข้อมูลจริง มีเพียง E2E ที่มี guard บังคับใช้ DB test ในเครื่อง (`scripts/test-database.mjs`)

**ที่เสนอ** ชี้ `DATABASE_URL` ใน root `.env` ไปที่ `kz-game-hub-db` (port 3307) และเก็บค่า production ไว้เฉพาะบน Plesk; เพิ่ม guard ตอน boot ที่ปฏิเสธ `DATABASE_URL` ที่ไม่ใช่ loopback เมื่อ `NODE_ENV !== 'production'` (ยกเว้นตั้ง opt-in ชัดเจน); อัปเดตคำเตือนใน `AGENTS.md` ให้ตรงกับสถานะใหม่

### P2 — ควรวางแผนแก้

#### AUD-05 Prisma migrations ใช้การไม่ได้

**หลักฐาน** `packages/database/prisma/migrations/` มี 2 migration (`20260512075152_init`, `20260615110324_update_db`) โดย `migration_lock.toml` ระบุ `provider = "postgresql"` และ SQL เป็นสไตล์ Postgres (`CREATE TYPE "RoomStatus" AS ENUM`) ครอบคลุม 4 ตาราง (`Room`, `User`, `SoundsFishyQuestion`, `Word`) ขณะที่ `schema.prisma` เป็น MySQL และมี 8 โมเดล

**ผลกระทบ** `prisma migrate dev/deploy` ใช้ไม่ได้ ทุกการเปลี่ยน schema ใน production (index ที่ phase 4 เพิ่ม, `ArtistPreset`, `GameSetting`) จึงอาศัย `prisma db push` อย่างเดียว ไม่มีประวัติการเปลี่ยนแปลงและไม่มี rollback

**ที่เสนอ** สร้าง baseline migration สำหรับ MySQL จาก schema ปัจจุบัน (`prisma migrate diff --from-empty --to-schema-datamodel ... --script`) ประกาศ baseline กับ production ด้วย `prisma migrate resolve --applied` แล้วใช้ `prisma migrate deploy` ใน deployment; ทำบน DB test ในเครื่องก่อนเสมอ

#### AUD-06 เกมไพ่ (`CARD_GAME`): reset ไม่ล้างสถานะผู้ชม

**หลักฐาน** สาขา `CARD_GAME` ของ `resetGame()` (`apps/api/src/games/games.service.ts:1439-1448`) set `room.status = LOBBY` และคืนค่าโดยตรง ไม่ผ่าน `withRoom` จึงไม่ได้เรียก `clearViewerFlagsOnLobby()` (`:1235`) ส่วนเกมอื่นรวมถึง `THIRTY_ONE` และ `COUP` ผ่าน `withRoom` ทุกสาขา

**ผลกระทบ** ผู้เล่นที่เข้าระหว่างเกม (`isViewer = true`) ยังเป็นผู้ชมหลัง host reset: รอบถัดไปไม่ถูกจัดที่นั่ง (`card-game.service.ts:69`, `:90` กรอง `isViewer` ออกตอนเริ่ม) และ action ถูกปฏิเสธโดย `rejectViewer` ทางแก้เฉพาะคือออกจากห้องแล้วเข้าใหม่ ข้อกำหนดเบื้องต้นคือ host เปิด `allowSpectators` (ค่า default เป็น `false`)

**ที่เสนอ** เรียก `this.clearViewerFlagsOnLobby(room)` ก่อนคืนค่าในสาขานั้น และเพิ่ม spec ใน `games.service.spec.ts`

#### AUD-07 `.env.example` ขาด env ที่โค้ดอ่านจริง 18 ตัว

**หลักฐาน** เทียบ `process.env.*` ที่ปรากฏใน `apps/api/src`, `packages/database/src`, `apps/web/src`, `next.config.mjs` และ `scripts/` กับ `.env.example` พบตัวที่โค้ดอ่านแต่ไม่มีในตัวอย่าง

- `RATE_LIMIT_ADMIN_LOCKOUT_MS`, `RATE_LIMIT_ADMIN_MAX`, `RATE_LIMIT_ADMIN_WINDOW_MS`, `RATE_LIMIT_CREATE_ROOM_MAX`, `RATE_LIMIT_CREATE_ROOM_WINDOW_MS`, `RATE_LIMIT_EXTERNAL_MAX`, `RATE_LIMIT_EXTERNAL_WINDOW_MS`, `RATE_LIMIT_GENERAL_MAX`, `RATE_LIMIT_GENERAL_WINDOW_MS` (9 ตัว; phase 1 เพิ่มมาแต่ไม่ได้บันทึก)
- `FTP_HOST`, `FTP_USER`, `FTP_PASS`, `FTP_REMOTE_DIR`, `FTP_SECURE` (deploy script)
- `LOG_TO_FILE`, `LOG_DIR`, `DISABLE_GAME_SETTINGS_DB`

ในทางกลับกัน `.env` ในเครื่องมี `YOUTUBE_API_KEY` แต่ไม่มีโค้ดไหนอ่าน

**ที่เสนอ** เพิ่ม 18 ตัวข้างต้นพร้อม comment อธิบายค่า default เข้า `.env.example` และลบ `YOUTUBE_API_KEY` ออกจาก `.env` ในเครื่อง

#### AUD-08 ผู้ชมไม่ได้รับแจ้งเมื่อผู้เล่นคนสุดท้ายออกจากห้อง

**หลักฐาน** `apps/api/src/games/games.gateway.ts:279-282` — กรณี `ROOM_EMPTIED` (ผู้เล่นคนสุดท้ายออกแบบ explicit; `games.service.ts:636`) ลบห้องแต่ไม่ emit `ROOM_DELETED` ส่วนกรณี `ROOM_CLOSED` (`:276`) และ grace expiry emit ผู้ชมที่เข้าผ่าน `SPECTATE_JOIN` (`:2316`) อยู่ใน socket.io room แต่ไม่อยู่ใน `room.players`

**ผลกระทบ** ผู้ชมค้างอยู่ในหน้าห้องที่ถูกลบไปแล้วจนกว่าจะออกเอง; เกิดได้เฉพาะเมื่อเปิด `allowSpectators`

**ที่เสนอ** emit `ROOM_DELETED` ในกรณี `ROOM_EMPTIED` ด้วย และตรวจว่า handler ฝั่ง client พาผู้ชมกลับหน้าแรก

#### AUD-09 `tsc --noEmit` ของ web ไม่ผ่าน และ CI ไม่ครอบคลุม

**หลักฐาน** `apps/web/e2e/demo.spec.ts:1344` และ `:2062` — การ spread `Set` (`[...new Set([...])]`) ผิด TS2802 เพราะ `apps/web/tsconfig.json:4` ตั้ง `target: "es5"`; `next build` ผ่านและ CI ไม่มี step type-check แยก

**ผลกระทบ** ไม่มีผลตอนรัน (Playwright transpile โดยไม่ type-check) แต่ `tsc --noEmit` ของ web ใช้เป็น gate ไม่ได้ และ type error ใน `e2e/` ตรวจไม่พบ

**ที่เสนอ** เปลี่ยนเป็น `Array.from(new Set([...]))` หรือปรับ `target`; เพิ่ม step `tsc --noEmit` สำหรับ `api` และ `web` ใน `ci.yml`

### P3 — ปรับปรุงเมื่อมีเวลา

#### AUD-10 ไม่มีจำกัดจำนวนผู้เล่นต่อห้อง และการเช็คชื่อซ้ำแยกตัวพิมพ์

`apps/api/src/games/games.gateway.ts:541` จำกัดจำนวนผู้เล่นเฉพาะ Dog Relay; เกมอื่นจำกัด min/max ตอนเริ่มเกมเท่านั้น ห้องใน lobby จึงรับผู้เล่นได้ไม่จำกัด `games.service.ts:446-448` เช็คชื่อซ้ำด้วย `player.name === user.name` จึงตั้งชื่อ `Bob` และ `bob` พร้อมกันได้ ในเกม social deduction การแอบอ้างชื่อทำได้ง่าย **ที่เสนอ** จำกัดจำนวนผู้เล่นต่อห้องตอน join (จาก catalog หรือค่า global) พร้อม error code ที่แปล i18n แล้ว; เช็คชื่อซ้ำด้วยชื่อที่ normalize แล้ว (trim, NFKC, ตัวพิมพ์เล็ก)

#### AUD-11 `/health` ตอบ 200 แม้ DB ล่ม และเปิดเผยข้อมูล runtime

`apps/api/src/health/health.controller.ts:11` เป็น `@Get()` ธรรมดา จึงตอบ HTTP 200 พร้อม `status: "degraded"`; คำตอบมี `environment`, `nodeVersion`, `pid` และ memory usage (`:46-58`) โดยไม่ต้องยืนยันตัวตน **ที่เสนอ** ตอบ 503 เมื่อ DB ล่มเพื่อให้ uptime monitor ถือว่าล่มจริง และย้ายข้อมูล runtime ไป endpoint แยกที่จำกัดสิทธิ์

#### AUD-12 Lint ไม่ครอบคลุม hooks และ promise; coverage ของ gateway ต่ำ

`apps/web/eslint.config.mjs:23` ปิด `no-explicit-any`; `apps/web/package.json` ไม่มี `eslint-plugin-react-hooks` (ไม่มี `rules-of-hooks`/`exhaustive-deps`) และไม่มี rule แบบ type-aware เช่น `no-floating-promises`; `parserOptions.project: true` (`:17-18`) ตั้งไว้โดยไม่มี rule ที่ใช้ Coverage: `games.gateway.ts` 36.8% statements / 29.8% branches (ต่ำสุดในบรรดาไฟล์หลัก), `games.service.ts` 59.4% / 51.3% **ที่เสนอ** เพิ่ม react-hooks plugin (`rules-of-hooks` เป็น error, `exhaustive-deps` เป็น warn) และ `no-floating-promises` สำหรับ api; เพิ่ม test ระดับ handler ของ gateway

#### AUD-13 สุขอนามัยของ repository

- branch ที่ merge แล้วแต่ยังไม่ลบ 8 กิ่ง: `enhance/fix-ui`, `feature/cipher-grid-pictures`, `feature/hub-workflow-verification`, `feature/werewolf`, `feature/who-barks`, `fix/card-game-ttt-hardening`, `fix/game-improvements`, `fix/urgent-gameplay`
- `fix/audit-defects-1` มี 32 commit ที่ไม่อยู่ใน `main` (ล่าสุด 16 ก.ย.; ต่างจาก `main` 71 ไฟล์) และ stash 4 รายการ — ควรตัดสินใจว่ายกเลิกหรือนำกลับมา
- git track ไฟล์เฉพาะเครื่อง: `.video_agent/plugin_root` (absolute path ของ plugin ในเครื่องนี้) และ `.stitch.json` (ตรวจแล้วเป็น Stitch project id ไม่ใช่ credential)
- `apps/web/public` อยู่ใน git 97 MB (วิดีโอ demo 48 MB, รูป 45 MB) — พิจารณา Git LFS หรือ host วิดีโอภายนอกภายหลัง
- `.scratch/0001`–`0010` ยัง `Status: open` ทั้งที่ implement แล้ว

## ผล E2E รอบที่รันบนโค้ด `975c9aa2`

รันด้วย `TEST_DATABASE_URL` ชี้ที่ `kz-game-hub-db` (127.0.0.1:3307/kz_game_hub_test), dev server ผ่าน `next dev` + `nest start --watch`, เครื่องมี dev server ของโปรเจกต์อื่นรันอยู่ด้วย โค้ดที่รันเก่ากว่า baseline 8 commit

### Sim suite (`playwright.sim.config.ts`, `E2E_SIM_PLAYS=1`)

21 failed · 33 passed · 3 skipped · ใช้เวลา 1.5 ชั่วโมง (เคสที่ skip คือ `whoami-ai` และ `music-trivia-soundcloud`/`youtube` ที่ต้องใช้ key/เน็ตภายนอก)

| เกม               | fail | รูปแบบข้อผิดพลาดที่พบ                                                              |
| ----------------- | ---- | ---------------------------------------------------------------------------------- |
| Banana Thief      | 9    | ข้อความผลไม่ปรากฏ; ฉากตัวพิเศษ timeout 9.5–16.8 นาทีต่อเคส                         |
| Who First         | 3    | `round-result-title` ไม่ปรากฏภายใน 8 วินาที                                        |
| Dog Relay         | 2    | `dog-relay-result` ไม่ปรากฏ; ฉาก 9 คน: `SyntaxError: Unexpected end of JSON input` |
| Tic-Tac-Toe (bot) | 2    | ปุ่ม "Play Again / เล่นอีกครั้ง" ไม่ปรากฏภายใน 20 วินาที                           |
| The Mind          | 2    | ไม่พบข้อความ "You Win / Game Over" (1.5 นาที)                                      |
| Pok Deng          | 2    | timeout 120 วินาที                                                                 |

### Main suite (`playwright.config.ts`) — หยุดก่อนจบ

เมื่อหยุดการรันพบ 59 failed และ 204 passed; ไม่ใช่ผลของชุดเต็ม 59 เคสที่ fail ประกอบด้วย sim ที่ถูกรันซ้ำ 19 เคส, demo 1 เคส และเคสใน 21 spec อื่นอีก 39 เคส (มากที่สุด: `music-trivia-experience.spec.ts` 11, `dog-relay.spec.ts` 6, `who-first-experience.spec.ts` 2, `tic-tac-toe-experience.spec.ts` 2, `battleship.spec.ts` 2) รายละเอียดข้อผิดพลาดของชุดนี้ไม่ได้ถูกพิมพ์เพราะ reporter รายงานตอนจบ

**ข้อสังเกต** รูปแบบที่พบใน sim คล้ายกัน คือหน้าจอผลตอนจบเกมไม่ปรากฏ แต่**ยังไม่ได้ระบุสาเหตุ** จึงต้องรันซ้ำบน baseline ปัจจุบันก่อนตีความว่าเป็น regression ของโค้ดหรือของ test harness

## สิ่งที่ตรวจแล้วว่าสบาย

- **Reconnection** — `remapSocketId` ของทั้ง 19 เกม (รวมไพ่ 31) อ้างถึงฟิลด์ที่เป็น id ทุกตัวใน state type ของตัวเอง (ตรวจด้วยสคริปต์เทียบ field แบบเชิงกล); `joinRoom` remap `roomHostId`, `hostPlayerId`, votes, chips และ private state ครบ; `deleteRoomData` ล้าง timer, session, private state, action receipt และข้อมูลเฉพาะเกม (music trivia, saboteur deadline) ครบ
- **Private data** — ความลับเก็บนอก `RoomState` ที่ broadcast: Banana Thief เก็บตัวโจรใน record `__room__` และเซ็ต `state.thiefId` เฉพาะตอนเฉลย; ไพ่ 31 เก็บไพ่ในมือและกองไพ่ใน private state, เปิดเผย `revealedHands` เฉพาะใน showdown และ action `DRAW_STOCK` ไม่ใส่ไพ่ใน `lastAction`
- **Timer** — `RoomTimerService` ใช้ key ต่อห้อง+ชื่อ, `unref()`, ครอบ callback ด้วย try/catch และ `clearRoom` เมื่อลบห้อง
- **Session และ validation** — reconnect token สุ่ม 32 bytes เก็บเป็น hash มีอายุ 24 ชั่วโมง; middleware `client.use` ตรวจ payload ทุก event (`isValidPayload` + `hasSafeValues` จำกัดความลึก/ความยาว/ขนาด array)
- **ไพ่ 31 (commit `6043846e`)** — ต่อครบทั้ง 4 จุด (types, gateway, service, store) มี spec 471 บรรทัด, E2E spec และ sim entry; การให้แต้ม (A=11, 30.5 สามตัว, 31 เป็น Blitz), knock penalty และการตัดไล่์ตรงตาม comment กติกาใน `packages/types/src/thirty-one.ts`
- **i18n** — `th` และ `en` ประกาศเป็น `Dictionary` และ `schema.ts` ไม่มี key แบบ optional ทำให้ TypeScript บังคับความครบถ้วนของ key ทั้งสองภาษา
- **Error handling ของ WebSocket** — `WsExceptionFilter` จับ exception ทุกกรณีและไม่เผยรายละเอียดให้ client

## สถานะ issue เดิม `.scratch/0001`–`0010`

ทั้ง 10 issue implement แล้วบน baseline (ยืนยันจากโค้ดและ gate ไม่ใช่จากข้อความ commit)

| Issue | Commit     | สิ่งที่ยืนยันบน baseline                                                                                                                                                                                                                 |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001  | `df8f181f` | lint ผ่าน 4/4; `.github/workflows/ci.yml` รัน lint + API tests + build; `deploy.yml` มี gate; Node 22 ทุก workflow                                                                                                                       |
| 0002  | `df8f181f` | `WsRateLimitService` + spec; `timingSafeEqual` ใน `common/admin-auth.util.ts`; `parseCorsOrigin` ใช้ร่วมกันใน `main.ts` และ gateway; `MAX_ROOMS` (default 200), `IDLE_ROOM_TTL_MS` (default 2 ชั่วโมง) + spec — **แต่มีช่องโหว่ AUD-02** |
| 0003  | `58471636` | `GameViewManager` ใช้ dynamic loader ผ่าน `game-view-loaders.tsx`; First Load JS 199 kB (เป้า < 220 kB)                                                                                                                                  |
| 0004  | `58471636` | `useGameStore()` แบบไม่มี selector เหลือ 0 จุด; store แยกเป็น slice (ไฟล์หลักเหลือ 131 บรรทัดจาก 1,408)                                                                                                                                  |
| 0005  | `58471636` | มี `app/error.tsx` และ `GameErrorBoundary.tsx`                                                                                                                                                                                           |
| 0006  | `b15644a8` | icon ลดเหลือ 40 KB ต่อไฟล์; font weights `['400','500','600','700']`; `<html lang="th">`                                                                                                                                                 |
| 0007  | `9e8a5b36` | `console.*` ใน `apps/api/src` (ไม่รวม spec) เหลือ 0; `/health` ใช้ `SELECT 1`                                                                                                                                                            |
| 0008  | `9e8a5b36` | composite index `[lang, query_count]`, `[gameType, playerName]`, `[playerName, createdAt]` อยู่ใน schema                                                                                                                                 |
| 0009  | `d80eb931` | `gateway/payload-validator.ts` + spec และ `gateway/admin-gateway.helper.ts`; store slices                                                                                                                                                |
| 0010  | `d80eb931` | security headers + `poweredByHeader: false`; `@types/fs-extra` อยู่ใน `devDependencies`; `.zcode/` ถูก ignore; ไฟล์ root ย้ายเข้า `docs/archive/`                                                                                        |

ข้อเสนอ: เปลี่ยน `Status:` ของทั้ง 10 เป็น `done` ตาม convention ใน `docs/agents/issue-tracker.md` (ไม่ได้แก้ในรอบนี้)

## ลำดับงานที่เสนอ

1. **AUD-01** แก้ `testIgnore` และแยก job ของ nightly แล้วรัน E2E บน baseline ให้จบ — เป็นตัวชี้วัดว่างานถัดไปทำให้ดีขึ้นจริงไหม
2. **AUD-02** แก้ `extractClientIp` + เก็บกวาด bucket + spec
3. **AUD-03** อัปเดต `mariadb` และ `socket.io` stack (patch-level, ความเสี่ยงต่ำ) แล้วปิด image optimizer ระหว่างรอแผน upgrade Next
4. **AUD-04** ย้าย dev ไปใช้ DB ในเครื่อง + guard ตอน boot
5. **P2 ที่เหลือ** (AUD-05 ถึง AUD-09) ทำเป็น PR เล็กๆ ทีละข้อ
6. **P3** ตามโอกาส

## วิธีรันซ้ำ

คำสั่งที่แตะ DB ต้อง override `DATABASE_URL` ไปที่ DB test ในเครื่องเสมอ (root `.env` ชี้ที่ production)

```bash
export TEST_DATABASE_URL='mysql://root:password@127.0.0.1:3307/kz_game_hub_test'
export DATABASE_URL="$TEST_DATABASE_URL"

pnpm install --frozen-lockfile --ignore-scripts
pnpm build --filter=@repo/types --filter=@repo/database
pnpm lint
pnpm -F api exec tsc --noEmit
pnpm -F web exec tsc --noEmit          # คาดว่าจะ fail 2 errors จนกว่าจะแก้ AUD-09
pnpm -F api test -- --coverage         # ห้ามตั้ง DISABLE_GAME_SETTINGS_DB
pnpm -F web build                      # ดู First Load JS ของ route /
pnpm audit --prod
gh run list -w 'Nightly tests' -L 12
```

สำหรับ E2E ใช้ runner ที่หยุด child process group ได้ตาม [isolated-e2e.md](isolated-e2e.md) และหลีกเลี่ยง `playwright test` แบบไม่กรองจนกว่าจะแก้ AUD-01 เพราะจะอัดวิดีโอ demo ทับไฟล์ที่ track ไว้

```bash
E2E_SIM_PLAYS=1 pnpm -F web exec playwright test -c playwright.sim.config.ts --reporter=list
pnpm -F web exec playwright test --grep-invert 'Full Game Demos|sim/' --reporter=list
```

## หมายเหตุด้านการดำเนินงาน

- การตรวจเริ่มบนโค้ด `975c9aa2` ซึ่งล้าหลัง `origin/main` 8 commit; ข้อค้นพบทั้งหมดตรวจซ้ำกับ `6043846e` หลัง pull แล้ว เลขบรรทัดในเอกสารเป็นของ baseline ใหม่
- ระหว่างรัน main suite แบบไม่กรอง `e2e/demo.spec.ts` ได้อัดวิดีโอทับ `apps/web/public/demo/*-demo.mp4` ที่ git track ไว้ 15 ไฟล์ การรันถูกหยุด ไฟล์ถูกคืนจาก HEAD ด้วย `git checkout` และลบ `apps/web/test-results` แล้ว working tree กลับเป็นสะอาดเหมือนก่อนตรวจ
- ไม่ได้แก้โค้ด, schema, seed หรือข้อมูลบน production; แตะเฉพาะ DB test ในเครื่องด้วย `db:push` (ผล: schema ตรงกันอยู่แล้ว)

## สถานะการแก้ — 27 พฤศจิกายน 2026

ส่วนนี้บันทึกรอบแก้ที่ตามหลังการตรวจ (landed บน branch `fix/audit-hardening-2026-11-27` เป็นชุด commit หลังตรวจเสร็จ) เขียนทับข้อความ "ไม่มีการแก้โค้ด" ข้างต้นซึ่งใช้กับรอบตรวจเท่านั้น

| ข้อ    | สิ่งที่ทำ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ไฟล์หลัก                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AUD-01 | `playwright.config.ts` เพิ่ม `testIgnore` สำหรับ `demo.spec.ts` และ `e2e/sim/`; สร้าง `playwright.demo.config.ts` สำหรับอัดวิดีโอแยก (`testIgnore` บล็อกทั้ง filter และ path ตรง จึงต้องมี config เฉพาะ); แยก `test-nightly.yml` เป็น 3 job (jest 20 นาที / e2e-main 60 / e2e-sim 150) พร้อม artifact ต่อ job; อัปเดตคำสั่งใน AGENTS.md, `.agents/rules/infrastructure.md`, `docs/qa/isolated-e2e.md` — ยืนยันแล้ว: default suite เหลือ 197 spec ไม่มี demo/sim, demo config เจอ 20 เทส                                                                                                                                                                           | `apps/web/playwright*.config.ts`, `.github/workflows/test-nightly.yml`                              |
| AUD-09 | แก้ TS2802 ด้วย `Array.from(new Set(...))` 2 จุด; เพิ่ม step `tsc --noEmit` (api + web) ใน `ci.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `apps/web/e2e/demo.spec.ts`, `.github/workflows/ci.yml`                                             |
| AUD-02 | `extractClientIp` ใหม่: default ใช้ `handshake.address` และ**ละเว้น** `x-forwarded-for` (client ปลอมได้); `TRUSTED_PROXY_HOPS=N` จึงจะเชื่อ header โดยนับ N hop จาก peer; เพิ่ม `pruneAdminBuckets` (soft cap 512 entries) กัน memory โต; spec 8 เคสผ่าน รวมเคส spoof + prune                                                                                                                                                                                                                                                                                                                                                                                     | `apps/api/src/games/ws-rate-limit.service.ts` + spec                                                |
| AUD-06 | สาขา `CARD_GAME` ของ `resetGame` เรียก `clearViewerFlagsOnLobby` ก่อนคืนค่า + เพิ่ม spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/api/src/games/games.service.ts` + spec                                                        |
| AUD-08 | กรณี `ROOM_EMPTIED` emit `ROOM_DELETED` ให้ผู้ชมที่ยังอยู่ใน socket.io room                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `apps/api/src/games/games.gateway.ts`                                                               |
| AUD-11 | `/health` ตอบ 503 เมื่อ DB ล่ม (200 เมื่อปกติ); smoke test ใน deploy script ยอมรับ 200 หรือ 503 ที่มี payload ของเรา (CI ไม่มี DB จริง); spec 3 เคสผ่าน                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `apps/api/src/health/health.controller.ts` + spec, `scripts/deploy-api-ftp.mjs`                     |
| AUD-10 | เพิ่ม cap ผู้เล่นต่อห้อง (`MAX_PLAYERS`, default 20, error `SERVER_ROOM_FULL`) ตรวจใน gateway แบบ synchronous ก่อน `joinRoom`, seated reconnect ผ่านเสมอ; เช็คชื่อซ้ำแบบ trim + case-insensitive; เพิ่ม i18n `th`/`en`; spec gateway 2 + service 1 เคส                                                                                                                                                                                                                                                                                                                                                                                                            | `games.gateway.ts`, `games.service.ts`, `apps/web/src/i18n/serverErrors.ts`                         |
| AUD-07 | `.env.example` เพิ่ม `RATE_LIMIT_*` 9 ตัว, `FTP_*` 5 ตัว, `LOG_TO_FILE`, `LOG_DIR`, `DISABLE_GAME_SETTINGS_DB`, `MAX_PLAYERS`, `TRUSTED_PROXY_HOPS`, `ALLOW_REMOTE_DATABASE_URL`; เอา `YOUTUBE_API_KEY` ออกจาก `.env` (ไม่มีโค้ดอ่าน)                                                                                                                                                                                                                                                                                                                                                                                                                             | `.env.example`, `.env` (local)                                                                      |
| AUD-03 | pnpm overrides บังคับ floors: `socket.io`/`socket.io-client` 4.8.4 ( NestJS pin 4.8.1 เอาไว้ตายตัว), `engine.io >=6.6.10`, `ws >=8.21.0`, `socket.io-parser >=4.2.7`, `proxy-addr >=2.0.8`; bump `@prisma/adapter-mariadb` ^7.10.1 + `mariadb` ^3.5.4; ปิด image optimizer (`images.unoptimized`) ระหว่างรอ upgrade Next — ผล runtime ยืนยันแล้ว: socket.io 4.8.4 / engine.io 6.6.13 / parser 4.2.7 / ws 8.23.0 / proxy-addr 2.0.8 / mariadb 3.5.5; `pnpm audit --prod`: **198 → 179 advisories (critical 4→3, high 77→64)**; ที่เหลือตรงๆ คือ `next` (ทั้งหมด) และ `body-parser`/`multer` DoS ที่ถูก Nest 10 pin (API ไม่มี endpoint upload; แก้จริงที่ Nest 12) | root `package.json`, `packages/database/package.json`, `apps/web/next.config.mjs`, `pnpm-lock.yaml` |
| AUD-04 | boot guard ใน `packages/database/src/index.ts` + `prisma.config.ts`: `DATABASE_URL` ที่ไม่ใช่ loopback นอก production จะ throw (ยกเว้น `ALLOW_REMOTE_DATABASE_URL=1`); สร้าง `kz_game_hub_dev` (push + seed แล้ว, GameSetting 22 เกม) และเปลี่ยน root `.env` ไปชี้ที่นั่น โดยเก็บ production DSN ไว้เป็น comment; อัปเดตคำอธิบายใน AGENTS.md; ทดสอบ guard 3 เคส (remote → throw, loopback → pass, opt-in → pass) — หมายเหตุ: seed ศิลปิน (`seed-e2e-artist.mjs`) ผูกกับ guard ของ E2E จึงเติมเฉพาะ DB test; dev ใช้ free search ได้ปกติ                                                                                                                           | `packages/database/**`, `.env` (local), `AGENTS.md`                                                 |

งานที่ยังไม่ทำในรอบนี้ (เปิด issue ใหม่ใน `.scratch/`): AUD-03 remainder = upgrade Next 14→16 (`.scratch/0011`), AUD-05 baseline migration (`.scratch/0012`), AUD-12 lint rules + gateway coverage (`.scratch/0013`), AUD-13 repo hygiene ที่ต้องได้ owner อนุมัติ (`.scratch/0014`) และ `.scratch/0001`–`0010` เดิมอัปเดตเป็น `done` พร้อมหลักฐานแล้ว

### ผล gate หลังแก้ (27 พ.ย.)

| Gate                                       | ผล                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                | ผ่าน                                                                                                                                                |
| `tsc --noEmit` (api + web)                 | ผ่านทั้งคู่ (AUD-09 ปิด error เดิม 2 จุด)                                                                                                           |
| `pnpm -F api test`                         | **48 suites, 1051/1051** (เพิ่มจาก 1045 ด้วยเทสใหม่: rate-limit 3, gateway cap 2, service duplicate-name 1, card-game reset 1)                      |
| `pnpm -F web build`                        | ผ่าน, First Load JS `/` = 199 kB (คงเดิม)                                                                                                           |
| graphify update                            | 4447 nodes / 9348 edges (runner ตัวเก่าที่ `/opt/homebrew/bin/graphify` ใช้ shebang python@3.14 ที่ถูกลบแล้ว ต้องเรียก `~/.local/bin/graphify` แทน) |
| E2E main suite (config ใหม่, ตัด demo/sim) | รัน 2 รอบ (5.9–6.1 นาที/รอบ): รอบแรก 156 ผ่าน/39 fail, รอบสอง (หลังแก้ env) 155 ผ่าน/40 fail — triage ท้ายส่วนนี้                                   |

### ผลและ triage ของ E2E main suite (27 พ.ย.)

การแก้ config (AUD-01) ทำให้ชุดหลักรันจบใน **~6 นาที** ต่อรอบ (เดิมไม่เคยจบภายใน 75 นาทีเพราะรวม demo + sim) สามข้อสงสัยแรกที่ต้องตรวจว่า "การแก้วันนี้ทำให้พังหรือไม่" ยืนยันแล้วว่า**ไม่ใช่**:

- `admin.spec.ts` — ล็อกด้วย env: spec อ่าน `ADMIN_SECRET` จาก process ของ Playwright ซึ่ง local ไม่มี (CI set job-level) **ผ่าน 2/2** หลังเพิ่ม dotenv โหลด root `.env` ใน playwright configs ทั้ง 4 ตัว
- `card-game-pok-deng.spec.ts` — flaky: fail ในชุดรอบแรก แต่**ผ่านเมื่อรันโดด** (1 passed) และผ่านในรอบสอง
- ทุก spec ที่ fail มีชื่อตรงกับชุดที่ fail บนโค้ดก่อนการแก้ทั้งหมดเมื่อวาน (`975c9aa2`)

ชุด fail ที่เหลือ (~37 ตัว/รอบ บางตัวสลับกันเป็น flaky) เป็น defect/spec-mismatch ที่**มีอยู่ก่อนการแก้** ตัวอย่าง signature ที่ยืนยันแล้ว:

| กลุ่ม                                                                                         | อาการ                                                            | ธรรมชาติ                                                                            |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| หน้าผลไม่ขึ้น (`dog-relay-result`, "Dealer scored", "You Win/Game Over", ปุ่ม "เล่นอีกครั้ง") | รอผลตอนจบเกมแล้วไม่ปรากฏ 10–20 วินาที                            | ตรงกับ sim suite ที่ fail เมื่อวานทั้งกลุ่ม — สงสัย result-reveal overlay + harness |
| `battleship.spec` (2 เคส)                                                                     | หา heading ไทย "ตั้งค่ายุทธการเรือรบ" ไม่เจอ                     | deterministic ทั้ง 2 รอบ + เมื่อวาน — i18n/heading ไม่ตรง                           |
| `thirty-one.spec` (catalog)                                                                   | strict mode violation: `getByText('Thirty-One')` match 2 element | selector กว้างเกิน (สลับ flaky)                                                     |
| `room-policy.spec`                                                                            | clipboard ได้ `?room=CODE&lang=en` แต่ spec คาด `?room=CODE`     | spec ไม่ตรงพฤติกรรม lang ใน URL                                                     |
| `music-trivia-experience` (11 เคส) + `music-reconnect`                                        | ~13 วินาที/เคส                                                   | deterministic ทั้ง 2 รอบ + เมื่อวาน                                                 |

งานแก้ต่อทั้งกลุ่มอยู่ใน `.scratch/0015-e2e-main-suite-deterministic-failures.md` (ยังไม่ได้ทำในรอบนี้)
