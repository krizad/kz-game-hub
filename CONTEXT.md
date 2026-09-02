# CONTEXT.md — KZ Game Hub

Single-context glossary for the entire repo. Use these terms verbatim in issues, specs, and code.

## Glossary

| Term | Definition |
|------|------------|
| **Influence** | การ์ดบทบาท 1 ใบ ผู้เล่นมี 2 ใบตอนเริ่มเกม เสียครบ 2 = ตกรอบกลายเป็น Spectator |
| **Coin** | สกุลเงิน เริ่ม 2 coins ต่อคน — Income +1, Foreign Aid +2, Tax (Duke) +3, Coup จ่าย 7 (บังคับ Coup เมื่อ 10+ coins) |
| **Role** | บทบาท 5 แบบ: Duke / Assassin / Captain / Ambassador / Contessa — 3 ใบต่อ Role รวม 15 ใบ ชื่ออังกฤษคงเดิมในโค้ด คำอธิบายแปล th/en ตามบอร์ดเกมไทย (ดยุค/มือสังหาร/กัปตัน/ทูต/คุณหญิง) |
| **Deck** | กองกลาง 15 ใบ สับตอนเริ่มเกม แจก 2 ใบ/คน ที่เหลือคว่ำไว้ — ใช้สำหรับ Exchange (Ambassador) จั่ว 2 คืน 2 |
| **Dead Pile** | Influence ที่ถูกสังหารแล้วหงายโชว์สาธารณะบน board |
| **Challenge** | ท้าว่า bluff — window 7 วินาที (RoomTimerService) ผู้แพ้เสีย Influence 1 ใบ (เลือกใบเอง) — ถ้าผู้ถูกท้ามีการ์ดจริง: ผู้ท้าเสีย 1 ใบ + ผู้ถูกท้านำใบที่เปิดคืนกอง สับ แล้วจั่วใหม่ |
| **Block** | ใช้ Role ขัดขวาง action (Counteraction) — window 7 วินาที แยกจาก Challenge, Challenge มี priority สูงกว่า Block เสมอ |
| **Coup** | Action จ่าย 7 coins สังหาร Influence 1 ใบของเป้าหมาย — block/challenge ไม่ได้, บังคับทำเมื่อมี 10+ coins |
| **Spectator** | ผู้เล่นที่ Influence เหลือ 0 ตกรอบแล้ว ดู board ต่อได้ ไม่มีเทิร์น |
| **Declare** | ประกาศ action ที่ต้อง claim Role ก่อนเข้า Challenge/Block window |
| **Summary Card** | ตารางสรุปความสามารถ 5 Roles + General Actions ดูได้ตลอดเวลาผ่านปุ่ม ?/ดูความสามารถ (modal) — ไม่จำกัดเทิร์น แม้เป็น Spectator |

## Game-Specific Notes — Coup (Classic)

- **Player count:** 2–6 คน, min 3 คนถึงเริ่มเกมได้ — วนเทิร์นตาม `room.players` ข้าม Spectator, เทิร์นแรก = host
- **Actions (7 แบบ):** Income (+1, ไม่ claim), Foreign Aid (+2, block ได้ด้วย Duke), Coup (จ่าย 7, ไม่ claim), Tax (Duke +3), Assassinate (Assassin จ่าย 3 สังหาร 1, block ได้ด้วย Contessa), Steal (Captain ขโมย 2, block ได้ด้วย Captain/Ambassador), Exchange (Ambassador จั่ว 2 คืน 2)
- **Flow:** Declare → Challenge window 7s (priority สูงสุด) → (ถ้ามี challenge: reveal → ผู้แพ้เสีย Influence + ถ้าผู้ถูกท้ามีจริงให้สับคืนกองจั่วใหม่) → Block window 7s (ถ้ามี) → Resolve — ทั้งหมด server-authoritative, private hand ส่งแยกผ่าน `PrivateStateService` + `server.to(socketId).emit`
- **Reconnection:** private hand ผูกกับ `userId` ไม่ใช่ `socketId` — `GamesService.joinRoom` ต้อง remap ทุก field
- **Help UI:** ปุ่ม Summary Card ( ? ) เปิด modal ตาราง 5 Roles + General Actions ได้ตลอดเวลา — component `CoupHelpModal.tsx` แยกจาก `CoupRules.tsx`

## References

- ADR: `docs/adr/0001-coup-classic-rules.md`
