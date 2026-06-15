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
  role: DetectiveClubRole;
  score: number;
  hand: string[]; // URLs or paths to images
  playedCards: string[];
  votedFor: string | null;
}

export interface DetectiveClubState {
  currentPhase: DetectiveClubPhase;
  informerId: string | null;
  conspiratorId: string | null;
  word: string | null;
  activePlayerId: string | null; // Whose turn is it to play a card
  playOrder: string[]; // Order of socketIds for the round
  round1StarterId: string | null; // The informer starts round 1
  scoreDeltas?: Record<string, number>; // Points gained in the current round
  deck?: string[]; // Deck of cards to draw from
  discardPile?: string[]; // Cards that have been played in previous rounds
  players: Record<string, DetectiveClubPlayer>; // Player states
}
