# KZ Game Hub

A real-time multiplayer online platform featuring a collection of classic and social deduction games.

**Live Demo:** [kz-game-hub.vercel.app](https://kz-game-hub.vercel.app/)
Built as a modern web application within a Turborepo.

## 🚀 Available Games

- **Who Know!:** A social deduction game based on the board game "Insider". Who knows the secret? Who's acting sus?
- **Tic-Tac-Toe:** One game, three modes the host picks in the waiting room — **Classic** (X's and O's, also vs a bot), **Gobbler** (bigger pieces gobble smaller ones), and **Ultimate** (a 3x3 grid of sub-boards).
- **Hand Duel:** A competitive Rock-Paper-Scissors game with multiple modes (1v1 Round Robin, All At Once) and Best-Of mechanics.
- **Sounds Fishy:** A trivia bluffing game — one player knows the real answer, others make up convincing fakes. Can you spot the truth?
- **Detective Club:** A social deduction card game — play cards to match a secret clue word, but one player is the spy who doesn't know it!
- **Who Am I:** A classic guessing game — players write words about a category, then try to deduce each other's identity. Can you be the last one standing?
- **Who First:** A fast-paced reaction and reflex buzzer game — test who reacts fastest when the signal changes!
- **Music Trivia:** A music guessing game — listen to synchronized song previews from iTunes, Spotify, YouTube, Deezer, or SoundCloud and guess the title and artist (typing or game-master mode).
- **The Mind:** A cooperative game where players must play numbered cards in ascending order without communicating!
- **Saboteur:** A social deduction game where gold miners dig tunnels towards hidden treasures while saboteurs try to secretly derail them.
- **Coup:** A high-stakes game of deception, bluffing, and manipulation — eliminate all rival influences to take control.
- **Thai Card Game (เกมไพ่ไทย):** Classic Thai card games with virtual chips — **Pok Deng** (ป๊อกเด้ง) and **Slave** (ไพ่ตกน้ำ), with host-editable advanced rules.

## ✨ Core Features

- **Real-time Multiplayer:** Play live with your friends using WebSockets.
- **Flexible Room System:** One room, many games. Easily create lobbies, invite friends via code or QR, and switch games.
- **Responsive Design:** Playable on both desktop and mobile devices.
- **Multilingual:** Full Thai (default) and English support.
- **AI-Powered:** Who Am I can generate words using Google Gemini AI.
- **Reconnection-safe:** Drop your connection and quietly reclaim your seat — server remaps every game's state to your new socket.
- **Admin Controls:** Per-game enable/disable panel in the lobby, gated by `ADMIN_SECRET`.
- **Leaderboard:** Finished matches are recorded server-side and aggregated per player.

## 🛠 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Zustand, Framer Motion, Lucide React
- **Backend:** NestJS, Socket.io
- **Database:** Prisma ORM, MySQL (remote production DB; provider auto-detected from `DATABASE_URL`)
- **AI:** Google Gemini (Who Am I word generation)
- **Media:** Music preview adapters for iTunes (default), Spotify, YouTube (via `youtubei.js`), Deezer, and SoundCloud
- **Monorepo:** Turborepo, pnpm

## 📦 Project Structure

```text
kz-game-hub/
├── apps/
│   ├── web/       # Next.js frontend application (Player screen & Lobby)
│   └── api/       # NestJS backend/websocket server (Game logic & Rooms)
├── packages/
│   ├── database/  # Prisma schema and generated client
│   ├── config/    # Shared configuration (ESLint, TS, etc.)
│   └── types/     # Shared TypeScript types & Game Constants
└── .agents/       # AI Agent skills, rules, and documentation
```

## 🤖 Developing with AI Agents

This repository is optimized for development alongside AI Coding Assistants (e.g., Antigravity, GitHub Copilot). It contains an `.agents/` directory that instructs AI tools on project conventions, architecture, and deployment constraints.

### Adding a New Game

If you are using Antigravity IDE or a similar agent framework, you can simply ask:

> "สร้างเกมใหม่ชื่อ [ชื่อเกม]" (Create a new game called [Game Name])

The agent will automatically load the `create-new-game` skill, scaffolding the types, backend logic, frontend UI, and Zustand store correctly according to the strict privacy guidelines and server-authoritative architecture of KZ Game Hub.

## 💻 Getting Started Locally

### Prerequisites

- Node.js (>=20.19.0)
- pnpm (9.1.0)
- A MySQL database (remote or local — the Prisma datasource provider is auto-detected from `DATABASE_URL`)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/krizad/kz-game-hub.git
   cd kz-game-hub
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` at the repo root. A single root `.env` feeds ALL apps — do NOT create per-app `.env` files.
   - Point `DATABASE_URL` at your MySQL instance, e.g. `mysql://user:password@localhost:3306/kz_game_hub`.
   - To run Prisma against PostgreSQL instead, switch the provider with `pnpm db:use:pg` (or `pnpm db:use:mysql` to switch back).

4. Push the database schema and seed trivia questions:

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

   > ⚠️ `db:push` writes to **whatever `DATABASE_URL` points at** — double-check it before running against a shared/production database.

5. Start the development server:

   ```bash
   pnpm dev
   ```

   - Web App will run on `http://localhost:3000`
   - API Server will run on `http://localhost:3001` (or whichever port configured)

## 🚢 Deployment

### 1. Database (MySQL)

Production runs against a MySQL database. Any managed or self-hosted MySQL works (e.g. your own server, PlanetScale, Railway, Aiven):

1. Create the database and a user.
2. Set `DATABASE_URL` to `mysql://user:password@host:3306/dbname` in the API's production environment.
3. Apply the schema once (`pnpm db:push`) and seed reference data (`pnpm db:seed`).

### 2. API Backend (Node host with WebSocket support)

Deploy the NestJS backend to any provider that keeps WebSocket connections open (Render, Koyeb, Fly.io, or your own server — this repo ships `pnpm deploy:ftp` for FTP-based deployments):

- Set `DATABASE_URL`, `CORS_ORIGIN` (allowed browser origins), and optionally `ADMIN_SECRET`, `GEMINI_API_KEY`, `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`.
- **Turborepo specific:** Set the Build Command to `pnpm build --filter=api` and Root Directory appropriately.

### 3. Web Frontend (Vercel)

Connect the GitHub repository to **[Vercel](https://vercel.com/)** to deploy the Next.js application. Zero configuration required for Next.js inside Turborepo.

- Set `NEXT_PUBLIC_API_URL` to your deployed backend URL.
