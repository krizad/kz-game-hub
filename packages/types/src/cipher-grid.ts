/**
 * Ciphergrid (สายลับคำใบ้) — two-team word-association game on a 5×5 board.
 * The colour of each unrevealed card (the Cipher Key) is private to the two
 * Cipher Leads and lives in PrivateStateService, never in the public state.
 */

import type { CipherGridPicturePack } from './cipher-grid-pictures';

export type CipherTeam = 'SOLAR' | 'LUNAR';
export type CipherGridMode = 'WORDS' | 'PICTURES';
export const CIPHER_GRID_MODE_PRESETS = {
  WORDS: { columns: 5, rows: 5, boardSize: 25, first: 9, second: 8, decoys: 7 },
  PICTURES: { columns: 5, rows: 4, boardSize: 20, first: 8, second: 7, decoys: 4 },
} as const;
export type CipherRole = 'CIPHER_LEAD' | 'TRACKER';
export type CipherCardType = 'SOLAR' | 'LUNAR' | 'DECOY' | 'VIRUS';
export type CipherGridPhase = 'TEAM_SETUP' | 'CLUE_GIVING' | 'DECODING' | 'ROUND_END';
/** `0`–`9`, or unlimited guesses. */
export type CipherClueCount = number | 'UNLIMITED';
export type CipherWinReason = 'ALL_FOUND' | 'VIRUS';

export const CIPHER_GRID_BOARD_SIZE = 25;
export const CIPHER_GRID_MIN_PLAYERS = 4;
export const CIPHER_GRID_MAX_CLUE_COUNT = 9;
export const CIPHER_GRID_MAX_CLUE_LENGTH = 30;
/** Private-state key holding the Cipher Key for each Cipher Lead socket. */
export const CIPHER_GRID_PRIVATE_KEY = 'cipherKeycard';

export interface CipherCardBase {
  revealed: boolean;
  /** Only set once the card is revealed (or for every card at ROUND_END). */
  type?: CipherCardType;
  /** Team whose turn it was when the card was revealed (null = challenge penalty). */
  revealedBy?: CipherTeam | null;
}

export type CipherCard = CipherCardBase &
  ({ kind: 'WORD'; word: string } | { kind: 'PICTURE'; pictureId: string });

export interface CipherClue {
  id: string;
  team: CipherTeam;
  word: string;
  count: CipherClueCount;
  giverId: string;
  challenged?: boolean;
  challenge?: { team: CipherTeam; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' };
}

export type CipherHistoryKind =
  | 'CLUE'
  | 'REVEAL'
  | 'CHALLENGE'
  | 'CHALLENGE_ACCEPTED'
  | 'CHALLENGE_REJECTED'
  | 'PENALTY_REVEAL'
  | 'END_TURN';

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
  mode: CipherGridMode;
  picturePack?: CipherGridPicturePack;
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

export interface CipherRespondChallengePayload {
  clueId: string;
  accept: boolean;
}
