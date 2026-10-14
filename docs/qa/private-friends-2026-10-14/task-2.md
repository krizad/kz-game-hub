# TASK-WA-001 — Who Am I host-input dialog

**Status:** DONE
**Pass commits:** `e73d739e fix: validate who am i host words and cover dialog flows`; `ce254797 test: capture who am i desktop dialog at 1280 by 900`

## Baseline already implemented

Commit `9acd4e9b` implemented the translated `GameDialog` host-word form, stable `player.id` draft keys, current `socketId` submission, connected non-viewer target filtering, draft cleanup after a player leaves, server rejection of stale/extra word keys, the initial API boundary tests, and two browser tests. This work was present before this verification pass. I did not rebuild or recommit those changes.

## Added in this pass

- Expanded `who-am-i-experience.spec.ts` to prove the enabled controls' Tab cycle, Escape focus restoration, English translations, and actual server transition to `ASKING` after reconnect and submission.
- Added a live-room browser case with an allowed viewer, a departing player and a replacement: the viewer requires no word, the departed draft disappears, the replacement input starts empty, and the game starts only after its new word is entered.
- Captured and inspected Thai and English dialog screenshots at 360×800, 390×844 and 1280×900 in `docs/qa/private-friends-2026-10-14/who-am-i/`. The dialog and actions fit the visible viewport at all six combinations; English placeholder text naturally truncates inside the 360-pixel input. Pixel dimensions were checked with `sips`. The first desktop capture used the browser's 1280×720 default; the second commit set 1280×900 explicitly and replaced both desktop images.
- Added malformed socket payload validation at the existing server boundary so null payloads and non-string words return `null` without throwing or changing the room.

## TDD evidence for new boundary defect

**RED:** `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test pnpm -F api test -- --runInBand --testPathPatterns=who-am-i --testNamePattern='malformed host word payloads'` failed as expected: `TypeError: Cannot convert undefined or null to object` at `Object.keys(playerWords)` in `startGameHostInput`; 1 failed, 79 skipped.

**GREEN:** After the minimal guard, the complete focused API suite passed: `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test pnpm -F api test -- --runInBand --testPathPatterns=who-am-i` — 80 passed, 0 failed.

The browser behaviors were already implemented in `9acd4e9b`; their added assertions passed on the first run, so no synthetic RED is claimed.

## Verification

- `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test node scripts/test-isolated.mjs who-am-i-experience.spec.ts --workers=1` — 3 passed, 0 failed before the capture-only desktop viewport correction. This isolated harness started API on 3101 and web on 3100.
- After the explicit desktop viewport correction, the single changed browser case was rerun with `--grep 'Thai modal has localized copy' --workers=1` through the same isolated harness — 1 passed, 0 failed.
- `pnpm -F web exec tsc --noEmit` and `pnpm -F api exec tsc --noEmit` — passed.
- Scoped web and API ESLint — passed.
- `pnpm exec prettier --check` on changed source/test files — rerun after formatting; passed.
- `git diff --check` — passed.

## Changed files in this pass

- `apps/api/src/games/who-am-i/who-am-i.service.ts`
- `apps/api/src/games/who-am-i/who-am-i.service.spec.ts`
- `apps/web/e2e/who-am-i-experience.spec.ts`
- Six screenshot PNGs under `docs/qa/private-friends-2026-10-14/who-am-i/`

## Self-review and concerns

The new API guard is restricted to `HOST_INPUT` word submission. Browser tests exercise the real socket flow and assert the resulting server room phase. The existing unrelated Tic Tac Toe source and dictionary edits in the shared worktree were untouched and are excluded from this task's commit. No remaining WA001 concern; controller will run the final full API suite and graph update for the serial five-task pass.
