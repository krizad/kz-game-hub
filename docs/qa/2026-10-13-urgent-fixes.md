# ผลแก้งานด่วน KZ Game Hub — 13 ตุลาคม 2026

> จัดระเบียบเอกสาร: นำไฟล์ภาพและหลักฐานประกอบเก่าออกแล้ว คงรายงานนี้ไว้เป็นประวัติผลตรวจ
> Baseline `c03c820c` · branch `fix/urgent-gameplay` · ใช้ managed worktree แยกจาก checkout เดิม

## งานที่แก้

| งาน                        | พฤติกรรมหลังแก้                                                                                                                                                                 | Commit     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| SH-1: ฐานทดสอบ             | ต้องระบุ TEST_DATABASE_URL ของ MySQL บนเครื่องและชื่อฐานสำหรับ tests; ไม่มี fallback ไป root .env; ไม่ reuse server ที่ไม่ทราบ env; Turbo ส่ง env override ถึง apps             | `ce1e3f75` |
| PK-1: Poker                | BB20 ให้ minimum raise40; ใช้ยอดเดิมพันก่อนหน้าในการคำนวณ increment; short all-in ไม่ลด full minimum หรือเปิดสิทธิ์ raise ของคนที่ acted ผิดกติกา; invalid BET ไม่เปลี่ยน state | `2a4dc486` |
| PK-2: Poker controls       | UI แยก full raise/short all-in, แสดงยอด call จริง, reset draft เมื่อมือ/turn เปลี่ยน, ปิดคำสั่งระหว่าง pending และแปล blind/action/phase                                        | `9fbfc6dc` |
| SH-2 / CA-1 / CP-1: มือถือ | ปุ่ม Join อยู่ในจอ, Slave เลื่อนมือไพ่ 26 ใบได้และเลือกด้วย id เดิม, Coup header และ select/action จัดเป็นแถวบนจอเล็ก                                                           | `9fbfc6dc` |
| MT-1: เริ่ม Music Trivia   | preset ที่ enabled และมีเพลงในระดับที่เลือกเริ่มได้เมื่อ query ว่าง; free search ที่ไม่มี query และ preset ระดับว่างมีเหตุผลกำกับปุ่ม                                           | `9fbfc6dc` |
| SH-3: Rules                | dialog จัด focus ภายใน, ปิดด้วย Escape และคืน focus ให้ปุ่มเปิด; close label แปลไทย/อังกฤษ                                                                                      | `9fbfc6dc` |
| SH-4: เชื่อมต่อกลับ        | แสดง connecting/reconnecting/failed พร้อม retry และ leave; รอ room snapshot ก่อนเปิดคำสั่ง; ไม่ emit game action เมื่อ socket offline; ล้าง private data ระหว่าง reconnect      | `9fbfc6dc` |

| Music reconnect | ส่ง playback รอบปัจจุบันพร้อม timestamp เดิมให้คนกลับเข้าห้อง/observer; คืนคำตอบเฉพาะ current host ใน GAME_MASTER ที่ไม่ได้เล่น; HTML5 audio seek ตามเวลาจาก server | `bbf92385` |
| หยุด test runner | ยกเลิกแล้วหยุด child process group เพื่อไม่ทิ้ง dev servers ค้าง | `e8b9027a` |

การแก้นี้เป็นชุดงานด่วนตาม roadmap (แผนเก่าเลิกใช้แล้ว) และแผนรายเกม ไม่ถือว่าปิดทุก checkbox ใน SH-2/SH-3/SH-4 หรือทุกงานของ CA/CP/MT/PK แล้ว. Correlated action acknowledgements, snapshot request ใหม่, dialog อื่น, sort/hints ของ Slave, iOS audio recovery และงาน P2/P3 ยังอยู่ในแผน.

## หลักฐานการตรวจ

- API Jest หลังแก้ Music reconnect: **653 tests / 29 suites ผ่าน**; Poker regression **29 tests ผ่าน**, ทดสอบทั้ง Online และ Ledger
- Node runner/DB guard regression **4 tests ผ่าน**, รวมตรวจ interruption แล้ว descendant หยุดจริง
- Browser regression **26 tests ผ่าน**: ชุด urgent fixes/Rules/i18n/Poker/card presets/ป๊อกเด้ง/reconnect/Coup ผ่าน 25 tests; Music reconnect แยกรันผ่านอีก 1 test
- Music browser test ตรวจ transport ทั้ง polling และ WebSocket: guest reload ระหว่าง PLAYING ได้ sync payload/timestamp เดิม, round เดิม, public snapshot ไม่มีชื่อเพลง และกด buzzer ต่อได้. ระหว่างพัฒนา harness แก้การเริ่ม observer ช้า, การพลาด polling payload และ locator ที่ไม่ได้รวม emoji; ผลผ่านข้างต้นมาจากรอบหลังแก้ครบ
- Simulated play-to-completion **12 tests ผ่าน**: aggressive Coup2, ป๊อกเด้ง2, ป๊อกเด้ง timer2, Slave2, Poker Online2, Poker Ledger2
- รอบก่อนหน้านั้น Classic2, RPS2 และ Coup basic2 ผ่าน ก่อนหยุดชุดกว้างเพราะ dev watcher reload จากการแก้ไฟล์ขณะ tests ยังเล่นอยู่; ไม่นับชุดที่หยุดเป็นผลผ่านทั้งชุด
- Web TypeScript และ lint ผ่าน; API TypeScript และ lint ผ่านหลังลบ dead locals ใน poker-engine ที่ทำให้ lint เดิมไม่ผ่าน
- เปิด `pnpm dev` ด้วย local DB และ PORT3301 ได้; health ยืนยัน API3301 และฐานทดสอบเชื่อมต่อได้; frontend เรียก API3301 จริงผ่าน browser sessions
- ตรวจภาพหลังแก้ด้วย Chromium ที่ 360×800: Home, Coup, Slave ใบสุดท้าย, Poker minimum40
- รัน `graphify update .` หลัง source และ tests เปลี่ยน; AST graph มี 3020 nodes / 5907 edges ใน worktree

ทดสอบใน MySQL container บนเครื่อง `127.0.0.1:13306/kz_game_hub_test`. ไม่ใช้ production .env สำหรับ startup, schema หรือ seed. Music preset fixture ใช้เพลงจำลองบน local DB จึงพิสูจน์ start/reconnect flow ได้ แต่ไม่รับรองเสียงจริงหรือความพร้อมของ provider ภายนอก. ยังไม่ได้รัน production build, GitHub workflow, Safari/อุปกรณ์จริง, screen reader หรือ sim ทุกเกม/ทุกโหมด.

Source review ทั้งชุดผ่าน; reviewer พบ Music playback recovery หายหลัง disconnect ระหว่างตรวจรอบแรก และตรวจยืนยัน fix เฉพาะนี้กับ runner interruption อีกครั้งแล้ว.

## วิธีรันซ้ำ

ดู [วิธีเตรียมฐานและใช้ runner](isolated-e2e.md). คำสั่งชุด regression:

```bash
node --test scripts/test-database.test.mjs scripts/test-isolated.test.mjs
DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' pnpm -F api test -- --runInBand
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' \
  node scripts/test-isolated.mjs music-reconnect.spec.ts urgent-fixes.spec.ts rules-modal.spec.ts i18n.spec.ts \
  poker.spec.ts card-game-presets.spec.ts card-game-pok-deng.spec.ts reconnect.spec.ts coup.spec.ts --workers=2
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' \
  E2E_SIM_PLAYS=2 E2E_SIM_GAMES='coup-3p-aggressive,card-pok-deng,card-slave,poker-' \
  node scripts/test-isolated.mjs -c playwright.sim.config.ts --workers=2
```

Runner ส่ง SIGINT/SIGTERM ไป process group ของ child ที่สร้างเอง เพื่อหยุด Playwright และ dev servers เมื่อยกเลิกการทดสอบ; regression ใช้ process fixture ตรวจว่า descendant ถูกหยุดจริง.
