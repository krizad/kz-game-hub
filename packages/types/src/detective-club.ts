export enum DetectiveClubPhase {
  SETUP = 'SETUP',
  PLAYING_ROUND_1 = 'PLAYING_ROUND_1',
  PLAYING_ROUND_2 = 'PLAYING_ROUND_2',
  DISCUSSION = 'DISCUSSION',
  VOTING = 'VOTING',
  SCORING = 'SCORING',
}

export enum DetectiveClubRole {
  INFORMER = 'INFORMER',
  CONSPIRATOR = 'CONSPIRATOR',
  DETECTIVE = 'DETECTIVE',
}

export interface DetectiveClubPlayer {
  id: string; // socketId
  score: number;
  playedCards: string[];
  votedFor: string | null;
  handSize: number;
  role?: DetectiveClubRole; // revealed only at SCORING
}

export interface DetectiveClubState {
  currentPhase: DetectiveClubPhase;
  informerId: string | null;
  conspiratorId: string | null; // hidden until SCORING
  word: string | null; // hidden from the conspirator until DISCUSSION
  activePlayerId: string | null; // Whose turn is it to play a card
  playOrder: string[]; // Order of socketIds for the round
  round1StarterId: string | null; // The informer starts round 1
  scoreDeltas?: Record<string, number>; // Points gained in the current round
  players: Record<string, DetectiveClubPlayer>; // Player states
}
