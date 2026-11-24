import { GameType, SOCKET_EVENTS, TTT_MODE_FLAGS } from '@repo/types';
import {
  hasSafeValues,
  isSettingsKey,
  isValidName,
  isValidPayload,
} from './payload-validator';

describe('gateway/payload-validator', () => {
  it('validates player display names', () => {
    expect(isValidName('Alice')).toBe(true);
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('a'.repeat(41))).toBe(false);
    expect(isValidName(123)).toBe(false);
  });

  it('validates game settings keys including TTT mode flags', () => {
    expect(isSettingsKey(GameType.WHO_KNOW)).toBe(true);
    expect(isSettingsKey(TTT_MODE_FLAGS[0])).toBe(true);
    expect(isSettingsKey('UNKNOWN_GAME')).toBe(false);
  });

  it('rejects unsafe values (deep nesting, oversized strings, non-finite numbers)', () => {
    expect(hasSafeValues({ ok: 'hello', n: 42, arr: [1, 2, 3] })).toBe(true);
    expect(hasSafeValues('x'.repeat(501))).toBe(false);
    expect(hasSafeValues(Number.NaN)).toBe(false);
    expect(hasSafeValues({ a: { b: { c: { d: { e: 1 } } } } })).toBe(false);
  });

  it('validates admin, room, and game-specific payloads', () => {
    expect(isValidPayload(SOCKET_EVENTS.LEAVE_ROOM, undefined)).toBe(true);
    expect(
      isValidPayload(SOCKET_EVENTS.CREATE_ROOM, { name: 'Host', gameType: GameType.POKER_V2 }),
    ).toBe(true);
    expect(isValidPayload(SOCKET_EVENTS.CREATE_ROOM, { name: '' })).toBe(false);

    expect(
      isValidPayload(SOCKET_EVENTS.SET_GAME_ENABLED, {
        gameType: GameType.COUP,
        enabled: false,
        adminKey: 'secret',
      }),
    ).toBe(true);
    expect(
      isValidPayload(SOCKET_EVENTS.SET_GAME_ENABLED, {
        gameType: 'NOPE',
        enabled: false,
        adminKey: 'secret',
      }),
    ).toBe(false);

    expect(isValidPayload(SOCKET_EVENTS.JOIN_ROOM, { code: 'AB12CD', name: 'Bob' })).toBe(true);
    expect(isValidPayload(SOCKET_EVENTS.JOIN_ROOM, { code: 'BAD', name: 'Bob' })).toBe(false);

    expect(
      isValidPayload(SOCKET_EVENTS.CIPHER_GIVE_CLUE, {
        code: 'AB12CD',
        word: 'Ocean',
        count: 2,
      }),
    ).toBe(true);
    expect(
      isValidPayload(SOCKET_EVENTS.CIPHER_GIVE_CLUE, {
        code: 'AB12CD',
        word: 'Ocean',
        count: 99,
      }),
    ).toBe(false);
  });
});
