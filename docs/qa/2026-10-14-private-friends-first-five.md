# First five private-friends tasks — delivery evidence

> จัดระเบียบเอกสาร: นำไฟล์ภาพและหลักฐานประกอบเก่าออกแล้ว คงรายงานนี้ไว้เป็นประวัติผลตรวจ
> Started: 2026-10-14. Baseline: `cb019bae`. Delivery branch: `feature/private-friends-complete` (continued from `feature/private-friends-controls`). Final HEAD: `9bac33d0`.

Execution scope: SH006 room policy, WA001 host-word dialog, TT001 keyboard controls, DC001 card controls/dialogs and MT001 local playback feedback. See execution plan (แผนเก่าเลิกใช้แล้ว).

## Test environment

Dedicated Docker MySQL container `kz-game-hub-urgent-tests-ram-20261013`, bound to `127.0.0.1:13306`, database `kz_game_hub_test`. Worktree has no copied production `.env`. Both `TEST_DATABASE_URL` and `DATABASE_URL` explicitly use this local database. Browser runner uses isolated Web3100/API3101 servers.

Preparation passed: shared types and database build, schema push to the local database, reference-data seed, deterministic E2E artist seed, and browser test inventory (155 tests before implementation). Preparation does not establish application acceptance.

Isolation guards: `node --test scripts/test-database.test.mjs scripts/test-isolated.test.mjs` passed 4/4. They cover explicit URL requirements, rejection of remote/non-test targets, validated child-process environment and runner/descendant cleanup on termination.

## Task evidence

SH006 complete, scoped review approved. Commits `47f4c9fe` and `3c586601`: UNLISTED/closed-spectator defaults, legacy PUBLIC/open fallback, host lobby controls, catalog filtering and server admission guards. Review identified a token/name mismatch bypass and client room loss on denied spectator entry; both were reproduced, fixed and re-reviewed. Original full API 659/659 and browser 21/21 passed; fix-focused API 162/162 and policy/reconnect browser 7/7 passed. Types, scoped lint and formatting passed. Viewport/language checks used browser assertions, without preserved passing screenshots. See full task evidence.

WA001 complete, scoped review approved. Existing commit `9acd4e9b` was preserved and verified; `e73d739e` added malformed payload guards and stronger real-room coverage, and `ce254797` corrected desktop capture dimensions. API 80/80, expanded browser 3/3 and the changed capture case 1/1 passed; types, scoped lint and formatting passed. Tab/Escape/focus restore, same-player reconnect/current socket submission, viewer exclusion and departed/replacement drafts are covered. Six TH/EN screenshots at 360×800, 390×844 and 1280×900 are preserved; controller and reviewer inspected mobile Thai and desktop English with no obstructed form actions. See task evidence.

TT001 complete, scoped review approved. Commits `4c5517a5` and `04a5a6ad` preserved the pre-existing six-file patch, completed native Gobbler inventory and named cells in all three modes, and added pending-action explanations. Review corrected the English explanation for an equal-size Gobbler placement. API 58/58, browser 4/4 and focused Gobbler fix case 1/1 passed; types, scoped lint and formatting passed. Keyboard moves were witnessed through server updates on other player/viewer pages. Browser assertions cover 360×800 Thai Classic, 390×844 English Gobbler and 1280×900 Thai Ultimate. Controller inspected the preserved Gobbler mobile screenshot: inventory and board fit. See task evidence.

DC001 complete, scoped review approved. Commit `62f10750`: separate native inspect/play controls visible without hover, GameDialog card viewer and confirmation, updated legacy/simulation selectors, and a focused hand-card width adjustment. API 20/20 and relevant E2E 5/5 passed; covering desktop 1/1 and touch 2/2 reruns followed the width fix. Types, scoped lint and formatting passed. Controller inspected desktop and Thai mobile full-page screenshots: five desktop cards fit; mobile controls are visible and remaining hand cards are horizontally reachable. Viewports 360×800/390×844/1280×900 produced full-page artifacts 360×1980, 390×1980, and 1280×1428. Existing mobile hand placement below the fold remains DC002 work. See task evidence.

MT001 complete, scoped review approved. Commit `9bac33d0`: local-only media playback state in `useMusicPlayback.ts` and integration into `MusicTriviaView.tsx`. Returns 5 statuses (`loading`, `ready`, `playing`, `blocked`, `error`), 3 reasons (`AUTOPLAY_BLOCKED`, `NETWORK_OR_PROVIDER`, `EXPIRED_CLIP`), volume, mute, and retry controls. True media signal is required before displaying Now Playing; guest receives no song titles or answers in errors. Expired clips cannot be restarted by retry. API tests (3 suites, 33/33 tests passed), experience E2E (6/6 tests passed), and reconnect spec (1/1 passed). See task evidence.

Final review triaged two minor DC001 coverage observations: keyboard-confirm uses Playwright click, and played-card inspection has no direct assertion in the new experience spec. Both were confirmed non-blocking as native modal behaviors, focus traps, and hand card inspection share identical implementation pathways.

## Integration evidence

- Full API baseline verification at `62f10750`: `pnpm -F api test -- --runInBand` with explicit local DB, exit 0, 29 suites and 665/665 tests passed. The API and shared-types source tree was verified identical between `62f10750` and `9bac33d0` (no backend/types modifications in MT001).
- Combined First-Five E2E: `node scripts/test-isolated.mjs room-policy.spec.ts who-am-i-experience.spec.ts tic-tac-toe-experience.spec.ts detective-club-experience.spec.ts music-trivia-experience.spec.ts music-reconnect.spec.ts --workers=1 --reporter=line` -> 20/20 tests passed across all 6 suites (2.4m).
- Play-to-completion simulations: `E2E_SIM_PLAYS=1 E2E_SIM_GAMES=ttt-classic-2p,detective-club-3p,whoami-host-input node scripts/test-isolated.mjs -c playwright.sim.config.ts` -> 3/3 passed (29.1s).
- Production build smoke: `pnpm -F web build` with explicit local DB passed with static generation 6/6 and 0 errors.
- Dev smoke: `PORT=3301 pnpm dev` smoke on API :3301 (`/health` returned HTTP 200 with database status connected) and Web :3000 (returned HTTP 200). Process terminated cleanly.
- Knowledge graph: `graphify update` re-extracted all modified AST files (278/278 uncached, 3111 nodes, 6028 edges, 234 communities).
- Whole-branch review (`cb019bae..9bac33d0`): All 5 approved tasks verified and reviewed. All quality gates passed with no outstanding Critical or Important issues.
