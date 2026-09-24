import { Test, TestingModule } from '@nestjs/testing';
import { SoundsFishyService } from './sounds-fishy.service';
import { PrivateStateService } from '../private-state.service';
import { RoomState, RoomStatus, SoundsFishyPhase } from '@repo/types';

jest.mock('@repo/database', () => ({
  prisma: {
    soundsFishyQuestion: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@repo/database';

describe('SoundsFishyService', () => {
  let service: SoundsFishyService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SoundsFishyService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();

    service = module.get<SoundsFishyService>(SoundsFishyService);
    jest.clearAllMocks();
  });

  function createRoom(players: Partial<RoomState['players'][number]>[]): RoomState {
    return {
      id: 'room-id',
      code: 'ABC123',
      gameType: 'SOUNDS_FISHY',
      status: RoomStatus.QUESTIONING,
      roomHostId: 'p1',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1, language: 'th' },
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignRoles', () => {
    it('should assign roles, fetch a question, and keep secrets out of public state', async () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      room.status = RoomStatus.LOBBY;

      (prisma.soundsFishyQuestion.aggregate as jest.Mock).mockResolvedValue({
        _min: { query_count: 0 },
      });
      (prisma.soundsFishyQuestion.findMany as jest.Mock).mockResolvedValue([
        { id: 1, question: 'Q?', answer: 'A!', lang: 'th' },
      ]);
      (prisma.soundsFishyQuestion.update as jest.Mock).mockResolvedValue({});

      const result = await service.assignRoles(room, 'p1');
      expect(result).not.toBeNull();
      expect(result!.room.status).toBe(RoomStatus.QUESTIONING);
      expect(result!.room.soundsFishyState).toBeDefined();
      expect(result!.room.soundsFishyState!.question!.question).toBe('Q?');

      const state = result!.room.soundsFishyState!;
      expect(state.question!.answer).toBeUndefined();
      expect(state.blueFishId).toBeNull();
      expect(state.redHerringIds).toEqual([]);

      const serialized = JSON.stringify(result!.room);
      expect(serialized).not.toContain('A!');
      expect(serialized).not.toContain('BLUE_FISH');

      const nonPicker = room.players.find((p) => p.socketId !== state.pickerId)!;
      expect(privateState.get(room.code, nonPicker.socketId, 'sfTrueAnswer')).toBe('A!');
    });

    it('should return null if not enough connected players', async () => {
      const room = createRoom([
        { socketId: 'p1' },
        { socketId: 'p2' },
        { socketId: 'p3', connected: false },
      ]);
      room.status = RoomStatus.LOBBY;

      const result = await service.assignRoles(room, 'p1');
      expect(result).toBeNull();
    });

    it('should ignore viewers and refuse to start outside the lobby', async () => {
      const viewerRoom = createRoom([
        { socketId: 'p1' },
        { socketId: 'p2' },
        { socketId: 'p3', isViewer: true },
      ]);
      viewerRoom.status = RoomStatus.LOBBY;
      expect(await service.assignRoles(viewerRoom, 'p1')).toBeNull();

      const startedRoom = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      expect(await service.assignRoles(startedRoom, 'p1')).toBeNull();
    });

    it('should clear stale answers before a new round', async () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      room.status = RoomStatus.LOBBY;
      privateState.set(room.code, 'p2', 'sfMyAnswer', { playerId: 'p2', answer: 'stale' });
      (prisma.soundsFishyQuestion.aggregate as jest.Mock).mockResolvedValue({
        _min: { query_count: 0 },
      });
      (prisma.soundsFishyQuestion.findMany as jest.Mock).mockResolvedValue([
        { id: 1, question: 'Q?', answer: 'A!', lang: 'th' },
      ]);
      (prisma.soundsFishyQuestion.update as jest.Mock).mockResolvedValue({});

      const result = await service.assignRoles(room, 'p1');

      expect(result).not.toBeNull();
      expect(privateState.getRoomData(room.code, 'sfMyAnswer').size).toBe(0);
    });
  });

  describe('typeAnswer', () => {
    it('shares live typing with every seat except the picker and keeps text out of public state', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];

      const result = service.typeAnswer(room, 'p2', 'draft answer');
      expect(result).not.toBeNull();
      expect(result!.soundsFishyState!.typingPlayerIds).toEqual(['p2']);
      expect(JSON.stringify(result)).not.toContain('draft answer');

      expect(privateState.get(room.code, 'p1', 'sfTypingTexts')).toBeUndefined();
      expect(privateState.get(room.code, 'p2', 'sfTypingTexts')).toEqual({ p2: 'draft answer' });
      expect(privateState.get(room.code, 'p3', 'sfTypingTexts')).toEqual({ p2: 'draft answer' });

      const submitted = service.submitAnswer(room, 'p2', 'draft answer');
      expect(submitted).not.toBeNull();
      expect(submitted!.soundsFishyState!.typingPlayerIds).toEqual([]);
      expect(privateState.get(room.code, 'p2', 'sfTypingTexts')).toBeUndefined();
      expect(privateState.get(room.code, 'p3', 'sfTypingTexts')).toBeUndefined();
    });
  });

  describe('typeAnswer', () => {
    it('shares live typing with every seat except the picker and keeps text out of public state', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];

      const result = service.typeAnswer(room, 'p2', 'draft answer');
      expect(result).not.toBeNull();
      expect(result!.soundsFishyState!.typingPlayerIds).toEqual(['p2']);
      expect(JSON.stringify(result)).not.toContain('draft answer');

      expect(privateState.get(room.code, 'p1', 'sfTypingTexts')).toBeUndefined();
      expect(privateState.get(room.code, 'p2', 'sfTypingTexts')).toEqual({ p2: 'draft answer' });
      expect(privateState.get(room.code, 'p3', 'sfTypingTexts')).toEqual({ p2: 'draft answer' });

      const submitted = service.submitAnswer(room, 'p2', 'draft answer');
      expect(submitted).not.toBeNull();
      expect(submitted!.soundsFishyState!.typingPlayerIds).toEqual([]);
      expect(privateState.get(room.code, 'p2', 'sfTypingTexts')).toBeUndefined();
      expect(privateState.get(room.code, 'p3', 'sfTypingTexts')).toBeUndefined();
    });
  });

  describe('submitAnswer', () => {
    function seedPrivate(room: RoomState) {
      privateState.set(room.code, '__room__', 'sfRoomTrueAnswer', 'Truth');
      privateState.set(room.code, '__room__', 'sfRoomBlueFish', 'p2');
      privateState.set(room.code, '__room__', 'sfRoomRedHerrings', ['p3']);
      for (const p of room.players) {
        const role =
          p.socketId === 'p1' ? 'PICKER' : p.socketId === 'p2' ? 'BLUE_FISH' : 'RED_HERRING';
        privateState.set(room.code, p.socketId, 'sfRole', role);
        if (role !== 'PICKER') privateState.set(room.code, p.socketId, 'sfTrueAnswer', 'Truth');
      }
    }

    it('rejects the red herring copying the truth and stores answers privately', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      seedPrivate(room);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];

      expect(service.submitAnswer(room, 'p3', 'truth ')).toBeNull();

      const result = service.submitAnswer(room, 'p3', 'Fake');
      expect(result).not.toBeNull();
      expect(result!.soundsFishyState!.playerAnswers['p3']).toBeUndefined();
      expect(privateState.get(room.code, 'p3', 'sfMyAnswer')).toMatchObject({ answer: 'Fake' });
      expect(JSON.stringify(result!)).not.toContain('Fake');
    });

    it('rejects the blue fish entering a wrong answer and blocks resubmission', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      seedPrivate(room);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];

      expect(service.submitAnswer(room, 'p2', 'Wrong')).toBeNull();
      expect(service.submitAnswer(room, 'p2', 'Truth')).not.toBeNull();
      expect(service.submitAnswer(room, 'p2', 'Changed')).toBeNull();
    });

    it('transitions to THE_PITCH when all connected non-pickers answered', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      seedPrivate(room);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];

      service.submitAnswer(room, 'p2', 'Truth');
      const result = service.submitAnswer(room, 'p3', 'Fake');

      expect(result!.soundsFishyState!.currentPhase).toBe(SoundsFishyPhase.THE_PITCH);
    });
  });

  describe('eliminatePlayer', () => {
    function setupHunt(room: RoomState) {
      privateState.set(room.code, '__room__', 'sfRoomBlueFish', 'p2');
      privateState.set(room.code, '__room__', 'sfRoomRedHerrings', ['p3']);
      privateState.set(room.code, '__room__', 'sfRoomTrueAnswer', 'Truth');
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.THE_HUNT,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {
          p2: { playerId: 'p2', answer: 'Truth', isRevealed: true },
          p3: { playerId: 'p3', answer: 'Fake', isRevealed: true },
        },
        answeredPlayerIds: ['p2', 'p3'],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];
    }

    it('should correctly handle eliminating a Red Herring', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      setupHunt(room);

      const result = service.eliminatePlayer(room, 'p1', 'p3');
      expect(result!.soundsFishyState!.eliminatedPlayers).toContain('p3');
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players[0].score).toBe(1);
      expect(result!.soundsFishyState!.blueFishId).toBe('p2');
      expect(result!.soundsFishyState!.question!.answer).toBe('Truth');
    });

    it('should correctly handle eliminating the Blue Fish', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      setupHunt(room);

      const result = service.eliminatePlayer(room, 'p1', 'p2');
      expect(result!.soundsFishyState!.eliminatedPlayers).toContain('p2');
      expect(result!.status).toBe(RoomStatus.RESULT);
      expect(result!.players[1].score).toBe(1);
      expect(result!.players[2].score).toBe(1);
    });

    it('blocks elimination when a connected player has not been revealed', () => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      setupHunt(room);
      room.soundsFishyState!.playerAnswers = {
        p2: { playerId: 'p2', answer: 'Truth', isRevealed: true },
      };

      expect(service.eliminatePlayer(room, 'p1', 'p3')).toBeNull();
    });
  });

  describe('handlePlayerDisconnect and answer resolution', () => {
    const setupRoom = (): RoomState => {
      const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }]);
      room.soundsFishyState = {
        currentPhase: SoundsFishyPhase.SETUP,
        pickerId: 'p1',
        blueFishId: null,
        redHerringIds: [],
        question: { id: '1', question: 'Q?', lang: 'th' },
        playerAnswers: {},
        answeredPlayerIds: [],
        eliminatedPlayers: [],
        roundScorePool: 0,
        roundPoints: {},
        typingPlayerIds: [],
      } as unknown as RoomState['soundsFishyState'];
      return room;
    };

    it('ignores answers from dropped players when resolving', () => {
      const room = setupRoom();
      privateState.set(room.code, 'p2', 'sfMyAnswer', { playerId: 'p2', answer: 'x' });
      room.players.find((p) => p.socketId === 'p2')!.connected = false;

      expect(service.checkAnswerResolution(room)).toBe(false);

      privateState.set(room.code, 'p3', 'sfMyAnswer', { playerId: 'p3', answer: 'y' });
      expect(service.checkAnswerResolution(room)).toBe(true);
    });

    it('reassigns the picker when the picker drops', () => {
      const room = setupRoom();
      privateState.set(room.code, 'p2', 'sfTrueAnswer', 'Truth');

      expect(service.handlePlayerDisconnect(room, 'p1')).toBe(true);

      expect(room.soundsFishyState!.pickerId).toBe('p2');
      expect(privateState.has(room.code, 'p2', 'sfTrueAnswer')).toBe(false);
    });
  });

  describe('remapRoomSecrets (reconnection)', () => {
    async function assignFour(room: RoomState) {
      room.status = RoomStatus.LOBBY;
      (prisma.soundsFishyQuestion.aggregate as jest.Mock).mockResolvedValue({
        _min: { query_count: 0 },
      });
      (prisma.soundsFishyQuestion.findMany as jest.Mock).mockResolvedValue([
        { id: 1, question: 'Q?', answer: 'A!', lang: 'th' },
      ]);
      (prisma.soundsFishyQuestion.update as jest.Mock).mockResolvedValue({});
      const result = await service.assignRoles(room, 'p1');
      expect(result).not.toBeNull();
      return result!;
    }

    it('keeps a reconnected blue fish bound to the true-answer rule', async () => {
      const room = createRoom([
        { socketId: 'p1' },
        { socketId: 'p2' },
        { socketId: 'p3' },
        { socketId: 'p4' },
      ]);
      const result = await assignFour(room);
      const state = result.room.soundsFishyState!;

      const blueOld = privateState.get<string>(room.code, '__room__', 'sfRoomBlueFish')!;
      expect(blueOld).toBeTruthy();

      // The blue fish drops and rejoins with a new socket id.
      privateState.remapSocketId(room.code, blueOld, 'blue-new');
      service.remapSocketId(state, blueOld, 'blue-new');
      service.remapRoomSecrets(room.code, blueOld, 'blue-new');
      room.players.find((p) => p.socketId === blueOld)!.socketId = 'blue-new';

      // Without the remap, the reconnected blue fish could fake an answer.
      expect(service.submitAnswer(room, 'blue-new', 'not the truth')).toBeNull();
      expect(service.submitAnswer(room, 'blue-new', 'A!')).not.toBeNull();
    });

    it('ends the round when the picker eliminates the reconnected blue fish', async () => {
      const room = createRoom([
        { socketId: 'p1' },
        { socketId: 'p2' },
        { socketId: 'p3' },
        { socketId: 'p4' },
      ]);
      const result = await assignFour(room);
      const state = result.room.soundsFishyState!;

      const blueOld = privateState.get<string>(room.code, '__room__', 'sfRoomBlueFish')!;
      privateState.remapSocketId(room.code, blueOld, 'blue-new');
      service.remapSocketId(state, blueOld, 'blue-new');
      service.remapRoomSecrets(room.code, blueOld, 'blue-new');
      room.players.find((p) => p.socketId === blueOld)!.socketId = 'blue-new';

      const pickerId = state.pickerId;
      const answerers = room.players.map((p) => p.socketId).filter((id) => id !== pickerId);
      for (const id of answerers) {
        const isBlue = privateState.get<string>(room.code, id, 'sfRole') === 'BLUE_FISH';
        expect(service.submitAnswer(room, id, isBlue ? 'A!' : 'decoy')).not.toBeNull();
      }
      expect(room.soundsFishyState!.currentPhase).toBe(SoundsFishyPhase.THE_PITCH);
      for (const id of answerers) {
        expect(service.revealPlayer(room, pickerId, id)).not.toBeNull();
      }
      expect(service.eliminatePlayer(room, pickerId, 'blue-new')).not.toBeNull();
      expect(room.status).toBe(RoomStatus.RESULT);
      expect(room.soundsFishyState!.blueFishId).toBe('blue-new');
    });
  });
});
