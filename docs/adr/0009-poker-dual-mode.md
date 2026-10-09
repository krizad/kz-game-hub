# 0009. Poker as a Standalone Game Type with One Betting Engine Across Two Modes

Status: Accepted
Date: 2026-10-09

## Context

Poker was requested with two experiences: a full on-web No-Limit Texas Hold'em game (cards and chips), and a companion mode that only manages chips and bets while players use a real physical deck at the table. The configurable `CARD_GAME` engine (ADR 0001) has an action set (`DRAW`/`STAND`/`PLAY`/`PASS`/…) and payout-multiplier scoring with no concept of betting rounds or a shared pot, so poker does not fit as a third preset.

## Decision

- One new game type, `POKER`, with `config.pokerMode: 'ONLINE' | 'CHIPS_LEDGER'`, selected by the host in the waiting room (ADR 0006 pattern), default `ONLINE`.
- Both modes run the **same shared betting engine**: blinds, turn order, min-raise, all-in-without-reopen, uncalled-bet return, full side-pot math. `ONLINE` adds server dealing (hole cards as private state per ADR 0002) and automatic showdown evaluation with per-player show/muck choice. `CHIPS_LEDGER` owns no deck; a contested hand ends with the host's pot award, and the host advances street markers without board cards.
- Chips stay virtual and match-scoped (ADR 0003); rebuys are host-granted within a match. One admin toggle `POKER`. 2–10 players. Match end records chip standings to the leaderboard (highest stack wins).
- No bots, no tournament blind escalation.

## Considered Options

- **Third `CARD_GAME` preset** — rejected: betting rounds (bet/call/raise/fold, pot math, side pots) would require reshaping the engine's action and payout model for every existing preset.
- **Two separate game types** — rejected: the two modes share nearly all state, rules, and UI; the split would duplicate lobby, admin, and rules surfaces with no benefit.

## Consequences

- Both modes always ship together under the single `POKER` toggle; disabling the game disables both.
- Adding poker variants (Omaha, tournaments) means extending inside `POKER`, not new game types.
- Chips ledger mode is an explicit exception to the server-owned `Deck` definition in `CONTEXT.md`.
