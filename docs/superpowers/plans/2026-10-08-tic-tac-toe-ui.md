# Tic-Tac-Toe Modes UI Implementation Plan

**Goal:** Give Classic, Gobbler, and Ultimate a shared visual foundation while making each mode’s strategic rule obvious at the board.

**Architecture:** Keep the mode selector and current per-mode services. Improve each view independently and reuse board-status primitives only where they fit.

**Tech Stack:** Next.js client components, Tailwind CSS, Framer Motion, Lucide React, th/en dictionaries, Playwright.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/tic-tac-toe/TicTacToeView.tsx
- apps/web/src/components/games/tic-tac-toe/TicTacToeUnifiedView.tsx
- apps/web/src/components/games/tic-tac-toe/TicTacToeModeSelector.tsx
- apps/web/src/components/games/tic-tac-toe/TicTacToeRules.tsx
- apps/web/src/components/games/tic-tac-toe/TicTacToeBotSettings.tsx
- apps/web/src/components/games/gobbler/GobblerView.tsx
- apps/web/src/components/games/gobbler/GobblerRules.tsx
- apps/web/src/components/games/ultimate-tic-tac-toe/UltimateTicTacToeView.tsx
- apps/web/src/components/games/ultimate-tic-tac-toe/UltimateTicTacToeRules.tsx
- apps/web/src/i18n/dictionaries/schema.ts, th.ts, and en.ts
- apps/web/e2e/tictactoe.spec.ts, tictactoe-bot.spec.ts, gobbler.spec.ts, and ultimatetictactoe.spec.ts

## Tasks

- [ ] Classic: enlarge board hit targets, clarify X/O turn ownership, show bot thinking/difficulty, and celebrate the winning line or draw.
- [ ] Gobbler: show remaining piece sizes, distinguish legal targets, and animate a gobble/reveal without hiding the piece underneath.
- [ ] Ultimate: emphasize the forced sub-board, mark closed boards and free-move options, and add a mobile-friendly board focus treatment.
- [ ] Keep mode selection in the lobby and explain each mode’s core rule in one short localized sentence.
- [ ] Unify turn/result typography and color meaning while preserving each mode’s board layout.
- [ ] Add E2E assertions for legal target feedback, active sub-board, mode-specific result, and bot turn; run the four listed specs and typecheck.

## Acceptance criteria

- Every legal board cell is easy to tap at phone width, without horizontal page scrolling.
- Classic, Gobbler, and Ultimate communicate their distinct rule before the first move.
- Win, draw, and bot outcomes are explicit.
- Gobbler shows the underlying piece after a gobble; Ultimate marks the forced next board.

## Engagement polish

- Use Framer Motion for a quick mark placement, the winning-line draw/highlight, Gobbler piece lift/reveal, and Ultimate forced-board focus. Keep board input immediate and never delay a legal move for an animation.
- Use the shared confetti helper only for a completed match win; support draw and bot outcomes with clear result styling instead of treating them as wins.
