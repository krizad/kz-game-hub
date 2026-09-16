import { Test, TestingModule } from '@nestjs/testing';
import { GameType, PlayingCard, RoomState, RoomStatus } from '@repo/types';
import { CardGameService } from './card-game.service';
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

// Round-robin deal order: p1 card 1, p2 card 1, p1 card 2, p2 card 2, then the dealer's third card.
// p1 (dealer) scores 3 and draws to 8; p2 scores 7 and loses one chip to p1.
const DEAL_P1_BEATS_P2: PlayingCard[] = [
  card('p1-a', 'A', 'CLUBS'),
  card('p2-a', '3', 'HEARTS'),
  card('p1-b', '2', 'DIAMONDS'),
  card('p2-b', '4', 'SPADES'),
  card('draw-1', '5', 'CLUBS'),
];

// p1 (dealer) stands on 5; p2 holds a natural Pok 9 and wins a double stake.
const DEAL_P2_POK_9: PlayingCard[] = [
  card('p1-a', 'A', 'CLUBS'),
  card('p2-a', '9', 'HEARTS'),
  card('p1-b', '4', 'DIAMONDS'),
  card('p2-b', 'K', 'SPADES'),
];

describe('CardGameService', () => {
  let service: CardGameService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardGameService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();
    service = module.get(CardGameService);
  });

  const room = (): RoomState => ({
    id: 'room-id',
    code: 'POK123',
    gameType: GameType.CARD_GAME,
    status: RoomStatus.LOBBY,
    roomHostId: 'p1',
    createdAt: new Date(),
    config: { hostSelection: 'ROUND_ROBIN', timerMin: 5 },
    players: ['p1', 'p2'].map((socketId) => ({
      id: socketId,
      socketId,
      name: socketId,
      score: 0,
      roomId: 'room-id',
      connected: true,
    })),
  });

  const fixedDeal = (popOrder: PlayingCard[] = DEAL_P1_BEATS_P2): void => {
    (service as any).createDeck = jest.fn(() => deckFor(popOrder));
    (service as any).shuffle = jest.fn((deck: PlayingCard[]) => deck);
  };

  const startRound = (target: RoomState, popOrder?: PlayingCard[]): RoomState => {
    fixedDeal(popOrder);
    return service.startPokDeng(target, target.roomHostId)!;
  };

  const finishRound = (target: RoomState): void => {
    const active = target.cardGameState!.activePlayerId!;
    expect(service.handleAction(target, active, { type: 'STAND' })).not.toBeNull();
  };

  it('deals hidden hands without leaking them into public room state', () => {
    const result = startRound(room());
    expect(result.status).toBe(RoomStatus.PLAYING);
    expect(result.cardGameState?.phase).toBe('PLAYER_TURNS');
    expect(result.cardGameState?.activePlayerId).toBe('p2');
    expect(result.cardGameState?.handCounts).toEqual({ p1: 2, p2: 2 });
    expect(JSON.stringify(result)).not.toContain('CLUBS');
    expect(privateState.get(result.code, 'p1', 'cardGame')).toBeDefined();
    expect(privateState.get(result.code, 'p2', 'cardGame')).toBeDefined();
  });

  it('rejects actions from a player who does not own the active turn', () => {
    const result = startRound(room());
    const active = result.cardGameState!.activePlayerId;
    const other = active === 'p1' ? 'p2' : 'p1';
    expect(service.handleAction(result, other, { type: 'STAND' })).toBeNull();
  });

  it('deals the first round to the first seated player and rotates the dealer', () => {
    const result = startRound(room());
    expect(result.cardGameState?.dealerId).toBe('p1');
    finishRound(result);
    const second = service.handleAction(result, 'p1', { type: 'NEXT_ROUND' })!;
    expect(second.cardGameState?.dealerId).toBe('p2');
  });

  it('keeps chip balances across rounds for the whole match', () => {
    const result = startRound(room());
    finishRound(result);
    expect(result.status).toBe(RoomStatus.RESULT);
    expect(result.cardGameState?.phase).toBe('RESULT');
    expect(result.cardGameState?.handCounts.p1).toBe(3);
    expect(result.cardGameChips).toEqual({ p1: 101, p2: 99 });
    expect(result.cardGameState?.chips).toEqual({ p1: 101, p2: 99 });

    const second = service.handleAction(result, 'p1', { type: 'NEXT_ROUND' })!;
    expect(second.cardGameChips).toEqual({ p1: 101, p2: 99 });
    expect(second.cardGameState?.chips).toEqual({ p1: 101, p2: 99 });
  });

  it('settles a natural Pok 9 with the preset multiplier', () => {
    const result = startRound(room(), DEAL_P2_POK_9);
    expect(result.cardGameState?.phase).toBe('RESULT');
    expect(result.cardGameState?.result?.outcomeTags.p2).toBe('POK_9');
    expect(result.cardGameState?.result?.winnerIds).toEqual(['p2']);
    expect(result.cardGameState?.result?.dealerScore).toBe(5);
    expect(result.cardGameChips).toEqual({ p1: 98, p2: 102 });
  });

  it('accepts NEXT_ROUND only from the host and only after a result', () => {
    const result = startRound(room());
    expect(service.handleAction(result, 'p1', { type: 'NEXT_ROUND' })).toBeNull();
    finishRound(result);
    expect(service.handleAction(result, 'p2', { type: 'NEXT_ROUND' })).toBeNull();
    expect(service.handleAction(result, 'p1', { type: 'NEXT_ROUND' })).not.toBeNull();
  });

  it('allows balances to go negative instead of clamping them', () => {
    const target = room();
    target.cardGameChips = { p1: 0, p2: 0 };
    startRound(target);
    finishRound(target);
    expect(target.cardGameChips).toEqual({ p1: 1, p2: -1 });
  });

  it('cancels the round, clears private hands, and keeps balances', () => {
    const result = startRound(room());
    const balances = { ...result.cardGameChips! };
    service.cancelRound(result);
    expect(result.cardGameState).toBeUndefined();
    expect(result.status).toBe(RoomStatus.LOBBY);
    expect(result.cardGameChips).toEqual(balances);
    expect(privateState.get(result.code, 'p1', 'cardGame')).toBeUndefined();
    expect(privateState.get(result.code, 'p2', 'cardGame')).toBeUndefined();
    expect(privateState.get(result.code, '__card-game-engine__', 'piles')).toBeUndefined();
  });

  it('remaps every public state reference on reconnect', () => {
    const result = startRound(room());
    finishRound(result);
    result.cardGameChips!.p1 = 37;
    result.cardGameState!.chips.p1 = 37;
    service.remapSocketId(result.cardGameState!, 'p1', 'p1-new');
    expect(result.cardGameState!.playerOrder).toContain('p1-new');
    expect(result.cardGameState!.chips['p1-new']).toBe(37);
    expect(result.cardGameState!.chips['p2']).toBe(99);
    expect(result.cardGameState!.result!.outcomeTags['p1-new']).toBeDefined();
    expect(result.cardGameState!.result!.outcomeTags['p1']).toBeUndefined();
  });
});
