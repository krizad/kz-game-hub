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

    const winners = pot.eligiblePlayerIds.slice(0, 2); // force a split
    expect(
      service.handleAction(room, 's1', { type: 'POT_AWARD', targetIds: winners }),
    ).not.toBeNull();
    expect(state.phase).toBe('HAND_RESULT');
    expect(state.handResult!.pots[0].winnerIds.sort()).toEqual([...winners].sort());
    expect(state.handResult!.pots[0].amount).toBe(60);
    const winnerChips = winners.reduce((sum, id) => sum + state.seats[id].chips, 0);
    expect(winnerChips).toBe(2 * 1000 - 40 + 60); // two blinds lost + pot split
    expect(totalChips(state)).toBe(3000);
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
