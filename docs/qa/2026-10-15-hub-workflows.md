# TASK-HUB-001..005 delivery audit

Date: 2026-10-15
Branch: `feature/hub-workflow-verification`
Baseline: `05cda1d6` (clean working tree at start)

Product commits: `8213e105` (Knowguise privacy), `badd756d` (Cluecanvas controls and rejection recovery).

The master workflow and local manifest lagged behind committed implementation. The audit found all first-delivery and reliability tasks already implemented. Commit `04994585` contains SF-002/003, DC-002/003, BT-001..003, PK-001..003 and CA-001..003; `05cda1d6` contains SA-001..003. These commits are implementation evidence, not a substitute for current verification.

## Changes in this delivery

- Knowguise: only connected seated participants receive private roles at round start; erase stale roles for viewers and disconnected seats. Browser coverage checks the observer remains without a role or secret after word submission.
- Cluecanvas: fold role/score below gameplay; place the hand ahead of the played-card table and give the setup input priority; make setup cards keyboard reachable; guard Enter while submitting a word.
- Preserve card confirmation on server rejection. Reconcile selection only when the authoritative hand, phase or active player changes. All hooks run before the optional-state return.
- Show the public word and informer in scoring, alongside the existing revealed votes and score explanations.
- Add browser proof for rejected-card preservation and accepted-card reconciliation, revealed-word display, guest next-round permissions and duplicate host next-round input.
- Repair Music Trivia's browser mock serialization: pass the mode through `addInitScript`'s argument, rather than closing over a Node variable. The setup-error rendering fixture also needs a non-lobby room status.
- Refresh tests that access policy controls inside collapsed Advanced Settings; scope voting selectors to vote-target controls and make role/modal selection wait for the assigned player. Match current bot and moderator labels precisely.
- Repair Banana Thief's random-role reconnect test: reload a non-thief voter, since the existing tested rule intentionally forfeits a thief who drops. Check authoritative RESULT rather than matching text that also exists before completion. New Banana Thief screenshots use test output paths rather than replacing historical QA images.

## Verification

- API: 31 suites, 740 tests passed, using an explicit local test database URL. The new viewer-role regression failed with the prior implementation and passed after the fix.
- API and web TypeScript: passed.
- API and web ESLint: passed.
- Isolated database preparation: passed against `127.0.0.1:13306/kz_game_hub_test`; 232 tests discovered before the latest additions.
- Broad isolated E2E sweep: 74 passed / 79 total (4.1 minutes). Five failures exposed remaining ambiguous/stale test assumptions in room policy, Who Am I and Knowguise. Focused rerun: 15 passed / 16 total; the remaining failure was a duplicate spectator-guidance text selector. After scoping it to the heading, the final Knowguise rerun passed all 3 tests (27.7 seconds), including the post-word observer privacy assertion. Every failing case from the 79-test sweep has a passing rerun; this is not a claim that one single 79-test run was clean.
- Cluecanvas rejected-card regression: deliberately restored the old eager-clear behavior and observed the expected missing-dialog failure, then restored the fixed source byte for byte; the focused rerun passed.
- First E2E attempt stopped after missing artist preset prevented Music Trivia startup. Prepared local fixtures before retrying.
- The next sweep exposed the mock serialization and random-thief test errors described above. Its failures remain recorded; a clean rerun is required before closing workflows.
- `pnpm dev` with the local test database: web GET / returned 200; API /health returned ok with database connected; both watchers compiled without errors. Stopped the task-owned dev processes after smoke checks.
- `pnpm build` against the local test database: passed, 4/4 build tasks (types, database client, API, web), 17.42 seconds.
- Visual inspection: Cluecanvas 360px Thai screenshot shows hand/actions before the played-card table and folded role/score after gameplay. Keyboard/touch cases cover 360/390/1280 viewports.
- Review: scoped self-review of privacy, state ownership, selection reconciliation, keyboard DOM order and existing synchronous action-loading duplicate guard; no independent reviewer approval claimed.

No production schema, seeds, credentials or game state were changed. Production deployment and GitHub CI have not been run by this delivery.

## Workflow gates

HUB-001/002/003: Completed after implementation audit, narrow fixes and the verification recorded above. Local `plan/` status is synchronized separately and remains gitignored according to repository policy.

HUB-004: user confirms people are ready and supplied `https://game-hub.krizad.com`. The protocol and aggregate results table are in [human playtest](2026-10-15-hub-human-playtest.md). The domain must serve the verified commit before results count for this delivery. No human results have been received, and no 80% activation claim is made.

HUB-005: **On Hold**. On 2026-10-15 the user explicitly reconfirmed private-friends focus. TASK-SH-007 and public growth remain gated; preparing this status does not count as implementing public quotas/statistics/capacity work.

## Reproduce verification

All database-dependent commands below explicitly target the guarded local test database.

```bash
DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' pnpm -F api test -- --runInBand
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' node scripts/test-isolated.mjs 'experience.spec.ts' 'task-sh-' detectiveclub.spec.ts room-policy.spec.ts catalog-and-learning.spec.ts --workers=2
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' node scripts/test-isolated.mjs who-know-experience.spec.ts who-am-i-experience.spec.ts room-policy.spec.ts detective-club-experience.spec.ts --workers=2
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' node scripts/test-isolated.mjs who-know-experience.spec.ts --workers=2
pnpm -F web exec tsc --noEmit
pnpm -F api exec tsc --noEmit
pnpm -F web lint
pnpm -F api lint
graphify update .
git diff --check
```

Full simulation matrix, live media providers, iOS and GitHub CI were not rerun; mocked browser playback is not evidence of live-provider availability. Human activation remains unmeasured. Historical QA images overwritten by legacy tests were preserved under ignored `tmp-script/hub-rerun-artifacts` and restored to their original tracked contents.
