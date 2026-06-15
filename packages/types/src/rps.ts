export type RPSChoice = 'ROCK' | 'PAPER' | 'SCISSORS';

export interface RPSState {
  activePlayers: string[]; // socketIds
  queue: string[]; // socketIds waiting their turn
  choices: Record<string, RPSChoice>; // socketId -> Choice
  scores: Record<string, number>; // socketId -> Wins
  roundWinner?: string | string[]; // Can be "DRAW", or a single P1 ID, or an array of winning IDs
  gameWinner?: string | string[]; // Overall winner(s) ID
}
