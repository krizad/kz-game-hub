import { DogRelayPair } from '@repo/types';
export declare function isDogRelayPairCorrect(actual: DogRelayPair, guess: DogRelayPair): boolean;
export declare function resolveDogRelayWinner(evilId: string, ballots: Record<string, string>): 'GOOD' | 'EVIL';
