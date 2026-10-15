# หลักฐาน runtime และ REA สำหรับ benchmark analysis

13 ตุลาคม 2026 · source `cb019bae` · ใช้ Game Studio game-playtest/game-ui-frontend และ REA passive CDP. [รายงาน](../../research/2026-10-13-board-game-platform-benchmark.md)

## สภาพแวดล้อมและข้อจำกัด

Chromium149 headless, Web3000/API3301 บนเครื่อง, test MySQL13306 tmpfs. ใช้ชื่อผู้เล่นจำลอง Alice/Bob/Carol และห้องชั่วคราว. DATABASE_URL กำหนดเป็น local ก่อน packages/schema/seed/startup; ไม่ใช้ productionDB. รูป role/hand เป็นของผู้เล่นจำลองใน capture ไม่ใช่ข้อมูลผู้ใช้จริง.

Playwright ควบคุมหน้าและสร้าง screenshots/geometry. REA อ่าน DOM/accessibility/metadata ภายใน origin ที่ระบุโดยไม่ evaluate/navigate/click. REA ทุก pagecapture เป็น`policy_filtered`และ`attach_limited`: ไม่เก็บ script sources/storage values/raw payloads/cookies/credentials และไม่เห็น network/console ก่อน attach. ไม่ใช่ coverage ของทุก action หรือการรับรอง private packet ทั้งระบบ.

## REA Evidence IDs

เก็บ bundle ฉบับเต็มที่ [rea-evidence.json](rea-evidence.json): 8 records, 466,659 bytes ณ export. คงรูปแบบ canonical จาก REA โดยไม่จัดรูปแบบไฟล์นี้ใหม่.

| Evidence                                                              | สิ่งที่ยืนยันได้                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ev_c63fe1a6ecd68765a4dd4144bc716f4b767f0892933d8c383509af450361f1a6` | initial browser target identity/origin/Chromiumversion                                   |
| `ev_07bdcc6fe1f29064501d840ce455fae3343fc55f7cb26d3241834d33e708e0b3` | HomeTH catalog14games มี accessiblelabels/จำนวนคน; ไม่มี filtercontrol ใน AX ที่ capture |
| `ev_4fee371ce314f24ccf87c865584d6b887df0e44a64176ee0c26916fbfd9f9979` | Coupactive AX และ genericturnprompt; no network ก่อน attachcapture                       |
| `ev_d078e9d84f473c4c35e36f91e5143aeae68e2dff015e39bdb5cc46f7e1275254` | WhoAmITH มี Cancel/StartGame อังกฤษ; host-input ไม่มี dialogrole ใน AX                   |
| `ev_bb16fdc68579f15fd791b4d184f6e835d44749e83390fc95f013de7caefddfbc` | Saboteurboardbuttons หลายช่อง name ว่างหรือ goal/start; handnames ยังเป็น action/pathIDs |
| `ev_05cad5db38d2c1c4cfa99d8b65ca2819db3a54a8f9a68e3a04132f37a6e9ef7b` | GobblerlobbyAX มี join/modebuttons; ไม่ถือว่าได้ทดสอบ activeinventory ด้วย keyboard แล้ว |

อีก 2 records เป็นรายการ browser targets ระหว่างสร้างหน้าทดสอบ. Endpoint ครั้งแรกยังไม่เปิดจึงตอบ provider_unavailable; หลังเปิด Chromium ของงานนี้ที่ loopback port 9223 จึงตรวจได้ ไม่ต้องติดตั้ง REA หรือ analysis engine เพิ่ม.

## ภาพ/geometry ที่ใช้

- [HomeTH360](home-th-360.png) / [HomeEN360](home-en-360.png): catalog สูง 2749/2764px ใน capture. มี metadata ดีแล้ว; filter เป็นข้อเสนอเพิ่มเพื่อช่วยกลุ่มเลือกเร็วขึ้น.
- [Coup360](coup-playing-360.png), [Coup390](coup-playing-390.png), [Coupdesktop](coup-playing-desktop.png): pageheight1525/1461/1152px ตาม viewport. ปุ่มไม่ล้นแนวนอนแล้ว; primaryincome บน 360 อยู่ต่ำกว่า viewport แรก.
- [DCsetup360](detective-initial-360.png): role/score/setup/hand/inputstack สูง 1420px. Cardstrip มีขอบตัดในภาพ; ยังไม่ได้ทดสอบว่าทุกใบเลือกไม่ได้ จึงรายงาน affordance/priority ไม่รายงาน functionaloverflowbug.
- [WhoAmITH จริง](who-am-i-actual-th-360.png) / [ผล Escape และ text](who-am-i-actual-th-360.json): กด Escape แล้ว modal ยังเปิด; UI รอบนอกไทยแต่ SetWords/body/Cancel/Start อังกฤษ. Modal อื่นเช่น Rules ผ่านงานด่วนแล้ว ห้ามสรุปว่า Rules เสีย.
- [Saboteur360](saboteur-playing-360.png): board9columns กับ handstrip แสดงได้; readability/zoom ต้องทดสอบเลือก target จริงบนเครื่องเพิ่ม. AXnames เป็นข้อพบที่ตรวจแล้ว.
- [Gobblerlobby360](gobbler-lobby-360.png): mode/sideentry. Activeinventorysemanticissue อิง source ไม่ใช่ทดลอง activeboard รอบนี้.

JSON คู่ภาพเก็บ viewport/pagegeometry/headings/buttonrects ของผู้เล่นจำลอง; ไม่ใช่ timing/performance benchmark. ขั้นตอนตรวจ WhoAmI ครั้งแรกอยู่ RANDOM ที่ยังไม่เลือก category จึง Startdisabled ตาม guard; เปลี่ยน HOST_INPUT แล้วเปิด modal ได้. การสลับ TH ขณะ modal เปิดถูก overlay บัง จึงปิด modal ก่อนสลับ TH และเปิดใหม่เพื่อ capture จริง. ไฟล์ attempt ที่ label ไม่ตรง state ย้ายไป ignoredtmp-script และไม่ใช้ในรายงาน.

## หน้าอ้างอิงที่เปิดจริง

- [BGA public landing](reference-bga.png) — [officialURL](https://en.boardgamearena.com/)
- [Colonist public landing](reference-colonist.png) — [officialURL](https://colonist.io/)
- [Codenames official online page](reference-codenames.png) — [officialURL](https://www.codenamesgame.com/play-online)

เป็น public landing/document shots ไม่ใช่ account/การรับรอง gameplay. ตัวนับ online ที่ติดในภาพเป็น snapshot จากเวลานั้น ไม่ใช้จัดอันดับหรือแทน annualstats.

## สถานะการทดสอบ

รอบนี้เป็นการตรวจและเก็บภาพพฤติกรรม ไม่ได้รัน Jest/E2E/simulation ทุกเกมจนจบซ้ำ. ผล API 653 tests, browser 26 tests และ simulation 12 tests เป็นการตรวจชุด urgent ก่อนหน้า ดูบันทึกเดิม. ยังไม่ได้ทดสอบ Safari/อุปกรณ์จริง, autoplay ของ providers จริง, async start races, load หรือ production performance.
