import { Test, TestingModule } from '@nestjs/testing';
import { WhoKnowService } from './who-know.service';
import { RoomState, RoomStatus, Role, UserState } from '@repo/types';

describe('WhoKnowService', () => {
  let service: WhoKnowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhoKnowService],
    }).compile();

    service = module.get<WhoKnowService>(WhoKnowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignRoles', () => {
    it('should assign roles to players', () => {
      const room = {
        players: [
          { socketId: 'p1', hasBeenHost: false },
          { socketId: 'p2', hasBeenHost: false },
          { socketId: 'p3', hasBeenHost: false },
          { socketId: 'p4', hasBeenHost: false },
        ] as UserState[],
        roomHostId: 'p1',
        config: { hostSelection: 'FIXED' },
      } as unknown as RoomState;

      const result = service.assignRoles(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.room.status).toBe(RoomStatus.WORD_SETTING);
      expect(result!.room.players[0].role).toBe(Role.Host); // Fixed mode assigns 0 or matching

      const knowPlayer = result!.room.players.find((p) => p.role === Role.Know);
      expect(knowPlayer).toBeDefined();
    });

    it('should fail if players count < 4', () => {
      const room = {
        players: [
          { socketId: 'p1', hasBeenHost: false },
          { socketId: 'p2', hasBeenHost: false },
          { socketId: 'p3', hasBeenHost: false },
        ] as UserState[],
        roomHostId: 'p1',
        config: { hostSelection: 'FIXED' },
      } as unknown as RoomState;

      const result = service.assignRoles(room, 'p1');
      expect(result).toBeNull();
    });
  });

  describe('setWord', () => {
    it('should set secret word and start timer', () => {
      const room = {
        code: 'XYZ123',
        status: RoomStatus.WORD_SETTING,
        players: [{ socketId: 'p1', role: Role.Host }],
        config: { timerMin: 5 },
      } as unknown as RoomState;

      const secretWords = new Map<string, string>();
      const result = service.setWord(room, 'Apple', 'p1', secretWords);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.QUESTIONING);
      expect(result!.endTime).toBeGreaterThan(Date.now());
      expect(secretWords.get('XYZ123')).toBe('Apple');
    });
  });

  describe('submitVote', () => {
    it('should register vote and check resolution', () => {
      const room = {
        status: RoomStatus.VOTING,
        players: [
          { socketId: 'p1', role: Role.Host, connected: true, score: 0 },
          { socketId: 'p2', role: Role.Know, connected: true, score: 0 },
          { socketId: 'p3', role: Role.Unknow, connected: true, score: 0 },
          { socketId: 'p4', role: Role.Unknow, connected: true, score: 0 },
        ],
        votes: {},
      } as unknown as RoomState;

      // Unknows vote for Know (p2)
      service.submitVote(room, 'p3', 'p2');
      const result = service.submitVote(room, 'p4', 'p2');

      expect(result!.status).toBe(RoomStatus.VOTING); // 1 vote missing from p2

      const finalResult = service.submitVote(room, 'p2', 'p3'); // Know votes for Unknow
      expect(finalResult!.status).toBe(RoomStatus.RESULT);

      expect(finalResult!.winner).toBe('COMMONERS'); // p2 (Know) got 2 votes out of 3, caught
      expect(finalResult!.players[2].score).toBe(1); // p3 Unknow got 1 point
      expect(finalResult!.players[3].score).toBe(1); // p4 Unknow got 1 point
    });

    it('should result in INSIDER win if insider is not correctly caught', () => {
      const room = {
        status: RoomStatus.VOTING,
        players: [
          { socketId: 'p1', role: Role.Host, connected: true, score: 0 },
          { socketId: 'p2', role: Role.Know, connected: true, score: 0 },
          { socketId: 'p3', role: Role.Unknow, connected: true, score: 0 },
          { socketId: 'p4', role: Role.Unknow, connected: true, score: 0 },
        ],
        votes: {},
      } as unknown as RoomState;

      service.submitVote(room, 'p3', 'p4');
      service.submitVote(room, 'p4', 'p3');
      const result = service.submitVote(room, 'p2', 'p3'); // p3 gets 2 votes, p4 gets 1

      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.winner).toBe('INSIDER'); // p3 who is Unknow is suspected
      expect(result!.players[1].score).toBe(2); // p2 Know gets 2 points
    });
  });
});
