# ADR 0001: Use declarative preset phase templates for configurable card games

- Status: Accepted
- Date: 2026-09-14

## Context

The platform must support Thai and international card games with different deals, piles, turn order, private information, win conditions, and scoring. Hosts need meaningful house-rule controls, but arbitrary event scripting would make validation, i18n rule summaries, and test coverage unreliable.

## Decision

Implement one `CARD_GAME` room type backed by a declarative card-engine model.

- Each system-owned preset supplies a fixed phase template and an allow-list of selectable policies.
- `CardGameConfig` exposes exactly six categories: deck; dealing/starter; turn/actions; piles/draw; visibility; and round/match scoring.
- The server validates the complete configuration in the lobby, normalizes it to a canonical form, and rejects invalid action/configuration combinations.
- The engine exposes a generic, discriminated `card_game_action` Socket.io request. Action kinds are fixed by the engine; a configuration never carries executable code.
- Pok Deng, Slave, Sam Sip, and Old Maid are the initial preset implementations. Their phase-specific validators may call shared engine primitives but do not alter client state directly.
- Rules are rendered from the same canonical configuration used by the validator, in Thai and English.

## Consequences

- A new game family can reuse deck, hand, pile, action-window, resolution, and scoring primitives without creating an unrestricted rules language.
- Variants outside the supported policy set require a new preset capability and tests rather than a hidden host-only option.
- Trick-taking, five-card climbing combinations, Jokers, rank exchanges, and replay are planned extensions, not implicit MVP promises.

## Alternatives considered

- **Arbitrary host event scripts:** rejected because server-side safety, deterministic validation, and a truthful rule summary cannot be guaranteed.
- **One independent `GameType` per card game:** rejected because it duplicates generic state, privacy, and configuration logic and makes variants harder to share.
- **Hard-coded games without Advanced Rules:** rejected because it does not meet the house-rule requirement.

