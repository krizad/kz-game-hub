---
name: verify-and-test-hub
description: >-
  Run lint, build, API Jest unit tests, and Playwright E2E / simulation tests safely in KZ Game Hub. Trigger when asked to "run tests", "verify build", "check lint", "run e2e", "รันเทส", "เช็คบิลด์", or before concluding any code change. Prevents accidental writes to remote production MySQL and handles monorepo build-order gotchas.
---

# Verify & Test — KZ Game Hub

## Safety Rule: Never Hit Production DB

Root `.env` `DATABASE_URL` points at a **remote production MySQL**.
- NEVER run `pnpm db:push`, `pnpm db:seed`, or `pnpm db:reset` without overriding `DATABASE_URL` to a local loopback test DB.
- E2E configs require `TEST_DATABASE_URL` (loopback host + database name containing `test`).

## 1. Fast Core Verification (Run After Every Code Change)

```bash
# Rebuild shared packages first if @repo/types or @repo/database changed
pnpm build --filter=@repo/types --filter=@repo/database

# Monorepo lint (all 5 workspaces)
pnpm lint

# API unit tests (Jest — 44+ suites, ~18s)
pnpm -F api test

# Single game / service test file
pnpm -F api test -- --testPathPatterns=ws-rate-limit

# Full production build (verifies TypeScript + Next.js bundle sizes)
pnpm build
```

## 2. Check Frontend Bundle Metrics

When working on frontend performance (`apps/web`), inspect the `next build` route table at the end of `pnpm build` (or `pnpm -F web build`):
- Track `Route /` `Size` and `First Load JS` before and after changes.
- Also run `pnpm -F web check:cipher-grid-pictures` whenever Cipher Grid images/manifests change.

## 3. Isolated Local E2E (Playwright)

Ensure local Docker MySQL (`kz-game-hub-db` on port `3307`) is running, then seed the test DB if fresh:

```bash
export TEST_DATABASE_URL="mysql://root:password@127.0.0.1:3307/kz_game_hub_test"

# One-time / after schema change: push & seed local test DB ONLY
DATABASE_URL="$TEST_DATABASE_URL" pnpm -F @repo/database db:push
DATABASE_URL="$TEST_DATABASE_URL" pnpm -F @repo/database db:seed
DATABASE_URL="$TEST_DATABASE_URL" pnpm -F api exec node scripts/seed-e2e-artist.mjs

# Main E2E suite (auto-starts API:3101 + Web:3100 with DISABLE_GAME_SETTINGS_DB=1)
pnpm -F web exec playwright test --reporter=list

# Single E2E spec
pnpm -F web exec playwright test apps/web/e2e/rules-modal.spec.ts --reporter=list

# Play-to-completion simulation suite
E2E_SIM_PLAYS=1 pnpm -F web exec playwright test -c playwright.sim.config.ts --reporter=list
```

Alternative one-shot helper: `node scripts/test-isolated.mjs --prepare --list` (see `docs/qa/isolated-e2e.md`).

## 4. Common Gotchas

- **Stale `@repo/types` errors**: Always run `pnpm build --filter=@repo/types` before blaming `api` or `web` TypeScript errors.
- **CI/remote install**: If `unrs-resolver` postinstall fails on fresh Linux CI, use `pnpm install --frozen-lockfile --ignore-scripts` and run `pnpm build --filter=@repo/database` explicitly so Prisma Client generates.
- **Never claim passing without fresh output**: Always run the verification commands after the final edit and cite actual pass counts / exit codes.
