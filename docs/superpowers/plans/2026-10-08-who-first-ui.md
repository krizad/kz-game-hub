# Who First UI Implementation Plan

**Goal:** Make wait, signal, reaction, false-start, and result states instantly readable.

**Architecture:** Use existing server timestamps, press records, round winner, and score; keep countdown timing server-authoritative.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/who-first/WhoFirstView.tsx
- WhoFirstRules.tsx
- apps/web/src/components/core/SoundToggle.tsx
- dictionaries
- apps/web/e2e/whofirst.spec.ts

## Tasks

- [ ] Make WAIT, COUNTDOWN, ACTIVE, ROUND_RESULT, FINISHED visually distinct with one dominant center cue.
- [ ] Show false starts/penalties immediately with an explanation; show fastest valid press and reaction time after resolution.
- [ ] Keep current round, rounds remaining, and match score visible.
- [ ] Provide equivalent visual and optional audio cues; do not communicate by color alone.
- [ ] Tune press target for one-handed mobile play and prevent countdown activation.
- [ ] Extend E2E for early/valid/simultaneous press and round completion; run whofirst.spec.ts and typecheck.

## Acceptance criteria

- Countdown and active signal cannot be confused.
- An early press is visibly identified as a penalty and not a valid win.
- Round result names winner and updates match progress.
- Audio-disabled and reduced-motion players receive equivalent cues.

## Engagement polish

- Use Framer Motion for a clear countdown pulse and an immediate ACTIVE cue, but keep the input window and server timestamps authoritative; animation must never delay or enable a press.
- Keep the existing optional sound cue as a parallel signal. Use shared confetti only for the finished match, not every reaction-time result.
