# Saboteur UI Implementation Plan

**Goal:** Make path building, hidden-role bluffing, tool damage, gold selection, and results readable on desktop/mobile.

**Architecture:** Preserve private role delivery and server-authoritative board/card state. Keep tile rendering in PathTileSvg.

**Tech Stack:** Next.js client components, React, Tailwind CSS, Framer Motion, th/en dictionaries, existing Playwright E2E flows.

## Global constraints

- Keep server-authoritative state and the existing socket protocol; do not change game mechanics or scoring.
- Keep private roles, words, hands, and unrevealed choices out of public UI and room broadcasts.
- Keep Thai and English copy aligned; verify layouts at mobile width.
- Extend the existing game E2E flow for new or changed interactions and run the focused spec plus web typecheck.

## Files

- apps/web/src/components/games/saboteur/SaboteurView.tsx
- PathTileSvg.tsx
- SaboteurRules.tsx
- SaboteurSettings.tsx
- dictionaries
- apps/web/e2e/saboteur.spec.ts

## Tasks

- [ ] Give the maze a responsive board viewport with clear start, hidden goals, placed path, current player, latest move.
- [ ] Add mobile tile inspect/zoom without requiring drag/drop.
- [ ] Make hand readable and explain legal path/action cards; show broken tools and repair targets next to action.
- [ ] Keep role and goal private until reveal; make role-specific instructions concise.
- [ ] Stage round-end, gold-pick, final ranking with winning role, picks, score changes.
- [ ] Extend E2E for path, tool break/repair, map/rockfall, gold pick, final result; run saboteur.spec.ts and typecheck.

## Acceptance criteria

- Paths and card connections can be inspected on small screens.
- Active player knows legal moves and why a tool is unavailable.
- Hidden goals/roles remain concealed until server-authorized reveal.
- Gold allocation and final scores are understandable without the event log.

## Engagement polish

- Keep the current SVG board and use Framer Motion for legal tile placement, tool damage/repair feedback, and the gold/role reveal after the round. Do not move hidden goal information into public UI.
- Prefer a clear final result panel over repeated confetti during the gold-pick sequence; use the shared celebration only after a final game winner is established.
