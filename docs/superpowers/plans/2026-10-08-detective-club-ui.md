# Detective Club UI Implementation Plan

**Goal:** Make clue giving, card selection, discussion, voting, and role scoring feel like one visual story.

**Architecture:** Keep phase components split by responsibility and preserve the card catalog and private role/word state.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/detective-club/DetectiveClubView.tsx
- phases/SetupPhase.tsx, PlayingPhase.tsx, DiscussionPhase.tsx, VotingPhase.tsx, ScoringPhase.tsx
- CardViewerModal.tsx
- DetectiveClubRules.tsx
- dictionaries
- apps/web/e2e/detectiveclub.spec.ts

## Tasks

- [ ] Show round, informer, storyteller, and phase progression without revealing the conspirator early.
- [ ] Improve card hand/gallery so images can be inspected and selected reliably on mobile.
- [ ] Clarify which word/clue is public and what the active storyteller must do.
- [ ] Show vote completion progress while keeping ballots sealed until resolution.
- [ ] Stage scoring to reveal roles, votes, score deltas, and next-round action.
- [ ] Extend E2E for card choice, phase transitions, private clue handling, scoring; run detectiveclub.spec.ts and typecheck.

## Acceptance criteria

- Current storyteller and phase are immediately identifiable.
- Card images are inspectable and tappable on narrow screens.
- Conspirator identity remains hidden until scoring.
- Score changes are attributable to the round outcome.

## Engagement polish

- Use Framer Motion for card selection/inspection and a deliberate scoring reveal: expose roles and vote/score changes in steps only after voting is complete.
- Prefer the narrative scoring reveal over frequent confetti; use a restrained final-winner treatment only if the result has a single clear winner.
