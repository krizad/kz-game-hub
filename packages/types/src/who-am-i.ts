export type WordMode = 'HOST_INPUT' | 'RANDOM' | 'PLAYER_INPUT' | 'AI_GENERATED';

export type GameActionType = 'VOTE_GUESS' | 'END_TURN' | 'GUESS_WORD' | 'NEXT_TURN' | 'END_MATCH';

export type VoteResult = 'YES' | 'NO' | 'MAYBE';

export interface WordCategory {
  name: string;
  count: number;
}

export interface WhoAmIGameState {
  currentTurn: string; // socketId of the active player
  currentGuess: string | null; // The question/guess the active player is asking
  votes: Record<string, VoteResult>; // socketId -> vote
  turnStatus: 'VOTING' | 'RESULT';
  guessResult?: boolean; // True if the turn was a GUESS_WORD turn
  guessedWord?: string; // The word the active player guessed
  winner: string | null; // socketId of the winner if game ends, or DRAW/null
  currentRound: number; // Current round number (1-indexed)
  maxRounds: number; // Total rounds configured
  eliminatedPlayers: string[]; // socketIds of players who guessed wrong and are out
  phase: 'COLLECTING_WORDS' | 'AWAITING_HOST_INPUT' | 'ASKING' | 'FINAL_GUESS';
  finalGuessUsed: string[]; // socketIds who already used their final guess
  // PLAYER_INPUT collection phase
  wordSubmittedIds: string[]; // socketIds who submitted (values stay private)
  wordSubmissionCategory?: string; // category label for PLAYER_INPUT
  revealedWords?: Record<string, string>; // all words revealed at game end
}
