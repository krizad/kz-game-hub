# Result Reveal Implementation Plan

**Goal:** Give every game a paced ending, with synchronized self-reveal in role games and a clear winner after the evidence.

**Architecture:** Shared types identify eligible result phases and timing. GamesService owns a small presentation record in room memory; GamesGateway broadcasts it through the existing room listener. A shared frontend boundary shows game-specific reveal cards before mounting the existing result view.

**Tech Stack:** TypeScript, NestJS/Socket.io, React, Framer Motion, Zustand, Jest, Playwright.

## Constraints

- Use stable UserState.id in presentation state, supporting reconnection without new socket remaps.
- Keep private hands and roles private until the existing game service has made them public.
- Preserve Poker show/muck and The Mind level replay.
- Update shared event constants, gateway, service and store together.
- No DB mutations; temporary scripts belong in ignored tmp-script/.

## Tasks

- [x] Add shared result phase plans and progress calculation in packages/types/src/result-reveal.ts; export the types and add RoomState.resultReveal and RESULT_REVEAL_ACTION.
- [x] Add server synchronization and permission-checked REVEAL/SKIP actions. Initialize the timeline before public room projection. Test phase coverage, elapsed-time fallback, stale requests, owner/host authorization and stable IDs.
- [x] Add localized presentation cards using public game state, then a responsive animated sequence. Show only revealed steps; expose the current participant's reveal button and the host's shared skip. Mount ordinary game results after the winner beat; retain Music Trivia's mounted playback subtree.
- [x] Connect the boundary in GameViewManager and the action in useGameStore. Keep scores and status prompts from spoiling the ending during the sequence.
- [x] Rebuild shared types, run all API tests and both TypeScript checks; run pnpm dev and browser E2E checks for actual result sequences; update graphify and review the diff.
