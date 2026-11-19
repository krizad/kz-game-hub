export type RPSChoice = 'ROCK' | 'PAPER' | 'SCISSORS';

export interface RPSState {
  activePlayers: string[]; // socketIds
  queue: string[]; // socketIds waiting their turn
  choices: Record<string, RPSChoice>; // revealed only at round resolution
  choicesMade: string[]; // socketIds who have locked a choice (values stay private)
  /** Server timestamp for the picking window; null when the timer is off or round resolved. */
  turnDeadline?: number | null;
  scores: Record<string, number>; // socketId -> Wins
  roundWinner?: string | string[]; // Can be "DRAW", or a single P1 ID, or an array of winning IDs
  gameWinner?: string | string[]; // Overall winner(s) ID
}

export interface RPSMakeChoicePayload {
  code: string;
  choice: RPSChoice;
  requestId?: string;
}
