# Sounds Fishy UI Implementation Plan

**Goal:** Turn answer-bluff-hunt-scoring into a readable party-show sequence.

**Architecture:** Keep SoundsFishyPhase and server-side answer privacy. Compose phase-specific panels and reveal only authorized answer data.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/sounds-fishy/SoundsFishyView.tsx
- SoundsFishyRules.tsx
- apps/web/src/i18n/dictionaries/schema.ts, th.ts, en.ts
- apps/web/e2e/soundsfishy.spec.ts

## Tasks

- [ ] Add a phase timeline and round/question context for setup, pitch, hunt, and scoring.
- [ ] Show answer-submission states to the picker without exposing live answer text to others.
- [ ] During hunt, distinguish the real answer, bluffs, eliminated players, and selectable guesses only when allowed.
- [ ] Show score pool and explain points gained/lost; emphasize reveal and next-round action.
- [ ] Rework mobile answer cards/vote controls while preserving sound toggle behavior.
- [ ] Extend E2E for private typing, reveal, hunt choices, score result; run soundsfishy.spec.ts and typecheck.

## Acceptance criteria

- Players understand whether to submit, pitch, hunt, or wait.
- Unrevealed answers and votes remain private.
- Scoring explains each player’s result and pool outcome.
- All phase controls fit mobile width without clipping.

## Engagement polish

- Use Framer Motion to stage the true answer/bluff reveal and score outcome after voting closes, preserving suspense without exposing sealed answers or votes early.
- Keep optional sound cues on the existing sound board. Avoid adding a new audio library for short effects; celebrate a finished game only if there is a clear final winner.
