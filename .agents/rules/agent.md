# 🤖 Agent Instructions — KZ Game Hub

## Identity

คุณคือ AI Coding Assistant ที่ช่วยพัฒนาและดูแลโปรเจกต์ **KZ Game Hub** — แพลตฟอร์มเกมออนไลน์ Multiplayer แบบ Real-time ที่รวมเกมไว้หลายประเภท

## Project Overview

- **ชื่อโปรเจกต์:** KZ Game Hub
- **คำอธิบาย:** เว็บแอป Real-time Multiplayer Game Hub — สร้างห้อง เชิญเพื่อน แล้วเลือกเกมเล่นด้วยกัน
- **Live Demo:** [kz-game-hub.vercel.app](https://kz-game-hub.vercel.app/)
- **Repository:** Turborepo Monorepo
- **AI Features:** Google Gemini สำหรับสร้างคำใน Who Am I (`GEMINI_API_KEY`)
- **Media Integration:** YouTube Data API สำหรับดึงวิดีโอเพลงใน Music Trivia

## Available Games

| Game                    | Type              | Min Players | Description                |
| ----------------------- | ----------------- | ----------- | -------------------------- |
| **Who Know!**           | Social Deduction  | 4           | ทายคำลับ ตามหา Insider     |
| **Classic Tic-Tac-Toe** | Strategy          | 2           | เกม XO คลาสสิก             |
| **Gobbler Tic-Tac-Toe** | Strategy          | 2           | XO ที่ตัวใหญ่ทับตัวเล็กได้ |
| **Hand Duel (RPS)**     | Competitive       | 2+          | เป่ายิ้งฉุบ Best-Of        |
| **Sounds Fishy**        | Trivia / Bluffing | 3+          | ตอบคำถาม แยกคำตอบจริง/ปลอม |
| **Detective Club**      | Social Deduction  | 4+          | วางการ์ดตามคำใบ้ ล่าสายลับ |
| **Who Am I**            | Word Guessing     | 3+          | ทายเอกลักษณ์ผู้เล่นจากคำ   |
| **Music Trivia**        | Music Guessing    | 2+          | ฟังเพลงทายชื่อเพลง/ศิลปิน  |

## Behavior Guidelines

1. **ใช้ภาษาไทยเป็นหลัก** ในการสื่อสารกับผู้ใช้ ยกเว้นชื่อเทคนิค, ชื่อไฟล์, และ code ให้ใช้ภาษาอังกฤษ
2. **อ่านไฟล์ `.agents/rules/` ทุกครั้ง** ก่อนเริ่มทำงาน เพื่อให้เข้าใจ context ล่าสุดของโปรเจกต์
3. **ห้ามแก้ไขไฟล์ที่ไม่เกี่ยวข้อง** — ถ้า request ของ user เกี่ยวกับเกมใดเกมหนึ่ง ให้แก้เฉพาะไฟล์ที่เกี่ยวข้อง
4. **รักษา Type Safety** — ทุกการเปลี่ยนแปลงต้อง update `packages/types` ให้สอดคล้องกัน
5. **Socket Events ต้อง sync** — เมื่อเพิ่ม/แก้ event ต้อง update ทั้ง `SOCKET_EVENTS` constant, Gateway, Service, และ Zustand Store
6. **ทดสอบด้วย `pnpm dev`** ก่อนบอกว่าเสร็จ เพื่อให้แน่ใจว่า build ผ่านทั้ง api และ web
7. **สร้างเกมใหม่** — หากผู้ใช้ต้องการให้สร้างเกมใหม่ ให้เรียกใช้ Skill `create-new-game` เสมอ เพื่อรับทราบขั้นตอนและ Architecture constraints อย่างถูกต้อง

## Key File References

| Purpose            | Path                                     |
| ------------------ | ---------------------------------------- |
| Agent Instructions | `.agents/rules/agent.md` (this file)     |
| Architecture       | `.agents/rules/architecture.md`          |
| Infrastructure     | `.agents/rules/infrastructure.md`        |
| Coding Rules       | `.agents/rules/rules.md`                 |
| Shared Types       | `packages/types/src/`                    |
| API Gateway        | `apps/api/src/games/games.gateway.ts`    |
| API Service        | `apps/api/src/games/games.service.ts`    |
| Web Store          | `apps/web/src/store/useGameStore.ts`     |
| Game Components    | `apps/web/src/components/games/`         |
| Prisma Schema      | `packages/database/prisma/schema.prisma` |
