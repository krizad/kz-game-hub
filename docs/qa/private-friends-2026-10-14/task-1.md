# Task 1 — SH006 room visibility and spectator policy

Status: DONE

Commit: `47f4c9fe feat: add unlisted rooms and spectator policy`

## Implemented

- `RoomConfig` now has optional `visibility: PUBLIC | UNLISTED` and `allowSpectators`. New rooms default to `UNLISTED`/`false`; missing legacy fields resolve to `PUBLIC`/`true` at policy reads. The existing config sanitizer accepts only these enum and boolean values.
- Public-room catalog includes only public, enabled lobby rooms. A host policy update broadcasts a fresh catalog. Lobby code/link joins still work for unlisted rooms.
- The gateway rejects disabled `SPECTATE_JOIN` with structured `SPECTATORS_DISABLED`. A fresh `JOIN_ROOM` after play starts would become a viewer, so it has the same guard. Existing seated socket or valid reconnect-token joins remain allowed. Admission checks occur before leaving an existing room.
- The lobby shows native, localized visibility and spectator controls for every game. Guests see disabled controls. Rejected spectator attempts clear the optimistic spectator state and show a translated reason.
- Existing copy-link behavior was verified to share `/?room=<code>` without the reconnect token.

## Files changed

`packages/types/src/core.ts`; `apps/api/src/games/games.service.ts`, `games.gateway.ts` and their specs; `apps/web/src/store/useGameStore.ts`; `apps/web/src/components/lobby/GameSettingsManager.tsx`, `GameViewManager.tsx`; `apps/web/src/i18n/dictionaries/schema.ts`, `th.ts`, `en.ts`, `serverErrors.ts`; `apps/web/e2e/room-policy.spec.ts`.

## RED evidence

All API commands used `DATABASE_URL` and `TEST_DATABASE_URL` set to `mysql://test:test@127.0.0.1:13306/kz_game_hub_test`.

1. `pnpm -F api test -- --runInBand --testPathPatterns=games.service.spec.ts --testNamePattern='defaults new rooms|lists public rooms|lets only the lobby host'`: 3 expected failures. New config lacked both policy fields; unlisted rooms still appeared in catalog; host policy update did not persist fields.
2. `pnpm -F api test -- --runInBand --testPathPatterns=games.gateway.spec.ts --testNamePattern='rejects spectator entry'`: expected failure, `client.join` was called once despite `allowSpectators: false`.
3. `pnpm -F api test -- --runInBand --testPathPatterns=games.gateway.spec.ts --testNamePattern='rejects fresh late code joins'`: expected failure, gateway returned `Player name is already in use` after calling `joinRoom`, instead of rejecting the late viewer with `SPECTATORS_DISABLED`.

## GREEN evidence and checks

- Focused API: `games.service.spec.ts` **139/139 passed**; `games.gateway.spec.ts` **20/20 passed**. These include legacy missing fields, default policy, public filtering, unlisted code join, host/guest/non-lobby behavior, malformed values, disabled/enabled spectator entry, late code-join denial, and seated reconnect bypass.
- Full API: `pnpm -F api test -- --runInBand` **29 suites, 659/659 tests passed**.
- Isolated browser: `node scripts/test-isolated.mjs apps/web/e2e/room-policy.spec.ts apps/web/e2e/room.spec.ts apps/web/e2e/lobby-options.spec.ts apps/web/e2e/reconnect.spec.ts --workers=1` **21/21 passed**. All browser commands also used the local DB variables above. The policy spec checks catalog changes, code join, same-seat reload, spectator denied/enabled, and copied invite URL at **1280×900 EN**; it exercises controls at **360×800 TH** and **390×844 EN**. These are browser assertions; no passing-run visual inspection or screenshots were preserved.
- `pnpm -F api exec tsc --noEmit`, `pnpm -F web exec tsc --noEmit`, scoped API/web ESLint, scoped Prettier check, and `git diff --check`: passed.
- Existing test output includes the intentional mocked `db down` GameSettingsService log; Playwright dev startup includes existing `NO_COLOR`/`FORCE_COLOR` and Next dev-origin warnings. No new lint or type warnings.

## Self-review and limits

New policy does not add a generic JOIN_ROOM player cap. Existing per-game start and seat rules remain as they were; admission quotas are deferred to SH007. No strict invite identity check was added: knowing the code/link permits a lobby join. Graphify update is assigned to the controller's final five-task pass; generated graph artifacts are excluded from this commit.

## Review fix round 1

Fix commit: `3c586601 fix: align spectator admission with seat identity` (on `feature/private-friends-complete`, based on `9acd4e9b`).

The gateway previously counted any matching socket or valid token as a seated reconnect. `GamesService.joinRoom` restores a seat only when the token resolves to a player **and** the submitted name matches. A changed unique name could therefore pass the spectator gate and create a new late viewer. The gateway now uses the service's exact token-and-name check; the same normalized name is passed to `joinRoom`. A real-service gateway regression confirms that a changed-name token request receives `SPECTATORS_DISABLED` and adds no viewer. The existing disabled-game test now uses a valid reconnect token to represent an actual returning player.

The store previously called `clearRoomSession()` on any `SPECTATORS_DISABLED`, even when the rejected request was to spectate another room and the server retained the current seat. It now records the prior spectator flag for a pending spectator join and restores only that flag on denial. The room, player ID and reconnect token remain intact. A successful spectator room update clears the pending state.

### Fix RED

All commands again set `DATABASE_URL` and `TEST_DATABASE_URL` to `mysql://test:test@127.0.0.1:13306/kz_game_hub_test`.

- `pnpm -F api test -- --runInBand --testPathPatterns=games.service.spec.ts --testNamePattern='recognizes a seated reconnect only'`: **1 failed**; mismatched name returned `true` from `hasSeatedSession`.
- `pnpm -F api test -- --runInBand --testPathPatterns=games.gateway.spec.ts --testNamePattern='does not treat a different name'`: **1 failed**; same-socket changed-name request produced `Player name is already in use` after passing admission, instead of `SPECTATORS_DISABLED` before `joinRoom`.
- `node scripts/test-isolated.mjs apps/web/e2e/room-policy.spec.ts --grep 'a denied spectator request keeps' --workers=1`: **1 failed**; after denial, current room code became `undefined` instead of the original room code.

### Fix GREEN

- `pnpm -F api test -- --runInBand --testPathPatterns=games.service.spec.ts`: **141/141 passed**.
- `pnpm -F api test -- --runInBand --testPathPatterns=games.gateway.spec.ts`: **21/21 passed**.
- `node scripts/test-isolated.mjs apps/web/e2e/room-policy.spec.ts apps/web/e2e/reconnect.spec.ts --workers=1`: **7/7 passed**. This includes the denied room-B request while seated in room A, plus three existing reconnect flows.
- Scoped API/web ESLint, API/web `tsc --noEmit`, scoped Prettier and `git diff --check`: passed. Browser startup retains baseline environment and Next dev warnings; no new lint/type warnings.

Fix files: `apps/api/src/games/games.gateway.ts`, `games.gateway.spec.ts`, `games.service.ts`, `games.service.spec.ts`; `apps/web/src/store/useGameStore.ts`; `apps/web/e2e/room-policy.spec.ts`.
