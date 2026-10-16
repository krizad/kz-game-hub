# 0012. Result deduplication and Poker match scores

Status: Accepted
Date: 2026-10-16

## Context

ADR 0011 introduced incremental result scores and a signature based on the current player list. A queued RPS player leaving after a resolved round changes that signature without creating a new result, causing another set of leaderboard rows. Poker also differs from cumulative-point games: `PokerService.endMatch()` publishes final chip stacks, while `resetMatch()` and `startMatch()` do not zero the previous published player scores. Subtracting a previous match's baseline can therefore award the leaderboard win to the player with fewer chips.

## Decision

- Supersede ADR 0011's signature-based deduplication in decision 5. For non-DOG_RELAY games, record at most once during each continuous stay in `RoomStatus.RESULT`. Rearming happens only after a broadcast of a non-RESULT state; player removal, reconnect, or other broadcasts within the same RESULT state do not create a new result cycle. DOG_RELAY retains its existing `roundId` deduplication.
- Add an exception to ADR 0011's incremental-score rule in decision 3: Poker records final chip stacks for each completed match and ranks those stacks directly. It never subtracts another match's chip stacks, whether the next match starts from RESULT or through LOBBY. Cumulative-point games retain incremental scoring.
- Keep the existing database schema and aggregation queries. Do not rewrite historical results as part of this correction.

## Consequences

The recorder no longer needs to derive result identity from mutable player names, scores, or game-specific round fields. New rounds and matches must continue broadcasting their non-RESULT state before their next completed result. Regression tests cover queued-player removal, the following valid RPS round, and both Poker restart paths using the game services.
