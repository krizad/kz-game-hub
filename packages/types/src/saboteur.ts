// ---------- Enums ----------
// Edge index convention for path cards: 0 = North(top), 1 = East(right), 2 = South(bottom), 3 = West(left).
// A path card lists `paths`: groups of mutually-connected edge indices.
// e.g. cross card => [[0,1,2,3]]; vertical pass-through => [[0],[2]] (openings NOT connected).

export enum SaboteurPhase {
  PLAYING = 'PLAYING',
  GOLD_PICK = 'GOLD_PICK',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export enum SaboteurRole {
  MINER = 'MINER',
  SABOTEUR = 'SABOTEUR',
}

export enum SaboteurTool {
  LANTERN = 'LANTERN',
  CART = 'CART',
  PICKAXE = 'PICKAXE',
}

export enum SaboteurActionKind {
  BREAK = 'BREAK',
  REPAIR = 'REPAIR',
  MAP = 'MAP',
  ROCKFALL = 'ROCKFALL',
}

// ---------- Card definitions ----------
export interface SaboteurCardDef {
  id: string;
  kind: 'PATH' | 'ACTION';
  /** Groups of connected edge indices. Present on PATH cards. */
  paths?: number[][];
  /** Present on ACTION cards. */
  action?: {
    kind: SaboteurActionKind;
    /** Tools affected by BREAK / REPAIR cards. */
    tools?: SaboteurTool[];
  };
  /** Number of copies in the deck. */
  quantity: number;
}

// Base-game playable path cards (40 total).
// Naming mirrors the physical cards: digits are 1-indexed edges (1=N,2=E,3=S,4=W);
// suffix c = connected, x = crossing (edges present but not all connected).
const SABOTEUR_PATH_CARDS: SaboteurCardDef[] = [
  { id: 'path-1x', kind: 'PATH', paths: [[0]], quantity: 1 },
  { id: 'path-4x', kind: 'PATH', paths: [[3]], quantity: 1 },
  { id: 'path-13c', kind: 'PATH', paths: [[0, 2]], quantity: 4 },
  { id: 'path-24c', kind: 'PATH', paths: [[1, 3]], quantity: 3 },
  { id: 'path-12c', kind: 'PATH', paths: [[0, 1]], quantity: 4 },
  { id: 'path-14c', kind: 'PATH', paths: [[0, 3]], quantity: 5 },
  { id: 'path-13x', kind: 'PATH', paths: [[0], [2]], quantity: 1 },
  { id: 'path-24x', kind: 'PATH', paths: [[1], [3]], quantity: 1 },
  { id: 'path-12x', kind: 'PATH', paths: [[0], [1]], quantity: 1 },
  { id: 'path-14x', kind: 'PATH', paths: [[0], [3]], quantity: 1 },
  { id: 'path-123c', kind: 'PATH', paths: [[0, 1, 2]], quantity: 5 },
  { id: 'path-234c', kind: 'PATH', paths: [[1, 2, 3]], quantity: 5 },
  { id: 'path-123x', kind: 'PATH', paths: [[0, 2], [1]], quantity: 1 },
  { id: 'path-234x', kind: 'PATH', paths: [[1, 3], [2]], quantity: 1 },
  { id: 'path-1234c', kind: 'PATH', paths: [[0, 1, 2, 3]], quantity: 5 },
  {
    id: 'path-1234x',
    kind: 'PATH',
    paths: [
      [0, 2],
      [1, 3],
    ],
    quantity: 1,
  },
];

const SABOTEUR_ACTION_CARDS: SaboteurCardDef[] = [
  {
    id: 'action-break-lantern',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.BREAK, tools: [SaboteurTool.LANTERN] },
    quantity: 3,
  },
  {
    id: 'action-break-cart',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.BREAK, tools: [SaboteurTool.CART] },
    quantity: 3,
  },
  {
    id: 'action-break-pickaxe',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.BREAK, tools: [SaboteurTool.PICKAXE] },
    quantity: 3,
  },
  {
    id: 'action-repair-lantern',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.REPAIR, tools: [SaboteurTool.LANTERN] },
    quantity: 2,
  },
  {
    id: 'action-repair-cart',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.REPAIR, tools: [SaboteurTool.CART] },
    quantity: 2,
  },
  {
    id: 'action-repair-pickaxe',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.REPAIR, tools: [SaboteurTool.PICKAXE] },
    quantity: 2,
  },
  {
    id: 'action-repair-lantern-cart',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.REPAIR, tools: [SaboteurTool.LANTERN, SaboteurTool.CART] },
    quantity: 1,
  },
  {
    id: 'action-repair-pickaxe-lantern',
    kind: 'ACTION',
    action: {
      kind: SaboteurActionKind.REPAIR,
      tools: [SaboteurTool.PICKAXE, SaboteurTool.LANTERN],
    },
    quantity: 1,
  },
  {
    id: 'action-repair-cart-pickaxe',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.REPAIR, tools: [SaboteurTool.CART, SaboteurTool.PICKAXE] },
    quantity: 1,
  },
  { id: 'action-map', kind: 'ACTION', action: { kind: SaboteurActionKind.MAP }, quantity: 6 },
  {
    id: 'action-rockfall',
    kind: 'ACTION',
    action: { kind: SaboteurActionKind.ROCKFALL },
    quantity: 3,
  },
];

/** Fixed special cards (not shuffled into the draw deck). */
export const SABOTEUR_START_CARD: SaboteurCardDef = {
  id: 'start',
  kind: 'PATH',
  paths: [[0, 1, 2, 3]], // mine entrance: one tunnel touching all four edges
  quantity: 1,
};

/** Goal cards: terminal tiles; treated as open on all sides for reveal checks. */
export const SABOTEUR_GOAL_CARD: SaboteurCardDef = {
  id: 'goal',
  kind: 'PATH',
  paths: [[0], [1], [2], [3]],
  quantity: 3,
};

export const SABOTEUR_DRAW_CARDS: SaboteurCardDef[] = [
  ...SABOTEUR_PATH_CARDS,
  ...SABOTEUR_ACTION_CARDS,
];

// Gold nugget card distribution: 28 cards.
export const SABOTEUR_GOLD_DECK: number[] = [
  3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];

/** Saboteur count per player count (index = player count). Miners get the rest minus 1 leftover card. */
export const SABOTEUR_ROLE_TABLE: Record<number, number> = {
  3: 1,
  4: 1,
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

/** Hand size per player count. */
export const SABOTEUR_HAND_SIZE_TABLE: Record<number, number> = {
  3: 6,
  4: 6,
  5: 6,
  6: 5,
  7: 5,
  8: 4,
  9: 4,
  10: 4,
};

export const SABOTEUR_TOTAL_ROUNDS = 3;

// Board geometry
export const SABOTEUR_BOARD_BOUNDS = { minX: 0, maxX: 8, minY: 0, maxY: 4 } as const;
export const SABOTEUR_START_POS = { x: 0, y: 2 } as const;
export const SABOTEUR_GOAL_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 8, y: 1 },
  { x: 8, y: 2 },
  { x: 8, y: 3 },
];

// ---------- Public state ----------
export interface SaboteurBoardCell {
  cardId: string;
  rotation: 0 | 180;
}

export interface SaboteurPlayerState {
  id: string; // socketId
  score: number;
  handSize: number;
  brokenTools: SaboteurTool[];
  /** Populated only during ROUND_END / GAME_OVER reveal. */
  role?: SaboteurRole;
}

export type SaboteurGoalContent = 'GOLD' | 'STONE';

export interface SaboteurLastAction {
  playerId: string;
  kind: 'PLACE' | 'ACTION' | 'DISCARD' | 'PASS' | 'PICK_GOLD' | 'DRAW';
  detail?: string;
}

export interface SaboteurRoundResult {
  winnerRole: SaboteurRole;
  /** Index into SABOTEUR_GOAL_POSITIONS / revealedGoals when miners reached a goal. */
  revealedGoalIndex: number | null;
  /** Face-up gold values available to pick (miners win only). */
  goldPool?: number[];
  /** Player ids in picking order (finder first, counter-clockwise). */
  pickOrder?: string[];
  currentPickerId?: string | null;
  /** playerId -> nuggets picked so far. */
  picks?: Record<string, number>;
  /** Nuggets granted per saboteur when saboteurs win (3, or 4 for lone saboteur). */
  saboteurBonus?: number;
}

export interface SaboteurFinalResults {
  scores: Record<string, number>;
  winnerIds: string[];
}

export interface SaboteurState {
  currentPhase: SaboteurPhase;
  /** 1-based round counter. */
  round: number;
  activePlayerId: string | null;
  turnOrder: string[];
  /** Key format `${x},${y}`. Includes start and goal cells. */
  board: Record<string, SaboteurBoardCell>;
  goalCells: Array<{ x: number; y: number }>;
  /** Aligned with goalCells; null while hidden. */
  revealedGoals: Array<SaboteurGoalContent | null>;
  stockCount: number;
  players: Record<string, SaboteurPlayerState>;
  lastAction?: SaboteurLastAction | null;
  roundResult?: SaboteurRoundResult | null;
  finalResults?: SaboteurFinalResults | null;
}

// ---------- Socket payloads ----------
export interface SaboteurPlacePathPayload {
  code: string;
  cardIndex: number;
  x: number;
  y: number;
  rotation: 0 | 180;
}

export interface SaboteurPlayActionPayload {
  code: string;
  cardIndex: number;
  /** Target player for BREAK / REPAIR. */
  targetPlayerId?: string;
  /** Tool to fix when playing a dual-tool REPAIR card (optional; auto-chosen otherwise). */
  repairTool?: SaboteurTool;
  /** Goal index 0..2 for MAP. */
  goalIndex?: number;
  /** Board cell for ROCKFALL. */
  targetX?: number;
  targetY?: number;
}

export interface SaboteurDiscardPayload {
  code: string;
  cardIndex: number;
}

export interface SaboteurPickGoldPayload {
  code: string;
  poolIndex: number;
}

// ---------- Pure board helpers (shared by API validation and web UI preview) ----------

export function saboteurCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function saboteurRotateEdge(edge: number, rotation: 0 | 180): number {
  return rotation === 180 ? (edge + 2) % 4 : edge;
}

export function saboteurRotatedPaths(paths: number[][], rotation: 0 | 180): number[][] {
  return paths.map((group) => group.map((e) => saboteurRotateEdge(e, rotation)));
}

const SABOTEUR_CARD_DEF_INDEX: Map<string, SaboteurCardDef> = (() => {
  const defs: SaboteurCardDef[] = [...SABOTEUR_DRAW_CARDS, SABOTEUR_START_CARD, SABOTEUR_GOAL_CARD];
  return new Map(defs.map((d) => [d.id, d]));
})();

export function saboteurGetCardDef(cardId: string): SaboteurCardDef | undefined {
  return SABOTEUR_CARD_DEF_INDEX.get(cardId);
}

/** Direction deltas indexed by edge: 0=N(y-1),1=E(x+1),2=S(y+1),3=W(x-1). */
const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

/** Trace the tunnel network reachable from the start card.
 *  Returns visited arrival nodes (`"x,y:edge"`) and keys of goal cells reached. */
export function saboteurTraceNetwork(board: Record<string, SaboteurBoardCell>): {
  visited: Set<string>;
  reachedGoalKeys: Set<string>;
} {
  const visited = new Set<string>();
  const reachedGoalKeys = new Set<string>();

  const openEdges = (cell: SaboteurBoardCell): Set<number> => {
    const def = saboteurGetCardDef(cell.cardId);
    if (!def?.paths) return new Set();
    return new Set(saboteurRotatedPaths(def.paths, cell.rotation).flat());
  };

  const groupAt = (cell: SaboteurBoardCell, edge: number): number[] | null => {
    const def = saboteurGetCardDef(cell.cardId);
    if (!def?.paths) return null;
    const rotated = saboteurRotatedPaths(def.paths, cell.rotation);
    return rotated.find((g) => g.includes(edge)) ?? null;
  };

  const startPos = SABOTEUR_START_POS;
  const startCell = board[saboteurCellKey(startPos.x, startPos.y)];
  if (!startCell) return { visited, reachedGoalKeys };

  const queue: Array<{ x: number; y: number; edge: number }> = [];
  for (const edge of openEdges(startCell)) {
    const node = `${startPos.x},${startPos.y}:${edge}`;
    visited.add(node);
    queue.push({ x: startPos.x, y: startPos.y, edge });
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = saboteurCellKey(cur.x, cur.y);
    const curCell = board[curKey];
    if (!curCell) continue;

    // Continue through the same connected group (pass-through stubs terminate here).
    if (curCell.cardId !== 'goal') {
      const group = groupAt(curCell, cur.edge);
      if (group) {
        for (const exitEdge of group) {
          if (exitEdge === cur.edge) continue;
          const dir = DIRS[exitEdge];
          const nx = cur.x + dir.dx;
          const ny = cur.y + dir.dy;
          const nKey = saboteurCellKey(nx, ny);
          const nCell = board[nKey];
          if (!nCell) continue;
          const nDefs = openEdges(nCell);
          const opposite = saboteurRotateEdge(exitEdge, 180);
          if (!nDefs.has(opposite)) continue;
          if (nCell.cardId === 'goal') {
            reachedGoalKeys.add(nKey);
            continue;
          }
          const node = `${nKey}:${opposite}`;
          if (!visited.has(node)) {
            visited.add(node);
            queue.push({ x: nx, y: ny, edge: opposite });
          }
        }
      }
    }
  }

  return { visited, reachedGoalKeys };
}

export interface SaboteurPlacementCheck {
  valid: boolean;
  /** Goal cell keys connected by this placement (empty if invalid). */
  revealedGoalKeys: string[];
}

/** Validate placing `cardId` at (x,y) with rotation against the current board. */
export function saboteurSimulatePlacement(
  board: Record<string, SaboteurBoardCell>,
  x: number,
  y: number,
  cardId: string,
  rotation: 0 | 180,
): SaboteurPlacementCheck {
  const { minX, maxX, minY, maxY } = SABOTEUR_BOARD_BOUNDS;
  if (x < minX || x > maxX || y < minY || y > maxY) return { valid: false, revealedGoalKeys: [] };
  const key = saboteurCellKey(x, y);
  if (board[key]) return { valid: false, revealedGoalKeys: [] };
  const def = saboteurGetCardDef(cardId);
  if (!def || def.kind !== 'PATH' || cardId === 'start') {
    return { valid: false, revealedGoalKeys: [] };
  }

  const rotated = saboteurRotatedPaths(def.paths ?? [], rotation);
  const myOpen = new Set(rotated.flat());

  // Adjacency: open must meet open, closed must meet closed, on every shared border.
  for (let d = 0; d < 4; d++) {
    const dir = DIRS[d];
    const nCell = board[saboteurCellKey(x + dir.dx, y + dir.dy)];
    if (!nCell) continue;
    const nDef = saboteurGetCardDef(nCell.cardId);
    const nOpen = new Set(
      nDef?.paths ? saboteurRotatedPaths(nDef.paths, nCell.rotation).flat() : [],
    );
    if (myOpen.has(d) !== nOpen.has(saboteurRotateEdge(d, 180))) {
      return { valid: false, revealedGoalKeys: [] };
    }
  }

  // Reachability: the new tile must join the network growing from the start card.
  const simulated = { ...board, [key]: { cardId, rotation } };
  const { visited, reachedGoalKeys } = saboteurTraceNetwork(simulated);
  let connected = false;
  for (const edge of myOpen) {
    if (visited.has(`${key}:${edge}`)) {
      connected = true;
      break;
    }
  }
  if (!connected) return { valid: false, revealedGoalKeys: [] };
  return { valid: true, revealedGoalKeys: [...reachedGoalKeys] };
}

/** All legal placements for a path card on the current board. */
export function saboteurValidPlacements(
  board: Record<string, SaboteurBoardCell>,
  cardId: string,
): Array<{ x: number; y: number; rotation: 0 | 180 }> {
  const results: Array<{ x: number; y: number; rotation: 0 | 180 }> = [];
  const seen = new Set<string>();
  const { minX, maxX, minY, maxY } = SABOTEUR_BOARD_BOUNDS;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (const rotation of [0, 180] as const) {
        const check = saboteurSimulatePlacement(board, x, y, cardId, rotation);
        if (!check.valid) continue;
        // Dedupe symmetric shapes (a card identical under 180° yields the same result twice).
        const sig = `${x},${y}:${rotation}`;
        const def = saboteurGetCardDef(cardId);
        const r180 = JSON.stringify(saboteurRotatedPaths(def?.paths ?? [], 180));
        const ident = JSON.stringify(def?.paths ?? []) === r180;
        const normSig = ident ? `${x},${y}:sym` : sig;
        if (seen.has(normSig)) continue;
        seen.add(normSig);
        results.push({ x, y, rotation });
      }
    }
  }
  return results;
}
