import { DogRelayPair } from '@repo/types';

export function isDogRelayPairCorrect(actual: DogRelayPair, guess: DogRelayPair): boolean {
  return actual.suspectId === guess.suspectId && actual.victimId === guess.victimId;
}

export function resolveDogRelayWinner(
  evilId: string,
  ballots: Record<string, string>,
): 'GOOD' | 'EVIL' {
  const counts = new Map<string, number>();
  for (const target of Object.values(ballots)) counts.set(target, (counts.get(target) ?? 0) + 1);
  const highest = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => count === highest);
  return leaders.length === 1 && leaders[0][0] === evilId ? 'GOOD' : 'EVIL';
}
