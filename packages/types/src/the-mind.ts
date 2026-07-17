export enum TheMindPhase {
  LOBBY = 'LOBBY',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  LEVEL_RESULT = 'LEVEL_RESULT',
  SHURIKEN_VOTE = 'SHURIKEN_VOTE',
  SHURIKEN_RESULT = 'SHURIKEN_RESULT',
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
  pileTopDOWN?: number | null;
  pileTopPlayerId: string | null;
  playedCards: { card: number; playerId: string; pile?: 'UP' | 'DOWN' }[];
  playerHands: Record<string, number[]>;
  readyPlayers: string[];
  failedPlayerId: string | null;
  discardedCards: Record<string, number[]>;
  shurikenProposerId: string | null;
  shurikenVotes: Record<string, boolean>;
  result: TheMindLevelResult | null;
  levelEndTime?: number;
}

export interface TheMindLevelResult {
  success: boolean;
  failedPlayerId?: string;
  discardedCards: Record<string, number[]>;
  livesLost: number;
  levelCleared?: boolean;
  isTimeOut?: boolean;
}

/**
 * Replays a Blind Mode round and returns the card positions that violated the
 * pile rules. Extreme Mode validates each pile independently and permits the
 * backwards-by-exactly-10 move.
 */
export function getTheMindInvalidPlayIndexes(
  playedCards: TheMindState['playedCards'],
  mode: 'NORMAL' | 'EXTREME' = 'NORMAL',
): number[] {
  let pileTopUp = 0;
  let pileTopDown = 101;
  const invalidIndexes: number[] = [];

  playedCards.forEach((playedCard, index) => {
    if (mode === 'EXTREME' && playedCard.pile === 'DOWN') {
      const isValid = playedCard.card < pileTopDown || playedCard.card === pileTopDown + 10;
      if (!isValid) invalidIndexes.push(index);
      pileTopDown = playedCard.card;
      return;
    }

    const isValid =
      playedCard.card > pileTopUp || (mode === 'EXTREME' && playedCard.card === pileTopUp - 10);
    if (!isValid) invalidIndexes.push(index);
    pileTopUp = playedCard.card;
  });

  return invalidIndexes;
}
