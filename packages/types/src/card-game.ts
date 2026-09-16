/** A card identity is only sent to its owner until the round is resolved. */
export interface PlayingCard {
  id: string;
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  suit: 'CLUBS' | 'DIAMONDS' | 'HEARTS' | 'SPADES';
}

export type CardGamePreset = 'POK_DENG';
export type PokDengPhase = 'PLAYER_TURNS' | 'DEALER_TURN' | 'RESULT';

/** Public-safe state: it deliberately contains card counts, never hidden cards. */
export interface CardGameState {
  preset: CardGamePreset;
  phase: PokDengPhase;
  dealerId: string;
  activePlayerId: string | null;
  playerOrder: string[];
  handCounts: Record<string, number>;
  chips: Record<string, number>;
  decisions: Record<string, 'PENDING' | 'STAND' | 'DRAWN' | 'NATURAL'>;
  result?: {
    dealerScore: number;
    playerScores: Record<string, number>;
    winnerIds: string[];
    revealedHands: Record<string, PlayingCard[]>;
  };
}

export interface CardGamePrivateState {
  preset: CardGamePreset;
  hand: PlayingCard[];
}

export type CardGameAction = { type: 'DRAW' } | { type: 'STAND' } | { type: 'NEXT_ROUND' };
