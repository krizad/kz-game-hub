---
goal: 'Development backlog index for KZ Game Hub'
version: '1.1'
date_created: '2026-10-13'
last_updated: '2026-10-15'
owner: 'KZ Game Hub maintainers'
status: 'In Progress'
tags: ['planning', 'backlog']
---

# KZ Game Hub — แผนงานรอพัฒนาต่อ

ใช้ skill `create-implementation-plan` สร้างแผนตาม template: requirements, implementation phases, alternatives, dependencies, files, testing, risks และ references. Baseline `cb019bae` หลัง merge urgent fixes เข้า main. ตอนสร้างแผนไม่มีการแก้ product code; ตอนนี้เริ่มพัฒนาเฉพาะ tasks ที่ผู้ใช้อนุมัติ และอัปเดตผลตาม review/test จริง.

รวม **16 แผน / 54 tasks**: master 1, shared 1 และรายเกม 14. แผนหลักและ manifest อยู่ `plan/` ตาม skill และ docs/agents/issue-tracker.md; directory นี้ถูก Gitignore ตาม repo จึงเป็น local backlog. ไฟล์ index นี้กับรายงานใน docs เป็นส่วนที่เก็บใน Git ได้. ถ้าส่งให้เครื่องอื่นต้องแนบชุด `plan/` ด้วย.

เริ่มอ่าน [master roadmap](../../../plan/design-game-hub-improvement-1.md), [shared contracts](../../../plan/refactor-shared-gameplay-1.md) และ [machine-readable manifest](../../../plan/game-hub-development-manifest-1.json).

ผู้ใช้ยืนยันแล้วว่าเน้น **เล่นกับเพื่อน / ห้องส่วนตัว**. งานหลักคือเลือกเกม ชวนเพื่อน เข้าห้อง ตั้งค่ากลุ่ม เรียน action แรก และเล่นต่อกับกลุ่มเดิม. ห้องใหม่ตามแผนเป็น UNLISTED และปิด spectator จน host อนุญาต; เป็น room policy สำหรับกลุ่มเพื่อน ไม่ใช่ strict invite authentication.

## ลำดับความสำคัญ — ปรับล่าสุด 14 ตุลาคม 2026

เรียงจากตรงเป้าหมายห้องเพื่อน, คำสั่งที่ใช้ไม่ได้, ความต่อเนื่อง/ผลคำสั่ง, usability และการขยาย. ไม่มี P0 ที่ยืนยันใหม่จากการจัดคิวนี้; source-derived risk ยังต้องทดสอบก่อนสรุป.

| คิว        | Task                                        | งาน                                     | เหตุผล                                                                  |
| ---------- | ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| 1          | TASK-SH-006                                 | ห้อง UNLISTED + host ควบคุมผู้ชม        | ตรงเป้าหมายเล่นกับเพื่อน; ไม่ประกาศห้องใน public catalog โดยค่าเริ่มต้น |
| 2          | TASK-WA-001                                 | Who Am I modal/TH/roster                | ปัญหาภาษาและ Escape ที่พบจริง; เป็น changeset จำกัดขอบเขต               |
| 3          | TASK-TT-001                                 | Keyboard/named cells/Gobbler inventory  | แก้การเข้าถึงคำสั่งหลัก                                                 |
| 4          | TASK-DC-001                                 | DC inspect/play/dialog                  | Touch/keyboard ใช้การ์ดและดูภาพได้ชัด                                   |
| 5          | TASK-MT-001                                 | Music media state/error/retry UI        | ผู้เล่นที่ไม่ได้ยินเสียงรู้ว่าต้องแก้อย่างไร                            |
| 6          | TASK-SH-003                                 | Async start deferred regression/guard   | พิสูจน์ race ก่อนแก้; ป้องกันผลเก่าทับเงื่อนไขห้องใหม่                  |
| 7          | TASK-SH-002                                 | Classic/RPS receipt pilot               | ไม่สรุป accepted จาก unrelated broadcast และไม่ส่งซ้ำ                   |
| 8          | TASK-SH-001                                 | Phase/role prompts + clock display      | ผู้เล่นรู้หน้าที่และเวลาในรอบปัจจุบัน                                   |
| 9          | TASK-MT-002 และ WA-002/SF-001/SA-001/RP-002 | Recovery/draft/targets ตาม prerequisite | ใช้ฐาน shared ที่ทำแล้ว โดยไม่ขยาย receipt ทุกเกมทันที                  |
| 10         | TASK-SH-005                                 | Mobile play/action layout               | ให้ board/hand/action มาก่อนข้อมูลรอง                                   |
| 11         | TASK-SH-004                                 | Catalog/invite/first-round guide        | ลดขั้นตอนเลือกเกมและเริ่มรอบกับเพื่อน                                   |
| ต่อจากนั้น | Tasks รายเกมที่เหลือ                        | Decision/result/rematch/copy            | ปรับตามผล playtest และคง game-specific rules                            |
| ภายหลัง    | TASK-SH-007                                 | Public quotas/statistics/CI/capacity    | รอคำสั่งขยายห้องสาธารณะ; matchmaking/ranked อยู่นอก core                |

คิวนี้เป็นลำดับแนะนำ ไม่ใช่ dependency chain ทั้งหมด. เอา dependency ที่เกิดเพียงเพราะไฟล์ชนกันออกแล้ว; SH-004 ต้องรอ SH-006, SH-005 ต้องรอ SH-001 และ dependencies รายเกมยังคงอยู่ใน manifest. Shared store/gateway/types/dictionaries ต้องแก้ทีละ changesetเพื่อไม่ชนกัน.

Playtest เริ่มหลัง pilot controls/reliability ไม่ต้องรอปรับครบ14เกม. ตรวจ implementation และ regression แล้ว 51/54 tasks; เหลือ HUB-004 ที่รอผลทดสอบคนจริง และ HUB-005/SH-007 ที่ On Hold ตามโฟกัสห้องส่วนตัว. รายละเอียดผลทดสอบปัจจุบันและข้อจำกัดอยู่ใน [HUB delivery audit](../../qa/2026-10-15-hub-workflows.md). ดู Completed/Date และ completed_tasks ใน manifest.

ไม่ทำ urgent fixes ซ้ำ: Poker raise/short all-in, Join/Coup overflow, Slave scroll26, Rules dialog, local test DB และ Music preset/reconnect เสร็จแล้วตาม [delivery evidence](../../qa/2026-10-13-urgent-fixes.md).

## Plan index

| แผน                                       | ID    | ไฟล์                                                                                           | สถานะ       | Tasks |
| ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- | ----------- | ----- |
| ภาพรวม                                    | `HUB` | [design-game-hub-improvement-1.md](../../../plan/design-game-hub-improvement-1.md)             | In Progress | 5     |
| ระบบร่วม                                  | `SH`  | [refactor-shared-gameplay-1.md](../../../plan/refactor-shared-gameplay-1.md)                   | In Progress | 7     |
| Who Know / Knowguise                      | `WK`  | [feature-who-know-experience-1.md](../../../plan/feature-who-know-experience-1.md)             | Completed   | 3     |
| Tic-Tac-Toe: Classic / Gobbler / Ultimate | `TT`  | [feature-tic-tac-toe-experience-1.md](../../../plan/feature-tic-tac-toe-experience-1.md)       | Completed   | 3     |
| RPS / Hand Duel                           | `RP`  | [feature-rps-experience-1.md](../../../plan/feature-rps-experience-1.md)                       | Completed   | 3     |
| Sounds Fishy / GuiseGuess                 | `SF`  | [feature-sounds-fishy-experience-1.md](../../../plan/feature-sounds-fishy-experience-1.md)     | Completed   | 3     |
| Detective Club / Cluecanvas               | `DC`  | [feature-detective-club-experience-1.md](../../../plan/feature-detective-club-experience-1.md) | Completed   | 3     |
| Who Am I                                  | `WA`  | [feature-who-am-i-experience-1.md](../../../plan/feature-who-am-i-experience-1.md)             | Completed   | 3     |
| Who First                                 | `WF`  | [feature-who-first-experience-1.md](../../../plan/feature-who-first-experience-1.md)           | Completed   | 3     |
| Music Trivia                              | `MT`  | [feature-music-trivia-experience-1.md](../../../plan/feature-music-trivia-experience-1.md)     | Completed   | 3     |
| The Mind / Countaline                     | `TM`  | [feature-the-mind-experience-1.md](../../../plan/feature-the-mind-experience-1.md)             | Completed   | 3     |
| Saboteur                                  | `SA`  | [feature-saboteur-experience-1.md](../../../plan/feature-saboteur-experience-1.md)             | Completed   | 3     |
| Coup / บ้านทรายทอง                        | `CP`  | [feature-coup-experience-1.md](../../../plan/feature-coup-experience-1.md)                     | Completed   | 3     |
| Thai Card Game: ป๊อกเด้ง / Slave          | `CA`  | [feature-card-game-experience-1.md](../../../plan/feature-card-game-experience-1.md)           | Completed   | 3     |
| Banana Thief                              | `BT`  | [feature-banana-thief-experience-1.md](../../../plan/feature-banana-thief-experience-1.md)     | Completed   | 3     |
| Poker: Online / Chips Ledger              | `PK`  | [feature-poker-experience-1.md](../../../plan/feature-poker-experience-1.md)                   | Completed   | 3     |

## วิธีกลับมาพัฒนา

ระบุ Task ID แล้วอ่านแผนเจ้าของงานกับ prerequisites ใน manifest. แต่ละแผนมี exact file/function references, acceptance cases, test commands, privacy/timer/reconnect constraints และ completion fields. ทำ regression/implementation/review เป็น changeset แยก; update status/Completed/Date จากผลจริง. งานที่แก้ store/gateway/dictionaries เดียวกันให้ทำตามลำดับเพื่อไม่ชนกัน.

ไฟล์ใหม่ของ tests/hooks/services ที่เสนอไม่ได้มีใน product ปัจจุบัน; สร้างเฉพาะเมื่อเริ่ม task นั้น. Test runner ต้องใช้ TEST_DATABASE_URL แบบ local, ไม่รันจาก root production .env. แผนสถานะ Planned ไม่ใช่คำสั่งเริ่ม implementation หรือ automation.

[Benchmark report](../../research/2026-10-13-board-game-platform-benchmark.md) · [Adoption rationale](2026-10-13-benchmark-adoption-plan.md) · [REA/runtime evidence](../../qa/benchmark-2026-10-13/README.md)
