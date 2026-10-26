/**
 * Battleship (ยุทธการเรือรบ) — naval strategy game supporting Team vs Team
 * and Free-for-all Battle Royale modes (ADR 0016).
 *
 * Privacy contract:
 * Ship placements and unrevealed ship coordinates live in PrivateStateService
 * (or the room-level team private store) and are never included in the
 * broadcast BattleshipState until the RESULT phase.
 * Public state carries only public target grids (hits, misses, collisions, sunk markers),
 * phase progression, turn deadlines, and announcements.
 */

export const BATTLESHIP_MIN_PLAYERS = 2;
export const BATTLESHIP_MAX_PLAYERS = 8;
export const BATTLESHIP_DEFAULT_TURN_SECONDS = 20;
export const BATTLESHIP_PLACEMENT_SECONDS = 45;

export const BATTLESHIP_PRIVATE_OCEAN_KEY = 'battleshipOceanGrid';

export type BattleshipMode = 'FREE_FOR_ALL' | 'TEAM_VS_TEAM';
export type BattleshipTeam = 'RED' | 'BLUE';
export type BattleshipTeamFleetMode = 'SHARED_BOARD' | 'MULTI_BOARD';
export type BattleshipGridPreset = 'CLASSIC_10x10' | 'QUICK_8x8';
export type BattleshipPhase = 'PLACEMENT' | 'PLAYING' | 'RESULT';
export type ShipOrientation = 'HORIZONTAL' | 'VERTICAL';
export type CellStatus = 'MISS' | 'HIT' | 'SUNK' | 'COLLISION';

export enum ShipType {
  CARRIER = 'CARRIER',
  BATTLESHIP = 'BATTLESHIP',
  CRUISER = 'CRUISER',
  SUBMARINE = 'SUBMARINE',
  DESTROYER = 'DESTROYER',
}

export interface ShipConfig {
  type: ShipType;
  length: number;
}

export const CLASSIC_10x10_FLEET: ShipConfig[] = [
  { type: ShipType.CARRIER, length: 5 },
  { type: ShipType.BATTLESHIP, length: 4 },
  { type: ShipType.CRUISER, length: 3 },
  { type: ShipType.SUBMARINE, length: 3 },
  { type: ShipType.DESTROYER, length: 2 },
];

export const QUICK_8x8_FLEET: ShipConfig[] = [
  { type: ShipType.BATTLESHIP, length: 4 },
  { type: ShipType.CRUISER, length: 3 },
  { type: ShipType.SUBMARINE, length: 3 },
  { type: ShipType.DESTROYER, length: 2 },
];

export interface Coordinate {
  x: number;
  y: number;
}

export interface ShipPlacement {
  id: string;
  type: ShipType;
  x: number;
  y: number;
  orientation: ShipOrientation;
  length: number;
  hits: number;
  sunk: boolean;
}

export interface TeammatePing {
  id: string;
  playerId: string;
  playerName: string;
  x: number;
  y: number;
  createdAt: number;
}

export interface BattleshipVolleyResult {
  shooterId: string;
  shooterName: string;
  targetId: string;
  targetName: string;
  x: number;
  y: number;
  result: 'MISS' | 'HIT' | 'SUNK' | 'COLLISION';
  sunkShipType?: ShipType;
}

export interface BattleshipPlayerStats {
  shotsFired: number;
  hits: number;
  misses: number;
  shipsSunk: number;
  collisions: number;
  accuracy: number;
}

export interface BattleshipWinner {
  mode: BattleshipMode;
  team?: BattleshipTeam;
  playerId?: string;
  playerName?: string;
}

export interface BattleshipState {
  mode: BattleshipMode;
  teamFleetMode: BattleshipTeamFleetMode;
  gridPreset: BattleshipGridPreset;
  gridSize: number;
  phase: BattleshipPhase;
  round: number;
  /** socketId -> team ('RED' | 'BLUE') */
  teams: Record<string, BattleshipTeam>;
  /** socketId of current shooter in sequential mode */
  turnPlayerId: string | null;
  /** active team in sequential team mode */
  currentTurnTeam: BattleshipTeam | null;
  turnDeadline: number | null;
  hitStreakEnabled: boolean;
  consecutiveHits: number;
  /**
   * targetId -> "x,y" coordinate string -> CellStatus
   * In FFA and MULTI_BOARD, targetId is the defender's socketId.
   * In SHARED_BOARD, targetId is the defender's team ('RED' or 'BLUE').
   */
  targetGrids: Record<string, Record<string, CellStatus>>;
  /** targetId -> count of unsunk ships */
  shipsRemaining: Record<string, number>;
  /** targetId -> list of sunk ship types */
  sunkShips: Record<string, ShipType[]>;
  /** socketIds of players who are still in the match */
  alivePlayerIds: string[];
  /** targetId -> list of ready players who submitted ship placement */
  placementReady: Record<string, boolean>;
  /** team -> active teammate pings */
  pings: Partial<Record<BattleshipTeam, TeammatePing[]>>;
  /** Results from the most recent volley/barrage */
  lastVolleyResults: BattleshipVolleyResult[];
  winner: BattleshipWinner | null;
  /** Populated ONLY at phase === RESULT: targetId -> placed ships for full reveal */
  revealedOceanGrids?: Record<string, ShipPlacement[]>;
  /** Stats per player socketId */
  battleStats: Record<string, BattleshipPlayerStats>;
}

export interface BattleshipPrivateState {
  targetId: string;
  ships: ShipPlacement[];
  gridSize: number;
}

export interface BattleshipPlaceShipsPayload {
  ships: ShipPlacement[];
}

export interface BattleshipFirePayload {
  targetId: string;
  x: number;
  y: number;
}

export interface BattleshipPingPayload {
  x: number;
  y: number;
}
