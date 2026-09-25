# 0005. MySQL Datasource Switch

Status: Accepted
Date: 2026-09

## Context

The project started on PostgreSQL (local Docker in dev, Supabase-style managed Postgres recommended for production). The production deployment has since moved to a self-hosted **remote MySQL** database (`DATABASE_URL="mysql://..."` pointing at the production host). The Prisma schema, seed data, and all DB access in the API must match the provider the production database actually speaks, while docs and the old Postgres-era `migrations/` folder still reference PostgreSQL.

## Decision

- The Prisma datasource is **MySQL**, driven entirely by `DATABASE_URL`.
- `packages/database/scripts/sync-schema.ts` (wired into every `db:*` script and the package build) detects the provider from `DATABASE_URL` and rewrites `provider` in `schema.prisma` accordingly; `pnpm db:use:mysql` / `pnpm db:use:pg` switch it explicitly. The codebase stays runnable against either engine.
- `prisma db push` (not migration files) is the operational way the schema is applied to the production MySQL. The existing `migrations/` folder is a PostgreSQL-era legacy kept for history.
- The DB remains reference/persistent data only: Sounds Fishy questions, Who Am I words, leaderboard `GameResult` rows, and `GameSetting` enable flags. Live game state is still in-memory only (see AGENTS.md architecture constraints).

## Consequences

- `db:push` writes to whatever `DATABASE_URL` points at — against the production URL it mutates the live database, so it must be run deliberately.
- Docs (`AGENTS.md`, `.agents/rules/`, `.env.example`) describe MySQL; the root `docker-compose.yml` still defines an old Postgres container that is no longer the datasource and can be ignored or repurposed for a local MySQL.
- Anyone provisioning a new environment picks the engine by choosing the `DATABASE_URL` scheme, no code changes needed.
