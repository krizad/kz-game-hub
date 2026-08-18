export type WhoFirstPhase = 'LOBBY' | 'COUNTDOWN' | 'ACTIVE' | 'ROUND_RESULT' | 'FINISHED';

export type WhoFirstGameActionType = 'START_COUNTDOWN' | 'PRESS_BUTTON' | 'NEXT_ROUND' | 'END_GAME';

export interface WhoFirstPressRecord {
  socketId: string;
  timestamp: number; // Server-side absolute timestamp
  reactionTimeMs?: number; // Time taken from the ACTIVE start time
  isPenalty: boolean; // True if pressed before ACTIVE phase
}

export interface WhoFirstState {
  phase: WhoFirstPhase;
  countdownStartTime?: number; // When countdown started
  countdownDurationMs?: number; // How long the countdown is
  countdownEndTime?: number; // Absolute deadline (server-owned countdown)
  activeStartTime?: number; // When the ACTIVE phase began
  presses: WhoFirstPressRecord[];
  currentRound: number;
  maxRounds: number;
  roundWinnerId?: string; // Winner of the last resolved round
}
