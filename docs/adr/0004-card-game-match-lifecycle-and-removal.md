# ADR 0004: Match lifecycle, chip persistence, and player-removal policy for card games

- Status: Accepted
- Date: 2026-09-16

## Context

ADR 0003 defines virtual chips as match-scoped, and `CONTEXT.md` defines a match as a sequence of rounds, but neither fixes the match boundary for a live room. The interim Pok Deng adapter (pre-engine MVP, see `plan/feature-configurable-card-platform-1.md`) reset every balance to 100 at each deal, which made round-to-round settlement cosmetic, and it had no removal path: when the dealer left mid-round the next action threw a `TypeError`, and when a pending player left, the round stalled forever on a departed socket.

The declarative engine of ADR 0001 has since been implemented (`card-engine.service.ts` with presets under `games/card-game/presets`); these interim rules were written so the engine replaced them without changing player-visible semantics.

## Decision

- **Match boundary.** A match is one continuous play session of a room: it begins when the host starts the game from the lobby and ends when the room returns to `LOBBY` (host reset / `resetGame`) or is deleted. Chip balances persist across rounds of a match and are re-initialized only at match start.
- **Balances are public, in-memory, and keyed by socket id.** They live in `RoomState.cardGameChips` so they survive round-state resets while never outliving the room. Every player entering a match starts with 100 virtual chips; a player who joins an ongoing match receives the starting balance on their first dealt round. Balances may go negative: chips are a score-keeping counter, not a currency, and the MVP implements no per-round limits, top-up, or elimination.
- **Showdown sets both result signals.** `cardGameState.phase = 'RESULT'` and `room.status = RoomStatus.RESULT`, so shared status logic keeps working. `NEXT_ROUND` is host-only and is accepted only in `RESULT`.
- **Dealer selection is deterministic.** The first dealer of a match is the first seated (non-viewer, connected) player; later dealers rotate to the next seated player after the previous dealer. If the previous dealer is no longer seated, rotation restarts from the first seated player. Configurable dealer policies are engine-phase work (ADR 0001, REQ-004).
- **A player is removed only on explicit leave or reconnect-grace expiry.** A plain disconnect keeps the seat, private hand, and pending turn during the grace window; the round simply waits.
- **Removal mid-round cancels the round.** When a seated player is removed while a round is live, the round ends without a result: card state is cleared, the room returns to `LOBBY`, chip balances are preserved, and the removed player's balance is dropped. No partial payouts are ever issued.
- The unused `DEALER_TURN` phase is removed from the public phase union; the dealer's mandatory third card is drawn synchronously at resolution.

## Consequences

- Round settlement cannot be gamed through a partial comparison, and no code path can read a removed player's hand.
- Round cancellation is deterministic, trivially testable, and leaks nothing. The cost is that a losing player can cancel a round by leaving; because a cancelled round moves no chips, the incentive is limited, and the engine phase can replace cancellation with deterministic auto-actions and limits.
- `RoomState` gains one optional public field (`cardGameChips`); `@repo/types` must be rebuilt before the apps see it.
- Balance identity is socket-scoped, so a removed player who rejoins a still-running match restarts at the starting balance. Stable match identity (session/player-scoped balances) is engine-phase work.
- ADR 0003's "match" term is now precise; the starting balance, limits, and multiplier table remain engine-phase configuration.

## Alternatives considered

- **Reset balances every round** (the interim behavior): rejected because it contradicts ADR 0003 and makes settlement cosmetic.
- **Auto-stand / auto-play the removed player** so the round finishes: rejected for the MVP because it needs a deterministic hidden-information policy (ADR 0001's deterministic auto-action) and risks unfair comparisons; the engine phase will revisit it.
- **Pause the round indefinitely for reconnect**: rejected because one absent player can freeze the table; the existing reconnect grace already bounds the wait.
- **Clamp balances at zero**: rejected because it creates risk-free wagering at zero; negative balances are honest for a score counter.
