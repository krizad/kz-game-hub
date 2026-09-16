import { Test, TestingModule } from '@nestjs/testing';
import { CardGameConfig, GameType, PlayingCard, RoomState, RoomStatus } from '@repo/types';
import { CardGameService } from './card-game.service';
import { validateConfig } from './card-engine.service';
import { POK_DENG_PRESET } from './presets/pok-deng.preset';
import { PrivateStateService } from '../private-state.service';

const card = (
  id: string,
  rank: PlayingCard['rank'],
  suit: PlayingCard['suit'],
): PlayingCard => ({ id, rank, suit });

// Cards are popped from the tail of the deck, so `popOrder` is reversed on top of the filler.
const deckFor = (popOrder: PlayingCard[]): PlayingCard[] => [
  ...Array.from({ length: 52 - popOrder.length }, (_, index) =>
    card(`filler-${index}`, '2', 'CLUBS'),
  ),
  ...[...popOrder].reverse(),
];

describe('Pok Deng preset flow', () => {
  let service: CardGameService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardGameService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();
    service = module.get(CardGameService);
  });

  const room = (ids: string[] = ['p1', 'p2']): RoomState => ({
    id: 'room-id',
    code: 'POK123',
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

  const fixedDeal = (popOrder: PlayingCard[]): void => {
    (service as any).createDeck = jest.fn(() => deckFor(popOrder));
    (service as any).shuffle = jest.fn((deck: PlayingCard[]) => deck);
  };

  const startRound = (target: RoomState, popOrder: PlayingCard[]): RoomState => {
    fixedDeal(popOrder);
    return service.startPokDeng(target, target.roomHostId)!;
  };

  const withConfig = (target: RoomState, partial: Partial<CardGameConfig>): RoomState => {
    const validated = validateConfig({ preset: 'POK_DENG', ...partial }, POK_DENG_PRESET);
    expect(validated.ok).toBe(true);
    expect(validated.errors).toBeUndefined();
    target.cardGameConfig = validated.config;
    return target;
  };

  it('lets the active player draw a third card before the dealer resolves', () => {
    // p1 dealer holds A+4 (5); p2 holds 2+3 (5) and draws an 8 down to 3.
    const result = startRound(room(), [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', '2', 'HEARTS'),
      card('p1-b', '4', 'DIAMONDS'),
      card('p2-b', '3', 'SPADES'),
      card('draw-1', '8', 'CLUBS'),
    ]);

    expect(result.cardGameState?.activePlayerId).toBe('p2');
    expect(service.handleAction(result, 'p2', { type: 'DRAW' })).not.toBeNull();

    expect(result.cardGameState?.phase).toBe('RESULT');
    expect(result.cardGameState?.decisions.p2).toBe('DRAWN');
    expect(result.cardGameState?.handCounts.p2).toBe(3);
    expect(result.cardGameState?.handCounts.p1).toBe(2);
    expect(result.cardGameState?.result?.dealerScore).toBe(5);
    expect(result.cardGameChips).toEqual({ p1: 101, p2: 99 });
  });

  it('resolves immediately when the dealer has a natural', () => {
    // p1 dealer holds A+7 (8) — a natural ends the round before any draws.
    const result = startRound(room(), [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', 'K', 'HEARTS'),
      card('p1-b', '7', 'DIAMONDS'),
      card('p2-b', '5', 'SPADES'),
    ]);

    expect(result.cardGameState?.phase).toBe('RESULT');
    expect(result.cardGameState?.activePlayerId).toBeNull();
    expect(result.cardGameState?.result?.dealerScore).toBe(8);
    expect(result.cardGameState?.handCounts).toEqual({ p1: 2, p2: 2 });
    // The dealer's POK_8 pays 2x — the losing seat pays double the base stake.
    expect(result.cardGameChips).toEqual({ p1: 102, p2: 98 });
  });

  it('keeps the dealer on two cards once the dealer has five or more', () => {
    // Both seats land on 5, so the dealer does not draw and wins the tie by default policy.
    const result = startRound(room(), [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', '2', 'HEARTS'),
      card('p1-b', '4', 'DIAMONDS'),
      card('p2-b', '3', 'SPADES'),
    ]);

    expect(service.handleAction(result, 'p2', { type: 'STAND' })).not.toBeNull();

    expect(result.cardGameState?.result?.dealerScore).toBe(5);
    expect(result.cardGameState?.handCounts.p1).toBe(2);
    expect(result.cardGameState?.decisions.p2).toBe('STAND');
    expect(result.cardGameState?.result?.winnerIds).toEqual([]);
    expect(result.cardGameChips).toEqual({ p1: 101, p2: 99 });
  });

  it('ends the round immediately when the stock cannot supply a draw', () => {
    const result = startRound(room(), [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', '3', 'HEARTS'),
      card('p1-b', '2', 'DIAMONDS'),
      card('p2-b', '4', 'SPADES'),
      card('draw-1', '5', 'CLUBS'),
    ]);
    privateState.set(result.code, '__card-game-engine__', 'piles', {
      stock: [],
      discards: [],
      reserve: [],
    });

    expect(service.handleAction(result, 'p2', { type: 'DRAW' })).not.toBeNull();

    expect(result.cardGameState?.phase).toBe('RESULT');
    expect(result.cardGameState?.handCounts.p2).toBe(2);
    expect(result.cardGameState?.result?.dealerScore).toBe(3);
    expect(result.cardGameChips).toEqual({ p1: 99, p2: 101 });
  });

  it('settles a three-player round with the outcome multiplier per seat', () => {
    // p3 is dealt a natural Pok 9, so only p2 needs to act before the dealer showdown.
    const result = startRound(room(['p1', 'p2', 'p3']), [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', '2', 'HEARTS'),
      card('p3-a', '3', 'DIAMONDS'),
      card('p1-b', '4', 'SPADES'),
      card('p2-b', '5', 'CLUBS'),
      card('p3-b', '6', 'HEARTS'),
    ]);

    expect(result.cardGameState?.decisions.p3).toBe('NATURAL');
    expect(result.cardGameState?.activePlayerId).toBe('p2');
    expect(service.handleAction(result, 'p2', { type: 'STAND' })).not.toBeNull();

    expect(result.cardGameState?.result?.dealerScore).toBe(5);
    expect(result.cardGameState?.result?.winnerIds).toEqual(['p2', 'p3']);
    expect(result.cardGameState?.result?.outcomeTags.p3).toBe('POK_9');
    expect(result.cardGameChips).toEqual({ p1: 97, p2: 101, p3: 102 });
  });

  it('falls back to the first seat when the starter policy needs a host pick', () => {
    const target = withConfig(room(), {
      deal: { ...POK_DENG_PRESET.defaultConfig.deal, starterPolicy: 'HOST_SELECT' },
    });
    const result = startRound(target, [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', '2', 'HEARTS'),
      card('p1-b', '4', 'DIAMONDS'),
      card('p2-b', '3', 'SPADES'),
    ]);

    expect(result.cardGameState?.dealerId).toBe('p1');
  });

  it('pushes chips back when the hands tie and the preset chooses PUSH', () => {
    const target = withConfig(room(), {
      scoring: { ...POK_DENG_PRESET.defaultConfig.scoring, tiePolicy: 'PUSH' },
    });
    const result = startRound(target, [
      card('p1-a', 'A', 'CLUBS'),
      card('p2-a', '2', 'HEARTS'),
      card('p1-b', '4', 'DIAMONDS'),
      card('p2-b', '3', 'SPADES'),
    ]);

    expect(service.handleAction(result, 'p2', { type: 'STAND' })).not.toBeNull();

    expect(result.cardGameState?.result?.dealerScore).toBe(5);
    expect(result.cardGameState?.result?.winnerIds).toEqual([]);
    expect(result.cardGameChips).toEqual({ p1: 100, p2: 100 });
  });
});
