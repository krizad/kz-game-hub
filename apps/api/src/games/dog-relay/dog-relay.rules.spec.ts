import { isDogRelayPairCorrect, resolveDogRelayWinner } from './dog-relay.rules';

describe('Dog Relay rules', () => {
  const actual = { suspectId: 'dog-001', victimId: 'dog-002' };
  it('requires both cards in the original order', () => {
    expect(isDogRelayPairCorrect(actual, actual)).toBe(true);
    expect(isDogRelayPairCorrect(actual, { suspectId: 'dog-002', victimId: 'dog-001' })).toBe(
      false,
    );
    expect(isDogRelayPairCorrect(actual, { suspectId: 'dog-001', victimId: 'dog-003' })).toBe(
      false,
    );
  });
  it.each([
    ['GOOD', { a: 'b', b: 'c', c: 'b', d: 'b', e: 'd' }],
    ['EVIL', { a: 'b', b: 'c', c: 'b', d: 'c', e: 'd' }],
    ['EVIL', { a: 'c', b: 'c', c: 'b', d: 'c', e: 'd' }],
    ['EVIL', {}],
  ])('returns %s for ballots %j', (winner, ballots) => {
    expect(resolveDogRelayWinner('b', ballots)).toBe(winner);
  });
});
