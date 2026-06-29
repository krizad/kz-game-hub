# KZ Game Hub

A real-time multiplayer online platform featuring a collection of classic and social deduction games.

**Live Demo:** [kz-game-hub.vercel.app](https://kz-game-hub.vercel.app/)
Built as a modern web application within a Turborepo.

## 🚀 Available Games

- **Who Know!:** A social deduction game based on the board game "Insider". Who knows the secret? Who's acting sus?
- **Gobbler Tic-Tac-Toe:** A strategic twist on the classic game where larger pieces can "gobble" smaller ones.
- **Classic Tic-Tac-Toe:** The traditional game of X's and O's.
- **Hand Duel:** A competitive Rock-Paper-Scissors game with multiple modes (1v1 Round Robin, All At Once) and Best-Of mechanics.
- **Sounds Fishy:** A trivia bluffing game — one player knows the real answer, others make up convincing fakes. Can you spot the truth?
- **Detective Club:** A social deduction card game — play cards to match a secret clue word, but one player is the spy who doesn't know it!
- **Who Am I:** A classic guessing game — players write words about a category, then try to deduce each other's identity. Can you be the last one standing?
- **Music Trivia:** A collaborative music guessing game — listen to YouTube music videos and guess the song and artist. See who's the ultimate music master!

## ✨ Core Features

- **Real-time Multiplayer:** Play live with your friends using WebSockets.
- **Flexible Room System:** One room, many games. Easily create lobbies, invite friends via code or QR, and switch games.
- **Responsive Design:** Playable on both desktop and mobile devices.
- **Multilingual:** Full Thai (default) and English support.
- **AI-Powered:** Who Am I can generate words using Google Gemini AI.

## 🛠 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Zustand, Framer Motion, Lucide React
- **Backend:** NestJS, Socket.io
- **Database:** Prisma ORM, PostgreSQL
- **AI:** Google Gemini (Who Am I word generation)
- **Media:** YouTube Data API (Music Trivia video integration)
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
└── docker-compose.yml # For setting up local dependencies (like DB)
```

## 💻 Getting Started Locally

### Prerequisites

- Node.js (>=20.19.0)
- pnpm (9.1.0)
- Docker (for the database)

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

3. Start the local database using Docker:

   ```bash
   docker compose up -d
   ```

4. Set up environment variables:
   - Copy `.env.example` to `.env` at the repo root. A single root `.env` feeds ALL apps — do NOT create per-app `.env` files.

5. Push the database schema and seed trivia questions:

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

6. Start the development server:

   ```bash
   pnpm dev
   ```

   - Web App will run on `http://localhost:3000`
   - API Server will run on `http://localhost:3001` (or whichever port configured)

## 🚢 Deployment (Recommended Free Stack)

### 1. Database (Supabase)

We recommend using [Supabase](https://supabase.com/) for the production database. It offers a generous free tier with a 500MB PostgreSQL database.
_Alternative: [Neon](https://neon.tech/) also offers a great "Serverless Postgres" free tier._

1. Create a new Supabase project.
2. Navigate to **Project Settings -> Database**.
3. Scroll down to **Connection String -> URI**.
4. Important: Ensure you are using the **Session** connection pooling (Port `5432`).
   - _Why?_ The backend application utilizes standard `pg.Pool` alongside Prisma's `pg-adapter` which effectively manages connection pooling on the server side. You do not need transaction pooling (pgbouncer) for this setup.
5. In your production environment variables, set `DATABASE_URL` to this Session connection string.

### 2. API Backend (Render)

Deploy the NestJS backend to a Node.js hosting provider such as [Render](https://render.com/), [Koyeb](https://www.koyeb.com/), or [Fly.io](https://fly.io/). Render offers a solid free tier with WebSocket support.

- Set `DATABASE_URL` to your Supabase Session string.
- **Turborepo specific:** Set the Build Command to `pnpm build --filter=api` and Root Directory appropriately.

### 3. Web Frontend (Vercel)

Connect the GitHub repository to **[Vercel](https://vercel.com/)** to deploy the Next.js application. Zero configuration required for Next.js inside Turborepo.

- Set `NEXT_PUBLIC_API_URL` to your deployed backend URL.
