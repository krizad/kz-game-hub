import { GameType, PlayingCard, RoomState, RoomStatus } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { OldMaidRuntime } from './old-maid.runtime';
import { OLD_MAID_DEFAULT_CONFIG } from './presets/old-maid.preset';

const card = (id: string, rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard => ({
  id,
  rank,
  suit,
});

const room = (ids: string[] = ['p1', 'p2']): RoomState => ({
  id: 'room-id',
  code: 'OLD123',
  gameType: GameType.CARD_GAME,
  status: RoomStatus.LOBBY,
  roomHostId: 'p1',
  createdAt: new Date(),
  config: { hostSelection: 'ROUND_ROBIN', timerMin: 5 },
  players: ids.map((socketId) => ({
    id: socketId,
    socketId,
    name: socketId,
    score: 0,
    roomId: 'room-id',
    connected: true,
  })),
});

const runtimeFor = (deck: PlayingCard[]) =>
  new OldMaidRuntime(new PrivateStateService(), () => [...deck]);

const FOUR_CARDS = [
  card('2C', '2', 'CLUBS'),
  card('4D', '4', 'DIAMONDS'),
  card('6H', '6', 'HEARTS'),
  card('8S', '8', 'SPADES'),
];

describe('OldMaidRuntime', () => {
  it('rotates the starter across rounds per the deal policy', () => {
    const target = room();
    const runtime = runtimeFor([...FOUR_CARDS]);

    const first = runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
    expect(first?.cardGameState?.dealerId).toBe('p1');

    const second = runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
    expect(second?.cardGameState?.dealerId).toBe('p2');
  });

  it('deals every card round-robin and lets the first holder lead', () => {
    const target = room();
    const runtime = runtimeFor(FOUR_CARDS);

    expect(runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2'])).toBe(target);
    expect(target.status).toBe(RoomStatus.PLAYING);
    expect(target.cardGameState?.activePlayerId).toBe('p1');
    expect(target.cardGameState?.handCounts).toEqual({ p1: 2, p2: 2 });
  });

  it('rejects a take from a player who is not in turn', () => {
    const target = room();
    const runtime = runtimeFor(FOUR_CARDS);
    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    const result = runtime.handleAction(
      target,
      'p2',
      { type: 'TAKE_CARD', index: 0 },
      OLD_MAID_DEFAULT_CONFIG,
    );

    expect(result).toBeNull();
  });

  it('rejects an out-of-range pick', () => {
    const target = room();
    const runtime = runtimeFor(FOUR_CARDS);
    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    const result = runtime.handleAction(
      target,
      'p1',
      { type: 'TAKE_CARD', index: 2 },
      OLD_MAID_DEFAULT_CONFIG,
    );

    expect(result).toBeNull();
  });

  it('rejects actions other than take-card', () => {
    const target = room();
    const runtime = runtimeFor(FOUR_CARDS);
    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    const result = runtime.handleAction(target, 'p1', { type: 'DRAW' }, OLD_MAID_DEFAULT_CONFIG);

    expect(result).toBeNull();
  });

  it('ends the round when only one player still holds cards', () => {
    const target = room();
    const runtime = runtimeFor([
      card('QC', 'Q', 'CLUBS'),
      card('QD', 'Q', 'DIAMONDS'),
      card('QH', 'Q', 'HEARTS'),
    ]);

    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    expect(target.status).toBe(RoomStatus.RESULT);
    expect(target.cardGameState?.phase).toBe('RESULT');
    expect(target.cardGameState?.result?.winnerIds).toEqual(['p1']);
    expect(target.cardGameState?.result?.placements).toEqual(['p1', 'p2']);
    expect(target.cardGameChips).toEqual({ p1: 101, p2: 99 });
  });

  it('keeps balances of seats that were not dealt into the round', () => {
    const target = room();
    target.cardGameChips = { p1: 100, p2: 100, ghost: 42 };
    const runtime = runtimeFor([
      card('QC', 'Q', 'CLUBS'),
      card('QD', 'Q', 'DIAMONDS'),
      card('QH', 'Q', 'HEARTS'),
    ]);

    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    expect(target.cardGameChips).toEqual({ p1: 101, p2: 99, ghost: 42 });
  });

  it('removes matching pairs after a take and hands the turn on', () => {
    const target = room();
    const runtime = runtimeFor([
      card('2C', '2', 'CLUBS'),
      card('3D', '3', 'DIAMONDS'),
      card('4H', '4', 'HEARTS'),
      card('2S', '2', 'SPADES'),
    ]);
    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    const result = runtime.handleAction(
      target,
      'p1',
      { type: 'TAKE_CARD', index: 1 },
      OLD_MAID_DEFAULT_CONFIG,
    );

    expect(result).toBe(target);
    expect(target.cardGameState?.handCounts).toEqual({ p1: 1, p2: 1 });
    expect(target.cardGameState?.decisions.p1).toBe('TOOK');
    expect(target.cardGameState?.activePlayerId).toBe('p2');
  });

  it('makes the last holder pay when another player sheds every card', () => {
    const target = room();
    const runtime = runtimeFor([
      card('2C', '2', 'CLUBS'),
      card('4D', '4', 'DIAMONDS'),
      card('6H', '6', 'HEARTS'),
    ]);
    runtime.startRound(target, OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);

    const result = runtime.handleAction(
      target,
      'p1',
      { type: 'TAKE_CARD', index: 0 },
      OLD_MAID_DEFAULT_CONFIG,
    );

    expect(result).toBe(target);
    expect(target.status).toBe(RoomStatus.RESULT);
    expect(target.cardGameChips).toEqual({ p1: 99, p2: 101 });
    expect(target.cardGameState?.result?.winnerIds).toEqual(['p2']);
    expect(target.cardGameState?.result?.placements).toEqual(['p2', 'p1']);
    expect(target.cardGameState?.handCounts.p1).toBe(3);
  });
});
