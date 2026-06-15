import { Test, TestingModule } from '@nestjs/testing';
import { DetectiveClubService } from './detective-club.service';
import { RoomState, RoomStatus, DetectiveClubPhase } from '@repo/types';

describe('DetectiveClubService', () => {
  let service: DetectiveClubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DetectiveClubService],
    }).compile();

    service = module.get<DetectiveClubService>(DetectiveClubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startGame', () => {
    it('should not start game if players < 3', () => {
      const room = {
        players: [{ socketId: 'p1' }, { socketId: 'p2' }],
        roomHostId: 'p1',
      } as unknown as RoomState;

      const result = service.startGame(room, 'p1');
      expect(result).toBeNull();
    });

    it('should not start game if requester is not host', () => {
      const room = {
        players: [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }],
        roomHostId: 'p1',
      } as unknown as RoomState;

      const result = service.startGame(room, 'p2');
      expect(result).toBeNull();
    });

    it('should start game and assign roles', () => {
      const room = {
        players: [
          { socketId: 'p1', score: 0 },
          { socketId: 'p2', score: 0 },
          { socketId: 'p3', score: 0 },
        ],
        roomHostId: 'p1',
      } as unknown as RoomState;

      const result = service.startGame(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.PLAYING);

      const state = result!.detectiveClubState!;
      expect(state).toBeDefined();
      expect(state.currentPhase).toBe(DetectiveClubPhase.SETUP);
      expect(state.informerId).toBeDefined();
      expect(state.conspiratorId).toBeDefined();
    });
  });

  describe('submitWord', () => {
    it('should not submit word if not informer', () => {
      const room = {
        detectiveClubState: {
          currentPhase: DetectiveClubPhase.SETUP,
          informerId: 'p1',
        },
      } as unknown as RoomState;

      const result = service.submitWord(room, 'p2', 'apple');
      expect(result).toBeNull();
    });

    it('should submit word and advance phase', () => {
      const room = {
        players: [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }],
        detectiveClubState: {
          currentPhase: DetectiveClubPhase.SETUP,
          informerId: 'p1',
        },
      } as unknown as RoomState;

      const result = service.submitWord(room, 'p1', 'apple');
      expect(result).not.toBeNull();
      expect(result!.detectiveClubState!.word).toBe('apple');
      expect(result!.detectiveClubState!.currentPhase).toBe(DetectiveClubPhase.PLAYING_ROUND_1);
      expect(result!.detectiveClubState!.activePlayerId).toBe('p1');
      expect(result!.detectiveClubState!.playOrder).toEqual(['p1', 'p2', 'p3']);
    });
  });

  describe('nextPhase', () => {
    it('should move from discussion to voting', () => {
      const room = {
        roomHostId: 'p1',
        detectiveClubState: {
          currentPhase: DetectiveClubPhase.DISCUSSION,
        },
      } as unknown as RoomState;

      const result = service.nextPhase(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.detectiveClubState!.currentPhase).toBe(DetectiveClubPhase.VOTING);
    });

    it('should not move from discussion to voting if not host', () => {
      const room = {
        roomHostId: 'p1',
        detectiveClubState: {
          currentPhase: DetectiveClubPhase.DISCUSSION,
        },
      } as unknown as RoomState;

      const result = service.nextPhase(room, 'p2');
      expect(result).toBeNull();
    });
  });
});
