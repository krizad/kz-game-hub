# Card Game Platform — Domain Context

## Purpose

This document defines the shared vocabulary and boundaries for the configurable card-game platform. It is the canonical domain reference for the feature; game-specific implementation details belong in the corresponding ADR and implementation plan.

## Product boundary

- The product hosts social card games using standard 52-card decks. It may add or remove Jokers and use multiple decks only when a preset permits it.
- It supports only virtual, match-scoped chips. It does not accept, transfer, redeem, or retain money or anything of real-world value.
- A room's live game state and rule configuration remain in memory. Nothing about a match is persisted.
- The server validates every game action and is the source of truth. Clients render public state and their own private state only.

## Glossary

| Term | Definition |
| --- | --- |
| Card game table | A room whose `gameType` is `CARD_GAME` — the Thai Card Game (เกมไพ่ไทย) — offering Pok Deng and Slave modes. |
| Preset | A versioned, system-owned rule definition such as Pok Deng or Slave. It supplies a safe default configuration and phase template. |
| Advanced Rules | Host-editable, allow-listed policies exposed by a preset. They cannot introduce arbitrary executable rules. |
| Rule configuration | The validated values selected for one room from a preset's allowed policies. |
| Deck | The ordered, server-owned collection of cards used by a round. |
| Stock | A face-down draw pile. |
| Discard pile | A face-up pile receiving discarded cards. |
| Hand | Cards owned by one player. Card identities are private unless a visibility policy reveals them. |
| Public state | Room/game information that may be broadcast to every member of the Socket.io room. It never contains an unrevealed hand, stock order, or another player's private choices. |
| Private state | Data emitted only to an entitled socket: the receiving player's hand, permitted target-card choices, and private action prompts. |
| Phase | A named, server-controlled stage such as deal, draw, play, resolve, score, or round-end. |
| Action | A validated player request permitted in the current phase, such as draw, play cards, pass, or stand. |
| Policy | One allow-listed behavior selected in configuration, for example `RESHUFFLE_DISCARDS_EXCEPT_TOP` when stock is empty. |
| Deterministic auto-action | A server-defined fallback whose result is entirely determined by public configuration and current server state; it never chooses strategically among hidden cards. |
| Round | One deal through resolution. A match may contain one or more rounds. A round cancelled by a player removal produces no result and moves no chips. |
| Match | One continuous play session of a room. It starts when the host starts the game from the lobby and ends when the room returns to the lobby or is deleted. Virtual chip balances persist across rounds within a match and reset only when a match starts. |
| Round cancellation | The server-side outcome when a seated player is removed (explicit leave or reconnect-grace expiry) during a live round: the round ends without a result, chip balances are preserved, and the room returns to the lobby. |
| Reconnect grace | The bounded window after a disconnect during which the player keeps their seat, private state, and pending turn; the round waits for them. On expiry the player is removed and a live round is cancelled. |
| Dealer | The player assigned the deal/compare role for a round (for Slave, the opening leader). Dealer selection follows the preset's starter policy via `resolveStarter`; `ROTATE` moves to the next seat each round, and the first dealer of a match is the first seated player. |
| Natural | A dealt hand worth 8 or 9 (mod 10). A dealer natural resolves the round immediately, before any third-card draw. |
| Live typing | In-progress answer text. The server relays it privately to every member except the picker, and it is never placed in public room state. |
| Allowed options | The allow-listed policy variants of the active preset, projected to clients so Advanced Rules controls offer only selectable values. |
| Forfeit prompt | Informational, host-configured end-of-round text. It has no effect outside the application and never requires proof of an offline action. |

## MVP preset contracts

| Preset | Mandatory mechanics | Explicitly deferred |
| --- | --- | --- |
| Pok Deng | Rotating human dealer, two-card deal, optional third card, mod-10 comparison, virtual chips, configured multipliers | AI dealer, side bets, real-money handling |
| Slave | Deal every card, 3♣ opening, single/pair/triple combinations, pass, clear after all eligible opponents pass, 2 as highest rank | Five-card combinations, Joker, rank-based exchanges |

