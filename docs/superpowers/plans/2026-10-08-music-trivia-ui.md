# Music Trivia UI Implementation Plan

**Goal:** Make audio setup, synchronized listening, buzzing, answering, reveal, and scores feel like a polished quiz show.

**Architecture:** Keep existing source, phases, timestamps, adapters, and timer behavior. Never surface the answer before reveal.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/music-trivia/MusicTriviaView.tsx
- MusicTriviaSettings.tsx
- MusicTriviaRules.tsx
- apps/web/src/components/core/SoundToggle.tsx
- dictionaries
- apps/web/e2e/musictrivia.spec.ts

## Tasks

- [ ] Separate source setup, audio readiness, countdown, playback, answer, reveal, and finished states with a stable phase rail.
- [ ] Make readiness/playback errors actionable; show ready players without exposing track answers.
- [ ] Prioritize synchronized play/buzzer during playback and current answerer/time during answering.
- [ ] Reveal artwork, title, artist, winner, and score delta in sequence; keep track links secondary.
- [ ] Prevent layout jumps and verify typing/game-master modes at mobile width.
- [ ] Extend E2E for both modes, audio readiness/error, timeout, reveal, progression; run musictrivia.spec.ts and typecheck.

## Acceptance criteria

- Audio readiness and sync state are visible before start.
- Players know when buzzing is allowed and who is answering.
- Track title/artist remain hidden until reveal.
- Both modes and long titles work on phone-width screens.

## Engagement polish

- Use Framer Motion for countdown, playback/answer/reveal transitions, and score changes. Keep countdownEndsAt/playStartTime and the existing synchronized audio flow authoritative; visual effects must not alter playback timing.
- Keep existing audio controls/player and sound preferences. Do not add Howler unless later work requires audio sprites, layered cues, or fades that the current player cannot provide.
