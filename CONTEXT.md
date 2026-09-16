# Card Game Platform — Domain Context

## Purpose

This document defines the shared vocabulary and boundaries for the configurable card-game platform. It is the canonical domain reference for the feature; game-specific implementation details belong in the corresponding ADR and implementation plan.

## Product boundary

- The product hosts social card games using standard 52-card decks. It may add or remove Jokers and use multiple decks only when a preset permits it.
- It supports only virtual, match-scoped chips. It does not accept, transfer, redeem, or retain money or anything of real-world value.
- A room's live game state remains in memory. Only an explicitly published, shareable rule configuration may be stored persistently.
- The server validates every game action and is the source of truth. Clients render public state and their own private state only.

## Glossary

| Term | Definition |
| --- | --- |
| Card game table | A room whose `gameType` is the new configurable card-game entry point. |
| Preset | A versioned, system-owned rule definition such as Pok Deng, Slave, Sam Sip, or Old Maid. It supplies a safe default configuration and phase template. |
| Advanced Rules | Host-editable, allow-listed policies exposed by a preset. They cannot introduce arbitrary executable rules. |
| Rule configuration | The validated values selected for one room from a preset's allowed policies. |
| Share code | An opaque code that resolves to an immutable published rule configuration. Importing it creates an editable room-local copy. |
| Deck | The ordered, server-owned collection of cards used by a round. |
| Stock | A face-down draw pile. |
| Discard pile | A face-up pile receiving discarded cards. Its top card can grant a reactive claim when the active preset allows it. |
| Hand | Cards owned by one player. Card identities are private unless a visibility policy reveals them. |
| Public state | Room/game information that may be broadcast to every member of the Socket.io room. It never contains an unrevealed hand, stock order, or another player's private choices. |
| Private state | Data emitted only to an entitled socket: the receiving player's hand, permitted target-card choices, and private action prompts. |
| Phase | A named, server-controlled stage such as deal, draw, play, resolve, score, or round-end. |
| Action | A validated player request permitted in the current phase, such as draw, discard, play cards, pass, claim discard, stand, take-card, or acknowledge result. |
| Policy | One allow-listed behavior selected in configuration, for example `RESHUFFLE_DISCARDS_EXCEPT_TOP` when stock is empty. |
| Reactive claim | A temporary action window after an event, such as Sam Sip allowing the next player to take a discard only if it completes a valid pair. |
| Deterministic auto-action | A server-defined fallback whose result is entirely determined by public configuration and current server state; it never chooses strategically among hidden cards. |
| Round | One deal through resolution. A match may contain one or more rounds. A round cancelled by a player removal produces no result and moves no chips. |
| Match | One continuous play session of a room. It starts when the host starts the game from the lobby and ends when the room returns to the lobby or is deleted. Virtual chip balances persist across rounds within a match and reset only when a match starts. |
| Round cancellation | The server-side outcome when a seated player is removed (explicit leave or reconnect-grace expiry) during a live round: the round ends without a result, chip balances are preserved, and the room returns to the lobby. |
| Reconnect grace | The bounded window after a disconnect during which the player keeps their seat, private state, and pending turn; the round waits for them. On expiry the player is removed and a live round is cancelled. |
| Dealer | The player assigned the deal/compare role for a round. Dealer selection is a configurable policy (ADR 0001). Until the engine lands, the first dealer of a match is the first seated player and later dealers rotate in seat order. |
| Forfeit prompt | Informational, host-configured end-of-round text. It has no effect outside the application and never requires proof of an offline action. |

## MVP preset contracts

| Preset | Mandatory mechanics | Explicitly deferred |
| --- | --- | --- |
| Pok Deng | Rotating human dealer, two-card deal, optional third card, mod-10 comparison, virtual chips, configured multipliers | AI dealer, side bets, real-money handling |
| Slave | 3♣ opening, single/pair/triple combinations, pass, clear after all eligible opponents pass, 2 as highest rank | Five-card combinations, Joker, rank-based exchanges |
| Sam Sip | Five-card initial deal, draw/discard, sum-to-ten pair removal, reactive claim of prior discard | Multi-card melds beyond the preset's pair rule |
| Old Maid | Deal all cards, remove matching ranks, choose one face-down card from the next player's hand, one designated unmatched card, last holder loses | Forced/offline penalties |
