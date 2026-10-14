# Task 4 — DC001 implementation report

Commit: `62f10750 fix: make Detective Club cards usable by touch and keyboard`.

## Implemented

- Replaced the hand card's click overlay with separate native inspect and select-to-play buttons. Both are visible without hover and have distinct localized accessible names. Played cards are also native inspect buttons with a visible zoom cue.
- Moved the card viewer and play confirmation to `GameDialog`. Native modal behavior and the existing `GameDialog` focus handling provide Escape close, Tab containment, background inertness, body scroll lock, and focus restoration.
- Added Thai and English card action labels to the shared dictionary schema. Updated the legacy Detective Club E2E and simulation driver to use the new play button.
- Kept the hand cards at 128px wide so all five are visible at 1280px; mobile cards remain horizontally reachable.

## TDD evidence

- RED: `TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test node scripts/test-isolated.mjs detective-club-experience.spec.ts --workers=1 --reporter=line` before implementation. The 360×800 Thai test failed at `expect(inspect).toBeVisible()` because no `ดูการ์ด...1` native button existed. The 390×844 English test failed at the same assertion for `Inspect card 1`. The implementation was edited while the process was still finishing, so the later keyboard case in that run passed; only the first touch failure is used as the clean RED evidence.
- GREEN: The same command after implementation: `3 passed (28.9s)`.

## Verification

- Combined relevant E2E: `node scripts/test-isolated.mjs detective-club-experience.spec.ts detectiveclub.spec.ts --workers=1 --reporter=line` with both local database URL variables: `5 passed (44.8s)`. This includes the existing three-player play-through to scoring.
- Focused API: `pnpm -F api test -- --testPathPatterns=detective-club --runInBand` with both local database URL variables: 1 suite, 20 tests passed.
- After the one-class desktop width correction, the desktop keyboard case passed again (`1 passed (18.8s)`). The two touch cases were rerun to capture final screenshots: `2 passed (23.2s)`.
- `pnpm -F web exec tsc --noEmit`, focused `eslint`, scoped `prettier --check`, and `git diff --check` passed.
- Visually inspected pre-play controls using 360×800 Thai, 390×844 English, and 1280×900 English viewports. Inspect and play controls are visible without hover, buttons have 44px minimum height, and five desktop hand cards fit. Selected full-page screenshots are in `docs/qa/private-friends-2026-10-14/detective-club/` and remain unstaged for controller review. Their saved pixel dimensions are 360×1980, 390×1980, and 1280×1428 respectively; the larger heights result from `fullPage: true`.

## Files changed

- `apps/web/src/components/games/detective-club/phases/PlayingPhase.tsx`
- `apps/web/src/components/games/detective-club/CardViewerModal.tsx`
- `apps/web/src/i18n/dictionaries/{schema,th,en}.ts`
- `apps/web/e2e/detective-club-experience.spec.ts`
- `apps/web/e2e/detectiveclub.spec.ts`
- `apps/web/e2e/sim/play.ts`

## Self-review and concerns

The first desktop screenshot exposed clipping of the fifth hand card after the controls were added. I reduced only the hand card width and reran the covering keyboard viewport test. No backend, event, rule, privacy, or broader setup/scoring behavior changed. No remaining implementation concern identified.
