# Simulated Play-to-Completion E2E

Simulates real playthroughs of every game and every lobby-selectable mode to its
completion state, driving the UI exactly like a player (socket traffic happens
naturally; no state injection).

Design decisions for the current matrix live in `plan/2026-09-29-e2e-full-coverage.md`.

## Matrix

| id                          | game           | players | mode/config                                 | completion assertion           |
| --------------------------- | -------------- | ------- | ------------------------------------------- | ------------------------------ |
| who-know-4p                 | Who Know       | 4       | defaults (ROUND_ROBIN host)                 | Voting Results / winner banner |
| who-know-random             | Who Know       | 4       | host selection RANDOM                       | Voting Results / winner banner |
| who-know-fixed              | Who Know       | 4       | host selection FIXED                        | Voting Results / winner banner |
| sounds-fishy-3p             | Sounds Fishy   | 3       | defaults                                    | Round Over scores              |
| ttt-classic-2p              | Tic-Tac-Toe    | 2       | mode CLASSIC PVP                            | "wins" banner                  |
| ttt-classic-bot-easy        | Tic-Tac-Toe    | 1       | mode CLASSIC, vs bot EASY                   | Play Again button              |
| ttt-classic-bot-god         | Tic-Tac-Toe    | 1       | mode CLASSIC, vs bot GOD                    | Play Again button              |
| ttt-gobbler-2p              | Tic-Tac-Toe    | 2       | mode GOBBLER PVP                            | winner banner                  |
| ttt-ultimate-2p             | Tic-Tac-Toe    | 2       | mode ULTIMATE PVP                           | "wins" banner                  |
| rps-bestof1-rr              | Hand Duel      | 2       | BO1 round robin                             | "Wins the Match!"              |
| rps-bestof3-rr              | Hand Duel      | 2       | BO3 round robin                             | "Wins the Match!"              |
| rps-bestof3-chaos           | Hand Duel      | 2       | BO3 all at once                             | "Wins the Match!"              |
| rps-allatonce-bo5           | Hand Duel      | 2       | BO5 all at once                             | "Wins the Match!"              |
| detective-club-3p           | Detective Club | 3       | defaults                                    | Scoring phase controls         |
| whoami-player-input         | Who Am I       | 2       | PLAYER_INPUT, 1 round                       | Game Over after YES vote       |
| whoami-host-input           | Who Am I       | 3       | HOST_INPUT (host moderates)                 | Game Over after YES vote       |
| whoami-random               | Who Am I       | 2       | RANDOM + category (Animals)                 | Game Over after YES vote       |
| whoami-ai                   | Who Am I       | 2       | AI_GENERATED (LLM key)                      | external, skipped by default   |
| who-first-2p                | Who First      | 2       | defaults                                    | Final results after End Game   |
| who-first-penalty           | Who First      | 2       | penalty on                                  | Final results after End Game   |
| who-first-infinite          | Who First      | 2       | infinite rounds, host ends game             | Final results after End Game   |
| music-trivia-typing         | Music Trivia   | 2       | TYPING, 5 rounds, iTunes                    | Game Over!                     |
| music-trivia-gm             | Music Trivia   | 2       | GAME_MASTER, 5 rounds                       | Game Over!                     |
| music-trivia-soundcloud     | Music Trivia   | 2       | SoundCloud source                           | external, skipped by default†  |
| music-trivia-youtube        | Music Trivia   | 2       | YouTube source                              | external, skipped by default†  |
| the-mind-normal             | The Mind       | 2       | NORMAL, max level 4                         | You Win! / Game Over           |
| the-mind-extreme            | The Mind       | 2       | EXTREME, max level 3                        | You Win! / Game Over           |
| the-mind-blind              | The Mind       | 2       | BLIND, max level 3                          | You Win! / Game Over           |
| the-mind-timeattack         | The Mind       | 2       | TIME ATTACK, max level 3                    | You Win! / Game Over           |
| saboteur-3p                 | Saboteur       | 3       | defaults, full 3 rounds                     | Win overlay / back to lobby    |
| saboteur-stone-ends         | Saboteur       | 3       | stone ends round instantly, 3 rounds        | Win overlay / back to lobby    |
| saboteur-timer              | Saboteur       | 3       | turn timer on (60s auto-pass), 3 rounds     | Win overlay / back to lobby    |
| coup-3p                     | Coup           | 3       | Income rush                                 | "Winner:" banner               |
| coup-3p-aggressive          | Coup           | 3       | Tax / Steal / Assassinate rush              | "Winner:" banner               |
| banana-thief-4p             | Banana Thief   | 4       | fast night clock                            | Reveal banner + thief name     |
| banana-thief-no-followers   | Banana Thief   | 4       | follower count 0                            | Reveal banner + thief name     |
| banana-thief-narrator-host  | Banana Thief   | 4       | HOST narrator (host paces all 6 hours)      | Reveal banner + thief name     |
| banana-thief-detective      | Banana Thief   | 5       | DETECTIVE special                           | Reveal banner + thief name     |
| banana-thief-sycophant      | Banana Thief   | 5       | SYCOPHANT special                           | Reveal banner + thief name     |
| banana-thief-scapegoat      | Banana Thief   | 5       | SCAPEGOAT special                           | Reveal banner + thief name     |
| banana-thief-two-followers  | Banana Thief   | 5       | follower count 2 (thief picks both)         | Reveal banner + thief name     |
| banana-thief-twins          | Banana Thief   | 6       | TWINS special pair, no followers            | Reveal banner + thief name     |
| banana-thief-specials-multi | Banana Thief   | 6       | 2 specials assigned (Detective + Sycophant) | Reveal banner + thief name     |
| banana-thief-all-specials   | Banana Thief   | 8       | all 4 special types selected                | Reveal banner + thief name     |
| card-pok-deng               | Thai Card Game | 2       | POK_DENG                                    | RESULT panel                   |
| card-pok-deng-timer         | Thai Card Game | 2       | POK_DENG + 20s turn timer                   | RESULT panel                   |
| card-slave                  | Thai Card Game | 2       | SLAVE preset                                | RESULT panel                   |

† SoundCloud/YouTube entries are external: their live track lookups are
network-flaky in headless runs. The iTunes-backed typing/GM entries were
re-promoted on 2026-09-30 after the driver rewrite (scan-all-pages buzzer +
page healing) and the answer-timeout server fix (see `.scratch/0005-*.md`).
Lobby-config coverage for Music Trivia also lives in `e2e/lobby-options.spec.ts`.

External entries need services beyond the default iTunes lookup or an LLM key;
they are skipped unless `E2E_SIM_INCLUDE_EXTERNAL=1`.

## Usage

```bash
# All non-external entries, 1 playthrough each
pnpm -F web exec playwright test -c playwright.sim.config.ts

# N playthroughs per entry (fresh room + full match each time)
E2E_SIM_PLAYS=3 pnpm -F web exec playwright test -c playwright.sim.config.ts

# Subset by id or prefix (comma-separated)
E2E_SIM_PLAYS=2 E2E_SIM_GAMES=ttt-classic-2p,rps pnpm -F web exec playwright test -c playwright.sim.config.ts

# Include flaky/external entries
E2E_SIM_INCLUDE_EXTERNAL=1 pnpm -F web exec playwright test -c playwright.sim.config.ts
```

## Environment variables

| Variable                   | Default | Meaning                                                   |
| -------------------------- | ------- | --------------------------------------------------------- |
| `E2E_SIM_PLAYS`            | `1`     | Number of simulated playthroughs per matrix entry         |
| `E2E_SIM_GAMES`            | all     | Comma-separated matrix ids or prefixes to include         |
| `E2E_SIM_INCLUDE_EXTERNAL` | off     | Include entries needing flaky external services / LLM key |

Failures report the matrix id and the exact playthrough number in the test
title, e.g. `sim/coup-3p — Income rush, coups until one player remains >
playthrough 2/3 reaches completion`. Screenshots and video are captured on
failure (Playwright config `screenshot: on`, `video: on`).

Known flaky/non-deterministic spots: hidden randomness in Saboteur roles/deals
and the external Music Trivia lookups. The historic `ttt-classic-bot-*`
load-flake was fixed on 2026-09-30 — the driver broke out of its loop when the
board hadn't rendered yet (`.scratch/0006` has the full post-mortem); it now
waits for the 9 board cells after joining a side. Drivers use bounded step
budgets and always assert an achievable completion state, never a specific
winner.

## Admin flags are never toggled in e2e

The admin panel writes through to the shared remote production MySQL
(`GameSettingsService.setEnabled` upserts even when `DISABLE_GAME_SETTINGS_DB=1`,
which only skips _loading_). `e2e/admin.spec.ts` is therefore read-only, and no
sim or interactive spec may click an admin toggle — flag-gating behavior is
covered by jest specs instead.

## Note on `debug-*.spec.ts`

The `debug-*.spec.ts` files are throwaway investigation specs kept as
`test.fixme` (they skip automatically). Deleting them is safe; they are not
part of the matrix and never count toward the passing playthroughs.
