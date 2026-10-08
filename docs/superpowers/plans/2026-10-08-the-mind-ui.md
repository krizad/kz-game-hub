# The Mind UI Implementation Plan

**Goal:** Support quiet cooperative play with a clear shared table, readable private hands, and satisfying level resolution.

**Architecture:** Keep hands private; render existing public piles, hand sizes, lives, shuriken, and level data.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/the-mind/TheMindView.tsx
- TheMindGameView.tsx
- TheMindRules.tsx
- dictionaries
- apps/web/e2e/themind.spec.ts

## Tasks

- [ ] Arrange ascending pile, optional extreme/down pile, lives, shuriken, level, and hand sizes as a compact table HUD.
- [ ] Improve private cards for touch selection and clarify selected/played state.
- [ ] Animate cards into the correct pile; retain ordering feedback under reduced motion.
- [ ] Explain readiness, shuriken vote, level success/failure, and game-over next step.
- [ ] Reveal failed-player/recovered-card details only during authorized phases.
- [ ] Extend E2E for normal/extreme modes, play order, shuriken, outcomes; run themind.spec.ts and typecheck.

## Acceptance criteria

- Own cards are readable/selectable on mobile; other hands show counts only.
- Players see lives, shuriken, level, and piles at a glance.
- Failure and level transitions explain outcome without premature hidden-state reveal.
- Reduced motion preserves meaningful feedback.

## Engagement polish

- Keep motion quiet and purposeful: use Framer Motion for a card entering a public pile and a level success/failure transition. Avoid confetti and competing sounds that undermine the game's cooperative focus.
- Provide reduced-motion users with an immediate pile update and explicit success/failure text.
