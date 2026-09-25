# 0006. Tic-Tac-Toe Collapsed to One Game with In-Room Mode Selection

Status: Accepted
Date: 2026-09

## Context

The TTT family previously existed as **three** game types: `TIC_TAC_TOE` (with a `ticTacToeMode` config of CLASSIC/GOBBLER/ULTIMATE), plus standalone `GOBBLER_TIC_TAC_TOE` and `ULTIMATE_TIC_TAC_TOE` types. The main lobby exposed this split as a special "3 Modes" card with three sub-buttons that pre-selected the mode at room creation, and the rules modal carried three overlapping tabs. A room-level mode selector (`TicTacToeModeSelector`, host-only, waiting-room only) already existed but was unreachable through the primary lobby flow.

## Decision

- **One game type**: `GOBBLER_TIC_TAC_TOE` and `ULTIMATE_TIC_TAC_TOE` are removed from the `GameType` enum. Every TTT room is `TIC_TAC_TOE` and the variant is `config.ticTacToeMode` (default `CLASSIC`), switchable by the host in the waiting room before starting.
- **Lobby**: the special 3-button card is replaced by a single "Tic-Tac-Toe" button; mode selection happens inside the room.
- **Mode flags**: the two admin toggles become feature flags keyed `GOBBLER_MODE` / `ULTIMATE_MODE` (constant `TTT_MODE_FLAGS`). They are not game types; `SET_GAME_ENABLED` validates against `GameType` ∪ `TTT_MODE_FLAGS`. A disabled flag hides the corresponding mode from the in-room selector; the active mode always remains visible.
- **Rules modal**: the duplicate Gobbler/Ultimate tabs are removed; the single Tic-Tac-Toe tab contains the three mode sub-tabs plus a note explaining in-room mode selection.
- The game services (`gobbler/`, `ultimate-tic-tac-toe/`) remain as mode implementations behind `TicTacToeService`-family routing; their `is*Room` checks now key off `ticTacToeMode` only.

## Consequences

- `GameSetting` rows for the two removed type strings become ignored orphans (fail-open reads treat them as enabled; no migration required). Fresh seeds create `GOBBLER_MODE`/`ULTIMATE_MODE` rows instead.
- Rooms are in-memory only, so there is no live-state migration; servers pick up the new model on deploy.
- Old leaderboard rows keep the historical type strings — they are display data only.
- Adding a fourth TTT mode means: a mode id + service wiring + a `tttMode` selector entry (+ optional admin flag), not a new game type.
