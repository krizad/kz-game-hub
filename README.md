# KZ Game Hub

A real-time multiplayer online platform featuring a collection of classic and social deduction games.

**Live Demo:** [who-know-web.vercel.app](https://who-know-web.vercel.app/)
Built as a modern web application within a Turborepo.

## 🚀 Available Games

- **Who Know!:** A social deduction game based on the board game "Insider". Who knows the secret? Who's acting sus?
- **Gobbler Tic-Tac-Toe:** A strategic twist on the classic game where larger pieces can "gobble" smaller ones.
- **Classic Tic-Tac-Toe:** The traditional game of X's and O's.
- **Hand Duel:** A competitive Rock-Paper-Scissors game with multiple modes (1v1 Round Robin, All At Once) and Best-Of mechanics.
- **Sounds Fishy:** A trivia bluffing game — one player knows the real answer, others make up convincing fakes. Can you spot the truth?
- **Detective Club:** A social deduction card game — play cards to match a secret clue word, but one player is the spy who doesn't know it!

## ✨ Core Features

- **Real-time Multiplayer:** Play live with your friends using WebSockets.
- **Flexible Room System:** One room, many games. Easily create lobbies, invite friends via code or QR, and switch games.
- **Responsive Design:** Playable on both desktop and mobile devices.

## 🛠 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Zustand, Shadcn/UI
- **Backend:** NestJS, Socket.io
- **Database:** Prisma ORM, PostgreSQL
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
- Node.js (v18+)
- pnpm (v9+)
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
   - Create `.env` files in `apps/web` and `apps/api` (use `.env.example` if available).
   - Ensure the `DATABASE_URL` in `packages/database/.env` points to your local Docker PostgreSQL instance.

5. Push the database schema:
   ```bash
   pnpm db:push
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
*Alternative: [Neon](https://neon.tech/) also offers a great "Serverless Postgres" free tier.*

1. Create a new Supabase project.
2. Navigate to **Project Settings -> Database**.
3. Scroll down to **Connection String -> URI**.
4. Important: Ensure you are using the **Session** connection pooling (Port `5432`). 
   - *Why?* The backend application utilizes standard `pg.Pool` alongside Prisma's `pg-adapter` which effectively manages connection pooling on the server side. You do not need transaction pooling (pgbouncer) for this setup.
5. In your production environment variables (e.g., Render, Railway), set the `DATABASE_URL` to this Session connection string.

### 2. API Backend (Render)
Deploy the NestJS backend to a Node.js hosting provider such as [Render](https://render.com/), [Koyeb](https://www.koyeb.com/), or [Fly.io](https://fly.io/). Render offers a solid free tier with WebSocket support.
- Ensure the `DATABASE_URL` is set to your Supabase Session string.
- Set the `CORS_ORIGIN` to your deployed frontend URL.
- **Turborepo specific:** Make sure to set the Build Command to `pnpm build --filter=api` (or similar depending on platform) and the Root Directory appropriately if needed.

### 3. Web Frontend (Vercel)
Connect the GitHub repository to **[Vercel](https://vercel.com/)** (for `apps/web`) to deploy the Next.js application. Their free Hobby tier requires zero configuration for Next.js inside Turborepo.
- Set the `NEXT_PUBLIC_API_URL` to your deployed backend URL. This ensures the WebSocket connections are properly routed to the live API.
