import { Test, TestingModule } from '@nestjs/testing';
import { GameType, RoomState, RoomStatus } from '@repo/types';
import { CardGameService } from './card-game.service';
import { PrivateStateService } from '../private-state.service';

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

  it('deals hidden hands without leaking them into public room state', () => {
    const result = service.startPokDeng(room(), 'p1')!;
    expect(result.status).toBe(RoomStatus.PLAYING);
    expect(result.cardGameState?.handCounts).toEqual({ p1: 2, p2: 2 });
    expect(JSON.stringify(result)).not.toContain('CLUBS');
    expect(privateState.get(result.code, 'p1', 'cardGame')).toBeDefined();
    expect(privateState.get(result.code, 'p2', 'cardGame')).toBeDefined();
  });

  it('rejects actions from a player who does not own the active turn', () => {
    const result = service.startPokDeng(room(), 'p1')!;
    const active = result.cardGameState!.activePlayerId;
    const other = active === 'p1' ? 'p2' : 'p1';
    expect(service.handleAction(result, other, { type: 'STAND' })).toBeNull();
  });

  it('remaps every public state reference on reconnect', () => {
    const result = service.startPokDeng(room(), 'p1')!;
    service.remapSocketId(result.cardGameState!, 'p1', 'p1-new');
    expect(result.cardGameState!.playerOrder).toContain('p1-new');
    expect(result.cardGameState!.handCounts['p1-new']).toBe(2);
    expect(result.cardGameState!.chips['p1-new']).toBe(100);
  });
});
