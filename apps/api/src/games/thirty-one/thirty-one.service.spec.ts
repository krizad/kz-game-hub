import { Test, TestingModule } from '@nestjs/testing';
import { GameType, PlayingCard, RoomState, RoomStatus, ThirtyOnePrivateState } from '@repo/types';
import * as pokerEngine from '../poker/poker-engine';
import { PrivateStateService } from '../private-state.service';
import { ThirtyOneService, evaluateThirtyOneHand } from './thirty-one.service';

const ENGINE_ID = '__thirty-one-engine__';
const PRIVATE_KEY = 'thirtyOne';

function card(rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard {
  return { id: `${rank}-${suit}`, rank, suit };
}

function makeRoom(playerCount = 3, overrides?: Partial<RoomState['config']>): RoomState {
  const players = Array.from({ length: playerCount }, (_, idx) => ({
    id: `p${idx + 1}`,
    name: `Player ${idx + 1}`,
    socketId: `s${idx + 1}`,
    score: 0,
    roomId: 'ROOM1',
    connected: true,
  }));

  return {
    id: 'ROOM1',
    code: 'ROOM1',
    gameType: GameType.THIRTY_ONE,
    status: RoomStatus.LOBBY,
    roomHostId: 's1',
    players,
    createdAt: new Date(),
    config: {
      hostSelection: 'FIXED',
      timerMin: 5,
      thirtyOneTurnSeconds: 0,
      ...overrides,
    },
  } as unknown as RoomState;
}

/**
 * Helper to create a deterministic 52-card deck where `shuffleDeck` returns
 * cards so that `.pop()` deals `hands` (round-robin: c0 for each player, c1, c2)
 * followed by `firstDiscard`, and then `drawTops` on subsequent `.pop()` calls.
 */
function mockDeterministicDeck(
  hands: PlayingCard[][],
  firstDiscard: PlayingCard,
  drawTops: PlayingCard[] = [],
): jest.SpyInstance {
  const full = pokerEngine.createDeck();
  const used = new Set<string>();
  const dealOrder: PlayingCard[] = [];

  for (let c = 0; c < 3; c++) {
    for (let p = 0; p < hands.length; p++) {
      const target = hands[p][c];
      used.add(target.id);
      dealOrder.push(target);
    }
  }
  used.add(firstDiscard.id);
  for (const dt of drawTops) used.add(dt.id);

  const rest = full.filter((c) => !used.has(c.id));
  // Since dealRound uses .pop(), end of array is dealt first:
  // [...rest, ...reversedDrawTops, firstDiscard, ...reversedDealOrder]
  const rigged = [...rest, ...[...drawTops].reverse(), firstDiscard, ...[...dealOrder].reverse()];

  return jest.spyOn(pokerEngine, 'shuffleDeck').mockReturnValueOnce(rigged);
}

describe('evaluateThirtyOneHand', () => {
  it('scores only the highest single-suit total', () => {
    const hand = [card('K', 'SPADES'), card('9', 'SPADES'), card('A', 'HEARTS')];
    const res = evaluateThirtyOneHand(hand);
    expect(res).toEqual({
      score: 19,
      bestSuit: 'SPADES',
      isThreeOfAKind: false,
      isBlitz: false,
    });
  });

  it('scores A=11, K/Q/J/10=10, and detects 31 Blitz', () => {
    const hand = [card('A', 'HEARTS'), card('Q', 'HEARTS'), card('10', 'HEARTS')];
    const res = evaluateThirtyOneHand(hand);
    expect(res).toEqual({
      score: 31,
      bestSuit: 'HEARTS',
      isThreeOfAKind: false,
      isBlitz: true,
    });
  });

  it('scores Three of a Kind as 30.5 (including three Aces)', () => {
    expect(
      evaluateThirtyOneHand([card('4', 'SPADES'), card('4', 'HEARTS'), card('4', 'DIAMONDS')]),
    ).toEqual({
      score: 30.5,
      bestSuit: null,
      isThreeOfAKind: true,
      isBlitz: false,
    });
    expect(
      evaluateThirtyOneHand([card('A', 'SPADES'), card('A', 'HEARTS'), card('A', 'CLUBS')]),
    ).toEqual({
      score: 30.5,
      bestSuit: null,
      isThreeOfAKind: true,
      isBlitz: false,
    });
  });
});

describe('ThirtyOneService', () => {
  let service: ThirtyOneService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThirtyOneService, PrivateStateService],
    }).compile();

    service = module.get(ThirtyOneService);
    privateState = module.get(PrivateStateService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deals 3 cards to 3 players, 1 discard, 42 draw pile, starting left of dealer', () => {
    const room = makeRoom(3);
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('5', 'DIAMONDS'), card('8', 'HEARTS')],
        [card('3', 'CLUBS'), card('6', 'DIAMONDS'), card('9', 'HEARTS')],
        [card('4', 'CLUBS'), card('7', 'DIAMONDS'), card('10', 'HEARTS')],
      ],
      card('J', 'SPADES'),
    );

    const started = service.startMatch(room, 's1');
    expect(started).not.toBeNull();
    expect(room.status).toBe(RoomStatus.PLAYING);

    const state = room.thirtyOneState!;
    expect(state.phase).toBe('PLAYING');
    expect(state.roundNumber).toBe(1);
    expect(state.dealerId).toBe('s1');
    expect(state.activePlayerId).toBe('s2'); // left of dealer
    expect(state.turnSubPhase).toBe('CHOOSE_ACTION');
    expect(state.drawPileCount).toBe(42);
    expect(state.discardPileCount).toBe(1);
    expect(state.topDiscard?.id).toBe('J-SPADES');
    expect(state.seats.s1.lives).toBe(3);
    expect(state.seats.s2.lives).toBe(3);
    expect(state.seats.s3.lives).toBe(3);

    const p2Priv = privateState.get<ThirtyOnePrivateState>('ROOM1', 's2', PRIVATE_KEY);
    expect(p2Priv?.hand).toHaveLength(3);
    expect(p2Priv?.evaluation?.score).toBe(9);
  });

  it('rejects starting with < 2 or > 9 players, or by non-host', () => {
    expect(service.startMatch(makeRoom(1), 's1')).toBeNull();
    expect(service.startMatch(makeRoom(10), 's1')).toBeNull();
    expect(service.startMatch(makeRoom(3), 's2')).toBeNull();
  });

  it('triggers immediate BLITZ showdown when dealt 31 on the initial deal', () => {
    const room = makeRoom(3);
    mockDeterministicDeck(
      [
        [card('A', 'SPADES'), card('K', 'SPADES'), card('10', 'SPADES')], // 31!
        [card('2', 'CLUBS'), card('5', 'DIAMONDS'), card('8', 'HEARTS')],
        [card('3', 'CLUBS'), card('6', 'DIAMONDS'), card('9', 'HEARTS')],
      ],
      card('4', 'DIAMONDS'),
    );

    service.startMatch(room, 's1');
    const state = room.thirtyOneState!;
    expect(state.phase).toBe('ROUND_RESULT');
    expect(state.showdown?.reason).toBe('BLITZ');
    expect(state.showdown?.winnerIds).toEqual(['s1']);
    expect(state.showdown?.loserIds).toEqual(['s2', 's3']);
    expect(state.seats.s1.lives).toBe(3);
    expect(state.seats.s2.lives).toBe(2);
    expect(state.seats.s3.lives).toBe(2);
  });

  it('enforces anti-stall rule: cannot discard the exact card drawn from Discard Pile', () => {
    const room = makeRoom(2);
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('5', 'DIAMONDS'), card('8', 'HEARTS')],
        [card('3', 'CLUBS'), card('6', 'DIAMONDS'), card('9', 'HEARTS')],
      ],
      card('Q', 'SPADES'),
    );

    service.startMatch(room, 's1');
    expect(room.thirtyOneState?.activePlayerId).toBe('s2');

    // Draw from discard
    expect(service.handleAction(room, 's2', { type: 'DRAW_DISCARD' })).not.toBeNull();
    expect(room.thirtyOneState?.turnSubPhase).toBe('DISCARD');

    // Attempt to discard Q-SPADES right back -> rejected!
    expect(service.handleAction(room, 's2', { type: 'DISCARD', cardId: 'Q-SPADES' })).toBeNull();

    // Discard another card -> allowed
    expect(service.handleAction(room, 's2', { type: 'DISCARD', cardId: '3-CLUBS' })).not.toBeNull();
    expect(room.thirtyOneState?.activePlayerId).toBe('s1');
    expect(room.thirtyOneState?.topDiscard?.id).toBe('3-CLUBS');
  });

  it('allows discarding the card just drawn from the Stock (Draw Pile)', () => {
    const room = makeRoom(2);
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('5', 'DIAMONDS'), card('8', 'HEARTS')],
        [card('3', 'CLUBS'), card('6', 'DIAMONDS'), card('9', 'HEARTS')],
      ],
      card('Q', 'SPADES'),
      [card('7', 'CLUBS')],
    );

    service.startMatch(room, 's1');
    expect(service.handleAction(room, 's2', { type: 'DRAW_STOCK' })).not.toBeNull();
    expect(service.handleAction(room, 's2', { type: 'DISCARD', cardId: '7-CLUBS' })).not.toBeNull();
    expect(room.thirtyOneState?.topDiscard?.id).toBe('7-CLUBS');
    expect(room.thirtyOneState?.activePlayerId).toBe('s1');
  });

  it('handles Knock, 1 final turn per other player, and Knock Penalty (-2 lives) when knocker is lowest or tied lowest', () => {
    const room = makeRoom(3);
    // s1 has 20 (K+10), s2 has 15 (9+6), s3 has 15 (8+7)
    mockDeterministicDeck(
      [
        [card('K', 'SPADES'), card('10', 'SPADES'), card('2', 'CLUBS')], // 20
        [card('9', 'HEARTS'), card('6', 'HEARTS'), card('2', 'DIAMONDS')], // 15
        [card('8', 'CLUBS'), card('7', 'CLUBS'), card('3', 'DIAMONDS')], // 15
      ],
      card('4', 'HEARTS'),
      [card('3', 'SPADES'), card('5', 'DIAMONDS')],
    );

    service.startMatch(room, 's1');
    // s2 knocks with 15!
    expect(service.handleAction(room, 's2', { type: 'KNOCK' })).not.toBeNull();
    expect(room.thirtyOneState?.knockerId).toBe('s2');
    expect(room.thirtyOneState?.finalTurnQueue).toEqual(['s3', 's1']);
    expect(room.thirtyOneState?.activePlayerId).toBe('s3');

    // Cannot knock again once table is knocked
    expect(service.handleAction(room, 's3', { type: 'KNOCK' })).toBeNull();

    // s3 takes final turn (draws 3-SPADES, discards 3-SPADES -> stays 15)
    service.handleAction(room, 's3', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's3', { type: 'DISCARD', cardId: '3-SPADES' });
    expect(room.thirtyOneState?.activePlayerId).toBe('s1');

    // s1 takes final turn (draws 5-DIAMONDS, discards 5-DIAMONDS -> stays 20)
    service.handleAction(room, 's1', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's1', { type: 'DISCARD', cardId: '5-DIAMONDS' });

    // Showdown: s2 (15) tied for lowest with s3 (15), so s2 takes Knock Penalty (-2 lives)!
    const state = room.thirtyOneState!;
    expect(state.phase).toBe('ROUND_RESULT');
    expect(state.showdown?.reason).toBe('KNOCK');
    expect(state.showdown?.knockPenalty).toBe(true);
    expect(state.showdown?.loserIds).toEqual(['s2']);
    expect(state.seats.s2.lives).toBe(1);
    expect(state.seats.s3.lives).toBe(3);
    expect(state.seats.s1.lives).toBe(3);
  });

  it('penalizes all tied lowest players (-1 each) when knocker is NOT among lowest', () => {
    const room = makeRoom(3);
    mockDeterministicDeck(
      [
        [card('A', 'SPADES'), card('10', 'SPADES'), card('2', 'CLUBS')], // s1 = 21
        [card('9', 'HEARTS'), card('6', 'HEARTS'), card('2', 'DIAMONDS')], // s2 = 15
        [card('8', 'CLUBS'), card('7', 'CLUBS'), card('3', 'DIAMONDS')], // s3 = 15
      ],
      card('4', 'HEARTS'),
      [card('3', 'SPADES'), card('5', 'DIAMONDS')],
    );

    service.startMatch(room, 's1');
    // s2 draws/discards harmlessly
    service.handleAction(room, 's2', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's2', { type: 'DISCARD', cardId: '3-SPADES' });
    // s3 draws/discards harmlessly
    service.handleAction(room, 's3', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's3', { type: 'DISCARD', cardId: '5-DIAMONDS' });
    // s1 knocks with 21!
    service.handleAction(room, 's1', { type: 'KNOCK' });
    // s2 draws/discards
    service.handleAction(room, 's2', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's2', { type: 'DISCARD', cardId: '2-SPADES' }); // wait, let's discard from hand
    // Actually let's draw discard (4-HEARTS) and discard 2-DIAMONDS? No, 4-HEARTS + 9 + 6 = 19, let's check
    // Wait: in the mock above, drawTops only had 2 cards, so rest of deck is on top. Let's just check what s2 holds:
    const s2Hand = privateState.get<ThirtyOnePrivateState>('ROOM1', 's2', PRIVATE_KEY)!.hand;
    const s2Drawn = s2Hand[s2Hand.length - 1];
    service.handleAction(room, 's2', { type: 'DISCARD', cardId: s2Drawn.id });

    // s3 draws from stock and discards drawn card so s3 stays 15
    service.handleAction(room, 's3', { type: 'DRAW_STOCK' });
    const s3Hand = privateState.get<ThirtyOnePrivateState>('ROOM1', 's3', PRIVATE_KEY)!.hand;
    const s3Drawn = s3Hand[s3Hand.length - 1];
    service.handleAction(room, 's3', { type: 'DISCARD', cardId: s3Drawn.id });

    const state = room.thirtyOneState!;
    expect(state.phase).toBe('ROUND_RESULT');
    expect(state.showdown?.knockPenalty).toBe(false);
    expect(state.showdown?.loserIds).toEqual(['s2', 's3']);
    expect(state.seats.s1.lives).toBe(3);
    expect(state.seats.s2.lives).toBe(2);
    expect(state.seats.s3.lives).toBe(2);
  });

  it('Three of a Kind (30.5) beats 30, and loses only to 31 (Blitz)', () => {
    const room = makeRoom(3);
    // s1 has 30 (K+Q+J of Spades), s2 has Three of a Kind (4s = 30.5), s3 has 25
    mockDeterministicDeck(
      [
        [card('K', 'SPADES'), card('Q', 'SPADES'), card('J', 'SPADES')], // 30
        [card('4', 'SPADES'), card('4', 'HEARTS'), card('4', 'DIAMONDS')], // 30.5
        [card('A', 'CLUBS'), card('9', 'CLUBS'), card('5', 'CLUBS')], // 25
      ],
      card('2', 'HEARTS'),
      [card('3', 'HEARTS'), card('6', 'DIAMONDS')],
    );

    service.startMatch(room, 's1');
    service.handleAction(room, 's2', { type: 'KNOCK' });
    service.handleAction(room, 's3', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's3', { type: 'DISCARD', cardId: '3-HEARTS' });
    service.handleAction(room, 's1', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's1', { type: 'DISCARD', cardId: '6-DIAMONDS' });

    const showdown = room.thirtyOneState!.showdown!;
    expect(showdown.handScores.s2.score).toBe(30.5);
    expect(showdown.handScores.s1.score).toBe(30);
    expect(showdown.winnerIds).toEqual(['s2']);
    expect(showdown.loserIds).toEqual(['s3']);
  });

  it('gives On the Welfare (0 lives) 1 final round and eliminates on next loss, declaring last survivor winner', () => {
    const room = makeRoom(2);
    // Give s2 31 on deal repeatedly? Let's test Welfare transition over rounds:
    // Round 1: s1 knocks and loses 2 -> 1 life
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('3', 'DIAMONDS'), card('4', 'HEARTS')], // s1 = 4
        [card('K', 'SPADES'), card('Q', 'SPADES'), card('5', 'HEARTS')], // s2 = 20
      ],
      card('6', 'CLUBS'),
      [card('7', 'DIAMONDS'), card('8', 'HEARTS')],
    );
    service.startMatch(room, 's1');
    // s2 draws & discards
    service.handleAction(room, 's2', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's2', { type: 'DISCARD', cardId: '7-DIAMONDS' });
    // s1 knocks with 4 -> loses 2 lives -> lives = 1
    service.handleAction(room, 's1', { type: 'KNOCK' });
    service.handleAction(room, 's2', { type: 'DRAW_STOCK' });
    service.handleAction(room, 's2', { type: 'DISCARD', cardId: '8-HEARTS' });
    expect(room.thirtyOneState?.seats.s1.lives).toBe(1);
    expect(room.thirtyOneState?.seats.s1.onWelfare).toBe(false);

    // Round 2: s2 gets 31 on deal -> s1 loses 1 life -> enters Welfare (0 lives, NOT eliminated!)
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('3', 'DIAMONDS'), card('4', 'HEARTS')],
        [card('A', 'SPADES'), card('K', 'SPADES'), card('10', 'SPADES')], // 31!
      ],
      card('6', 'CLUBS'),
    );
    service.handleAction(room, 's1', { type: 'NEXT_ROUND' });
    expect(room.thirtyOneState?.phase).toBe('ROUND_RESULT');
    expect(room.thirtyOneState?.seats.s1.lives).toBe(0);
    expect(room.thirtyOneState?.seats.s1.onWelfare).toBe(true);
    expect(room.thirtyOneState?.seats.s1.status).toBe('ACTIVE');

    // Round 3: s2 gets 31 on deal again -> s1 loses while On the Welfare -> ELIMINATED -> s2 WINS MATCH!
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('3', 'DIAMONDS'), card('4', 'HEARTS')],
        [card('A', 'HEARTS'), card('K', 'HEARTS'), card('10', 'HEARTS')], // 31!
      ],
      card('6', 'CLUBS'),
    );
    service.handleAction(room, 's1', { type: 'NEXT_ROUND' });
    expect(room.thirtyOneState?.seats.s1.status).toBe('ELIMINATED');
    expect(room.thirtyOneState?.phase).toBe('MATCH_OVER');
    expect(room.thirtyOneState?.winnerId).toBe('s2');
    expect(room.status).toBe(RoomStatus.RESULT);
  });

  it('reshuffles discard pile (keeping top discard card) when draw pile runs out', () => {
    const room = makeRoom(2);
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('3', 'DIAMONDS'), card('4', 'HEARTS')],
        [card('5', 'CLUBS'), card('6', 'DIAMONDS'), card('7', 'HEARTS')],
      ],
      card('8', 'SPADES'),
    );

    service.startMatch(room, 's1');
    // Artificially empty draw pile and put 4 cards in discard pile
    privateState.set('ROOM1', ENGINE_ID, 'deck', {
      drawPile: [],
      discardPile: [
        card('9', 'CLUBS'),
        card('10', 'CLUBS'),
        card('J', 'CLUBS'),
        card('Q', 'SPADES'),
      ],
    });
    room.thirtyOneState!.drawPileCount = 0;
    room.thirtyOneState!.discardPileCount = 4;
    room.thirtyOneState!.topDiscard = card('Q', 'SPADES');

    expect(service.handleAction(room, 's2', { type: 'DRAW_STOCK' })).not.toBeNull();
    expect(room.thirtyOneState?.reshuffledThisTurn).toBe(true);
    expect(room.thirtyOneState?.topDiscard?.id).toBe('Q-SPADES');
    expect(room.thirtyOneState?.discardPileCount).toBe(1);
    expect(room.thirtyOneState?.drawPileCount).toBe(2); // 3 recycled - 1 drawn = 2
  });

  it('remaps socket IDs cleanly on reconnect and handles turn timeout', () => {
    const room = makeRoom(2, { thirtyOneTurnSeconds: 30 });
    mockDeterministicDeck(
      [
        [card('2', 'CLUBS'), card('3', 'DIAMONDS'), card('4', 'HEARTS')],
        [card('5', 'CLUBS'), card('6', 'DIAMONDS'), card('7', 'HEARTS')],
      ],
      card('8', 'SPADES'),
    );

    service.startMatch(room, 's1');
    const state = room.thirtyOneState!;
    expect(state.activePlayerId).toBe('s2');
    const deadline = state.turnDeadline!;
    expect(deadline).toBeGreaterThan(Date.now() - 1000);

    service.remapSocketId(state, 's2', 's2-new');
    privateState.remapSocketId('ROOM1', 's2', 's2-new');
    expect(state.activePlayerId).toBe('s2-new');

    const timedOut = service.handleTurnTimeout(room, deadline);
    expect(timedOut).not.toBeNull();
    expect(state.activePlayerId).toBe('s1');
    expect(state.turnSubPhase).toBe('CHOOSE_ACTION');
  });

  it('ends match if active player leaves leaving 1 survivor', () => {
    const room = makeRoom(2);
    service.startMatch(room, 's1');
    service.handlePlayerRemoved(room, 's2');
    expect(room.thirtyOneState?.phase).toBe('MATCH_OVER');
    expect(room.thirtyOneState?.winnerId).toBe('s1');
    expect(room.status).toBe(RoomStatus.RESULT);
  });
});
