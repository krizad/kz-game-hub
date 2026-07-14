export enum TheMindPhase {
  LOBBY = 'LOBBY',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  LEVEL_RESULT = 'LEVEL_RESULT',
  SHURIKEN_VOTE = 'SHURIKEN_VOTE',
  GAME_OVER = 'GAME_OVER',
}

export interface TheMindState {
  phase: TheMindPhase;
  deck: number[];
  level: number;
  maxLevel: number;
  lives: number;
  shuriken: number;
  pileTop: number;
  playerHands: Record<string, number[]>;
  readyPlayers: string[];
  failedPlayerId: string | null;
  discardedCards: Record<string, number[]>;
  shurikenProposerId: string | null;
  shurikenVotes: Record<string, boolean>;
  result: TheMindLevelResult | null;
}

export interface TheMindLevelResult {
  success: boolean;
  failedPlayerId?: string;
  discardedCards: Record<string, number[]>;
  livesLost: number;
}
