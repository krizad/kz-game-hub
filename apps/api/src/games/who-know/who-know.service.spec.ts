import { Test, TestingModule } from '@nestjs/testing';
import { WhoKnowService } from './who-know.service';
import { PrivateStateService } from '../private-state.service';
import { RoomState, RoomStatus, Role, UserState } from '@repo/types';

describe('WhoKnowService', () => {
  let service: WhoKnowService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhoKnowService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();

    service = module.get<WhoKnowService>(WhoKnowService);
  });

  function createRoom(
    players: Partial<UserState>[],
    status: RoomStatus = RoomStatus.LOBBY,
  ): RoomState {
    return {
      id: 'room-id',
      code: 'ABC123',
      gameType: 'WHO_KNOW',
      status,
      roomHostId: 'p1',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 5 },
      players: players.map((p, i) => ({
        id: p.socketId as string,
        socketId: p.socketId as string,
        name: `P${i}`,
        score: 0,
        roomId: 'room-id',
        connected: true,
        ...p,
      })),
    } as unknown as RoomState;
  }

  const fourPlayers = () => [
    { socketId: 'p1', hasBeenHost: false },
    { socketId: 'p2', hasBeenHost: false },
    { socketId: 'p3', hasBeenHost: false },
    { socketId: 'p4', hasBeenHost: false },
  ];

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignRoles', () => {
    it('assigns roles privately and never broadcasts them', () => {
      const room = createRoom(fourPlayers());

      const result = service.assignRoles(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.room.status).toBe(RoomStatus.WORD_SETTING);
      expect(JSON.stringify(result!.room)).not.toContain(Role.Know);
      expect(JSON.stringify(result!.room.players)).not.toContain('"role"');

      const roles = Object.values(
        room.players.map((p) => privateState.get(room.code, p.socketId, 'wkRole')),
      );
      expect(roles).toContain(Role.Host);
      expect(roles).toContain(Role.Know);
      expect(roles).toContain(Role.Unknow);
    });

    it('should fail if connected players count < 4', () => {
      const room = createRoom([
        { socketId: 'p1' },
        { socketId: 'p2' },
        { socketId: 'p3' },
        { socketId: 'p4', connected: false },
      ]);

      expect(service.assignRoles(room, 'p1')).toBeNull();
    });

    it('should fail when re-invoked mid-game', () => {
      const room = createRoom(fourPlayers(), RoomStatus.QUESTIONING);
      expect(service.assignRoles(room, 'p1')).toBeNull();
    });
  });

  describe('setWord', () => {
    function seedRoles(room: RoomState) {
      privateState.set(room.code, 'p1', 'wkRole', Role.Host);
      privateState.set(room.code, 'p2', 'wkRole', Role.Know);
      privateState.set(room.code, 'p3', 'wkRole', Role.Unknow);
      privateState.set(room.code, 'p4', 'wkRole', Role.Unknow);
    }

    it('should set secret word and start timer', () => {
      const room = createRoom(fourPlayers(), RoomStatus.WORD_SETTING);
      seedRoles(room);

      const secretWords = new Map<string, string>();
      const result = service.setWord(room, 'Apple', 'p1', secretWords);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(RoomStatus.QUESTIONING);
      expect(result!.endTime).toBeGreaterThan(Date.now());
      expect(secretWords.get(room.code)).toBe('Apple');
    });

    it('rejects non-host callers, empty words, and oversized words', () => {
      const room = createRoom(fourPlayers(), RoomStatus.WORD_SETTING);
      seedRoles(room);

      const secretWords = new Map<string, string>();
      expect(service.setWord(room, 'Apple', 'p2', secretWords)).toBeNull();
      expect(service.setWord(room, '   ', 'p1', secretWords)).toBeNull();
      expect(service.setWord(room, 'a'.repeat(61), 'p1', secretWords)).toBeNull();
      expect(secretWords.size).toBe(0);
    });
  });

  describe('submitVote', () => {
    function seedVotingRoom() {
      const room = createRoom(fourPlayers(), RoomStatus.VOTING);
      privateState.set(room.code, 'p1', 'wkRole', Role.Host);
      privateState.set(room.code, 'p2', 'wkRole', Role.Know);
      privateState.set(room.code, 'p3', 'wkRole', Role.Unknow);
      privateState.set(room.code, 'p4', 'wkRole', Role.Unknow);
      room.votes = {};
      return room;
    }

    it('should register votes privately and resolve correctly', () => {
      const room = seedVotingRoom();

      service.submitVote(room, 'p3', 'p2');
      const result = service.submitVote(room, 'p4', 'p2');

      expect(result!.status).toBe(RoomStatus.VOTING); // p2 (Know) hasn't voted yet
      expect(result!.votes).toEqual({}); // votes stay private during VOTING

      const finalResult = service.submitVote(room, 'p2', 'p3');
      expect(finalResult!.status).toBe(RoomStatus.RESULT);
      expect(finalResult!.winner).toBe('COMMONERS');
      expect(finalResult!.players[2].score).toBe(1);
      expect(finalResult!.players[3].score).toBe(1);
      expect(finalResult!.votes).toEqual({ p2: 'p3', p3: 'p2', p4: 'p2' });
    });

    it('should result in INSIDER win if insider is not correctly caught', () => {
      const room = seedVotingRoom();

      service.submitVote(room, 'p3', 'p4');
      service.submitVote(room, 'p4', 'p3');
      const result = service.submitVote(room, 'p2', 'p3');

      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.winner).toBe('INSIDER');
      expect(result!.players[1].score).toBe(2);
    });

    it('rejects self votes, host votes, host targets, and double votes', () => {
      const room = seedVotingRoom();

      expect(service.submitVote(room, 'p3', 'p3')).toBeNull();
      expect(service.submitVote(room, 'p1', 'p2')).toBeNull();
      expect(service.submitVote(room, 'p3', 'p1')).toBeNull();
      expect(service.submitVote(room, 'p3', 'stranger')).toBeNull();

      expect(service.submitVote(room, 'p3', 'p2')).not.toBeNull();
      expect(service.submitVote(room, 'p3', 'p4')).toBeNull();
    });
  });

  describe('handleQuestioningTimeout', () => {
    it('moves QUESTIONING to RESULT with TIMEOUT winner and reveals roles', () => {
      const room = createRoom(fourPlayers(), RoomStatus.QUESTIONING);
      privateState.set(room.code, 'p2', 'wkRole', Role.Know);

      const result = service.handleQuestioningTimeout(room);

      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.winner).toBe('TIMEOUT');
      expect(result!.players[1].role).toBe(Role.Know);
    });

    it('ignores rooms not in QUESTIONING', () => {
      const room = createRoom(fourPlayers(), RoomStatus.VOTING);
      expect(service.handleQuestioningTimeout(room)).toBeNull();
    });
  });
});
