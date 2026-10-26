import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  RoomState,
  RoomStatus,
  UserState,
  RoomConfig,
  BattleshipState,
  BattleshipMode,
  BattleshipTeam,
  BattleshipTeamFleetMode,
  BattleshipGridPreset,
  BattleshipPhase,
  BattleshipPlaceShipsPayload,
  BattleshipFirePayload,
  BattleshipPingPayload,
  BattleshipVolleyResult,
  BattleshipPlayerStats,
  ShipPlacement,
  ShipType,
  ShipConfig,
  CellStatus,
  TeammatePing,
  CLASSIC_10x10_FLEET,
  QUICK_8x8_FLEET,
  BATTLESHIP_DEFAULT_TURN_SECONDS,
  BATTLESHIP_PLACEMENT_SECONDS,
  BATTLESHIP_PRIVATE_OCEAN_KEY,
  BATTLESHIP_MIN_PLAYERS,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';

export type BattleshipOutcome =
  | { room: RoomState; error?: undefined }
  | { room?: undefined; error: string };

interface PendingShot {
  shooterId: string;
  shooterName: string;
  targetId: string;
  x: number;
  y: number;
}

@Injectable()
export class BattleshipService {
  private readonly logger = new Logger(BattleshipService.name);

  /** roomCode -> Map of socketId -> PendingShot for FFA Simultaneous Volley */
  private readonly pendingShots = new Map<string, Map<string, PendingShot>>();

  constructor(private readonly privateState: PrivateStateService) {}

  // --- Initializers & Helpers ---

  getFleetConfig(preset: BattleshipGridPreset): ShipConfig[] {
    return preset === 'CLASSIC_10x10' ? CLASSIC_10x10_FLEET : QUICK_8x8_FLEET;
  }

  getGridSize(preset: BattleshipGridPreset): number {
    return preset === 'CLASSIC_10x10' ? 10 : 8;
  }

  initLobby(room: RoomState): void {
    room.config.battleshipMode ??= 'FREE_FOR_ALL';
    room.config.battleshipTeamFleetMode ??= 'SHARED_BOARD';
    room.config.battleshipGridPreset ??= 'CLASSIC_10x10';
    room.config.battleshipHitStreak ??= true;
    room.config.battleshipTurnSeconds ??= BATTLESHIP_DEFAULT_TURN_SECONDS;
  }

  createInitialState(players: UserState[], config?: RoomConfig): BattleshipState {
    const mode: BattleshipMode = config?.battleshipMode ?? 'FREE_FOR_ALL';
    const teamFleetMode: BattleshipTeamFleetMode =
      config?.battleshipTeamFleetMode ?? 'SHARED_BOARD';
    const gridPreset: BattleshipGridPreset = config?.battleshipGridPreset ?? 'CLASSIC_10x10';
    const gridSize = this.getGridSize(gridPreset);
    const hitStreakEnabled =
      mode === 'FREE_FOR_ALL' ? false : (config?.battleshipHitStreak ?? true);

    const activePlayers = players.filter((p) => !p.isViewer && p.connected !== false);
    const alivePlayerIds = activePlayers.map((p) => p.socketId);

    // Assign teams if TEAM_VS_TEAM
    const teams: Record<string, BattleshipTeam> = {};
    if (mode === 'TEAM_VS_TEAM') {
      activePlayers.forEach((p, idx) => {
        teams[p.socketId] = idx % 2 === 0 ? 'RED' : 'BLUE';
      });
    }

    const targetGrids: Record<string, Record<string, CellStatus>> = {};
    const shipsRemaining: Record<string, number> = {};
    const sunkShips: Record<string, ShipType[]> = {};
    const placementReady: Record<string, boolean> = {};
    const battleStats: Record<string, BattleshipPlayerStats> = {};

    const fleetCount = this.getFleetConfig(gridPreset).length;

    if (mode === 'TEAM_VS_TEAM' && teamFleetMode === 'SHARED_BOARD') {
      ['RED', 'BLUE'].forEach((teamKey) => {
        targetGrids[teamKey] = {};
        shipsRemaining[teamKey] = fleetCount;
        sunkShips[teamKey] = [];
        placementReady[teamKey] = false;
      });
    } else {
      alivePlayerIds.forEach((socketId) => {
        targetGrids[socketId] = {};
        shipsRemaining[socketId] = fleetCount;
        sunkShips[socketId] = [];
        placementReady[socketId] = false;
      });
    }

    alivePlayerIds.forEach((socketId) => {
      battleStats[socketId] = {
        shotsFired: 0,
        hits: 0,
        misses: 0,
        shipsSunk: 0,
        collisions: 0,
        accuracy: 0,
      };
    });

    return {
      mode,
      teamFleetMode,
      gridPreset,
      gridSize,
      phase: 'PLACEMENT',
      round: 1,
      teams,
      turnPlayerId: null,
      currentTurnTeam: null,
      turnDeadline: Date.now() + BATTLESHIP_PLACEMENT_SECONDS * 1000,
      hitStreakEnabled,
      consecutiveHits: 0,
      targetGrids,
      shipsRemaining,
      sunkShips,
      alivePlayerIds,
      placementReady,
      pings: { RED: [], BLUE: [] },
      lastVolleyResults: [],
      winner: null,
      battleStats,
    };
  }

  // --- Random Ship Placement ---

  generateRandomShipPlacement(gridSize: number, preset: BattleshipGridPreset): ShipPlacement[] {
    const fleet = this.getFleetConfig(preset);
    const placements: ShipPlacement[] = [];
    const occupied = new Set<string>();

    for (const ship of fleet) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        attempts++;
        const orientation = Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL';
        const maxX = orientation === 'HORIZONTAL' ? gridSize - ship.length : gridSize - 1;
        const maxY = orientation === 'VERTICAL' ? gridSize - ship.length : gridSize - 1;

        const startX = Math.floor(Math.random() * (maxX + 1));
        const startY = Math.floor(Math.random() * (maxY + 1));

        const coords: { x: number; y: number }[] = [];
        let collision = false;

        for (let i = 0; i < ship.length; i++) {
          const cx = orientation === 'HORIZONTAL' ? startX + i : startX;
          const cy = orientation === 'VERTICAL' ? startY + i : startY;
          if (occupied.has(`${cx},${cy}`)) {
            collision = true;
            break;
          }
          coords.push({ x: cx, y: cy });
        }

        if (!collision) {
          coords.forEach((c) => occupied.add(`${c.x},${c.y}`));
          placements.push({
            id: randomUUID(),
            type: ship.type,
            x: startX,
            y: startY,
            orientation,
            length: ship.length,
            hits: 0,
            sunk: false,
          });
          placed = true;
        }
      }

      if (!placed) {
        // Fallback: place sequentially
        for (let y = 0; y < gridSize && !placed; y++) {
          for (let x = 0; x <= gridSize - ship.length && !placed; x++) {
            let coll = false;
            for (let i = 0; i < ship.length; i++) {
              if (occupied.has(`${x + i},${y}`)) {
                coll = true;
                break;
              }
            }
            if (!coll) {
              for (let i = 0; i < ship.length; i++) occupied.add(`${x + i},${y}`);
              placements.push({
                id: randomUUID(),
                type: ship.type,
                x,
                y,
                orientation: 'HORIZONTAL',
                length: ship.length,
                hits: 0,
                sunk: false,
              });
              placed = true;
            }
          }
        }
      }
    }

    return placements;
  }

  // --- Start Game ---

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId && room.hostPlayerId !== requesterId) {
      return null;
    }

    const activePlayers = room.players.filter((p) => !p.isViewer && p.connected !== false);
    if (activePlayers.length < BATTLESHIP_MIN_PLAYERS) {
      return null;
    }

    this.pendingShots.delete(room.code);
    this.privateState.clearRoom(room.code);

    room.status = RoomStatus.PLAYING;
    room.battleshipState = this.createInitialState(room.players, room.config);

    return room;
  }

  // --- Place Ships ---

  placeShips(
    room: RoomState,
    socketId: string,
    payload: BattleshipPlaceShipsPayload,
  ): BattleshipOutcome {
    const state = room.battleshipState;
    if (!state || state.phase !== 'PLACEMENT') {
      return { error: 'Game is not in placement phase' };
    }

    const targetId = this.resolveTargetId(state, socketId);
    if (!targetId) {
      return { error: 'Player does not have a placement target' };
    }

    const validation = this.validatePlacements(payload.ships, state.gridSize, state.gridPreset);
    if (!validation.valid) {
      return { error: validation.error || 'Invalid ship placement' };
    }

    // Save secret ships into private state
    this.saveOceanGrid(room.code, state, targetId, payload.ships);
    state.placementReady[targetId] = true;

    // Check if all are ready
    const allReady = Object.keys(state.targetGrids).every((tid) => state.placementReady[tid]);

    if (allReady) {
      this.transitionToPlaying(room);
    }

    return { room };
  }

  private validatePlacements(
    ships: ShipPlacement[],
    gridSize: number,
    preset: BattleshipGridPreset,
  ): { valid: boolean; error?: string } {
    const expectedFleet = this.getFleetConfig(preset);
    if (ships.length !== expectedFleet.length) {
      return { valid: false, error: `Expected ${expectedFleet.length} ships, got ${ships.length}` };
    }

    const occupied = new Set<string>();

    for (const ship of ships) {
      const match = expectedFleet.find((f) => f.type === ship.type && f.length === ship.length);
      if (!match) {
        return { valid: false, error: `Invalid ship type or length: ${ship.type}` };
      }

      for (let i = 0; i < ship.length; i++) {
        const x = ship.orientation === 'HORIZONTAL' ? ship.x + i : ship.x;
        const y = ship.orientation === 'VERTICAL' ? ship.y + i : ship.y;

        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
          return { valid: false, error: `Ship ${ship.type} is out of bounds at (${x},${y})` };
        }

        const key = `${x},${y}`;
        if (occupied.has(key)) {
          return { valid: false, error: `Ships overlap at coordinate (${x},${y})` };
        }
        occupied.add(key);
      }
    }

    return { valid: true };
  }

  private saveOceanGrid(
    roomCode: string,
    state: BattleshipState,
    targetId: string,
    ships: ShipPlacement[],
  ): void {
    if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
      // Save for each team member
      const teamPlayers = Object.entries(state.teams)
        .filter(([, t]) => t === targetId)
        .map(([sid]) => sid);

      teamPlayers.forEach((sid) => {
        this.privateState.set(roomCode, sid, BATTLESHIP_PRIVATE_OCEAN_KEY, {
          targetId,
          ships,
          gridSize: state.gridSize,
        });
      });
      // Also store at room level under team key
      this.privateState.set(roomCode, `__team_${targetId}__`, BATTLESHIP_PRIVATE_OCEAN_KEY, {
        targetId,
        ships,
        gridSize: state.gridSize,
      });
    } else {
      this.privateState.set(roomCode, targetId, BATTLESHIP_PRIVATE_OCEAN_KEY, {
        targetId,
        ships,
        gridSize: state.gridSize,
      });
    }
  }

  private getOceanGrid(
    roomCode: string,
    state: BattleshipState,
    targetId: string,
  ): ShipPlacement[] | undefined {
    if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
      const stored = this.privateState.get<{ ships: ShipPlacement[] }>(
        roomCode,
        `__team_${targetId}__`,
        BATTLESHIP_PRIVATE_OCEAN_KEY,
      );
      return stored?.ships;
    }
    const stored = this.privateState.get<{ ships: ShipPlacement[] }>(
      roomCode,
      targetId,
      BATTLESHIP_PRIVATE_OCEAN_KEY,
    );
    return stored?.ships;
  }

  private transitionToPlaying(room: RoomState): void {
    const state = room.battleshipState!;
    state.phase = 'PLAYING';
    state.round = 1;
    const turnSeconds = room.config.battleshipTurnSeconds || BATTLESHIP_DEFAULT_TURN_SECONDS;
    state.turnDeadline = Date.now() + turnSeconds * 1000;

    if (state.mode === 'FREE_FOR_ALL') {
      state.turnPlayerId = null;
      state.currentTurnTeam = null;
    } else {
      // Sequential: Pick first RED player
      const redPlayers = Object.entries(state.teams)
        .filter(([, t]) => t === 'RED')
        .map(([sid]) => sid)
        .filter((sid) => state.alivePlayerIds.includes(sid));

      state.currentTurnTeam = 'RED';
      state.turnPlayerId = redPlayers[0] || state.alivePlayerIds[0];
    }
  }

  // --- Fire Shot ---

  fireShot(room: RoomState, socketId: string, payload: BattleshipFirePayload): BattleshipOutcome {
    const state = room.battleshipState;
    if (!state || state.phase !== 'PLAYING') {
      return { error: 'Game is not in playing phase' };
    }

    if (!state.alivePlayerIds.includes(socketId)) {
      return { error: 'Eliminated players cannot fire' };
    }

    // Coordinate validation
    const { x, y, targetId } = payload;
    if (x < 0 || x >= state.gridSize || y < 0 || y >= state.gridSize) {
      return { error: 'Target coordinate out of bounds' };
    }

    const shooterTeam = state.teams[socketId];
    if (state.mode === 'TEAM_VS_TEAM') {
      if (state.teamFleetMode === 'SHARED_BOARD') {
        const opposingTeam = shooterTeam === 'RED' ? 'BLUE' : 'RED';
        if (targetId !== opposingTeam) {
          return { error: 'Must target opposing team in shared board mode' };
        }
      } else {
        const targetTeam = state.teams[targetId];
        if (targetTeam === shooterTeam) {
          return { error: 'Cannot fire at teammates' };
        }
        if (!state.alivePlayerIds.includes(targetId)) {
          return { error: 'Target player is already eliminated' };
        }
      }
    } else {
      // FFA
      if (targetId === socketId) {
        return { error: 'Cannot fire at yourself' };
      }
      if (!state.alivePlayerIds.includes(targetId)) {
        return { error: 'Target player is already eliminated' };
      }
    }

    // Check if cell was already targeted on that target's board
    const coordKey = `${x},${y}`;
    const targetBoard = state.targetGrids[targetId];
    if (targetBoard && targetBoard[coordKey]) {
      return { error: 'Coordinate has already been fired upon' };
    }

    const shooter = room.players.find((p) => p.socketId === socketId);
    const shooterName = shooter?.name || 'Unknown';

    if (state.mode === 'FREE_FOR_ALL') {
      // Simultaneous Volley mode: Buffer the shot
      let roomPending = this.pendingShots.get(room.code);
      if (!roomPending) {
        roomPending = new Map();
        this.pendingShots.set(room.code, roomPending);
      }

      roomPending.set(socketId, {
        shooterId: socketId,
        shooterName,
        targetId,
        x,
        y,
      });

      // If all living players have submitted, resolve the volley immediately!
      if (roomPending.size >= state.alivePlayerIds.length) {
        this.resolveSimultaneousVolley(room);
      }

      return { room };
    }

    // Sequential mode (1v1 or TEAM_VS_TEAM)
    if (state.turnPlayerId !== socketId) {
      return { error: 'Not your turn to fire' };
    }

    const targetShips = this.getOceanGrid(room.code, state, targetId);
    if (!targetShips) {
      return { error: 'Target ocean grid not found' };
    }

    const hitShip = this.checkHit(targetShips, x, y);
    const targetName = this.resolveTargetName(room, state, targetId);

    const stats = state.battleStats[socketId];
    if (stats) stats.shotsFired++;

    if (hitShip) {
      hitShip.hits++;
      state.consecutiveHits++;
      if (stats) stats.hits++;

      let result: 'HIT' | 'SUNK' = 'HIT';
      let sunkShipType: ShipType | undefined;

      if (hitShip.hits >= hitShip.length) {
        hitShip.sunk = true;
        result = 'SUNK';
        sunkShipType = hitShip.type;
        state.shipsRemaining[targetId]--;
        state.sunkShips[targetId].push(hitShip.type);
        if (stats) stats.shipsSunk++;

        // Mark all coordinates of this ship as SUNK
        for (let i = 0; i < hitShip.length; i++) {
          const sx = hitShip.orientation === 'HORIZONTAL' ? hitShip.x + i : hitShip.x;
          const sy = hitShip.orientation === 'VERTICAL' ? hitShip.y + i : hitShip.y;
          targetBoard[`${sx},${sy}`] = 'SUNK';
        }
      } else {
        targetBoard[coordKey] = 'HIT';
      }

      state.lastVolleyResults = [
        {
          shooterId: socketId,
          shooterName,
          targetId,
          targetName,
          x,
          y,
          result,
          sunkShipType,
        },
      ];

      // Check win condition
      if (this.checkWinCondition(room, targetId)) {
        return { room };
      }

      // Hit streak rule
      if (state.hitStreakEnabled) {
        // Reset turn deadline for extra shot
        const turnSec = room.config.battleshipTurnSeconds || BATTLESHIP_DEFAULT_TURN_SECONDS;
        state.turnDeadline = Date.now() + turnSec * 1000;
        return { room };
      }
    } else {
      // Miss
      targetBoard[coordKey] = 'MISS';
      state.consecutiveHits = 0;
      if (stats) stats.misses++;

      state.lastVolleyResults = [
        {
          shooterId: socketId,
          shooterName,
          targetId,
          targetName,
          x,
          y,
          result: 'MISS',
        },
      ];
    }

    if (stats && stats.shotsFired > 0) {
      stats.accuracy = Math.round((stats.hits / stats.shotsFired) * 100);
    }

    // Rotate turn to next player
    this.advanceSequentialTurn(room);

    return { room };
  }

  // --- Simultaneous Volley Resolution (FFA) ---

  private resolveSimultaneousVolley(room: RoomState): void {
    const state = room.battleshipState!;
    const roomPending = this.pendingShots.get(room.code) ?? new Map<string, PendingShot>();
    this.pendingShots.delete(room.code);

    const shots = Array.from(roomPending.values());
    const volleyResults: BattleshipVolleyResult[] = [];

    // Group shots by `targetId:x,y` to detect Mid-Air Shell Collisions (Q12)
    const shotsByTargetCell = new Map<string, PendingShot[]>();
    for (const shot of shots) {
      const key = `${shot.targetId}:${shot.x},${shot.y}`;
      const list = shotsByTargetCell.get(key) || [];
      list.push(shot);
      shotsByTargetCell.set(key, list);
    }

    for (const [key, group] of shotsByTargetCell.entries()) {
      const [targetId, coordStr] = key.split(':');
      const [xStr, yStr] = coordStr.split(',');
      const x = Number(xStr);
      const y = Number(yStr);

      const targetBoard = state.targetGrids[targetId] || {};
      const targetName = this.resolveTargetName(room, state, targetId);

      if (group.length > 1) {
        // Mid-Air Shell Collision! Both shells collide in mid-air, 0 damage to target!
        targetBoard[`${x},${y}`] = 'COLLISION';
        for (const shot of group) {
          const stats = state.battleStats[shot.shooterId];
          if (stats) {
            stats.shotsFired++;
            stats.collisions++;
            stats.misses++;
            if (stats.shotsFired > 0) {
              stats.accuracy = Math.round((stats.hits / stats.shotsFired) * 100);
            }
          }
          volleyResults.push({
            shooterId: shot.shooterId,
            shooterName: shot.shooterName,
            targetId,
            targetName,
            x,
            y,
            result: 'COLLISION',
          });
        }
      } else {
        // Single shot -> Evaluate Hit / Miss / Sunk
        const shot = group[0];
        const stats = state.battleStats[shot.shooterId];
        if (stats) stats.shotsFired++;

        const targetShips = this.getOceanGrid(room.code, state, targetId);
        const hitShip = targetShips ? this.checkHit(targetShips, x, y) : undefined;

        if (hitShip) {
          hitShip.hits++;
          if (stats) stats.hits++;

          let result: 'HIT' | 'SUNK' = 'HIT';
          let sunkShipType: ShipType | undefined;

          if (hitShip.hits >= hitShip.length) {
            hitShip.sunk = true;
            result = 'SUNK';
            sunkShipType = hitShip.type;
            state.shipsRemaining[targetId]--;
            state.sunkShips[targetId].push(hitShip.type);
            if (stats) stats.shipsSunk++;

            for (let i = 0; i < hitShip.length; i++) {
              const sx = hitShip.orientation === 'HORIZONTAL' ? hitShip.x + i : hitShip.x;
              const sy = hitShip.orientation === 'VERTICAL' ? hitShip.y + i : hitShip.y;
              targetBoard[`${sx},${sy}`] = 'SUNK';
            }
          } else {
            targetBoard[`${x},${y}`] = 'HIT';
          }

          volleyResults.push({
            shooterId: shot.shooterId,
            shooterName: shot.shooterName,
            targetId,
            targetName,
            x,
            y,
            result,
            sunkShipType,
          });
        } else {
          targetBoard[`${x},${y}`] = 'MISS';
          if (stats) stats.misses++;
          volleyResults.push({
            shooterId: shot.shooterId,
            shooterName: shot.shooterName,
            targetId,
            targetName,
            x,
            y,
            result: 'MISS',
          });
        }

        if (stats && stats.shotsFired > 0) {
          stats.accuracy = Math.round((stats.hits / stats.shotsFired) * 100);
        }
      }
    }

    state.lastVolleyResults = volleyResults;

    // Check eliminations in FFA
    for (const pid of [...state.alivePlayerIds]) {
      if (state.shipsRemaining[pid] <= 0) {
        state.alivePlayerIds = state.alivePlayerIds.filter((id) => id !== pid);
      }
    }

    // Check FFA win condition
    if (state.alivePlayerIds.length <= 1) {
      const winnerId = state.alivePlayerIds[0];
      const winnerPlayer = room.players.find((p) => p.socketId === winnerId);
      this.finishGame(room, {
        mode: 'FREE_FOR_ALL',
        playerId: winnerId,
        playerName: winnerPlayer?.name || 'Champion',
      });
      return;
    }

    // Advance round
    state.round++;
    const turnSeconds = room.config.battleshipTurnSeconds || BATTLESHIP_DEFAULT_TURN_SECONDS;
    state.turnDeadline = Date.now() + turnSeconds * 1000;
  }

  private checkHit(ships: ShipPlacement[], x: number, y: number): ShipPlacement | undefined {
    return ships.find((ship) => {
      for (let i = 0; i < ship.length; i++) {
        const sx = ship.orientation === 'HORIZONTAL' ? ship.x + i : ship.x;
        const sy = ship.orientation === 'VERTICAL' ? ship.y + i : ship.y;
        if (sx === x && sy === y) return true;
      }
      return false;
    });
  }

  private advanceSequentialTurn(room: RoomState): void {
    const state = room.battleshipState!;
    state.consecutiveHits = 0;

    if (state.mode === 'TEAM_VS_TEAM') {
      const nextTeam: BattleshipTeam = state.currentTurnTeam === 'RED' ? 'BLUE' : 'RED';
      state.currentTurnTeam = nextTeam;

      // Find players on the next team
      const teamPlayers = Object.entries(state.teams)
        .filter(([, t]) => t === nextTeam)
        .map(([sid]) => sid)
        .filter((sid) => state.alivePlayerIds.includes(sid));

      if (teamPlayers.length === 0) {
        this.checkWinCondition(room, nextTeam);
        return;
      }

      // Rotate seat within team
      const prevShooter = state.turnPlayerId;
      const prevIdx = prevShooter ? teamPlayers.indexOf(prevShooter) : -1;
      const nextShooter = teamPlayers[(prevIdx + 1) % teamPlayers.length];
      state.turnPlayerId = nextShooter;
    } else {
      // 1v1
      const living = state.alivePlayerIds;
      const currentIdx = living.indexOf(state.turnPlayerId || '');
      state.turnPlayerId = living[(currentIdx + 1) % living.length];
    }

    state.round++;
    const turnSeconds = room.config.battleshipTurnSeconds || BATTLESHIP_DEFAULT_TURN_SECONDS;
    state.turnDeadline = Date.now() + turnSeconds * 1000;
  }

  private checkWinCondition(room: RoomState, defeatedTargetId: string): boolean {
    const state = room.battleshipState!;

    if (state.mode === 'TEAM_VS_TEAM') {
      if (state.teamFleetMode === 'SHARED_BOARD') {
        if (state.shipsRemaining[defeatedTargetId] <= 0) {
          const winningTeam: BattleshipTeam = defeatedTargetId === 'RED' ? 'BLUE' : 'RED';
          this.finishGame(room, {
            mode: 'TEAM_VS_TEAM',
            team: winningTeam,
          });
          return true;
        }
      } else {
        // MULTI_BOARD
        if (state.shipsRemaining[defeatedTargetId] <= 0) {
          state.alivePlayerIds = state.alivePlayerIds.filter((id) => id !== defeatedTargetId);
        }
        const redAlive = state.alivePlayerIds.filter((id) => state.teams[id] === 'RED');
        const blueAlive = state.alivePlayerIds.filter((id) => state.teams[id] === 'BLUE');

        if (redAlive.length === 0) {
          this.finishGame(room, { mode: 'TEAM_VS_TEAM', team: 'BLUE' });
          return true;
        }
        if (blueAlive.length === 0) {
          this.finishGame(room, { mode: 'TEAM_VS_TEAM', team: 'RED' });
          return true;
        }
      }
    } else {
      // FFA
      if (state.shipsRemaining[defeatedTargetId] <= 0) {
        state.alivePlayerIds = state.alivePlayerIds.filter((id) => id !== defeatedTargetId);
      }
      if (state.alivePlayerIds.length <= 1) {
        const winnerId = state.alivePlayerIds[0];
        const winnerPlayer = room.players.find((p) => p.socketId === winnerId);
        this.finishGame(room, {
          mode: 'FREE_FOR_ALL',
          playerId: winnerId,
          playerName: winnerPlayer?.name || 'Champion',
        });
        return true;
      }
    }

    return false;
  }

  private finishGame(
    room: RoomState,
    winner: { mode: BattleshipMode; team?: BattleshipTeam; playerId?: string; playerName?: string },
  ): void {
    const state = room.battleshipState!;
    state.phase = 'RESULT';
    state.winner = winner;
    state.turnDeadline = null;
    room.status = RoomStatus.RESULT;

    // Full Ocean Reveal: Populate revealedOceanGrids from private state
    const revealed: Record<string, ShipPlacement[]> = {};
    Object.keys(state.targetGrids).forEach((tid) => {
      const ships = this.getOceanGrid(room.code, state, tid);
      if (ships) revealed[tid] = ships;
    });
    state.revealedOceanGrids = revealed;

    // Award scores
    if (winner.team) {
      room.players.forEach((p) => {
        if (state.teams[p.socketId] === winner.team) {
          p.score = (p.score || 0) + 1;
        }
      });
    } else if (winner.playerId) {
      const winnerPlayer = room.players.find((p) => p.socketId === winner.playerId);
      if (winnerPlayer) {
        winnerPlayer.score = (winnerPlayer.score || 0) + 1;
      }
    }
  }

  // --- Teammate Ping ---

  pingCoordinate(
    room: RoomState,
    socketId: string,
    payload: BattleshipPingPayload,
  ): BattleshipOutcome {
    const state = room.battleshipState;
    if (!state || state.phase !== 'PLAYING') {
      return { error: 'Game is not playing' };
    }

    const team = state.teams[socketId];
    if (!team) {
      return { error: 'Pings are only available in team mode' };
    }

    const player = room.players.find((p) => p.socketId === socketId);
    const newPing: TeammatePing = {
      id: randomUUID(),
      playerId: socketId,
      playerName: player?.name || 'Teammate',
      x: payload.x,
      y: payload.y,
      createdAt: Date.now(),
    };

    const now = Date.now();
    const teamPings = (state.pings[team] || []).filter((p) => now - p.createdAt < 10000);
    teamPings.push(newPing);
    state.pings[team] = teamPings;

    return { room };
  }

  // --- Timeout Handling ---

  handleTimeout(room: RoomState, deadline: number): RoomState | null {
    const state = room.battleshipState;
    if (!state || state.turnDeadline !== deadline) {
      return null;
    }

    if (state.phase === 'PLACEMENT') {
      // Auto-place fleets for anyone not yet ready
      for (const targetId of Object.keys(state.targetGrids)) {
        if (!state.placementReady[targetId]) {
          const autoShips = this.generateRandomShipPlacement(state.gridSize, state.gridPreset);
          this.saveOceanGrid(room.code, state, targetId, autoShips);
          state.placementReady[targetId] = true;
        }
      }
      this.transitionToPlaying(room);
      return room;
    }

    if (state.phase === 'PLAYING') {
      if (state.mode === 'FREE_FOR_ALL') {
        // Auto-fire random for any player who didn't submit
        const roomPending = this.pendingShots.get(room.code) ?? new Map<string, PendingShot>();
        for (const pid of state.alivePlayerIds) {
          if (!roomPending.has(pid)) {
            const autoTarget = this.pickRandomTargetAndCoordinate(state, pid);
            if (autoTarget) {
              const player = room.players.find((p) => p.socketId === pid);
              roomPending.set(pid, {
                shooterId: pid,
                shooterName: player?.name || 'AFK Player',
                targetId: autoTarget.targetId,
                x: autoTarget.x,
                y: autoTarget.y,
              });
            }
          }
        }
        this.pendingShots.set(room.code, roomPending);
        this.resolveSimultaneousVolley(room);
        return room;
      }

      // Sequential: Auto-fire random coordinate for current turnPlayerId
      if (state.turnPlayerId) {
        const autoTarget = this.pickRandomTargetAndCoordinate(state, state.turnPlayerId);
        if (autoTarget) {
          this.fireShot(room, state.turnPlayerId, {
            targetId: autoTarget.targetId,
            x: autoTarget.x,
            y: autoTarget.y,
          });
          return room;
        }
        this.advanceSequentialTurn(room);
        return room;
      }
    }

    return null;
  }

  private pickRandomTargetAndCoordinate(
    state: BattleshipState,
    shooterId: string,
  ): { targetId: string; x: number; y: number } | null {
    let validTargets: string[] = [];

    if (state.mode === 'TEAM_VS_TEAM') {
      const myTeam = state.teams[shooterId];
      const opposingTeam: BattleshipTeam = myTeam === 'RED' ? 'BLUE' : 'RED';
      if (state.teamFleetMode === 'SHARED_BOARD') {
        validTargets = [opposingTeam];
      } else {
        validTargets = state.alivePlayerIds.filter((id) => state.teams[id] === opposingTeam);
      }
    } else {
      validTargets = state.alivePlayerIds.filter((id) => id !== shooterId);
    }

    if (validTargets.length === 0) return null;

    const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
    const targetBoard = state.targetGrids[targetId] || {};

    const availableCoords: { x: number; y: number }[] = [];
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        if (!targetBoard[`${x},${y}`]) {
          availableCoords.push({ x, y });
        }
      }
    }

    if (availableCoords.length === 0) return null;
    const choice = availableCoords[Math.floor(Math.random() * availableCoords.length)];
    return { targetId, x: choice.x, y: choice.y };
  }

  // --- Disconnect & Reconnect ---

  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    const state = room.battleshipState;
    if (!state || state.phase !== 'PLAYING') return;

    if (state.turnPlayerId === socketId && state.mode === 'TEAM_VS_TEAM') {
      // In shared team, immediately rotate to next connected teammate
      this.advanceSequentialTurn(room);
    }
  }

  handleReconnect(room: RoomState, playerId: string): void {
    const state = room.battleshipState;
    if (!state) return;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    // Resend private state
    const targetId = this.resolveTargetId(state, player.socketId);
    if (targetId) {
      const ships = this.getOceanGrid(room.code, state, targetId);
      if (ships) {
        this.privateState.set(room.code, player.socketId, BATTLESHIP_PRIVATE_OCEAN_KEY, {
          targetId,
          ships,
          gridSize: state.gridSize,
        });
      }
    }
  }

  remapSocketId(state: BattleshipState, oldSocketId: string, newSocketId: string): void {
    if (state.teams[oldSocketId]) {
      state.teams[newSocketId] = state.teams[oldSocketId];
      delete state.teams[oldSocketId];
    }

    const aliveIdx = state.alivePlayerIds.indexOf(oldSocketId);
    if (aliveIdx !== -1) {
      state.alivePlayerIds[aliveIdx] = newSocketId;
    }

    if (state.turnPlayerId === oldSocketId) {
      state.turnPlayerId = newSocketId;
    }

    if (state.battleStats[oldSocketId]) {
      state.battleStats[newSocketId] = state.battleStats[oldSocketId];
      delete state.battleStats[oldSocketId];
    }

    if (state.targetGrids[oldSocketId]) {
      state.targetGrids[newSocketId] = state.targetGrids[oldSocketId];
      delete state.targetGrids[oldSocketId];
    }

    if (state.placementReady[oldSocketId] !== undefined) {
      state.placementReady[newSocketId] = state.placementReady[oldSocketId];
      delete state.placementReady[oldSocketId];
    }
  }

  reset(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId && room.hostPlayerId !== requesterId) {
      return null;
    }

    this.pendingShots.delete(room.code);
    this.privateState.clearRoom(room.code);

    room.status = RoomStatus.LOBBY;
    room.battleshipState = undefined;

    return room;
  }

  // --- Utility ---

  private resolveTargetId(state: BattleshipState, socketId: string): string | null {
    if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
      return state.teams[socketId] || null;
    }
    return socketId;
  }

  private resolveTargetName(room: RoomState, state: BattleshipState, targetId: string): string {
    if (targetId === 'RED') return 'ทีมแดง (Red Team)';
    if (targetId === 'BLUE') return 'ทีมน้ำเงิน (Blue Team)';
    const player = room.players.find((p) => p.socketId === targetId);
    return player?.name || targetId;
  }
}
