import { Test, TestingModule } from '@nestjs/testing';
import { GameType, PlayingCard, PokerV2Action, RoomState, RoomStatus } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { PokerV2Service } from './poker-v2.service';
import { buildAdvisor, detectDraws, simulateEquity } from './poker-v2-advisor';
import { evaluateHand } from '../poker/poker-engine';

const ENGINE_ID = '__poker-v2-engine__';
const PRIVATE_KEY = 'pokerV2';

function card(rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard {
  return { id: `${rank}-${suit}`, rank, suit };
}

describe('PokerV2Service', () => {
  let service: PokerV2Service;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PokerV2Service, PrivateStateService],
    }).compile();

    service = module.get(PokerV2Service);
    privateState = module.get(PrivateStateService);
  });

  function makeRoom(playerCount = 3): RoomState {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      id: String(i + 1),
      name: ['A', 'B', 'C', 'D'][i],
      socketId: `s${i + 1}`,
      score: 0,
      roomId: 'r1',
      connected: true,
    }));
    return {
      id: 'r1',
      gameType: GameType.POKER_V2,
      code: 'POKERV2',
      status: RoomStatus.LOBBY,
      roomHostId: 's1',
      players,
      createdAt: new Date(),
      config: {
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5,
        pokerV2SmallBlind: 10,
        pokerV2BigBlind: 20,
        pokerV2StartingStack: 1000,
        pokerV2Ante: 0,
        pokerV2TurnTimerEnabled: false,
        pokerV2AutoDealSeconds: 5,
      },
    } as unknown as RoomState;
  }

  /** Rewrite the stored deck so the next five pops are exactly `board`. */
  function setDeckForBoard(room: RoomState, board: PlayingCard[]): void {
    const deck = privateState.get<PlayingCard[]>(room.code, ENGINE_ID, 'deck')!;
    const crafted = deck.slice(0, deck.length - board.length);
    crafted.push(...[...board].reverse());
    privateState.set(room.code, ENGINE_ID, 'deck', crafted);
  }

  function setHoleCards(room: RoomState, socketId: string, holeCards: PlayingCard[]): void {
    privateState.set(room.code, socketId, PRIVATE_KEY, { holeCards });
  }

  /** Drive betting with check/call until the phase leaves the streets. */
  function checkCallDown(room: RoomState, untilPhase?: string): void {
    const state = room.pokerV2State!;
    let guard = 0;
    while (state.activePlayerId && guard < 60 && (!untilPhase || state.phase !== untilPhase)) {
      const actor = state.activePlayerId;
      const seat = state.seats[actor];
      const toCall = Math.max(0, state.currentBet - seat.bet);
      const action: PokerV2Action = toCall === 0 ? { type: 'CHECK' } : { type: 'CALL' };
      const result = service.handleAction(room, actor, action);
      expect(result).not.toBeNull();
      guard += 1;
    }
  }

  function totalChips(state: NonNullable<RoomState['pokerV2State']>): number {
    let sum = state.pot;
    for (const id of state.playerOrder) {
      sum += state.seats[id].chips + state.seats[id].bet;
    }
    return sum;
  }

  it('startMatch deals blinds, private hole cards and a preflop advisor', () => {
    const room = makeRoom();
    const result = service.startMatch(room, 's1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(RoomStatus.PLAYING);

    const state = result!.pokerV2State!;
    expect(state.handNumber).toBe(1);
    expect(state.phase).toBe('PREFLOP');
    expect(state.currentBet).toBe(20);
    expect(state.board).toHaveLength(0);

    for (const id of state.playerOrder) {
      const hole = privateState.get<{ holeCards?: PlayingCard[] }>(
        room.code,
        id,
        PRIVATE_KEY,
      )?.holeCards;
      expect(hole).toHaveLength(2);
      const advisor = privateState.get<{ advisor?: { winProbability: number } }>(
        room.code,
        id,
        PRIVATE_KEY,
      )?.advisor;
      expect(advisor).toBeDefined();
      expect(advisor!.winProbability).toBeGreaterThan(0);
      expect(advisor!.winProbability).toBeLessThan(1);
    }
    expect(totalChips(state)).toBe(3000);
  });

  it('startMatch rejects non-host and undersized rooms', () => {
    const room = makeRoom();
    expect(service.startMatch(room, 's2')).toBeNull();
    expect(service.startMatch(makeRoom(1), 's1')).toBeNull();
  });

  it('check/call closes preflop and deals the flop automatically', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    checkCallDown(room, 'FLOP');
    expect(state.phase).toBe('FLOP');
    expect(state.board).toHaveLength(3);
    expect(state.currentBet).toBe(0);
    expect(state.activePlayerId).not.toBeNull();
  });

  it('check/call down reaches an auto-revealed showdown', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    setDeckForBoard(room, [
      card('A', 'HEARTS'),
      card('K', 'HEARTS'),
      card('Q', 'HEARTS'),
      card('J', 'HEARTS'),
      card('10', 'HEARTS'),
    ]);
    checkCallDown(room);

    const state = room.pokerV2State!;
    expect(state.board).toHaveLength(5);
    expect(state.phase).toBe('HAND_RESULT');
    expect(Object.keys(state.showdown!.revealedCards)).toHaveLength(3);
    expect(state.handResult!.pots).toHaveLength(1);
    expect(state.handResult!.pots[0].winnerIds.length).toBeGreaterThanOrEqual(1);
    expect(state.nextHandDeadline).not.toBeNull();

    // Winner takes the pot; total chips are conserved.
    const before = totalChips(state);
    expect(before).toBe(3000);
    for (const id of state.playerOrder) {
      expect(state.seats[id].handCategory).toBeDefined();
    }
  });

  it('folding to one seat awards the uncontested pot and arms auto-deal', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;

    // Find two non-active seats to fold, whoever acts gets checked down.
    let folds = 0;
    let guard = 0;
    while (state.phase !== 'HAND_RESULT' && folds < 2 && guard < 40) {
      guard += 1;
      const actor = state.activePlayerId!;
      if (folds < 2) {
        const result = service.handleAction(room, actor, { type: 'FOLD' });
        expect(result).not.toBeNull();
        folds += 1;
      }
    }
    expect(state.phase).toBe('HAND_RESULT');
    const winner = state.handResult!.pots[0].winnerIds;
    expect(winner).toHaveLength(1);
    expect(state.nextHandDeadline).not.toBeNull();

    // Time-travel past the countdown, then auto-deal.
    state.nextHandDeadline = Date.now() - 1000;
    expect(service.autoDealIfDue(room)).toBe(true);
    expect(state.handNumber).toBe(2);
    expect(state.phase).toBe('PREFLOP');
    expect(state.nextHandDeadline).toBeNull();
  });

  it('autoDealIfDue is a no-op before the countdown elapses', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    // Force a hand result state with a future deadline.
    state.nextHandDeadline = Date.now() + 60_000;
    state.phase = 'HAND_RESULT';
    expect(service.autoDealIfDue(room)).toBe(false);
    expect(state.handNumber).toBe(1);
  });

  it('any seated player can skip the countdown with START_HAND', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    // Fold down to end the hand.
    let folds = 0;
    let guard = 0;
    while (state.phase !== 'HAND_RESULT' && folds < 2 && guard < 40) {
      guard += 1;
      service.handleAction(room, state.activePlayerId!, { type: 'FOLD' });
      folds += 1;
    }
    expect(state.phase).toBe('HAND_RESULT');
    const hand1 = state.handNumber;

    // A non-host seat skips the countdown — host-only would return null.
    const nonHost = state.playerOrder.find((id) => id !== room.roomHostId)!;
    expect(service.handleAction(room, nonHost, { type: 'START_HAND' })).not.toBeNull();
    expect(state.handNumber).toBe(hand1 + 1);
    expect(state.phase).toBe('PREFLOP');
  });

  it('records settled hands into the bounded history', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    let guard = 0;
    while (state.phase !== 'HAND_RESULT' && guard < 40) {
      guard += 1;
      service.handleAction(room, state.activePlayerId!, { type: 'FOLD' });
    }
    expect(state.history).toHaveLength(1);
    const entry = state.history[0];
    expect(entry.handNumber).toBe(1);
    expect(entry.pots).toHaveLength(1);
    expect(entry.pots[0].winnerIds).toHaveLength(1);
    expect(entry.revealedCards).toEqual({}); // uncontested hand never reveals

    // History is bounded.
    for (let i = 0; i < 30; i++) {
      state.nextHandDeadline = Date.now() - 1000;
      service.autoDealIfDue(room);
      guard = 0;
      while (state.phase !== 'HAND_RESULT' && guard < 40) {
        guard += 1;
        service.handleAction(room, state.activePlayerId!, { type: 'FOLD' });
      }
    }
    expect(state.history.length).toBeLessThanOrEqual(20);
    expect(state.history[state.history.length - 1].handNumber).toBe(state.handNumber);
  });

  it('skips advisor computation when the room switches it off', () => {
    const room = makeRoom();
    room.config.pokerV2AdvisorEnabled = false;
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    for (const id of state.playerOrder) {
      const data = privateState.get<{ holeCards?: PlayingCard[]; advisor?: unknown }>(
        room.code,
        id,
        PRIVATE_KEY,
      );
      expect(data?.holeCards).toHaveLength(2);
      expect(data?.advisor).toBeUndefined();
    }
  });

  it('heads-up all-in: winner takes the match and the room ends', () => {
    const room = makeRoom(2);
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;

    // s1 holds aces, s2 kings; the board brings no king.
    setHoleCards(room, 's1', [card('A', 'SPADES'), card('A', 'HEARTS')]);
    setHoleCards(room, 's2', [card('K', 'SPADES'), card('K', 'HEARTS')]);
    setDeckForBoard(room, [
      card('2', 'CLUBS'),
      card('7', 'DIAMONDS'),
      card('9', 'CLUBS'),
      card('J', 'DIAMONDS'),
      card('3', 'SPADES'),
    ]);

    // Whoever acts first shoves; the other calls all-in.
    let guard = 0;
    while (state.phase === 'PREFLOP' && guard < 10) {
      guard += 1;
      const actor = state.activePlayerId!;
      service.handleAction(room, actor, { type: 'ALL_IN' });
    }
    expect(state.phase).toBe('HAND_RESULT');
    expect(state.handResult!.matchEnded).toBe(true);
    expect(room.status).toBe(RoomStatus.RESULT);

    const winnerId = state.handResult!.pots[0].winnerIds[0];
    const loserId = state.playerOrder.find((id) => id !== winnerId)!;
    expect(state.seats[winnerId].chips).toBe(2000);
    expect(state.seats[loserId].chips).toBe(0);
    expect(room.players.find((p) => p.socketId === winnerId)!.score).toBe(2000);
    expect(room.players.find((p) => p.socketId === loserId)!.score).toBe(0);
  });

  it('disconnect mid-hand folds the seat and betting continues', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    const dropper = state.playerOrder.find((id) => id !== state.activePlayerId)!;
    privateState.set(room.code, dropper, PRIVATE_KEY, {
      holeCards: [card('2', 'CLUBS'), card('3', 'CLUBS')],
    });

    service.handlePlayerRemoved(room, dropper);
    expect(state.seats[dropper].status).toBe('FOLDED');
    expect(state.phase).not.toBe('HAND_RESULT');
    expect(state.activePlayerId).not.toBe(dropper);

    // Check it down: the remaining two play for the pot.
    checkCallDown(room);
    expect(state.phase).toBe('HAND_RESULT');
    expect(state.showdown!.revealedCards[dropper]).toBeUndefined();
  });

  it('remapSocketId migrates every socket-keyed field', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    const dealer = state.dealerId!;
    const anySeat = state.playerOrder.find((id) => id !== dealer)!;

    service.remapSocketId(state, dealer, 'new-dealer');
    expect(state.dealerId).toBe('new-dealer');
    expect(state.playerOrder).toContain('new-dealer');
    expect(state.seats['new-dealer']).toBeDefined();
    expect(state.seats[dealer]).toBeUndefined();

    service.remapSocketId(state, anySeat, 'moved-seat');
    expect(state.playerOrder).toContain('moved-seat');
    expect(state.playerOrder).not.toContain(anySeat);
  });

  it('resetMatch returns the room to the lobby and wipes private state', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    expect(service.resetMatch(room, 's2')).toBeNull();
    const result = service.resetMatch(room, 's1');
    expect(result).not.toBeNull();
    expect(room.status).toBe(RoomStatus.LOBBY);
    expect(room.pokerV2State).toBeUndefined();
    for (const player of room.players) {
      expect(privateState.get(room.code, player.socketId, PRIVATE_KEY)).toBeUndefined();
    }
  });

  it('conserves chips across a full hand with an all-in call', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerV2State!;
    const totalBefore = totalChips(state);
    expect(totalBefore).toBe(3000);

    // One player shoves; everyone calls or folds, then the hand plays out.
    let guard = 0;
    while (state.phase !== 'HAND_RESULT' && guard < 30) {
      guard += 1;
      const actor = state.activePlayerId;
      if (!actor) break;
      const shove = service.handleAction(room, actor, { type: 'ALL_IN' });
      expect(shove).not.toBeNull();
    }
    checkCallDown(room);
    expect(state.phase).toBe('HAND_RESULT');
    expect(totalChips(state)).toBe(3000);
  });
});

describe('poker-v2 advisor', () => {
  it('six-card evaluation at the turn reads trips, not a phantom flush', () => {
    // Regression: the engine's old double loop assumed 7 cards and produced
    // a 4-card "flush" from 6-card (turn) sets. 5♠K♥ + A♥J♥5♦5♥ is trips.
    const known = [
      card('5', 'SPADES'),
      card('K', 'HEARTS'),
      card('A', 'HEARTS'),
      card('J', 'HEARTS'),
      card('5', 'DIAMONDS'),
      card('5', 'HEARTS'),
    ];
    const ev = evaluateHand(known);
    expect(ev.category).toBe('THREE_OF_A_KIND');
    expect(ev.best).toHaveLength(5);
  });
  it('detects a nine-out flush draw on the flop', () => {
    const hole = [card('A', 'HEARTS'), card('K', 'HEARTS')];
    const board = [card('Q', 'HEARTS'), card('7', 'HEARTS'), card('2', 'SPADES')];
    const current = evaluateHand([...hole, ...board]);
    const draws = detectDraws(hole, board, current.catIndex);
    const flush = draws.find((d) => d.id === 'FLUSH_DRAW');
    expect(flush).toBeDefined();
    expect(flush!.outs).toBe(9);
    expect(flush!.probByRiver).toBeGreaterThan(0.33);
    expect(flush!.probByRiver).toBeLessThan(0.37);
  });

  it('detects an open-ended straight draw', () => {
    const hole = [card('9', 'CLUBS'), card('8', 'CLUBS')];
    const board = [card('7', 'DIAMONDS'), card('6', 'HEARTS'), card('2', 'SPADES')];
    const current = evaluateHand([...hole, ...board]);
    const draws = detectDraws(hole, board, current.catIndex);
    const oesd = draws.find((d) => d.id === 'OPEN_ENDED_STRAIGHT');
    expect(oesd).toBeDefined();
    expect(oesd!.outs).toBe(8);
  });

  it('detects a pocket pair set draw preflop', () => {
    const hole = [card('7', 'CLUBS'), card('7', 'DIAMONDS')];
    const board: PlayingCard[] = [];
    const draws = detectDraws(hole, board, 1);
    const setDraw = draws.find((d) => d.id === 'SET_DRAW');
    expect(setDraw).toBeDefined();
    expect(setDraw!.outs).toBe(2);
  });

  it('reports no draws once the river lands', () => {
    const hole = [card('A', 'HEARTS'), card('K', 'HEARTS')];
    const board = [
      card('Q', 'HEARTS'),
      card('7', 'HEARTS'),
      card('2', 'SPADES'),
      card('3', 'SPADES'),
      card('9', 'SPADES'),
    ];
    const current = evaluateHand([...hole, ...board]);
    expect(detectDraws(hole, board, current.catIndex)).toHaveLength(0);
  });

  it('buildAdvisor reports the current made hand and equity in range', () => {
    const hole = [card('A', 'HEARTS'), card('K', 'HEARTS')];
    const board = [card('Q', 'HEARTS'), card('7', 'HEARTS'), card('2', 'SPADES')];
    const advisor = buildAdvisor(hole, board, 0.42);
    expect(advisor.currentCategory).toBe('HIGH_CARD');
    expect(advisor.winProbability).toBe(0.42);
    expect(advisor.outs).toBeGreaterThan(0);
    expect(advisor.draws.some((d) => d.id === 'FLUSH_DRAW')).toBe(true);
  });

  it('pocket aces dominate one random opponent (Monte Carlo)', () => {
    // Each player's estimate is their own perspective vs random opponents:
    // AA ≈ 85% heads-up, trash ≈ 39%. Opponents' actual hole cards (72o
    // below) must not leak into either estimate.
    const equity = simulateEquity(
      [
        { socketId: 's1', holeCards: [card('A', 'SPADES'), card('A', 'HEARTS')] },
        { socketId: 's2', holeCards: [card('7', 'CLUBS'), card('5', 'DIAMONDS')] },
      ],
      [],
      400,
    );
    expect(equity.get('s1')!).toBeGreaterThan(0.8);
    expect(equity.get('s2')!).toBeLessThan(0.5);
  });

  it('three-way estimates match textbook all-in ranges', () => {
    const live = [
      { socketId: 's1', holeCards: [card('A', 'SPADES'), card('A', 'HEARTS')] },
      { socketId: 's2', holeCards: [card('K', 'CLUBS'), card('K', 'DIAMONDS')] },
      { socketId: 's3', holeCards: [card('Q', 'CLUBS'), card('Q', 'HEARTS')] },
    ];
    const equity = simulateEquity(live, [], 600);
    // Each faces two random hands: AA ≈ 73%, KK ≈ 66%, QQ ≈ 59%.
    expect(equity.get('s1')!).toBeGreaterThan(0.68);
    expect(equity.get('s2')!).toBeGreaterThan(0.58);
    // Only assert the wide AA-vs-QQ gap: the KK/QQ ordering is inside the
    // Monte-Carlo noise floor at these iteration counts.
    expect(equity.get('s1')!).toBeGreaterThan(equity.get('s3')!);
  });
});
