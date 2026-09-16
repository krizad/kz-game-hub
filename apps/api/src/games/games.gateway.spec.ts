import { SOCKET_EVENTS } from '@repo/types';
import { GamesGateway } from './games.gateway';

describe('GamesGateway payload guard', () => {
  let gateway: GamesGateway;

  beforeEach(() => {
    gateway = new GamesGateway({} as never, {} as never, {} as never, {} as never);
  });

  const isValid = (event: string, payload: unknown): boolean =>
    (
      gateway as unknown as {
        isValidPayload: (event: string, payload: unknown) => boolean;
      }
    ).isValidPayload(event, payload);

  it('accepts who_am_i_get_categories without a room code', () => {
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'en' })).toBe(true);
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'th' })).toBe(true);
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, {})).toBe(true);
  });

  it('rejects who_am_i_get_categories with an unsafe lang', () => {
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 42 })).toBe(false);
    expect(isValid(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang: 'x'.repeat(50) })).toBe(false);
  });

  it('still requires a valid room code for room events', () => {
    expect(isValid(SOCKET_EVENTS.START_GAME, {})).toBe(false);
    expect(isValid(SOCKET_EVENTS.START_GAME, { code: 'abc' })).toBe(false);
    expect(isValid(SOCKET_EVENTS.START_GAME, { code: 'abc123' })).toBe(true);
  });

  it('accepts exchange selections of any small size and rejects malformed ones', () => {
    expect(isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0] })).toBe(
      true,
    );
    expect(
      isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0, 1] }),
    ).toBe(true);
    expect(
      isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: [0, 1, 2, 3, 4] }),
    ).toBe(false);
    expect(
      isValid(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { code: 'abc123', keepIndices: ['0'] }),
    ).toBe(false);
  });
});
