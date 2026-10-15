import { Test, TestingModule } from '@nestjs/testing';
import { GameType, PokerAction, PokerPublicState, RoomState, RoomStatus } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { PokerService } from './poker.service';
import { isStreetPhase, legalMoves } from './poker-engine';

describe('PokerService', () => {
  let service: PokerService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PokerService, PrivateStateService],
    }).compile();

    service = module.get(PokerService);
    privateState = module.get(PrivateStateService);
  });

  function makeRoom(mode: 'ONLINE' | 'CHIPS_LEDGER' = 'ONLINE'): RoomState {
    const players = [
      { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true },
      { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true },
      { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true },
    ];
    return {
      id: 'r1',
      gameType: GameType.POKER,
      code: 'POKER1',
      status: RoomStatus.LOBBY,
      roomHostId: 's1',
      players,
      createdAt: new Date(),
      config: {
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5,
        pokerMode: mode,
        pokerSmallBlind: 10,
        pokerBigBlind: 20,
        pokerStartingStack: 1000,
        pokerAnte: 0,
        pokerTurnTimerEnabled: false,
      },
    } as unknown as RoomState;
  }

  /** Auto-drive the current betting round: check when possible, else call. */
  function checkCallDown(room: RoomState, untilPhase: 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN') {
    const state = room.pokerState!;
    let guard = 0;
    while (
      isStreetPhase(state.phase) &&
      state.activePlayerId &&
      (untilPhase !== 'SHOWDOWN' || true)
    ) {
      if (state.phase === untilPhase) return;
      const actor = state.activePlayerId;
      const moves = legalMoves(state, actor)!;
      const action: PokerAction = moves.canCheck ? { type: 'CHECK' } : { type: 'CALL' };
      expect(service.handleAction(room, actor, action)).not.toBeNull();
      if (++guard > 40) throw new Error('checkCallDown did not converge');
    }
  }

  function totalChips(state: PokerPublicState): number {
    return (
      Object.values(state.seats).reduce((sum, seat) => sum + seat.chips + seat.bet + 0, 0) +
      state.pot
    );
  }

  it('startMatch deals blinds and private hole cards, enters PLAYING', () => {
    const room = makeRoom();
    const result = service.startMatch(room, 's1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(RoomStatus.PLAYING);
    const state = result!.pokerState!;
    expect(state.mode).toBe('ONLINE');
    expect(state.handNumber).toBe(1);
    expect(state.currentBet).toBe(20);
    expect(legalMoves(state, state.activePlayerId!)!.minRaiseTo).toBe(40);
    expect(state.activePlayerId).toBeTruthy();
    expect(Object.values(state.seats).filter((s) => s.lastAction === 'SMALL_BLIND')).toHaveLength(
      1,
    );
    expect(Object.values(state.seats).filter((s) => s.lastAction === 'BIG_BLIND')).toHaveLength(1);
    for (const id of state.playerOrder) {
      const hole = privateState.get<{ holeCards: unknown[] }>(room.code, id, 'poker');
      expect(hole?.holeCards).toHaveLength(2);
    }
    // Chips on the table: blinds only
    const committed = Object.values(state.seats).reduce((sum, s) => sum + s.bet, 0);
    expect(committed).toBe(30);
  });

  describe.each(['ONLINE', 'CHIPS_LEDGER'] as const)('%s betting rules', (mode) => {
    it('uses the previous table bet for full raise increments and rejects invalid BET amounts unchanged', () => {
      const room = makeRoom(mode);
      service.startMatch(room, 's1');
      const state = room.pokerState!;
      const first = state.activePlayerId!;
      expect(legalMoves(state, first)!.minRaiseTo).toBe(40);

      for (const amount of [0, 20, 39, 1001, NaN, Infinity, 40.5]) {
        const before = JSON.stringify(state);
        expect(service.handleAction(room, first, { type: 'BET', amount })).toBeNull();
        expect(JSON.stringify(state)).toBe(before);
        expect(totalChips(state)).toBe(3000);
      }

      expect(service.handleAction(room, first, { type: 'BET', amount: 40 })).not.toBeNull();
      expect(state.currentBet).toBe(40);
      expect(state.minRaiseTo).toBe(60);
      const second = state.activePlayerId!;
      expect(legalMoves(state, second)!.minRaiseTo).toBe(60);
      expect(service.handleAction(room, second, { type: 'BET', amount: 100 })).not.toBeNull();
      expect(state.currentBet).toBe(100);
      expect(state.minRaiseTo).toBe(160);
      expect(legalMoves(state, state.activePlayerId!)!.minRaiseTo).toBe(160);
      expect(totalChips(state)).toBe(3000);
    });

    it('keeps prior actors locked after a short all-in, then reopens after cumulative short raises', () => {
      const room = makeRoom(mode);
      room.players.push({
        id: '4',
        name: 'D',
        socketId: 's4',
        score: 0,
        roomId: 'r1',
        connected: true,
      } as RoomState['players'][number]);
      service.startMatch(room, 's1');
      const state = room.pokerState!;
      const raiser = state.activePlayerId!;
      expect(service.handleAction(room, raiser, { type: 'BET', amount: 40 })).not.toBeNull();

      const firstShort = state.activePlayerId!;
      state.seats[firstShort].chips = 50 - state.seats[firstShort].bet;
      expect(service.handleAction(room, firstShort, { type: 'ALL_IN' })).not.toBeNull();
      expect(state.currentBet).toBe(50);
      expect(state.minRaiseTo).toBe(70);
      expect(state.seats[raiser].raiseLocked).toBe(true);
      const secondShort = state.activePlayerId!;
      state.seats[secondShort].chips = 60 - state.seats[secondShort].bet;
      expect(service.handleAction(room, secondShort, { type: 'ALL_IN' })).not.toBeNull();
      expect(state.currentBet).toBe(60);
      expect(state.minRaiseTo).toBe(80);
      expect(state.seats[raiser].raiseLocked).toBe(false);
      expect(state.seats[firstShort].status).toBe('ALL_IN');
      expect(state.seats[secondShort].status).toBe('ALL_IN');
    });

    it('allows a locked actor to call all-in but never raise', () => {
      const room = makeRoom(mode);
      service.startMatch(room, 's1');
      const state = room.pokerState!;
      const raiser = state.activePlayerId!;
      expect(service.handleAction(room, raiser, { type: 'BET', amount: 40 })).not.toBeNull();
      const short = state.activePlayerId!;
      state.seats[short].chips = 50 - state.seats[short].bet;
      expect(service.handleAction(room, short, { type: 'ALL_IN' })).not.toBeNull();
      const next = state.activePlayerId!;
      expect(service.handleAction(room, next, { type: 'CALL' })).not.toBeNull();
      expect(state.activePlayerId).toBe(raiser);
      expect(state.seats[raiser].raiseLocked).toBe(true);
      expect(legalMoves(state, raiser)!.canBet).toBe(false);
      const before = JSON.stringify(state);
      expect(service.handleAction(room, raiser, { type: 'BET', amount: 70 })).toBeNull();
      expect(JSON.stringify(state)).toBe(before);
      expect(service.handleAction(room, raiser, { type: 'ALL_IN' })).toBeNull();
      expect(JSON.stringify(state)).toBe(before);
      state.seats[raiser].chips = 10;
      expect(service.handleAction(room, raiser, { type: 'ALL_IN' })).not.toBeNull();
      expect(state.seats[raiser].status).toBe('ALL_IN');
      expect(state.seats[raiser].lastAction).toBe('ALL_IN');
      expect(state.seats[raiser].lastActionAmount).toBe(10);
    });

    it('reopens prior actors after a full raise over a short all-in', () => {
      const room = makeRoom(mode);
      service.startMatch(room, 's1');
      const state = room.pokerState!;
      const raiser = state.activePlayerId!;
      expect(service.handleAction(room, raiser, { type: 'BET', amount: 40 })).not.toBeNull();
      const short = state.activePlayerId!;
      state.seats[short].chips = 50 - state.seats[short].bet;
      expect(service.handleAction(room, short, { type: 'ALL_IN' })).not.toBeNull();
      expect(state.seats[raiser].raiseLocked).toBe(true);
      const reraiser = state.activePlayerId!;
      expect(legalMoves(state, reraiser)!.minRaiseTo).toBe(70);
      expect(service.handleAction(room, reraiser, { type: 'BET', amount: 90 })).not.toBeNull();
      expect(state.minRaiseTo).toBe(130);
      expect(state.seats[raiser].raiseLocked).toBe(false);
      expect(state.activePlayerId).toBe(raiser);
      expect(legalMoves(state, raiser)!.canBet).toBe(true);
    });
  });

  it('rejects start from non-host or with too few players', () => {
    expect(service.startMatch(makeRoom(), 's2')).toBeNull();
    const room = makeRoom();
    room.players = room.players.slice(0, 1);
    expect(service.startMatch(room, 's1')).toBeNull();
  });

  it('plays a full checked-down hand to showdown with show/muck and conserved chips', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    checkCallDown(room, 'FLOP');
    expect(room.pokerState!.phase).toBe('FLOP');
    expect(room.pokerState!.board).toHaveLength(3);
    expect(room.pokerState!.pot).toBe(60); // three callers of the BB

    checkCallDown(room, 'TURN');
    expect(room.pokerState!.board).toHaveLength(4);
    checkCallDown(room, 'RIVER');
    expect(room.pokerState!.board).toHaveLength(5);
    checkCallDown(room, 'SHOWDOWN');

    const state = room.pokerState!;
    expect(state.phase).toBe('SHOWDOWN');
    expect(state.handResult?.pots.length).toBeGreaterThan(0);
    expect(state.handResult!.pots[0].amount).toBe(60);
    expect(state.showdown!.awaitingRevealIds).toHaveLength(3);

    // One player shows, two muck.
    const [revealed, ...hidden] = state.showdown!.awaitingRevealIds;
    expect(service.handleAction(room, revealed, { type: 'SHOW' })).not.toBeNull();
    expect(state.showdown!.revealedCards[revealed]).toHaveLength(2);
    for (const id of hidden) {
      expect(service.handleAction(room, id, { type: 'MUCK' })).not.toBeNull();
    }
    expect(state.phase).toBe('HAND_RESULT');
    expect(state.showdown!.awaitingRevealIds).toHaveLength(0);
    expect(totalChips(state)).toBe(3000);
  });

  it('awards an uncontested pot with the uncalled blind refunded', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerState!;

    // Fold every seat until one remains.
    let guard = 0;
    while (state.phase === 'PREFLOP' && state.activePlayerId) {
      service.handleAction(room, state.activePlayerId, { type: 'FOLD' });
      if (++guard > 5) throw new Error('too many folds');
    }
    expect(state.phase).toBe('HAND_RESULT');
    const winner = state.handResult!.pots[0].winnerIds[0];
    expect(state.handResult!.pots[0].winnerIds).toHaveLength(1);
    // Small blind folded: winner (BB or dealer) got the uncalled blind back.
    expect(totalChips(state)).toBe(3000);
    expect(state.seats[winner].chips).toBeGreaterThan(1000);
  });

  it('runs CHIPS_LEDGER without hole cards and settles via host pot award', () => {
    const room = makeRoom('CHIPS_LEDGER');
    service.startMatch(room, 's1');
    const state = room.pokerState!;
    expect(state.mode).toBe('CHIPS_LEDGER');
    for (const id of state.playerOrder) {
      expect(privateState.get(room.code, id, 'poker')).toBeUndefined();
    }

    checkCallDown(room, 'FLOP');
    expect(state.phase).toBe('FLOP');
    expect(state.board).toHaveLength(0); // no cards in ledger mode
    checkCallDown(room, 'SHOWDOWN');

    expect(state.phase).toBe('SHOWDOWN');
    expect(state.showdown!.pendingPots).toHaveLength(1);
    expect(state.showdown!.pendingPots[0].amount).toBe(60);
    expect(state.handResult).toBeUndefined();

    // Non-host cannot award.
    const pot = state.showdown!.pendingPots[0];
    expect(
      service.handleAction(room, 's2', {
        type: 'POT_AWARD',
        targetIds: [pot.eligiblePlayerIds[0]],
      }),
    ).toBeNull();

    // Target not in eligiblePlayerIds is rejected.
    expect(
      service.handleAction(room, 's1', {
        type: 'POT_AWARD',
        targetIds: ['non_existent_player'],
      }),
    ).toBeNull();

    const winners = pot.eligiblePlayerIds.slice(0, 2); // force a split
    expect(
      service.handleAction(room, 's1', { type: 'POT_AWARD', targetIds: winners }),
    ).not.toBeNull();
    expect(state.phase).toBe('HAND_RESULT');
    expect(state.handResult!.pots[0].winnerIds.sort()).toEqual([...winners].sort());
    expect(state.handResult!.pots[0].eligiblePlayerIds).toEqual(pot.eligiblePlayerIds);
    expect(state.handResult!.pots[0].amount).toBe(60);
    const winnerChips = winners.reduce((sum, id) => sum + state.seats[id].chips, 0);
    expect(winnerChips).toBe(2 * 1000 - 40 + 60); // two blinds lost + pot split
    expect(totalChips(state)).toBe(3000);

    // Duplicate award when pendingPots is empty is rejected.
    expect(service.handleAction(room, 's1', { type: 'POT_AWARD', targetIds: winners })).toBeNull();
  });

  it('supports host rebuy and ledger chip adjustments', () => {
    const room = makeRoom('CHIPS_LEDGER');
    service.startMatch(room, 's1');
    const state = room.pokerState!;
    const bustId = state.playerOrder[0];

    // Adjust away exactly what the seat holds behind (blind posts stay in bet).
    expect(
      service.handleAction(room, 's1', {
        type: 'ADJUST_CHIPS',
        targetId: bustId,
        amount: -state.seats[bustId].chips,
      }),
    ).not.toBeNull();
    expect(state.seats[bustId].chips).toBe(0);

    // Rebuy grants a fresh full stack (new money enters the match).
    expect(service.handleAction(room, 's1', { type: 'REBUY', targetId: bustId })).not.toBeNull();
    expect(state.seats[bustId].chips).toBe(1000);

    // REBUY on a funded seat is rejected.
    expect(
      service.handleAction(room, 's1', { type: 'REBUY', targetId: state.playerOrder[1] }),
    ).toBeNull();
  });

  it('END_MATCH records chip standings as player scores', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerState!;
    // Fold out to settle chips unevenly.
    let guard = 0;
    while (state.phase === 'PREFLOP' && state.activePlayerId) {
      service.handleAction(room, state.activePlayerId, { type: 'FOLD' });
      if (++guard > 5) throw new Error('too many folds');
    }
    expect(service.handleAction(room, 's1', { type: 'END_MATCH' })).not.toBeNull();
    expect(room.status).toBe(RoomStatus.RESULT);
    for (const player of room.players) {
      expect(player.score).toBe(state.seats[player.socketId].chips);
    }
    // Non-host cannot end the match.
    const room2 = makeRoom();
    service.startMatch(room2, 's1');
    expect(service.handleAction(room2, 's2', { type: 'END_MATCH' })).toBeNull();
  });

  it('cancels a live hand when an in-hand player is removed, but not between hands', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    expect(room.pokerState).toBeDefined();

    service.handlePlayerDisconnect(room, room.pokerState!.playerOrder[0]);
    expect(room.pokerState).toBeUndefined();
    expect(room.status).toBe(RoomStatus.LOBBY);

    // Between hands: SHOWDOWN-phase disconnects leave the match intact.
    service.startMatch(room, 's1');
    checkCallDown(room, 'SHOWDOWN');
    const state = room.pokerState!;
    for (const id of [...state.showdown!.awaitingRevealIds]) {
      service.handleAction(room, id, { type: 'MUCK' });
    }
    service.handlePlayerDisconnect(room, state.playerOrder[0]);
    expect(room.pokerState).toBeDefined();
    expect(room.status).toBe(RoomStatus.PLAYING);
  });

  it('remaps socket ids across seats, order and showdown structures', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    const state = room.pokerState!;
    const oldId = state.playerOrder[0];

    // Force a showdown then remap before revealing. The private-state card
    // move mirrors GamesService.joinRoom, which calls PrivateStateService.
    checkCallDown(room, 'SHOWDOWN');
    privateState.remapSocketId(room.code, oldId, 's9');
    service.remapSocketId(state, oldId, 's9');

    expect(state.playerOrder).toContain('s9');
    expect(state.playerOrder).not.toContain(oldId);
    expect(state.seats['s9']).toBeDefined();
    expect(state.seats[oldId]).toBeUndefined();
    if (state.dealerId === oldId) expect(state.dealerId).toBe('s9');
    if (state.showdown) {
      expect(state.showdown.awaitingRevealIds).not.toContain(oldId);
    }
    expect(privateState.get(room.code, 's9', 'poker')).toBeDefined();
    expect(privateState.get(room.code, oldId, 'poker')).toBeUndefined();
  });

  it('resets the match back to the lobby (host only)', () => {
    const room = makeRoom();
    service.startMatch(room, 's1');
    expect(service.resetMatch(room, 's2')).toBeNull();
    expect(service.resetMatch(room, 's1')).not.toBeNull();
    expect(room.pokerState).toBeUndefined();
    expect(room.status).toBe(RoomStatus.LOBBY);
  });
});
