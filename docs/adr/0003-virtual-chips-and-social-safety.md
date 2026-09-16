# ADR 0003: Limit card-game stakes and penalties to virtual, match-scoped social play

- Status: Accepted
- Date: 2026-09-14

## Context

Pok Deng commonly uses betting and Old Maid may use social penalties. The requested feature is a game hub, not a payment or gambling system.

## Decision

- Virtual chips start from the room configuration, are only transferred/calculated within the current match, and are reset when that match/room ends.
- Pok Deng payout multipliers are fixed preset policy values, displayed before the round starts, and applied server-side.
- The UI may display host-defined result labels and a forfeit prompt. Prompts are informational only and must not solicit money, alcohol consumption, physical acts, or proof of an offline activity.
- No payment provider, withdrawal, deposit, cash value, cross-room balance, leaderboard based on chips, or real-world settlement is implemented.

## Consequences

- The game retains its social scoring loop while avoiding financial-accounting requirements.
- Copy and validation rules must prevent hosts from presenting virtual chips as money or an enforceable obligation.

