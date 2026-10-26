# ยุทธการเรือรบ — Battleship

A real-time naval strategy game for 2–8 players, supporting Team vs Team and Free-for-all Battle Royale modes. `BATTLESHIP` is its internal game identity; localized display names are ยุทธการเรือรบ / Battleship (see [ADR 0016](../adr/0016-battleship-team-and-ffa-architecture.md)).

## Gameplay Modes

1. **Free-For-All (พบกันทั้งหมด / Battle Royale):**
   - 2 to 8 players. Each player commands an individual ocean grid.
   - Paced via **Simultaneous Volleys**: all living players select their target opponent and target coordinate within a countdown window (default: 20 seconds).
   - **💥 Mid-Air Shell Collision (กระสุนชนกันกลางอากาศ):** If 2 or more players fire at the exact same coordinate on the same victim during the same volley, their shells collide mid-air and explode! Neither shell damages the victim's grid.
   - Last surviving naval commander wins the match.

2. **Team vs Team (เล่นเป็นทีม):**
   - 2 Teams (Red Team vs Blue Team).
   - Host chooses fleet architecture in the lobby:
     - **Shared Board (`SHARED_BOARD`):** Each team shares 1 ocean grid and 1 fleet. Teammates collaboratively place ships in placement phase. During attack turns, members alternate firing with real-time **Teammate Pings** (ชี้เป้าแนะนำพิกัด).
     - **Multi-Board (`MULTI_BOARD`):** Each player commands an individual ocean grid. A team is eliminated when all its members' fleets are destroyed.
   - Sequential turns with configurable **Hit Streak** (bonus shot awarded upon scoring a hit).

## Fleet Configurations

- **Classic 10×10 (`CLASSIC_10x10`):** Standard 5-ship fleet totaling 17 cells:
  - Carrier (5 cells)
  - Battleship (4 cells)
  - Cruiser (3 cells)
  - Submarine (3 cells)
  - Destroyer (2 cells)
- **Quick 8×8 (`QUICK_8x8`):** Fast 4-ship fleet totaling 12 cells for 3–5 minute mobile rounds:
  - Battleship (4 cells)
  - Cruiser (3 cells)
  - Submarine (3 cells)
  - Destroyer (2 cells)

## Rules & Constraints

- **Placement Constraints:** Classic Milton Bradley rules. Ships cannot overlap and must stay within the grid boundaries, but ships are allowed to touch each other along edges or ends.
- **Auto-Placement Fallback:** Placement phase has a 45-second timer. If any player or team has not completed placement, unplaced ships are deterministically positioned at random.
- **Target Grids:** Publicly visible in FFA and team modes. Hits (`HIT`), misses (`MISS`), and sunk ships (`SUNK`) are broadcast.
- **Strict Ghost View:** Eliminated players may view public grids and phase progression, but NEVER unrevealed opponent ships, preserving physical room privacy in face-to-face sessions.
- **Full Ocean Reveal:** When the game ends, the result screen reveals all actual ship positions for every player/team alongside comprehensive Battle Stats (accuracy %, shots fired, hits, misses, collisions).

## Implementation Boundaries

- Shared types: `packages/types/src/battleship.ts`.
- Backend service: `apps/api/src/games/battleship/battleship.service.ts`.
- Private state key: `BATTLESHIP_PRIVATE_OCEAN_KEY` (`'battleshipOceanGrid'`), managed via `PrivateStateService`.
- Timers: Handled via `RoomTimerService` (`syncBattleshipTimer`).
- Frontend view: `apps/web/src/components/games/battleship/BattleshipView.tsx`.
- Rules modal: `apps/web/src/components/games/battleship/BattleshipRules.tsx`.
- Settings: `apps/web/src/components/games/battleship/BattleshipSettings.tsx`.
