# Thai Card Game UI Implementation Plan

**Goal:** Give Pok Deng and Slave a shared virtual card-table identity while retaining distinct play patterns.

**Architecture:** Reuse public preset/state and private hand data. Keep the generic card engine, virtual chips, and privacy policies unchanged.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/card-game/PokDengView.tsx
- SlaveView.tsx
- CardHand.tsx
- CardGameActionPanel.tsx
- CardGameLog.tsx
- CardGameRuleSummary.tsx
- CardGameSettings.tsx
- CardGameRules.tsx
- dictionaries
- apps/web/e2e/card-game-pok-deng.spec.ts, card-game-presets.spec.ts, e2e/sim coverage

## Tasks

- [ ] Replace raw phase identifiers with localized table status; show dealer, active seat, round result, virtual chip balance.
- [ ] Pok Deng: distinguish private hand, optional draw/stand decision, hand value visibility, showdown multiplier/result.
- [ ] Slave: emphasize trick pile, leading combination, active seat, selectable hand, legal play/pass, winning finish.
- [ ] Make selected cards and action validity obvious; explain unavailable and configured deterministic timeout actions.
- [ ] Improve card size/fanning and mobile table layout; preserve privacy for hands, stock order, hidden choices.
- [ ] Explain public-safe log and chip movement; make match reset/replay clear.
- [ ] Extend E2E for both presets, privacy, legal actions, results, reconnect; run card-game specs and typecheck.

## Acceptance criteria

- Each player can distinguish private hand from public table cards.
- Phase, dealer/turn, legal action, and result are localized.
- Pok Deng communicates virtual chips and never implies real money.
- Slave clarifies trick ownership, lead requirement, and pass status.
- Server privacy and match lifecycle contracts remain unchanged.

## Engagement polish

- Use Framer Motion for deal/draw, selected-card feedback, trick/pile movement, and showdown reveal. Keep private hand contents private and all actions available immediately.
- Use the shared reduced-motion-aware celebration once at a completed match result; never imply real-money gambling through celebratory visuals or sound.
