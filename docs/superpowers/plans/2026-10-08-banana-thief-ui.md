# Banana Thief UI Implementation Plan

**Goal:** Make the night-clock party game legible and tense while protecting secret roles and votes.

**Architecture:** Keep RoleArtwork and private state. Drive UI from existing public phase/timer/vote state and each player’s own private information.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/banana-thief/BananaThiefView.tsx
- RoleArtwork.tsx
- BananaThiefRules.tsx
- BananaThiefSettings.tsx
- dictionaries
- apps/web/e2e/banana-thief.spec.ts

## Tasks

- [ ] Present role card and setup readiness as private first actions; show only each player’s entitled role.
- [ ] Make clock/night timeline and wake/sleep action unmistakable, including time remaining and personal wake result.
- [ ] Clarify follower selection, discussion, sealed voting, and result with phase-specific prompts and vote progress.
- [ ] Give thief, mouse, follower, and special roles distinct localized instructions without leaking others’ roles.
- [ ] At reveal, explain thief/caught player, winning team, role effects, score, and next-round action.
- [ ] Check timer cleanup/reconnect UI; extend E2E for base and special-role configurations; run banana-thief.spec.ts and typecheck.

## Acceptance criteria

- Private roles, die values, and unrevealed ballots are never shown to other players.
- Every timed phase shows whether the local player acts or waits.
- Vote progress reveals only ballot count.
- Result explains why mice, thief, or scapegoat won.

## Engagement polish

- Use Framer Motion for the clock/night sequence, wake/sleep feedback, and the authorized role/result reveal.
- Consider Rive for a small thief/mouse character that reacts to existing public phases and final results, but only if a purpose-made character asset is available. Lazy-load it, provide a static artwork fallback, and do not let the animation carry private role information.
- Keep existing optional sound effects. A final winner can use the shared celebration helper, with reduced motion respected.
