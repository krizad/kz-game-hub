# Task 3 report — TT001 Tic-Tac-Toe keyboard controls

**Status:** DONE

## Implementation

Preserved and reviewed the six pre-existing, user-authored dirty files imported into this worktree. That patch already converted Gobbler's selectable inventory stacks to native `button type="button"` controls with `aria-pressed`, localized side and size names, and disabled state for non-owners/non-turn players. It also named Classic, Gobbler, and Ultimate cells with coordinates, occupancy, and disabled reasons in Thai and English. Ultimate labels identify both the outer board and the inner cell. Existing move handlers, mode identity, and backend contracts remain unchanged.

Added `apps/web/e2e/tic-tac-toe-experience.spec.ts`. It drives real rooms in all three modes, verifies Tab/Enter keyboard play and server-broadcast move state, checks that empty cells have unique accessible names, and confirms that non-turn players and spectators cannot act. The matrix covers 360×800 Thai Classic, 390×844 English Gobbler, and 1280×900 Thai Ultimate. Spectators are explicitly enabled in each room's lobby before joining, matching the new room policy.

Found and fixed one gap in the imported patch: during a pending move, a normally legal cell was disabled but its name omitted a reason. All three views now append a localized “please wait” reason while `actionLoading` is true. This only changes the accessible label; it retains existing action behavior.

## RED / GREEN evidence

The imported six-file patch already satisfied the original keyboard behavior when first tested: `node scripts/test-isolated.mjs tic-tac-toe-experience.spec.ts --workers=1` passed **3/3** with the explicit local test DB variables below. There is no invented pre-patch RED for that user-authored work.

For the newly discovered pending-action defect, added an assertion that sets the local pending flag, checks the otherwise legal cell is disabled, and requires a reason in its accessible name.

- **RED:** `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test node scripts/test-isolated.mjs tic-tac-toe-experience.spec.ts --grep CLASSIC --workers=1` → **1 failed**. Expected `/โปรดรอ/`; received `"แถว 1 คอลัมน์ 1: ว่าง"` on disabled `ttt-cell-0`.
- **GREEN:** `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test node scripts/test-isolated.mjs tic-tac-toe-experience.spec.ts tictactoe-modes.spec.ts --workers=1` → **4 passed**, including all three pending-action assertions and the existing mode-switch flow.

There were no selector/fixture failures in the executed browser tests. Before the first run I corrected the test expectation for Gobbler: the next player must select an inventory piece before an empty board cell becomes enabled. This follows existing game behavior and was not an implementation failure.

## Other validation

- `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test pnpm -F api test -- --runInBand --testPathPatterns='tic-tac-toe|gobbler|ultimate-tic-tac-toe'` → **4 suites, 58 tests passed**.
- `pnpm -F web exec tsc --noEmit --pretty false` → passed.
- Scoped ESLint on three views and the new E2E spec → passed.
- Scoped Prettier on seven changed files; `git diff --check` → passed.
- `graphify update .` run after source changes.

## Files and self-review

Committed scope: `TicTacToeView.tsx`, `GobblerView.tsx`, `UltimateTicTacToeView.tsx`, dictionary schema/Thai/English files, and the new E2E spec. The report is kept in the SDD working directory. Controller-owned QA/planning files and generated graph output are not staged.

Reviewed disabled-state precedence, Gobbler selection and piece-size rules, Ultimate board targeting, and spectator admission. No backend changes or new GameType. No remaining TT001 concerns.

## Review fix round 1 — equal-size Gobbler reason

Commit: `04a5a6ad fix: describe equal-size Gobbler placement restriction`.

Reviewer found that the English `disabledCannotGobble` text described only a smaller piece on a larger one, while Gobbler also disables equal-size placements. The Thai text already explicitly says larger **or equal** target size, so it needed no change. Changed the English message to “Choose a larger piece to cover this piece”; no game rule or pending-action behavior changed.

Extended the real browser Gobbler case after X places a Large piece at row 1, column 1. O selects a Large inventory piece, then the test verifies that the occupied cell remains disabled and its full accessible name explains the equal-size rule.

- **RED:** `DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test node scripts/test-isolated.mjs tic-tac-toe-experience.spec.ts --grep GOBBLER --workers=1` → **1 failed**. Expected `Row 1, Column 1: Large X (Choose a larger piece to cover this piece)`; received `Row 1, Column 1: Large X (Cannot place smaller piece on larger piece)`.
- **GREEN:** same command after the one-line dictionary change → **1 passed**.
- `pnpm -F web exec tsc --noEmit --pretty false` and `pnpm -F web exec eslint e2e/tic-tac-toe-experience.spec.ts src/i18n/dictionaries/en.ts` → both passed. Prettier reported both affected files unchanged; `git diff --check` passed.
- Captured a 390×844 English Gobbler screenshot at `docs/qa/private-friends-2026-10-14/tic-tac-toe/gobbler-equal-size-en-390x844.png` for controller inspection.
- `graphify update .` run after the change. No selector or fixture corrections were needed in this review round.
