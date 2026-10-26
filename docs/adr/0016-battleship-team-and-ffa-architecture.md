# 0016. Battleship Team and Free-For-All Architecture

Status: Accepted
Date: 2026-10-26

## Context

The hub needs a naval strategy game based on the classic Battleship (identity: `GameType.BATTLESHIP`, Thai/English display names: ยุทธการเรือรบ / Battleship) supporting both Team play (เล่นเป็นทีม) and Free-for-All (เล่นแบบพบกันทั้งหมด) across mobile web devices.

Key architectural challenges:

- Multi-player scaling: Classic Battleship is strictly 2 players (1v1). Scaling to teams and 3–8 player free-for-all requires distinct grid ownership, targeting, and turn pacing models.
- Board privacy: Ship coordinates are strictly confidential to the ship's owner (or team). Revealing coordinates publicly or leaking them via unredacted room state would break game integrity.
- Turn latency: Sequential single-shot turns scale poorly in party settings (e.g., 6 players waiting 5 turns between actions).

## Decision

1. **Game Identity & Modes (`GameType.BATTLESHIP`)**:
   - `FREE_FOR_ALL`: 2–8 players, Naval Battle Royale. Each player commands an individual ocean grid and targets other living players; last standing player wins.
   - `TEAM_VS_TEAM`: 2 teams (Red vs Blue). The host configures the fleet architecture via `BattleshipTeamFleetMode`:
     - `SHARED_BOARD`: Each team shares 1 ocean grid and 1 fleet.
     - `MULTI_BOARD`: Each player has an individual ocean grid; a team loses when all its members' fleets are sunk.

2. **Turn Cadence (`BattleshipTurnCadence`)**:
   - Sequential turns for 1v1 and `TEAM_VS_TEAM` (players rotate turns within team).
   - `SIMULTANEOUS_VOLLEY` for `FREE_FOR_ALL` (all living players select target player + coordinate within a countdown window, e.g. 20s; shots resolve simultaneously).

3. **Grid Presets & Fleet Composition (`BattleshipGridPreset`)**:
   - `CLASSIC_10x10`: 10x10 grid, 5 ships (Carrier: 5, Battleship: 4, Cruiser: 3, Submarine: 3, Destroyer: 2). Total 17 cells. Default preset.
   - `QUICK_8x8`: 8x8 grid, 4 ships (Battleship: 4, Cruiser: 3, Submarine: 3, Destroyer: 2). Total 12 cells for fast mobile sessions.
   - **Placement Constraint**: Classic Milton Bradley rules — ships cannot overlap and must stay within grid boundaries, but adjacent touching (side-by-side or end-to-end) is permitted.

4. **Hit Streak (`hitStreakEnabled`)**:
   - Host-configurable toggle for sequential turns (default: ON). If a shot hits, the firing player shoots again until a miss. Disabled in `SIMULTANEOUS_VOLLEY`.

5. **Ship Placement Phase (`BattleshipPhase.PLACEMENT`)**:
   - Mobile-friendly drag & drop placement with rotation and an "Auto-Randomize" button.
   - In `SHARED_BOARD`, teammates collaboratively place and rotate ships in real time.
   - On placement timeout (45s), deterministic auto-placement safely places any remaining ships.

6. **Targeting & Communication**:
   - In `SHARED_BOARD`, teammates can tap the enemy target grid to place real-time **Pings (recommendation markers)** visible to the shooting teammate.
   - In Multi-Board / FFA, UI provides a **Player Carousel / Tab Bar** displaying opponent avatars, remaining health/ships, and switching their Target Grid with one tap.

7. **Mid-Air Shell Collision (กระสุนชนกันกลางอากาศ)**:
   - In `SIMULTANEOUS_VOLLEY`, if two or more players target the identical coordinate on the same victim during the same round, their shells collide mid-air! Neither shell reaches the target, dealing zero damage to the target grid and showing a special mid-air collision animation.

8. **Revelation & Ghost View**:
   - When a ship sinks, its full class name is publicly announced (e.g., "Red Team's Carrier was sunk!").
   - Target Grids in FFA are public, enabling tactical deductions across players.
   - Eliminated players enter **Strict Ghost View**: they see public target grids and phase progression, but NEVER unrevealed opponent ships, maintaining physical room privacy.
   - Scoring: +1 point per winning team member, +1 point for last surviving player in FFA.

9. **Turn Timeout & Disconnect Handling**:
   - On shot timeout (or disconnected player during their turn in sequential mode), the server executes an auto-fire at a random unshot coordinate.
   - In `SHARED_BOARD`, if the current shooter disconnects, the shooting turn advances immediately to the next connected teammate.

10. **End Game Summary & Full Reveal**:
    - The result screen reveals all actual ship positions across all ocean grids alongside battle statistics (accuracy %, ships sunk, damage taken).

## Consequences

- Secret ship coordinates must reside exclusively within the private-state store (`PrivateStateService`) or room-level team private store, projected only to the owning player or team members.
- Public broadcast `BattleshipState` contains only public target grids (hits, misses, shell collisions), turn phase, timers, and sunk announcements.
- Front-end needs:
  - Mobile touch-optimized drag-and-drop / tap-to-place board editor with orientation toggle.
  - Multi-opponent carousel with quick-target selection.
  - Real-time teammate ping overlay.
  - Animations for Hit, Miss, Sunk, and Mid-air Shell Collision.
