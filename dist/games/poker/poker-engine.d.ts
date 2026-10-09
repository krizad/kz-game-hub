import { PokerHandCategory, PokerPhase, PokerPot, PokerPublicState, PokerSeat, PlayingCard } from '@repo/types';
export declare function createDeck(): PlayingCard[];
export declare function shuffleDeck(deck: PlayingCard[]): PlayingCard[];
export interface HandEvaluation {
    category: PokerHandCategory;
    catIndex: number;
    tiebreak: number[];
    best: PlayingCard[];
}
export declare function compareEvaluations(a: HandEvaluation, b: HandEvaluation): number;
export declare function evaluateHand(cards: PlayingCard[]): HandEvaluation;
export declare function buildSidePots(seats: Record<string, PokerSeat>): PokerPot[];
export declare function uncalledBetPortion(seats: Record<string, PokerSeat>): {
    playerId: string;
    amount: number;
} | null;
export declare const POKER_STREETS: PokerPhase[];
export declare function isStreetPhase(phase: PokerPhase): boolean;
export declare function nextStreet(phase: PokerPhase): PokerPhase | null;
export declare function actableSeats(state: PokerPublicState): string[];
export declare function bettingRoundComplete(state: PokerPublicState): boolean;
export declare function bettingPossible(state: PokerPublicState): boolean;
export interface PokerLegalMoves {
    canFold: boolean;
    canCheck: boolean;
    callAmount: number;
    canBet: boolean;
    minRaiseTo: number;
    maxRaiseTo: number;
    isAllInCall: boolean;
}
export declare function legalMoves(state: PokerPublicState, playerId: string): PokerLegalMoves | null;
export declare function autoAction(state: PokerPublicState): 'CHECK' | 'FOLD';
