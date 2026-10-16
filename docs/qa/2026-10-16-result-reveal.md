# Paced result reveals — 2026-10-16

All 16 game types use a shared server-owned presentation timeline. Social role reveals use five-second slots (with owner self-reveal and automatic fallback), card hands use 3.2-second slots, and simple scores/choices use 2.2-second slots. Winners appear after those slots, followed by each game's existing detailed summary. The host can skip for everyone.

The timeline uses stable player IDs and survives socket remapping. Spectators and non-playing hosts receive no personal losing message. Coup publishes remaining roles only after RESULT and remaps the final hand keys on reconnect. Poker final match standings have their own timeline and rank chip stacks independently of pot winners. The Mind's final blind replay runs before announcing the result, and the summary does not replay it again. Existing intermediate level replays remain unchanged. Music Trivia retains unlocked audio and readiness across presentations; its summary waits for explicit host advancement.

## Verified

- Shared package build and web/API TypeScript checks passed.
- All API tests passed: 38 suites, 885 tests.
- Focused browser regression selection passed: 12 tests across the new reveal suite, RPS, classic tic-tac-toe and ultimate tic-tac-toe. After final timing/participant adjustments, the five reveal tests passed again.
- Browser coverage: choices before winner, persistent summary, owner reveal reflected on all four clients, same timeline after reload, host skip synchronized to all clients, Thai at 360px without horizontal overflow, correctly judged music answer, retained readiness in the next song, and no automatic advance after ten seconds. Content fixtures resolve evidence, role labels and outcomes for every game in Thai and English, including Poker final chip standings.
- ESLint on changed runtime files and `git diff --check` passed.
- `pnpm dev` started API and web successfully; `/health` reported the local test database connected and the web returned HTTP 200. Dev servers were stopped after verification.
- Independent code review findings for Music Trivia phases/audio and Poker match standings were fixed and rechecked.
- `graphify update .` completed with AST extraction and no LLM calls.

Browser verification used the disposable local MySQL database at `127.0.0.1:13306/kz_game_hub_test`, in container `kz-game-hub-reveal-e2e`. The container was paused after verification, preserving its test data. No production data was used. This is targeted browser coverage, not a full rerun of the 52-entry simulation matrix.
