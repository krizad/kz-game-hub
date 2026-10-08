# Knowguise (Who Know) UI Implementation Plan

**Goal:** Make role setup, questioning, voting, and reveal feel like a clear social-deduction round.

**Architecture:** Keep the role and secret word in the existing private RoleCard flow. Improve the game view and phase copy using existing RoomStatus, votes, room players, and score state.

**Tech Stack:** Next.js client components, Tailwind CSS, Framer Motion, Zustand, th/en dictionaries, Playwright.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/who-know/WhoKnowView.tsx
- apps/web/src/components/games/who-know/WhoKnowRules.tsx
- apps/web/src/components/RoleCard.tsx
- apps/web/src/app/page.tsx
- apps/web/src/i18n/dictionaries/schema.ts, th.ts, and en.ts
- apps/web/e2e/whoknow.spec.ts

## Tasks

- [x] Replace raw room-status wording with a phase rail for secret-word setup, questioning, voting, and results; highlight the active phase.
- [x] During questioning, show timer and question context with a clear end-questioning affordance; keep role and secret word private.
- [x] During voting, show each player's own submitted/waiting state and tell the Word Keeper that ballots are sealed. The server keeps ballot counts private until resolution, so do not add live aggregate progress or expose choices early.
- [x] Stage result role reveal, winning side, vote outcome, and current scores as the round’s visual focus.
- [x] Tune the private role card for mobile and allow a player to revisit their role without leaking it to broadcast UI.
- [x] Extend E2E for phase progression, vote privacy before reveal, and result clarity; run whoknow.spec.ts and typecheck.

Implementation note: live submitted-vote totals are intentionally omitted because WhoKnowService stores ballots privately and only copies them into `room.votes` once the round resolves. The UI shows the local player's vote receipt and keeps other ballots hidden.

## Acceptance criteria

- Each player can identify their private role and next action.
- Vote progress is visible while vote choices remain hidden until reveal.
- Result explains who won and why in Thai and English.
- Existing role privacy and timer behavior remain unchanged.

## Engagement polish

- Use Framer Motion for a private role-card reveal, phase transitions, and a staged result reveal; keep the role/word visible only to its entitled player.
- At final match victory, use the shared reduced-motion-aware celebration helper once. Keep ordinary vote and score changes calm so the reveal remains meaningful.
