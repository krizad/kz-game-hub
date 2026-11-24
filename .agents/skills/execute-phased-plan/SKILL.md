---
name: execute-phased-plan
description: >-
  Execute phased implementation plans from plan/ safely in local or remote agent sessions (e.g., Gemini Remote). Trigger when asked to "execute plan", "implement phase", "ทำตามแผน", "เริ่ม Phase", or continue work from plan/*.md. Enforces phase isolation, build order, ADR compliance, DB safety, and full verification gates.
---

# Execute Phased Plan — KZ Game Hub

Use this skill whenever executing a multi-phase plan in `plan/` (such as `plan/2026-11-24-project-hardening-and-optimization.md`).

## Pre-Flight Checklist (Always Do First)

1. Read `AGENTS.md`, the target `plan/<file>.md`, and every ADR referenced by the active phase (`docs/adr/NNNN-*.md`).
2. Check `git status` and current branch. Work one phase at a time on a dedicated branch (e.g. `feat/phase-1-security-ci` or per user instruction).
3. Confirm database safety:
   - Root `.env` `DATABASE_URL` points to **remote production MySQL**. NEVER run `pnpm db:push`, `db:reset`, or destructive commands against `.env` `DATABASE_URL`.
   - Always use `TEST_DATABASE_URL` pointing to a local disposable MySQL (`127.0.0.1:3307/kz_game_hub_test`) for DB tests or E2E.

## Execution Rules Per Phase

1. **Respect monorepo build order**:
   - After modifying `packages/types`, immediately run `pnpm build --filter=@repo/types`.
   - After modifying `packages/database`, immediately run `pnpm build --filter=@repo/database`.
2. **Keep diffs scoped to the active phase**:
   - Do not mix tasks from later phases into the current PR/commit.
   - If a task requires changing a Socket event, update all 4 locations (`packages/types/src/core.ts`, `apps/api/src/games/games.gateway.ts`, `apps/api/src/games/games.service.ts`, `apps/web/src/store/useGameStore.ts`).
3. **Update docs & i18n alongside code**:
   - Any new server error code MUST be mapped in `apps/web/src/i18n/serverErrors.ts` (`th` and `en`).
   - Any new UI string MUST be added to `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`.
   - Any new env variable MUST be documented in `.env.example`.

## Mandatory Verification Gate Before Claiming Phase Complete

Run every check that applies to the phase and confirm exit code 0:

```bash
pnpm build --filter=@repo/types --filter=@repo/database
pnpm lint
pnpm -F api test
pnpm build
```

If frontend views, routing, or assets changed, also run targeted Playwright E2E with local `TEST_DATABASE_URL`:

```bash
TEST_DATABASE_URL="mysql://root:password@127.0.0.1:3307/kz_game_hub_test" \
  pnpm -F web exec playwright test --reporter=list
```

## Finishing a Phase

1. If `graphify` CLI is installed in the environment, run `graphify update .` (skip silently if unavailable in remote sandbox).
2. Commit using Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `chore:`, `docs:`). Never bypass pre-commit / Mimosa security hooks without explicit owner approval.
3. Report exact verification results (command + pass/fail + metrics such as `next build` First Load JS) before moving to the next phase.
