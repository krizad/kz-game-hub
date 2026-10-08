# Shared Game UI Implementation Plan

> Implement one game or one task batch at a time; consult the linked per-game plan before changing a game view.

**Goal:** Make the shared play surface consistently explain phase, turn ownership, next action, and progress across every game.

**Architecture:** Keep a thin shared status component driven by public room/game state and per-game copy. Game-specific boards, hands, roles, and actions stay in their existing views. Do not add API fields or events for presentation-only improvements.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, useGameStore, th/en dictionaries, Playwright E2E.

## Engagement and feedback

- Use the installed Framer Motion for consistent enter/exit, turn, selection, and result transitions; centralize shared transition conventions instead of adding another general animation package.
- Respect the device reduced-motion preference globally. Preserve state changes with immediate content updates, clear labels, and non-moving highlights.
- Add a shared, dynamically loaded `canvas-confetti` celebration helper for eligible game-finished states. Trigger once per finished match, never for every round/score update, and disable it for reduced-motion users.
- Keep sound optional and routed through the existing sound settings/system. Do not make timing-critical cues sound-only.

## Global constraints

- Preserve server-authoritative game state and private-state boundaries.
- Keep both dictionaries synchronized.
- Preserve the warm board-game palette and each game’s accent color.
- Maintain responsive layouts, keyboard focus visibility, and reduced-motion behavior.

## Current baseline

- GameStatusHeader is mounted by GameViewManager for active rooms.
- It currently derives phase, a subset of active players, and public progress from existing RoomState fields.
- It uses a generic instruction for group phases; per-game next-action guidance is the primary remaining shared improvement.

## Files

- apps/web/src/components/games/GameStatusHeader.tsx — shared phase, turn, prompt, and progress display.
- apps/web/src/components/lobby/GameViewManager.tsx — public-state projection and header placement.
- apps/web/src/i18n/dictionaries/schema.ts — shared copy shape.
- apps/web/src/i18n/dictionaries/th.ts and en.ts — localized labels and prompts.
- apps/web/e2e — extend the existing game flow specs where shared state is not covered.

## Tasks

- [ ] Audit every GameType against RoomState and note whether phase, actor, group action, and progress exist.
- [ ] Replace the generic group prompt with short Thai/English per-game prompts that match the controls shown in that phase.
- [ ] Show a named active player only when the phase has a single actor; use collective status for simultaneous, voting, and cooperative phases.
- [ ] Add stable loading/unknown-state fallbacks so missing state never exposes raw enum identifiers or untranslated keys.
- [ ] Check small screens, long Thai labels, keyboard focus, screen-reader status announcements, and prefers-reduced-motion.
- [ ] Define reusable Motion transition patterns for phase changes, selections, and results; ensure reduced-motion alternatives remain clear.
- [ ] Add a client-only, lazy-loaded win celebration helper with a reduced-motion opt-out and a guard against duplicate firing.
- [ ] Update relevant Playwright flows and run the focused game specs plus web typecheck.

## Acceptance criteria

- All 13 GameTypes have an explicit projection rule and understandable localized phase label.
- The header never names a player as active when all players may act together.
- The prompt matches the phase and visible controls; waiting players are not told to act.
- Progress appears only when public state has a meaningful numerator and denominator.
- No server types, socket protocol, or game rules change.
