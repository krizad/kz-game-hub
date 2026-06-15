import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { WhoKnowService } from './who-know/who-know.service';
import { TicTacToeService } from './tic-tac-toe/tic-tac-toe.service';
import { RPSService } from './rps/rps.service';
import { GobblerService } from './gobbler/gobbler.service';
import { SoundsFishyService } from './sounds-fishy/sounds-fishy.service';
import { DetectiveClubService } from './detective-club/detective-club.service';
import { WhoAmIService } from './who-am-i/who-am-i.service';
import { RoomState, RoomStatus, GameType, Role } from '@repo/types';

describe('GamesService', () => {
  let service: GamesService;
  let whoKnowService: jest.Mocked<WhoKnowService>;
  let ticTacToeService: jest.Mocked<TicTacToeService>;
  let rpsService: jest.Mocked<RPSService>;
  let gobblerService: jest.Mocked<GobblerService>;
  let soundsFishyService: jest.Mocked<SoundsFishyService>;
  let detectiveClubService: jest.Mocked<DetectiveClubService>;
  let whoAmIService: jest.Mocked<WhoAmIService>;

  const mockGameServices = {
    whoKnow: {
      assignRoles: jest.fn(),
      setWord: jest.fn(),
      stopTimer: jest.fn(),
      endQuestioning: jest.fn(),
      showWord: jest.fn(),
      checkVoteResolution: jest.fn(),
      submitVote: jest.fn(),
      resetGame: jest.fn(),
    },
    ticTacToe: {
      joinSide: jest.fn(),
      makeMove: jest.fn(),
      reset: jest.fn(),
    },
    rps: {
      assignRoles: jest.fn(),
      makeChoice: jest.fn(),
      nextRound: jest.fn(),
      reset: jest.fn(),
    },
    gobbler: {
      joinSide: jest.fn(),
      placePiece: jest.fn(),
      movePiece: jest.fn(),
      reset: jest.fn(),
    },
    soundsFishy: {
      assignRoles: jest.fn(),
      typeAnswer: jest.fn(),
      checkAnswerResolution: jest.fn(),
      submitAnswer: jest.fn(),
      revealPlayer: jest.fn(),
      eliminatePlayer: jest.fn(),
      bankPoints: jest.fn(),
      nextRound: jest.fn(),
    },
    detectiveClub: {
      startGame: jest.fn(),
      submitWord: jest.fn(),
      playCard: jest.fn(),
      nextPhase: jest.fn(),
      submitVote: jest.fn(),
      nextRound: jest.fn(),
      reset: jest.fn(),
    },
    whoAmI: {
      getCategories: jest.fn(),
      startGameHostInput: jest.fn(),
      startGameRandom: jest.fn(),
      startGamePlayerInput: jest.fn(),
      submitPlayerWord: jest.fn(),
      handleGameAction: jest.fn(),
      resetGame: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: WhoKnowService, useValue: mockGameServices.whoKnow },
        { provide: TicTacToeService, useValue: mockGameServices.ticTacToe },
        { provide: RPSService, useValue: mockGameServices.rps },
        { provide: GobblerService, useValue: mockGameServices.gobbler },
        { provide: SoundsFishyService, useValue: mockGameServices.soundsFishy },
        { provide: DetectiveClubService, useValue: mockGameServices.detectiveClub },
        { provide: WhoAmIService, useValue: mockGameServices.whoAmI },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    whoKnowService = module.get(WhoKnowService) as jest.Mocked<WhoKnowService>;
    ticTacToeService = module.get(TicTacToeService) as jest.Mocked<TicTacToeService>;
    rpsService = module.get(RPSService) as jest.Mocked<RPSService>;
    gobblerService = module.get(GobblerService) as jest.Mocked<GobblerService>;
    soundsFishyService = module.get(SoundsFishyService) as jest.Mocked<SoundsFishyService>;
    detectiveClubService = module.get(DetectiveClubService) as jest.Mocked<DetectiveClubService>;
    whoAmIService = module.get(WhoAmIService) as jest.Mocked<WhoAmIService>;
    (service as any).rooms.clear();
    (service as any).secretWords.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should create a room with default WHO_KNOW game type', () => {
      const room = service.createRoom('host1');

      expect(room.code).toHaveLength(6);
      expect(room.gameType).toBe(GameType.WHO_KNOW);
      expect(room.status).toBe(RoomStatus.LOBBY);
      expect(room.roomHostId).toBe('host1');
      expect(room.players).toEqual([]);
      expect(room.config).toEqual({
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5,
        rpsBestOf: 3,
        rpsMode: '1V1_ROUND_ROBIN',
        language: 'th',
      });
    });

    it('should create a Tic-Tac-Toe room with initial board state', () => {
      const room = service.createRoom('host1', GameType.TIC_TAC_TOE);

      expect(room.gameType).toBe(GameType.TIC_TAC_TOE);
      expect(room.ticTacToeState).toBeDefined();
      expect(room.ticTacToeState!.board).toHaveLength(9);
      expect(room.ticTacToeState!.board.every((c) => c === null)).toBe(true);
      expect(room.ticTacToeState!.currentTurn).toBe('X');
    });

    it('should create an RPS room with initial state', () => {
      const room = service.createRoom('host1', GameType.RPS);

      expect(room.gameType).toBe(GameType.RPS);
      expect(room.rpsState).toBeDefined();
      expect(room.rpsState!.activePlayers).toEqual([]);
      expect(room.rpsState!.queue).toEqual([]);
      expect(room.rpsState!.choices).toEqual({});
      expect(room.rpsState!.scores).toEqual({});
    });

    it('should create a Gobbler room with full inventory', () => {
      const room = service.createRoom('host1', GameType.GOBBLER_TIC_TAC_TOE);

      expect(room.gameType).toBe(GameType.GOBBLER_TIC_TAC_TOE);
      expect(room.gobblerState).toBeDefined();
      expect(room.gobblerState!.board).toHaveLength(9);
      expect(room.gobblerState!.board.every((c) => Array.isArray(c))).toBe(true);
      expect(room.gobblerState!.currentTurn).toBe('X');
      expect(room.gobblerState!.inventory.X).toHaveLength(6);
      expect(room.gobblerState!.inventory.O).toHaveLength(6);
      expect(room.gobblerState!.scores).toEqual({ X: 0, O: 0 });
    });

    it('should create a WHO_AM_I room with default config', () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);

      expect(room.gameType).toBe(GameType.WHO_AM_I);
      expect(room.config.maxRounds).toBe(3);
      expect(room.config.wordMode).toBe('RANDOM');
    });

    it('should create a Sounds Fishy room with no extra state (handled at start)', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);

      expect(room.gameType).toBe(GameType.SOUNDS_FISHY);
      expect(room.status).toBe(RoomStatus.LOBBY);
    });

    it('should store the room and allow retrieval', () => {
      const room = service.createRoom('host1');
      expect(service.getRoom(room.code)).toBe(room);
    });
  });

  describe('findRoomCodeBySocketId', () => {
    it('should find room code by socket ID', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, {
        id: 'p1',
        name: 'Player1',
        socketId: 'p1',
      });

      expect(service.findRoomCodeBySocketId('p1')).toBe(room.code);
    });

    it('should return null for unknown socket ID', () => {
      expect(service.findRoomCodeBySocketId('unknown')).toBeNull();
    });
  });

  describe('getRoom', () => {
    it('should return room by code', () => {
      const room = service.createRoom('host1');
      expect(service.getRoom(room.code)).toBeDefined();
    });

    it('should return undefined for unknown code', () => {
      expect(service.getRoom('XXXXXX')).toBeUndefined();
    });
  });

  describe('joinRoom', () => {
    it('should return null for non-existent room', () => {
      expect(service.joinRoom('XXXXXX', { id: 'p1', name: 'Test', socketId: 'p1' })).toBeNull();
    });

    it('should add a new player to the room', () => {
      const room = service.createRoom('host1');
      const updatedRoom = service.joinRoom(room.code, {
        id: 'p1',
        name: 'Player1',
        socketId: 'p1',
      });

      expect(updatedRoom).not.toBeNull();
      expect(updatedRoom!.players).toHaveLength(1);
      expect(updatedRoom!.players[0].name).toBe('Player1');
      expect(updatedRoom!.players[0].socketId).toBe('p1');
      expect(updatedRoom!.players[0].score).toBe(0);
      expect(updatedRoom!.players[0].connected).toBe(true);
    });

    it('should reconnect with new socketId if player name matches', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'oldSock', name: 'Player1', socketId: 'oldSock' });

      const updatedRoom = service.joinRoom(room.code, {
        id: 'newSock',
        name: 'Player1',
        socketId: 'newSock',
      });

      expect(updatedRoom).not.toBeNull();
      expect(updatedRoom!.players).toHaveLength(1);
      expect(updatedRoom!.players[0].socketId).toBe('newSock');
      expect(updatedRoom!.players[0].connected).toBe(true);
    });

    it('should update host socketId on reconnection if player was host', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'host1', name: 'Host', socketId: 'host1' });

      const updatedRoom = service.joinRoom(room.code, {
        id: 'newHostSock',
        name: 'Host',
        socketId: 'newHostSock',
      });

      expect(updatedRoom!.roomHostId).toBe('newHostSock');
    });

    it('should migrate votes on reconnection', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'p1', name: 'Player1', socketId: 'p1' });
      service.joinRoom(room.code, { id: 'p2', name: 'Player2', socketId: 'p2' });

      room.votes = { p1: 'p2', p2: 'p1' };
      (service as any).rooms.set(room.code, room);

      const updatedRoom = service.joinRoom(room.code, {
        id: 'p1New',
        name: 'Player1',
        socketId: 'p1New',
      });

      expect(updatedRoom!.votes!['p1New']).toBe('p2');
      expect(updatedRoom!.votes!['p1']).toBeUndefined();
      expect(updatedRoom!.votes!['p2']).toBe('p1New');
    });

    it('should persist room in the store', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'p1', name: 'Test', socketId: 'p1' });

      const retrieved = service.getRoom(room.code);
      expect(retrieved!.players).toHaveLength(1);
    });
  });

  describe('leaveRoom', () => {
    it('should return null if player not found', () => {
      expect(service.leaveRoom('unknown')).toBeNull();
    });

    it('should delete room if host leaves explicitly', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'host1', name: 'Host', socketId: 'host1' });

      const result = service.leaveRoom('host1', true);
      expect(result).toEqual({ code: null });
      expect(service.getRoom(room.code)).toBeUndefined();
    });

    it('should delete room if host leaves from LOBBY (even on disconnect)', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'host1', name: 'Host', socketId: 'host1' });

      const result = service.leaveRoom('host1', false);
      expect(result).toEqual({ code: null });
      expect(service.getRoom(room.code)).toBeUndefined();
    });

    it('should remove player on explicit leave', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'host1', name: 'Host', socketId: 'host1' });
      service.joinRoom(room.code, { id: 'p1', name: 'Player1', socketId: 'p1' });

      const result = service.leaveRoom('p1', true);
      expect(result).not.toBeNull();
      const roomResult = result as RoomState;
      expect(roomResult.players).toHaveLength(1);
      expect(roomResult.players[0].socketId).toBe('host1');
    });

    it('should mark player disconnected on non-explicit leave during game', () => {
      const room = service.createRoom('host1');
      service.joinRoom(room.code, { id: 'host1', name: 'Host', socketId: 'host1' });
      room.status = RoomStatus.PLAYING;
      (service as any).rooms.set(room.code, room);
      service.joinRoom(room.code, { id: 'p1', name: 'Player1', socketId: 'p1' });

      const result = service.leaveRoom('p1', false);
      expect(result).not.toBeNull();
      const roomResult = result as RoomState;
      expect(roomResult.players[1].connected).toBe(false);
    });

    it('should delete room when all players disconnected', () => {
      const room = service.createRoom('host1');
      room.status = RoomStatus.PLAYING;
      (service as any).rooms.set(room.code, room);
      service.joinRoom(room.code, { id: 'host1', name: 'Host', socketId: 'host1' });
      room.players.push({
        id: 'p1', name: 'Player1', socketId: 'p1', score: 0, roomId: room.id, connected: false,
      });
      (service as any).rooms.set(room.code, room);

      const result = service.leaveRoom('host1', false);
      expect(result).toBeNull();
      expect(service.getRoom(room.code)).toBeUndefined();
    });

    it('should trigger WhoKnow vote resolution on disconnect during VOTING', () => {
      const room = service.createRoom('host1');
      room.status = RoomStatus.VOTING;
      (service as any).rooms.set(room.code, room);
      service.joinRoom(room.code, { id: 'p1', name: 'Player1', socketId: 'p1' });

      service.leaveRoom('p1', false);
      expect(whoKnowService.checkVoteResolution).toHaveBeenCalled();
    });

    it('should trigger SoundsFishy answer resolution on disconnect during QUESTIONING', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      room.status = RoomStatus.QUESTIONING;
      (service as any).rooms.set(room.code, room);
      service.joinRoom(room.code, { id: 'p1', name: 'Player1', socketId: 'p1' });

      service.leaveRoom('p1', false);
      expect(soundsFishyService.checkAnswerResolution).toHaveBeenCalled();
    });
  });

  describe('getAvailableRooms', () => {
    it('should return only LOBBY rooms', () => {
      const lobbyRoom = service.createRoom('host1');
      service.joinRoom(lobbyRoom.code, { id: 'host1', name: 'Host', socketId: 'host1' });

      const playingRoom = service.createRoom('host2');
      playingRoom.status = RoomStatus.PLAYING;
      (service as any).rooms.set(playingRoom.code, playingRoom);

      const available = service.getAvailableRooms();
      expect(available).toHaveLength(1);
      expect(available[0].code).toBe(lobbyRoom.code);
      expect(available[0].hostName).toBe('Host');
      expect(available[0].playerCount).toBe(1);
    });

    it('should show Unknown for host name if host not in players', () => {
      const room = service.createRoom('host1');
      const available = service.getAvailableRooms();
      expect(available[0].hostName).toBe('Unknown');
    });

    it('should return empty array when no lobby rooms', () => {
      expect(service.getAvailableRooms()).toEqual([]);
    });
  });

  describe('updateConfig', () => {
    it('should update room config', () => {
      const room = service.createRoom('host1');
      const updated = service.updateConfig(room.code, 'host1', { timerMin: 10, language: 'en' });

      expect(updated).not.toBeNull();
      expect(updated!.config.timerMin).toBe(10);
      expect(updated!.config.language).toBe('en');
      expect(updated!.config.hostSelection).toBe('ROUND_ROBIN');
    });

    it('should return null if room does not exist', () => {
      expect(service.updateConfig('XXXXXX', 'host1', {})).toBeNull();
    });

    it('should return null if room is not in LOBBY', () => {
      const room = service.createRoom('host1');
      room.status = RoomStatus.PLAYING;
      (service as any).rooms.set(room.code, room);

      expect(service.updateConfig(room.code, 'host1', {})).toBeNull();
    });

    it('should return null if requester is not host', () => {
      const room = service.createRoom('host1');
      expect(service.updateConfig(room.code, 'p2', {})).toBeNull();
    });
  });

  describe('assignRoles', () => {
    it('should return null for non-existent room', async () => {
      expect(await service.assignRoles('XXXXXX', 'host1')).toBeNull();
    });

    it('should delegate to SoundsFishyService for SOUNDS_FISHY game', async () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      const resultRoom = { ...room, status: RoomStatus.QUESTIONING };
      const expectedResult = { room: resultRoom, roles: { p1: Role.Host } };
      soundsFishyService.assignRoles.mockResolvedValue(expectedResult);

      const result = await service.assignRoles(room.code, 'host1');

      expect(soundsFishyService.assignRoles).toHaveBeenCalledWith(room, 'host1');
      expect(result).toEqual(expectedResult);
      expect(service.getRoom(room.code)!.status).toBe(RoomStatus.QUESTIONING);
    });

    it('should delegate to RPSService for RPS game', async () => {
      const room = service.createRoom('host1', GameType.RPS);
      const resultRoom = { ...room, status: RoomStatus.PLAYING };
      const expectedResult = { room: resultRoom, roles: {} };
      rpsService.assignRoles.mockReturnValue(expectedResult);

      const result = await service.assignRoles(room.code, 'host1');

      expect(rpsService.assignRoles).toHaveBeenCalledWith(room, 'host1');
      expect(result).toEqual(expectedResult);
    });

    it('should delegate to DetectiveClubService for DETECTIVE_CLUB game', async () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      const updatedRoom = { ...room, status: RoomStatus.PLAYING };
      detectiveClubService.startGame.mockReturnValue(updatedRoom);

      const result = await service.assignRoles(room.code, 'host1');

      expect(detectiveClubService.startGame).toHaveBeenCalledWith(room, 'host1');
      expect(result).toEqual({ room: updatedRoom, roles: {} });
    });

    it('should route WHO_AM_I RANDOM mode to startGameRandom', async () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      room.config.wordMode = 'RANDOM';
      (service as any).rooms.set(room.code, room);
      const updatedRoom = { ...room, status: RoomStatus.PLAYING };
      whoAmIService.startGameRandom.mockResolvedValue(updatedRoom);

      const result = await service.assignRoles(room.code, 'host1');

      expect(whoAmIService.startGameRandom).toHaveBeenCalledWith(room, 'host1');
      expect(result).toEqual({ room: updatedRoom, roles: {} });
    });

    it('should route WHO_AM_I HOST_INPUT mode to startGamePlayerInput', async () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      room.config.wordMode = 'HOST_INPUT';
      (service as any).rooms.set(room.code, room);
      const updatedRoom = { ...room, status: RoomStatus.PLAYING };
      whoAmIService.startGamePlayerInput.mockReturnValue(updatedRoom);

      const result = await service.assignRoles(room.code, 'host1');

      expect(whoAmIService.startGamePlayerInput).toHaveBeenCalledWith(room, 'host1');
      expect(result).toEqual({ room: updatedRoom, roles: {} });
    });

    it('should route WHO_AM_I PLAYER_INPUT mode to startGamePlayerInput', async () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      room.config.wordMode = 'PLAYER_INPUT';
      (service as any).rooms.set(room.code, room);
      const updatedRoom = { ...room, status: RoomStatus.PLAYING };
      whoAmIService.startGamePlayerInput.mockReturnValue(updatedRoom);

      const result = await service.assignRoles(room.code, 'host1');

      expect(whoAmIService.startGamePlayerInput).toHaveBeenCalledWith(room, 'host1');
    });

    it('should default to WhoKnowService for other game types', async () => {
      const room = service.createRoom('host1', GameType.WHO_KNOW);
      const resultRoom = { ...room, status: RoomStatus.WORD_SETTING };
      const expectedResult = { room: resultRoom, roles: { host1: Role.Host } };
      whoKnowService.assignRoles.mockReturnValue(expectedResult);

      const result = await service.assignRoles(room.code, 'host1');

      expect(whoKnowService.assignRoles).toHaveBeenCalledWith(room, 'host1');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('setWord', () => {
    it('should delegate to WhoKnowService and persist', () => {
      const room = service.createRoom('host1');
      const updatedRoom = { ...room, status: RoomStatus.QUESTIONING };
      whoKnowService.setWord.mockReturnValue(updatedRoom);

      const result = service.setWord(room.code, 'SECRET', 'host1');

      expect(whoKnowService.setWord).toHaveBeenCalledWith(room, 'SECRET', 'host1', expect.any(Map));
      expect(result!.status).toBe(RoomStatus.QUESTIONING);
    });

    it('should return null for missing room', () => {
      expect(service.setWord('XXXXXX', 'SECRET', 'host1')).toBeNull();
    });
  });

  describe('stopTimer', () => {
    it('should delegate to WhoKnowService', () => {
      const room = service.createRoom('host1');
      const updatedRoom = { ...room, status: RoomStatus.VOTING };
      whoKnowService.stopTimer.mockReturnValue(updatedRoom);

      const result = service.stopTimer(room.code, 'host1');
      expect(result!.status).toBe(RoomStatus.VOTING);
    });
  });

  describe('endQuestioning', () => {
    it('should delegate to WhoKnowService', () => {
      const room = service.createRoom('host1');
      const updatedRoom = { ...room, status: RoomStatus.VOTING };
      whoKnowService.endQuestioning.mockReturnValue(updatedRoom);

      const result = service.endQuestioning(room.code, 'host1', false);
      expect(whoKnowService.endQuestioning).toHaveBeenCalledWith(room, 'host1', false);
      expect(result!.status).toBe(RoomStatus.VOTING);
    });
  });

  describe('submitVote', () => {
    it('should delegate to WhoKnowService', () => {
      const room = service.createRoom('host1');
      const updatedRoom = { ...room, status: RoomStatus.RESULT };
      whoKnowService.submitVote.mockReturnValue(updatedRoom);

      const result = service.submitVote(room.code, 'p1', 'p2');
      expect(whoKnowService.submitVote).toHaveBeenCalledWith(room, 'p1', 'p2');
      expect(result).not.toBeNull();
    });
  });

  describe('resetGame', () => {
    it('should delegate to WhoAmIService for WHO_AM_I game', () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      room.status = RoomStatus.RESULT;
      (service as any).rooms.set(room.code, room);

      const updatedRoom = { ...room, status: RoomStatus.LOBBY };
      whoAmIService.resetGame.mockReturnValue(updatedRoom);

      const result = service.resetGame(room.code, 'host1');
      expect(whoAmIService.resetGame).toHaveBeenCalledWith(room, 'host1');
      expect(result!.status).toBe(RoomStatus.LOBBY);
    });

    it('should delegate to WhoKnowService for other game types', () => {
      const room = service.createRoom('host1');
      room.status = RoomStatus.RESULT;
      (service as any).rooms.set(room.code, room);

      const updatedRoom = { ...room, status: RoomStatus.LOBBY };
      whoKnowService.resetGame.mockReturnValue(updatedRoom);

      const result = service.resetGame(room.code, 'host1');
      expect(whoKnowService.resetGame).toHaveBeenCalledWith(room, 'host1', expect.any(Map));
      expect(result!.status).toBe(RoomStatus.LOBBY);
    });
  });

  describe('getSecretWord', () => {
    it('should return undefined when no word set', () => {
      expect(service.getSecretWord('TEST')).toBeUndefined();
    });
  });

  describe('ticTacToe delegation', () => {
    it('should delegate joinSide and persist updated room', () => {
      const room = service.createRoom('host1', GameType.TIC_TAC_TOE);
      const updatedRoom = { ...room, status: RoomStatus.PLAYING };
      ticTacToeService.joinSide.mockReturnValue(updatedRoom);

      const result = service.tttJoinSide(room.code, 'p1', 'X');

      expect(ticTacToeService.joinSide).toHaveBeenCalledWith(room, 'p1', 'X');
      expect(service.getRoom(room.code)!.status).toBe(RoomStatus.PLAYING);
      expect(result).not.toBeNull();
    });

    it('should delegate makeMove', () => {
      const room = service.createRoom('host1', GameType.TIC_TAC_TOE);
      ticTacToeService.makeMove.mockReturnValue(room);

      const result = service.tttMakeMove(room.code, 'p1', 0);
      expect(ticTacToeService.makeMove).toHaveBeenCalledWith(room, 'p1', 0);
      expect(result).not.toBeNull();
    });

    it('should delegate tttReset', () => {
      const room = service.createRoom('host1', GameType.TIC_TAC_TOE);
      ticTacToeService.reset.mockReturnValue(room);

      service.tttReset(room.code, 'host1');
      expect(ticTacToeService.reset).toHaveBeenCalledWith(room, 'host1');
    });

    it('should return null for missing room', () => {
      expect(service.tttJoinSide('XXXXXX', 'p1', 'X')).toBeNull();
      expect(service.tttMakeMove('XXXXXX', 'p1', 0)).toBeNull();
      expect(service.tttReset('XXXXXX', 'host1')).toBeNull();
    });
  });

  describe('RPS delegation', () => {
    it('should delegate makeChoice', () => {
      const room = service.createRoom('host1', GameType.RPS);
      rpsService.makeChoice.mockReturnValue(room);

      const result = service.rpsMakeChoice(room.code, 'p1', 'ROCK');
      expect(rpsService.makeChoice).toHaveBeenCalledWith(room, 'p1', 'ROCK');
      expect(result).not.toBeNull();
    });

    it('should delegate nextRound', () => {
      const room = service.createRoom('host1', GameType.RPS);
      rpsService.nextRound.mockReturnValue(room);

      service.rpsNextRound(room.code, 'host1');
      expect(rpsService.nextRound).toHaveBeenCalledWith(room, 'host1');
    });

    it('should delegate rpsReset', () => {
      const room = service.createRoom('host1', GameType.RPS);
      rpsService.reset.mockReturnValue(room);

      service.rpsReset(room.code, 'host1');
      expect(rpsService.reset).toHaveBeenCalledWith(room, 'host1');
    });
  });

  describe('Gobbler delegation', () => {
    it('should delegate joinSide', () => {
      const room = service.createRoom('host1', GameType.GOBBLER_TIC_TAC_TOE);
      gobblerService.joinSide.mockReturnValue(room);

      service.gobblerJoinSide(room.code, 'p1', 'X');
      expect(gobblerService.joinSide).toHaveBeenCalledWith(room, 'p1', 'X');
    });

    it('should delegate placePiece', () => {
      const room = service.createRoom('host1', GameType.GOBBLER_TIC_TAC_TOE);
      gobblerService.placePiece.mockReturnValue(room);

      service.gobblerPlacePiece(room.code, 'p1', 'piece1', 0);
      expect(gobblerService.placePiece).toHaveBeenCalledWith(room, 'p1', 'piece1', 0);
    });

    it('should delegate movePiece', () => {
      const room = service.createRoom('host1', GameType.GOBBLER_TIC_TAC_TOE);
      gobblerService.movePiece.mockReturnValue(room);

      service.gobblerMovePiece(room.code, 'p1', 0, 4);
      expect(gobblerService.movePiece).toHaveBeenCalledWith(room, 'p1', 0, 4);
    });
  });

  describe('SoundsFishy delegation', () => {
    it('should delegate typeAnswer', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.typeAnswer.mockReturnValue(room);

      service.soundsFishyTypeAnswer(room.code, 'p1', 'hello');
      expect(soundsFishyService.typeAnswer).toHaveBeenCalledWith(room, 'p1', 'hello');
    });

    it('should delegate submitAnswer', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.submitAnswer.mockReturnValue(room);

      service.soundsFishySubmitAnswer(room.code, 'p1', 'answer');
      expect(soundsFishyService.submitAnswer).toHaveBeenCalledWith(room, 'p1', 'answer');
    });

    it('should delegate revealPlayer', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.revealPlayer.mockReturnValue(room);

      service.soundsFishyRevealPlayer(room.code, 'p1', 'p2');
      expect(soundsFishyService.revealPlayer).toHaveBeenCalledWith(room, 'p1', 'p2');
    });

    it('should delegate eliminatePlayer', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.eliminatePlayer.mockReturnValue(room);

      service.soundsFishyEliminatePlayer(room.code, 'p1', 'p2');
      expect(soundsFishyService.eliminatePlayer).toHaveBeenCalledWith(room, 'p1', 'p2');
    });

    it('should delegate bankPoints', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.bankPoints.mockReturnValue(room);

      service.soundsFishyBankPoints(room.code, 'p1');
      expect(soundsFishyService.bankPoints).toHaveBeenCalledWith(room, 'p1');
    });

    it('should delegate nextRound', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.nextRound.mockReturnValue(room);

      service.soundsFishyNextRound(room.code, 'host1');
      expect(soundsFishyService.nextRound).toHaveBeenCalledWith(room, 'host1');
    });

    it('should delegate reset (via nextRound)', () => {
      const room = service.createRoom('host1', GameType.SOUNDS_FISHY);
      soundsFishyService.nextRound.mockReturnValue(room);

      service.soundsFishyReset(room.code, 'host1');
      expect(soundsFishyService.nextRound).toHaveBeenCalledWith(room, 'host1');
    });
  });

  describe('DetectiveClub delegation', () => {
    it('should delegate submitWord', () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      detectiveClubService.submitWord.mockReturnValue(room);

      service.detectiveClubSubmitWord(room.code, 'p1', 'word');
      expect(detectiveClubService.submitWord).toHaveBeenCalledWith(room, 'p1', 'word');
    });

    it('should delegate playCard', () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      detectiveClubService.playCard.mockReturnValue(room);

      service.detectiveClubPlayCard(room.code, 'p1', 0);
      expect(detectiveClubService.playCard).toHaveBeenCalledWith(room, 'p1', 0);
    });

    it('should delegate nextPhase', () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      detectiveClubService.nextPhase.mockReturnValue(room);

      service.detectiveClubNextPhase(room.code, 'host1');
      expect(detectiveClubService.nextPhase).toHaveBeenCalledWith(room, 'host1');
    });

    it('should delegate vote', () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      detectiveClubService.submitVote.mockReturnValue(room);

      service.detectiveClubVote(room.code, 'p1', 'p2');
      expect(detectiveClubService.submitVote).toHaveBeenCalledWith(room, 'p1', 'p2');
    });

    it('should delegate nextRound', () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      detectiveClubService.nextRound.mockReturnValue(room);

      service.detectiveClubNextRound(room.code, 'host1');
      expect(detectiveClubService.nextRound).toHaveBeenCalledWith(room, 'host1');
    });

    it('should delegate reset', () => {
      const room = service.createRoom('host1', GameType.DETECTIVE_CLUB);
      detectiveClubService.reset.mockReturnValue(room);

      service.detectiveClubReset(room.code, 'host1');
      expect(detectiveClubService.reset).toHaveBeenCalledWith(room, 'host1');
    });
  });

  describe('WhoAmI delegation', () => {
    it('should delegate submitPlayerWord', () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      const expectedResult = { room, error: undefined };
      whoAmIService.submitPlayerWord.mockReturnValue(expectedResult);

      const result = service.whoAmISubmitPlayerWord(room.code, 'p1', 'word');
      expect(whoAmIService.submitPlayerWord).toHaveBeenCalledWith(room, 'p1', 'word');
      expect(result).toEqual(expectedResult);
    });

    it('should return null for missing room on submitPlayerWord', () => {
      expect(service.whoAmISubmitPlayerWord('XXXXXX', 'p1', 'word')).toBeNull();
    });

    it('should delegate gameAction', () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      whoAmIService.handleGameAction.mockReturnValue(room);

      const action = { type: 'SUBMIT_GUESS', guess: 'test' };
      const result = service.whoAmIGameAction(room.code, 'p1', action);
      expect(whoAmIService.handleGameAction).toHaveBeenCalledWith(room, 'p1', action);
      expect(result).not.toBeNull();
    });

    it('should delegate categoriesList', () => {
      const categories = [{ name: 'Animals', count: 5 }];
      whoAmIService.getCategories.mockResolvedValue(categories);

      const result = service.whoAmICategoriesList();
      expect(whoAmIService.getCategories).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should delegate startHostInput', () => {
      const room = service.createRoom('host1', GameType.WHO_AM_I);
      const updatedRoom = { ...room, status: RoomStatus.PLAYING };
      whoAmIService.startGameHostInput.mockReturnValue(updatedRoom);

      const playerWords = { p1: 'Apple' };
      const result = service.whoAmIStartHostInput(room.code, 'host1', playerWords);
      expect(whoAmIService.startGameHostInput).toHaveBeenCalledWith(room, 'host1', playerWords);
      expect(result).not.toBeNull();
    });
  });
});
