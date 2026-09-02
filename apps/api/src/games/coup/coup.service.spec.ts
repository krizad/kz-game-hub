import { Test, TestingModule } from '@nestjs/testing';
import { CoupService } from './coup.service';
import { PrivateStateService } from '../private-state.service';
import { RoomTimerService } from '../room-timer.service';
import { GameType, RoomState, RoomStatus, CoupRole } from '@repo/types';

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
