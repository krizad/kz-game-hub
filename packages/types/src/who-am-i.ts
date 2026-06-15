export type WordMode = 'HOST_INPUT' | 'RANDOM' | 'PLAYER_INPUT';

export type GameActionType =
  | 'SUBMIT_GUESS'
  | 'VOTE_GUESS'
  | 'END_TURN'
  | 'GUESS_WORD'
  | 'NEXT_TURN';

export type VoteResult = 'YES' | 'NO' | 'MAYBE';

export interface WordCategory {
  name: string;
  count: number;
}

export interface WhoAmIGameState {
  currentTurn: string; // socketId of the active player
  playerWords: Record<string, string>; // socketId -> assigned word
  currentGuess: string | null; // The question/guess the active player is asking
  votes: Record<string, VoteResult>; // socketId -> vote
  turnStatus: 'THINKING' | 'VOTING' | 'RESULT';
  guessResult?: boolean; // True if the turn was a GUESS_WORD turn
  guessedWord?: string; // The word the active player guessed
  winner: string | null; // socketId of the winner if game ends, or DRAW/null
  currentRound: number; // Current round number (1-indexed)
  maxRounds: number; // Total rounds configured
  eliminatedPlayers: string[]; // socketIds of players who guessed wrong and are out
  phase: 'COLLECTING_WORDS' | 'ASKING' | 'FINAL_GUESS';
  finalGuessUsed: string[]; // socketIds who already used their final guess
  // PLAYER_INPUT collection phase
  wordSubmissions?: Record<string, string>; // socketId -> submitted word (during COLLECTING_WORDS)
  wordSubmissionCategory?: string; // category label for PLAYER_INPUT
}
