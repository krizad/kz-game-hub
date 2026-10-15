/**
 * Ciphergrid (สายลับคำใบ้) — two-team word-association game on a 5×5 board.
 * The colour of each unrevealed card (the Cipher Key) is private to the two
 * Cipher Leads and lives in PrivateStateService, never in the public state.
 */

export type CipherTeam = 'SOLAR' | 'LUNAR';
export type CipherRole = 'CIPHER_LEAD' | 'TRACKER';
export type CipherCardType = 'SOLAR' | 'LUNAR' | 'DECOY' | 'VIRUS';
export type CipherGridPhase = 'TEAM_SETUP' | 'CLUE_GIVING' | 'DECODING' | 'ROUND_END';
/** `0`–`9`, or unlimited guesses. */
export type CipherClueCount = number | 'UNLIMITED';
export type CipherWinReason = 'ALL_FOUND' | 'VIRUS';

export const CIPHER_GRID_BOARD_SIZE = 25;
export const CIPHER_GRID_MIN_PLAYERS = 4;
export const CIPHER_GRID_MAX_CLUE_COUNT = 9;
/** Private-state key holding the Cipher Key for each Cipher Lead socket. */
export const CIPHER_GRID_PRIVATE_KEY = 'cipherKeycard';

export interface CipherCard {
  word: string;
  revealed: boolean;
  /** Only set once the card is revealed (or for every card at ROUND_END). */
  type?: CipherCardType;
  /** Team whose turn it was when the card was revealed (null = challenge penalty). */
  revealedBy?: CipherTeam | null;
}

export interface CipherClue {
  team: CipherTeam;
  word: string;
  count: CipherClueCount;
  giverId: string;
  challenged?: boolean;
}

export type CipherHistoryKind = 'CLUE' | 'REVEAL' | 'CHALLENGE' | 'PENALTY_REVEAL' | 'END_TURN';

export interface CipherHistoryEntry {
  kind: CipherHistoryKind;
  team: CipherTeam;
  playerId?: string;
  word?: string;
  count?: CipherClueCount;
  cardIndex?: number;
  cardType?: CipherCardType;
}

export interface CipherGridState {
  phase: CipherGridPhase;
  round: number;
  /** socketId → team. Players without an entry sit this match out. */
  teams: Record<string, CipherTeam>;
  /** team → socketId of that team's Cipher Lead. Everyone else on the team is a Tracker. */
  cipherLeads: Partial<Record<CipherTeam, string>>;
  board: CipherCard[];
  startingTeam: CipherTeam | null;
  currentTeam: CipherTeam | null;
  currentClue: CipherClue | null;
  /** Cards revealed by the current team under the current clue. */
  guessesThisTurn: number;
  /** socketId → card index a Tracker is pointing at (one ping per player). */
  pings: Record<string, number>;
  remaining: Record<CipherTeam, number>;
  winner: CipherTeam | null;
  winReason: CipherWinReason | null;
  history: CipherHistoryEntry[];
  /** Rounds won per team across the match. */
  scores: Record<CipherTeam, number>;
  /** Epoch ms when the current turn auto-ends (null = no turn timer). */
  turnEndsAt: number | null;
}

/** Sent only to the Cipher Leads via PrivateStateService. */
export interface CipherGridPrivateState {
  keycard: CipherCardType[];
}

export interface CipherAssignTeamPayload {
  team: CipherTeam | null;
  role?: CipherRole;
  /** Host only: assign another player. Defaults to the sender. */
  targetId?: string;
}

export interface CipherGiveCluePayload {
  word: string;
  count: CipherClueCount;
}

export interface CipherCardIndexPayload {
  cardIndex: number;
}
