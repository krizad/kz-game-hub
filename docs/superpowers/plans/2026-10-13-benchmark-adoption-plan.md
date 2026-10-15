# KZ Game Hub — แผนนำ benchmark มาปรับใช้หลัง urgent fixes

สถานะ: Proposed · 13 ตุลาคม 2026 · baseline `cb019bae` · [รายงานวิเคราะห์](../../research/2026-10-13-board-game-platform-benchmark.md)

เป้าหมาย: เพื่อนกลุ่มเดิมเลือกเกม เข้าห้อง เรียน action แรก เล่นบนมือถือ กู้ห้อง และเล่นรอบต่อไปได้สะดวก. เป็นส่วนต่อจากแผนรายเกมวันที่ 13 ไม่ทำ urgent fixes ซ้ำ และยังไม่ได้เปลี่ยน product code ตามแผนนี้.

ผู้ใช้ยืนยันแล้วว่าเน้น **เล่นกับเพื่อน / ห้องส่วนตัว**. ให้ room visibility/spectator policyเป็นcoreงานห้องเพื่อน ส่วนpublicmatching/ranked/การขยายสาธารณะเลื่อนไปภายหลัง. ใช้ [แผนรอพัฒนาฉบับปัจจุบัน](2026-10-13-development-backlog-index.md) เป็นลำดับimplementationล่าสุด.

## ข้อกำหนดร่วม

- React/Next DOM + existing services; server ตัดสิน state. ไม่ย้ายไป engine ใหม่เพื่อแก้ menu/board/card UX.
- Socket events/types→gateway→service→store ต้องตรงกันทั้ง 4 จุดเมื่อเปลี่ยน contract และ rebuild types.
- private roles/words/hands/votes ไม่เข้า public snapshot/log/metrics/tutorial ของคนอื่น.
- live rooms อยู่ memory; result persistence เป็นคนละส่วน. ไม่สัญญา room survival หลัง server restart.
- มี TH/EN และ keyboard/touch; modal ใช้ GameDialog ที่มีแล้ว; no-sound/reduced-motion ยังอ่านสารสำคัญได้.
- E2E ใช้ TEST_DATABASE_URL/local DB runner. ไม่ใช้ production .env/schema/seed/loadtests.
- ทุก task มี baseline/reproduction, targeted regression และ scoped review; source-derived risks ต้องพิสูจน์ก่อนเลือกรายละเอียด fix.

## Wave 1 — คำสั่งและทางกู้ที่เชื่อถือได้

### BA-1: correlated action receipts (P1, M/L)

**โยง:** B-01 / SH-4. **Files:** `packages/types/src/core.ts`, `apps/api/src/games/games.gateway.ts`, `games.service.ts`, `apps/web/src/store/useGameStore.ts`, `core/ActionLoadingOverlay.tsx` และคำแปล.

- [ ] จำลอง pending ของ A แล้ว B สร้าง broadcast; บันทึกว่า broadcast ไม่ใช่หลักฐานยอมรับคำสั่งของ A.
- [ ] กำหนด actionId/ack accepted/rejected/stateVersion และ timeout เป็น unknown; ไม่ถือ timeout เป็น reject และไม่ replay อัตโนมัติ.
- [ ] นำร่อง Classic/RPS ก่อนการ์ด/social; stale/duplicate handling ยึด phase/turn จาก server และ idempotency contract ที่ตกลง.
- [ ] pending ไม่ปลดจาก broadcast ที่ไม่เกี่ยวกับคำสั่ง; reject คง draft; unknown มี authorized read-only sync เมื่อจำเป็น. การ sync ไม่ join ซ้ำ/reset timer/rotate host.
- [ ] ทดสอบ duplicate, phase ที่ไม่ตรงกับปัจจุบัน, offline ก่อน emit, ack ที่มาช้า, broadcast ที่มาผิดลำดับ, reconnect และ private data permissions.

**ผ่านเมื่อ:** UI รู้ว่าคำสั่งเฉพาะนั้นมีผลแบบไหนและไม่ชวนส่งซ้ำเมื่อยังไม่แน่ใจ; no duplicate state mutation.

### BA-2: async start generation guards (P1 risk verification, M)

**โยง:** B-02 / SF-1 / WhoAmI plan. **Files:** `games.service.ts`, Sounds Fishy/WhoAmI services+specs.

- [ ] เขียน deferred DB/AI tests ก่อน: double-start, config เปลี่ยน, การเปลี่ยน host, ผู้เล่นออกจากห้อง, ห้องถูกลบ.
- [ ] เลือก lock/generation หลังเห็น failure จริง; snapshot ของ config/participants และตรวจ phase/host/generation หลัง await ก่อน private/การเขียน state.
- [ ] ห้ามผลเก่า overwrite เกมใหม่ และรักษา guard ที่ป้องกันห้องที่ถูกลบกลับเข้า Map อยู่แล้ว.
- [ ] ส่ง คลังเนื้อหาว่าง/provider ใช้งานไม่ได้/เริ่มเกมไม่ผ่านเงื่อนไข เป็น reason ต่างกันพร้อม retry; query ที่ซ้ำ/retry ไม่ทำผลซ้ำ.

**ผ่านเมื่อ:** รับเฉพาะ generation ที่ยังใช้ได้; start ล้มเหลวกลับสู่สถานะที่ host แก้ได้.

### BA-3: controls/dialog/language (P1, M)

**โยง:** B-03/B-05 / SH-3 / TT-2/DC-1/WhoAmI.

- [ ] WhoAmI lobby HOST_INPUT modal ใช้ GameDialog/dictionary; Set Words/description/placeholder/Cancel/Start แปลครบ.
- [ ] Validate required player IDs จาก roster ปัจจุบัน; reject/remap/guest ออกไม่ล้าง draft หรือรับ keys เก่าแทนคนใหม่.
- [ ] Gobbler inventory เป็น button พร้อม size/side/selected; Classic/Ultimate/Saboteur cells มี coordinate/state ชื่ออ่านได้.
- [ ] DC tap inspect/play แยกชัดและไม่ต้อง hover; ย้าย view/confirm dialogs พร้อม Tab/Escape/คืน focus. CardViewer มี Escape แล้ว ให้ตรวจ focus ที่ยังขาด.
- [ ] Keyboard-only flows และ 360/390/desktop TH/EN ผ่าน; focus ต้องไม่หลุด ใต้ modal; pending ส่งได้ครั้งเดียว.

**ผ่านเมื่อ:** คนใช้ touch/keyboard เลือกและยืนยัน action หลักได้เท่ากัน; ไม่มี ข้อความอังกฤษ ตกหล่นในไทย.

### BA-4: media readiness/recovery (P1, M)

**โยง:** B-04 / MT-2 / Banana plan. **Files:** MusicTriviaView/media hook, Banana sound hooks, dictionaries/tests.

- [ ] แยก local media state loading/ready/playing/blocked/error จาก game phase; phase PLAYING ของห้อง ไม่เท่ากับเครื่องนี้ได้ยินเสียง.
- [ ] การกด Ready ปลด autoplay จริง; retry/resume ใช้ song/server timestamp เดิม และแสดง reason โดยไม่เผย title.
- [ ] HTMLAudio/ReactPlayer failure, source adapter failure, volume/mute และคืนจาก background มี feedback ที่อ่านได้.
- [ ] Banana muted/blocked มี สัญญาณภาพ เฉพาะคนมีสิทธิ์; force-start บอกผลและคนยังไม่ ready ก่อนยืนยัน.
- [ ] จำลอง play rejection/404/timer หมดเวลา + iOS บนอุปกรณ์จริง/Safari gesture pass; คง Music reconnect/regression สิทธิ์คำตอบของ host เดิม.

**ผ่านเมื่อ:** ผู้เล่นรู้ว่าต้องเปิดเสียง/รอ/retry หรือเลือก provider และไม่ต้อง reset เกมทั้งห้อง.

## Wave 2 — เลือกง่าย เรียนรู้เร็ว เล่นบนมือถือ

### BA-5: catalog/lobby learning (P2, M)

**แรงอ้างอิง:** [Tabletopia guide](https://help.tabletopia.com/knowledge-base/beginners-guide/), [Codenames flow](https://www.codenamesgame.com/play-online), [BGA tutorials](https://jsrpg.boardgamearena.com/tutorialfaq).

- [ ] กรองทั้ง 14 เกม ตามจำนวนกลุ่ม/แนว/เสียง/การพิมพ์ ใช้ metadata เดียวกับ minimum/กติกาฝั่ง server; disabled games ยังอ่านเหตุผลได้.
- [ ] Lobby เชิญเพื่อนเป็น CTA หลัก, connected/จำนวนคนที่ ready, ค่าตั้งต้น และ เปิด Advanced เมื่อจำเป็น; ใช้ Copy/QR/InviteView เดิม.
- [ ] อธิบายก่อนรอบแรก 3 ส่วน: goal,หน้าที่,action แรก. ทดลอง practice scenario สำหรับ Classic/RPS ก่อน tutorial framework.
- [ ] เวลาเล่นมี sample/estimate label ก่อนเผยแพร่; guest token ไม่อยู่ URL.
- [ ] วัด invite→join→action แรก กับกลุ่มใหม่; อย่าเพิ่ม การบังคับสมัครบัญชี ใน flow นี้.

### BA-6: phase/role prompts + mobile play layout (P2, M/L)

**แรงอ้างอิง:** [BGA UX](https://en.doc.boardgamearena.com/images/5/57/Guidelines_UX_new_compressed.pdf), [Colonist mobile](https://blog.colonist.io/why-colonist-is-going-portrait-on-mobile/).

- [ ] ต่อยอด GameStatusHeader ด้วย phase/role prompt registry; actor/responders/waiting/viewer ได้รับข้อความต่างกันตามสิทธิ์.
- [ ] นำร่อง Coup/DC/Saboteur/Ultimate: phase สั้น→board/hand→action; role panel ที่เป็นข้อมูลรอง/score/players/history พับได้เมื่อเหมาะ.
- [ ] Action dock ใช้เฉพาะเมื่อไม่บังไพ่/board/คีย์บอร์ดบนหน้าจอ/safe area; ทั้ง portrait/landscape ใช้ได้.
- [ ] Saboteur zoom/pan/target mode และ Ultimate board preview ไม่พึ่ง hover; ตรวจชิ้นส่วนด้วย touch แสดงได้ด้วยปุ่มที่เห็นจริง.
- [ ] พื้นที่กด 44px สำหรับคำสั่งสำคัญ, controls ที่มีชื่ออ่านได้, หน้าไม่ล้นแนวนอน; 320/360/390px+zoom 200%+keyboard ทดสอบจริง.

**ผ่านเมื่อ:** ผู้เล่นบอก phase/หน้าที่และทำ action แรกได้จากหน้าเกม; viewport แรกของมือถือ ไม่หมดไปกับ panels ข้อมูลรอง.

## Wave 3 — ตัดสินใจและเล่นต่อกับกลุ่มเดิม

### BA-7: decision/settlement/recap (P2, M/L)

**แรงอ้างอิง:** [Colonist trade redesign](https://blog.colonist.io/improving-the-colonist-trade-system/), [Gartic reveal](https://garticphone.com/).

- [ ] Coup cost/target/claim/responder/deadline ชัด, exchange มี จำนวนที่เลือก/aria-pressed และรักษา selection เมื่อ reject.
- [ ] Poker แยก raise-to กับ ชิปที่ต้องเติมเพิ่ม, pot/contribution/eligibility/refund; ยืนยันการแจก pot ใน ledger/receipt/idempotency. ไม่แก้ กติกาเดิมพัน ที่ผ่านแล้วซ้ำ.
- [ ] Slave เลือกชุดตาม trick พร้อม เหตุผลที่กดไม่ได้, เรียงไพ่โดยคง stable IDs, preserve draft; ป๊อกเด้ง chips ก่อน→delta→หลัง/ตัวคูณ.
- [ ] Results เฉลย public เฉพาะเมื่อกติกาอนุญาต; อธิบาย เหตุผลที่ชนะ/คะแนนที่เปลี่ยน. ไม่ใส่ คำแนะนำกลยุทธ์ ที่เปลี่ยนทักษะ.
- [ ] Rematch ด้วย settings เดิม; ถ้าจะ change-game ในกลุ่มเดิม ต้องกำหนด score reset,host,session,private cleanup และ timer cancellation ก่อนสร้าง.

### BA-8: game-specific continuation checklist

ใช้แผนเดิมเป็นเจ้าของรายละเอียด ไม่สร้าง 14implementation ซ้อนกัน:

| เกม               | นำร่อง/งานเฉพาะถัดไป                                | Acceptance เพิ่ม                                            |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Who Know          | private card lifecycle + result reason              | blur/newround ต้องกด reveal ใหม่                            |
| Tic-Tac-Toe3modes | BA-3/6 + Classic practice                           | inventory→cell ด้วย keyboard; Ultimatepreview ด้วย tap      |
| RPS               | BA-1/5 + คิวคนที่พัก/sealed/reveal                  | emoji มีชื่อ; currentduel ต่างจาก คะแนนรวมแมตช์             |
| Sounds Fishy      | BA-2 + picker/fishprompts/ความล้มเหลวของคลังเนื้อหา | true/fakeentry/elim/bank หน้าที่ชัด                         |
| Detective Club    | BA-3/6 + votescoringrecap                           | inspect/play/confirm ไม่พึ่ง hover                          |
| Who Am I          | BA-2/3 + guess/ผลรับคำสั่งโหวต                      | reject แล้ว word/guess ไม่หาย                               |
| Who First         | display clock/networkcopy + accessibleGO            | clock±5s/muted ไม่ทำสัญญาณปลอม                              |
| Music Trivia      | BA-4 + providerreadiness                            | retryclip เดิมโดยไม่เผย answer                              |
| The Mind          | ready/Extremepiles/ข้ามได้ตามตัวเลือกreveal         | ไม่ hint ลำดับไพ่เพื่อน; reducedmotion อ่านผลได้            |
| Saboteur          | BA-3/6 + MAP/ROCKFALL/repairtargets                 | cells ที่มีชื่อพิกัด; peek ไม่ public; reject คง selection  |
| Coup              | BA-6/7 + responseclock/exchange                     | target/thirdparty สิทธิ์ถูกและ timer เดิม                   |
| Card Game         | BA-7 + Slavevalidity/Poksettlement                  | stableIDs/ผลรวมชิปคงเดิม                                    |
| Banana Thief      | BA-4 + role-safewake/forcestart                     | คนไม่ ready มีคำอธิบาย; muted เล่นต่อได้                    |
| Poker             | BA-7 + pot/ledgerclarity                            | all-ins ที่ยอดไม่เท่ากัน/split/odd chips+แจก pot ครั้งเดียว |

## Wave 4 — รองรับการเปิดสาธารณะและการเติบโต

### BA-9: room access/admission (P1 ก่อนเปิดกว้าง, M)

- [ ] ตัดสิน public/unlisted/invite-only แยกกัน; default สำหรับ groupfriends ตามความต้องการผู้ใช้.
- [ ] Serverenforcejoin/spectate/private channels; unlisted แค่ไม่อยู่ catalog ไม่ถือว่าปลอดการเข้าจาก code.
- [ ] จำกัด create/read/actionrate, room capacity ตามเกม, observer/จำนวนห้องทั้งหมด และ rejectcopy.
- [ ] Local burst test หลาย socket ไม่ทำ timer ห้องอื่นช้า; เดิม seatedplayerreconnect ได้แม้ admission เต็ม.

### BA-10: statistics/CI/capacity (P2 ตามหลักฐาน, M/L)

- [ ] สถิติ guest name มี label/per game/tie-aware; resultwrite มี idempotentkey/ bounded retry โดยไม่ บันทึก live play state.
- [ ] เสนอ critical PR checks กับทีม; broad sim ยัง nightly/manual. ไม่เปลี่ยน CIpolicy โดยอ้างว่า benchmark บังคับ.
- [ ] วัด production JS/LCP/INP/render frequency/state bytes/event loop lag/timer lateness ก่อน optimizeimports/animations.
- [ ] ระบุ capacity ของ API process เดียว/deploymentbehavior; ออกแบบ room ownership+affinity เมื่อหลาย instances จำเป็น. Socket Redis adapter อย่างเดียวไม่แชร์ state ใน Map.
- [ ] Public matching/moderation/accounts/full replay/voice chat เป็น scope แยก ใช้ หลักฐานจากผู้เล่นและ capacity ตัดสิน.

## Validation และการส่งงาน

- [ ] ทุก wave มี runtime ก่อน/หลัง,API tests ที่ตรวจพฤติกรรมจริง+browserregression,TH/EN/keyboard/mobile และ privacy review.
- [ ] Pilot2 กลุ่มใหม่ 3–5 คนกับคู่ 2 คน; วัด action แรก,การกดผิดตำแหน่ง,คำสั่งไม่ผ่านเงื่อนไข,recovery และ รอบที่สอง. ค่าเป้าหมาย 80%ทำ action แรกเองเป็นข้อเสนอจนกว่าจะวัดจริง.
- [ ] บันทึก source commit/URL วันที่ของ benchmark พร้อม unknowns; ไม่อ้าง Safari/live provider จาก Chromium mocks.
- [ ] อัปเดตแผนรายเกมและ graph หลังแก้ code; ส่ง small changesets ตาม owner โดยไม่ต้องรอครบ 14 เกม.

**Dependency:** BA-1/2 เป็นฐาน receipt/reliability; BA-3/4 ส่งแยกได้; BA-5/6 นำร่องหลัง controls ใช้ได้; BA-7 อิง receipt และ คำแนะนำตาม phase; BA-9 ก่อน publicgrowth; BA-10 ตามผลวัด. S/M/L เป็นขนาดความซับซ้อน ไม่ใช่เวลาที่รับปาก.
