import { Test, TestingModule } from '@nestjs/testing';
import { CoupService } from './coup.service';
import { PrivateStateService } from '../private-state.service';
import { RoomTimerService } from '../room-timer.service';
import { GameType, RoomState, RoomStatus, CoupRole, CoupActionType } from '@repo/types';

describe('CoupService (01 scaffold)', () => {
  let service: CoupService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoupService,
        PrivateStateService,
        { provide: RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
      ],
    }).compile();

    service = module.get(CoupService);
    privateState = module.get(PrivateStateService);
  });

  function makeRoom(overrides: Partial<RoomState> = {}): RoomState {
    const players = [
      { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true } as any,
      { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true } as any,
      { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true } as any,
    ];
    return {
      id: 'r1',
      gameType: GameType.COUP,
      code: 'ABC123',
      status: RoomStatus.LOBBY,
      roomHostId: 's1',
      players,
      createdAt: new Date(),
      config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
      ...overrides,
    } as RoomState;
  }

  it('startGame deals 2 Influence and 2 Coin per player and enters PLAYING', () => {
    const room = makeRoom();
    const result = service.startGame(room, 's1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(RoomStatus.PLAYING);
    expect(result!.coupState).toBeDefined();
    expect(result!.coupState!.phase).toBe('PLAYING');
    expect(result!.coupState!.currentTurn).toBe('s1');
    expect(Object.keys(result!.coupState!.coins)).toHaveLength(3);
    for (const sid of ['s1', 's2', 's3']) {
      expect(result!.coupState!.coins[sid]).toBe(2);
      expect(result!.coupState!.influences[sid].count).toBe(2);
      expect(result!.coupState!.influences[sid].revealed).toEqual([]);
      const hand = privateState.get<CoupRole[]>(room.code, sid, 'coupHand');
      expect(hand).toHaveLength(2);
    }
    // 15 - 6 dealt = 9 remaining
    expect(result!.coupState!.deck).toHaveLength(9);
    expect(result!.coupState!.deadPile).toEqual([]);
  });

  it('startGame fails if not host or not enough players or wrong status', () => {
    const room = makeRoom();
    expect(service.startGame(room, 's2')).toBeNull(); // not host
    const room2 = makeRoom({ players: makeRoom().players.slice(0, 2) });
    expect(service.startGame(room2, 's1')).toBeNull(); // 2 < min 3
    const room3 = makeRoom({ status: RoomStatus.PLAYING } as any);
    expect(service.startGame(room3, 's1')).toBeNull();
  });

  it('resetGame clears coupState and returns to LOBBY', () => {
    const room = makeRoom();
    service.startGame(room, 's1');
    expect(room.coupState).toBeDefined();
    const reset = service.resetGame(room, 's1');
    expect(reset).not.toBeNull();
    expect(reset!.status).toBe(RoomStatus.LOBBY);
    expect(reset!.coupState).toBeUndefined();
    // private hands cleared
    for (const sid of ['s1', 's2', 's3']) {
      expect(privateState.get(room.code, sid, 'coupHand')).toBeUndefined();
    }
  });

  it('remapSocketId moves coins/influences/currentTurn', () => {
    const room = makeRoom();
    service.startGame(room, 's1');
    const state = room.coupState!;
    const oldCoins = state.coins['s2'];
    service.remapSocketId(state, 's2', 's2-new');
    expect(state.coins['s2-new']).toBe(oldCoins);
    expect(state.coins['s2']).toBeUndefined();
    expect(state.influences['s2-new']).toBeDefined();
    expect(state.influences['s2']).toBeUndefined();
    state.currentTurn = 's2';
    service.remapSocketId(state, 's2', 's2-new2');
    // currentTurn should have been remapped from s2 to s2-new before, now test again
    const state2 = { ...state, currentTurn: 's2-new' } as any;
    service.remapSocketId(state2, 's2-new', 's2-final');
    expect(state2.currentTurn).toBe('s2-final');
  });
});

describe('CoupService (02 core economy)', () => {
  let service: CoupService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoupService,
        PrivateStateService,
        { provide: RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
      ],
    }).compile();
    service = module.get(CoupService);
    privateState = module.get(PrivateStateService);
  });

  function makeRoom(overrides: Partial<RoomState> = {}): RoomState {
    const players = [
      { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true } as any,
      { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true } as any,
      { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true } as any,
    ];
    return {
      id: 'r1',
      gameType: GameType.COUP,
      code: 'ABC123',
      status: RoomStatus.LOBBY,
      roomHostId: 's1',
      players,
      createdAt: new Date(),
      config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
      ...overrides,
    } as RoomState;
  }

  function startRoom(): RoomState {
    const room = makeRoom();
    service.startGame(room, 's1');
    return room;
  }

  it('Income gives +1 and advances turn', () => {
    const room = startRoom();
    const r = service.declareAction(room, 's1', CoupActionType.INCOME);
    expect(r).not.toBeNull();
    expect(r!.coupState!.coins['s1']).toBe(3);
    expect(r!.coupState!.currentTurn).toBe('s2');
  });

  it('Foreign Aid gives +2', () => {
    const room = startRoom();
    service.declareAction(room, 's1', CoupActionType.INCOME); // s1 -> s2 turn
    const r2 = service.declareAction(room, 's2', CoupActionType.FOREIGN_AID);
    expect(r2).not.toBeNull();
    expect(r2!.coupState!.coins['s2']).toBe(4);
    expect(r2!.coupState!.currentTurn).toBe('s3');
  });

  it('Tax gives +3', () => {
    const room = startRoom();
    const r = service.declareAction(room, 's1', CoupActionType.TAX);
    expect(r).not.toBeNull();
    expect(r!.coupState!.coins['s1']).toBe(5);
  });

  it('Coup pays 7 and makes target lose 1 influence with deadPile', () => {
    const room = startRoom();
    // give s1 enough coins
    room.coupState!.coins['s1'] = 7;
    const beforeDead = room.coupState!.deadPile.length;
    const handBefore = [...(privateState.get<CoupRole[]>(room.code, 's2', 'coupHand')!)];
    const r = service.declareAction(room, 's1', CoupActionType.COUP, 's2');
    expect(r).not.toBeNull();
    expect(r!.coupState!.coins['s1']).toBe(0);
    expect(r!.coupState!.influences['s2'].count).toBe(1);
    expect(r!.coupState!.deadPile.length).toBe(beforeDead + 1);
    expect(r!.coupState!.influences['s2'].revealed.length).toBe(1);
    // hand should shrink
    expect(privateState.get<CoupRole[]>(room.code, 's2', 'coupHand')!.length).toBe(1);
    // turn advances to s2 (still alive) -> next is s3? s1 just played, next alive after s1 is s2, but s2 lost one but still alive with 1
    expect(r!.coupState!.currentTurn).toBe('s2');
  });

  it('Coup fails if not enough coins or not your turn', () => {
    const room = startRoom();
    expect(service.declareAction(room, 's2', CoupActionType.INCOME)).toBeNull(); // not turn
    expect(service.declareAction(room, 's1', CoupActionType.COUP, 's2')).toBeNull(); // only 2 coins
    // set coins to 7 but wrong target
    room.coupState!.coins['s1'] = 7;
    expect(service.declareAction(room, 's1', CoupActionType.COUP, 's9')).toBeNull();
    expect(service.declareAction(room, 's1', CoupActionType.COUP)).toBeNull(); // missing target
  });

  it('forces Coup when 10+ coins', () => {
    const room = startRoom();
    room.coupState!.coins['s1'] = 10;
    expect(service.declareAction(room, 's1', CoupActionType.INCOME)).toBeNull();
    expect(service.declareAction(room, 's1', CoupActionType.TAX)).toBeNull();
    expect(service.declareAction(room, 's1', CoupActionType.FOREIGN_AID)).toBeNull();
    const r = service.declareAction(room, 's1', CoupActionType.COUP, 's2');
    expect(r).not.toBeNull();
  });

  it('advances turn skipping dead players and detects winner', () => {
    const room = startRoom();
    // make s3 dead
    room.coupState!.influences['s3'].count = 0;
    // s1 income -> should skip s3, go to s2? Actually turn order is s1->s2->s3->s1. If s3 dead, after s2 it should go to s1.
    service.declareAction(room, 's1', CoupActionType.INCOME); // now s2 turn
    const r2 = service.declareAction(room, 's2', CoupActionType.INCOME);
    expect(r2!.coupState!.currentTurn).toBe('s1'); // skipped s3
    // make only s1 alive
    room.coupState!.influences['s2'].count = 0;
    room.coupState!.coins['s1'] = 7;
    const r3 = service.declareAction(room, 's1', CoupActionType.COUP, 's2'); // s2 already dead, should fail? pick s3 dead too
    expect(r3).toBeNull();
    // Coup on dead should fail, but if only s1 alive game should already be RESULT?
    // Instead Coup s1 on s2 when s2 has 0? Let's set s2 alive 1
    room.coupState!.influences['s2'].count = 1;
    privateState.set(room.code, 's2', 'coupHand', [CoupRole.DUKE]);
    const r4 = service.declareAction(room, 's1', CoupActionType.COUP, 's2');
    expect(r4!.coupState!.influences['s2'].count).toBe(0);
    expect(r4!.coupState!.winnerId).toBe('s1');
    expect(r4!.coupState!.phase).toBe('RESULT');
    expect(r4!.status).toBe(RoomStatus.RESULT);
  });
});
