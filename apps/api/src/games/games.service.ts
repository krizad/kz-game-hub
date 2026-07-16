import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  Role,
  UserState,
  RoomConfig,
  GameType,
  RPSChoice,
  WordCategory,
  PLAYER_COLORS,
  ANIMAL_EMOJIS,
} from '@repo/types';
import { v4 as uuidv4 } from 'uuid';
import { WhoKnowService } from './who-know/who-know.service';
import { TicTacToeService } from './tic-tac-toe/tic-tac-toe.service';
import { RPSService } from './rps/rps.service';
import { GobblerService } from './gobbler/gobbler.service';
import { SoundsFishyService } from './sounds-fishy/sounds-fishy.service';
import { DetectiveClubService } from './detective-club/detective-club.service';
import { WhoAmIService } from './who-am-i/who-am-i.service';
import { WhoFirstService } from './who-first/who-first.service';
import { MusicTriviaService, MusicTriviaActionResult } from './music-trivia/music-trivia.service';
import { TheMindService } from './the-mind/the-mind.service';

@Injectable()
export class GamesService {
  private rooms: Map<string, RoomState> = new Map();
  private readonly secretWords: Map<string, string> = new Map();
  private readonly reconnectTokens = new Map<string, Map<string, string>>();

  constructor(
    private readonly whoKnowService: WhoKnowService,
    private readonly ticTacToeService: TicTacToeService,
    private readonly rpsService: RPSService,
    private readonly gobblerService: GobblerService,
    private readonly soundsFishyService: SoundsFishyService,
    private readonly detectiveClubService: DetectiveClubService,
    private readonly whoAmIService: WhoAmIService,
    private readonly whoFirstService: WhoFirstService,
    private readonly musicTriviaService: MusicTriviaService,
    private readonly theMindService: TheMindService,
  ) {}

  findRoomCodeBySocketId(socketId: string): string | null {
    for (const [code, room] of this.rooms.entries()) {
      if (room.players.some((p) => p.socketId === socketId)) {
        return code;
      }
    }
    return null;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  getReconnectToken(code: string, socketId: string): string | null {
    const room = this.rooms.get(code);
    const player = room?.players.find((candidate) => candidate.socketId === socketId);
    if (!player) return null;

    const tokenEntry = [...(this.reconnectTokens.get(code)?.entries() ?? [])].find(
      ([, playerId]) => playerId === player.id,
    );
    return tokenEntry?.[0] ?? null;
  }

  createRoom(hostId: string, gameType: GameType = GameType.WHO_KNOW): RoomState {
    let code: string;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(code));
    const room: RoomState = {
      id: uuidv4(),
      gameType,
      code,
      status: RoomStatus.LOBBY,
      roomHostId: hostId,
      players: [],
      createdAt: new Date(),
      config: {
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5,
        rpsBestOf: 3,
        rpsMode: '1V1_ROUND_ROBIN',
        language: 'th',
      },
    };

    if (gameType === GameType.TIC_TAC_TOE) {
      room.ticTacToeState = {
        board: Array(9).fill(null),
        currentTurn: 'X',
      };
    } else if (gameType === GameType.RPS) {
      room.rpsState = {
        activePlayers: [],
        queue: [],
        choices: {},
        scores: {},
      };
    } else if (gameType === GameType.GOBBLER_TIC_TAC_TOE) {
      room.gobblerState = {
        board: Array.from({ length: 9 }, () => []),
        currentTurn: 'X',
        inventory: {
          X: [
            { id: uuidv4(), side: 'X', size: 'SMALL' },
            { id: uuidv4(), side: 'X', size: 'SMALL' },
            { id: uuidv4(), side: 'X', size: 'MEDIUM' },
            { id: uuidv4(), side: 'X', size: 'MEDIUM' },
            { id: uuidv4(), side: 'X', size: 'LARGE' },
            { id: uuidv4(), side: 'X', size: 'LARGE' },
          ],
          O: [
            { id: uuidv4(), side: 'O', size: 'SMALL' },
            { id: uuidv4(), side: 'O', size: 'SMALL' },
            { id: uuidv4(), side: 'O', size: 'MEDIUM' },
            { id: uuidv4(), side: 'O', size: 'MEDIUM' },
            { id: uuidv4(), side: 'O', size: 'LARGE' },
            { id: uuidv4(), side: 'O', size: 'LARGE' },
          ],
        },
        scores: { X: 0, O: 0 },
      };
    } else if (gameType === GameType.WHO_AM_I) {
      room.config.maxRounds = 3;
      room.config.wordMode = 'RANDOM';
    } else if (gameType === GameType.WHO_FIRST) {
      room.config.whoFirstPenalty = true;
      room.config.whoFirstHostPlays = false;
      room.config.maxRounds = 5;
      room.whoFirstState = {
        phase: 'LOBBY',
        presses: [],
        currentRound: 1,
        maxRounds: 5,
      };
    } else if (gameType === GameType.MUSIC_TRIVIA) {
      room.config.musicTriviaMode = 'TYPING';
      room.config.musicTriviaSource = 'ITUNES';
      room.config.musicTriviaRounds = 10;
      room.config.musicTriviaHostPlays = true;
      room.config.musicTriviaAnswerTimeoutMs = 15000;
    } else if (gameType === GameType.THE_MIND) {
      // TheMindState is initialized when the game starts via assignRoles
    }

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(
    code: string,
    user: Omit<UserState, 'score' | 'roomId' | 'role'>,
    reconnectToken?: string,
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const playerId = reconnectToken
      ? this.reconnectTokens.get(code)?.get(reconnectToken)
      : undefined;
    const existingPlayer = playerId
      ? room.players.find((player) => player.id === playerId && player.name === user.name)
      : undefined;
    const duplicateName = room.players.some((player) => player.name === user.name);

    if (!existingPlayer && duplicateName) return null;

    if (existingPlayer) {
      const oldSocketId = existingPlayer.socketId;
      existingPlayer.socketId = user.socketId;
      existingPlayer.connected = true;

      if (room.roomHostId === oldSocketId) {
        room.roomHostId = user.socketId;
      }

      if (room.votes) {
        if (room.votes[oldSocketId]) {
          room.votes[user.socketId] = room.votes[oldSocketId];
          delete room.votes[oldSocketId];
        }

        Object.entries(room.votes).forEach(([voterId, targetId]) => {
          if (targetId === oldSocketId) {
            room.votes![voterId] = user.socketId;
          }
        });
      }

      if (room.ticTacToeState) {
        if (room.ticTacToeState.playerXId === oldSocketId)
          room.ticTacToeState.playerXId = user.socketId;
        if (room.ticTacToeState.playerOId === oldSocketId)
          room.ticTacToeState.playerOId = user.socketId;
      }

      if (room.rpsState) {
        const idx = room.rpsState.activePlayers.indexOf(oldSocketId);
        if (idx !== -1) room.rpsState.activePlayers[idx] = user.socketId;

        const qIdx = room.rpsState.queue.indexOf(oldSocketId);
        if (qIdx !== -1) room.rpsState.queue[qIdx] = user.socketId;

        if (room.rpsState.choices[oldSocketId]) {
          room.rpsState.choices[user.socketId] = room.rpsState.choices[oldSocketId];
          delete room.rpsState.choices[oldSocketId];
        }

        if (room.rpsState.scores[oldSocketId] !== undefined) {
          room.rpsState.scores[user.socketId] = room.rpsState.scores[oldSocketId];
          delete room.rpsState.scores[oldSocketId];
        }

        if (room.rpsState.gameWinner === oldSocketId) room.rpsState.gameWinner = user.socketId;
        else if (Array.isArray(room.rpsState.gameWinner)) {
          const wIdx = room.rpsState.gameWinner.indexOf(oldSocketId);
          if (wIdx !== -1) room.rpsState.gameWinner[wIdx] = user.socketId;
        }

        if (room.rpsState.roundWinner === oldSocketId) room.rpsState.roundWinner = user.socketId;
        else if (Array.isArray(room.rpsState.roundWinner)) {
          const wIdx = room.rpsState.roundWinner.indexOf(oldSocketId);
          if (wIdx !== -1) room.rpsState.roundWinner[wIdx] = user.socketId;
        }
      }

      if (room.gobblerState) {
        if (room.gobblerState.playerXId === oldSocketId)
          room.gobblerState.playerXId = user.socketId;
        if (room.gobblerState.playerOId === oldSocketId)
          room.gobblerState.playerOId = user.socketId;
      }

      if (room.soundsFishyState) {
        if (room.soundsFishyState.pickerId === oldSocketId)
          room.soundsFishyState.pickerId = user.socketId;
        if (room.soundsFishyState.blueFishId === oldSocketId)
          room.soundsFishyState.blueFishId = user.socketId;

        const rhIdx = room.soundsFishyState.redHerringIds.indexOf(oldSocketId);
        if (rhIdx !== -1) room.soundsFishyState.redHerringIds[rhIdx] = user.socketId;

        const epIdx = room.soundsFishyState.eliminatedPlayers.indexOf(oldSocketId);
        if (epIdx !== -1) room.soundsFishyState.eliminatedPlayers[epIdx] = user.socketId;

        if (room.soundsFishyState.playerAnswers[oldSocketId]) {
          room.soundsFishyState.playerAnswers[user.socketId] =
            room.soundsFishyState.playerAnswers[oldSocketId];
          room.soundsFishyState.playerAnswers[user.socketId].playerId = user.socketId;
          delete room.soundsFishyState.playerAnswers[oldSocketId];
        }

        if (room.soundsFishyState.roundPoints[oldSocketId] !== undefined) {
          room.soundsFishyState.roundPoints[user.socketId] =
            room.soundsFishyState.roundPoints[oldSocketId];
          delete room.soundsFishyState.roundPoints[oldSocketId];
        }

        if (room.soundsFishyState.typingAnswers[oldSocketId]) {
          room.soundsFishyState.typingAnswers[user.socketId] =
            room.soundsFishyState.typingAnswers[oldSocketId];
          delete room.soundsFishyState.typingAnswers[oldSocketId];
        }
      }

      // Migrate detectiveClubState references from old socketId to new socketId
      if (room.detectiveClubState) {
        const dcState = room.detectiveClubState;
        if (dcState.players[oldSocketId]) {
          dcState.players[user.socketId] = dcState.players[oldSocketId];
          dcState.players[user.socketId].id = user.socketId;
          delete dcState.players[oldSocketId];
        }
        if (dcState.informerId === oldSocketId) dcState.informerId = user.socketId;
        if (dcState.conspiratorId === oldSocketId) dcState.conspiratorId = user.socketId;
        if (dcState.activePlayerId === oldSocketId) dcState.activePlayerId = user.socketId;
        if (dcState.round1StarterId === oldSocketId) dcState.round1StarterId = user.socketId;
        dcState.playOrder = dcState.playOrder.map((id) =>
          id === oldSocketId ? user.socketId : id,
        );
        Object.values(dcState.players).forEach((p) => {
          if (p.votedFor === oldSocketId) p.votedFor = user.socketId;
        });
      }

      if (room.whoAmIState) {
        const waState = room.whoAmIState;
        if (waState.currentTurn === oldSocketId) waState.currentTurn = user.socketId;
        if (waState.playerWords[oldSocketId]) {
          waState.playerWords[user.socketId] = waState.playerWords[oldSocketId];
          delete waState.playerWords[oldSocketId];
        }
        if (waState.votes[oldSocketId]) {
          waState.votes[user.socketId] = waState.votes[oldSocketId];
          delete waState.votes[oldSocketId];
        }
        if (waState.winner === oldSocketId) waState.winner = user.socketId;
        const elimIdx = waState.eliminatedPlayers.indexOf(oldSocketId);
        if (elimIdx !== -1) waState.eliminatedPlayers[elimIdx] = user.socketId;
        const fgIdx = waState.finalGuessUsed.indexOf(oldSocketId);
        if (fgIdx !== -1) waState.finalGuessUsed[fgIdx] = user.socketId;
        if (waState.wordSubmissions?.[oldSocketId]) {
          waState.wordSubmissions[user.socketId] = waState.wordSubmissions[oldSocketId];
          delete waState.wordSubmissions[oldSocketId];
        }
      }

      if (room.whoFirstState) {
        room.whoFirstState.presses.forEach((p) => {
          if (p.socketId === oldSocketId) p.socketId = user.socketId;
        });
      }

      if (room.musicTriviaState) {
        this.musicTriviaService.remapSocketId(room.musicTriviaState, oldSocketId, user.socketId);
      }
    } else {
      const usedColors = new Set(room.players.map((p) => p.color));
      const availableColors = PLAYER_COLORS.filter((c) => !usedColors.has(c));
      const color =
        availableColors.length > 0
          ? availableColors[Math.floor(Math.random() * availableColors.length)]
          : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

      const usedAvatars = new Set(room.players.map((p) => p.avatar));
      const availableAvatars = ANIMAL_EMOJIS.filter((a) => !usedAvatars.has(a));
      const avatar =
        availableAvatars.length > 0
          ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
          : ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)];

      room.players.push({
        ...user,
        id: uuidv4(),
        score: 0,
        roomId: room.id,
        connected: true,
        color,
        avatar,
      });

      const newPlayer = room.players[room.players.length - 1];
      const token = uuidv4();
      const roomTokens = this.reconnectTokens.get(code) ?? new Map<string, string>();
      roomTokens.set(token, newPlayer.id);
      this.reconnectTokens.set(code, roomTokens);
    }

    this.rooms.set(code, room);
    return room;
  }

  leaveRoom(clientId: string, explicitLeave: boolean = false): RoomState | null | { code: null } {
    for (const [code, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.socketId === clientId);
      if (playerIndex !== -1) {
        if (room.roomHostId === clientId) {
          if (explicitLeave || room.status === RoomStatus.LOBBY) {
            this.deleteRoomData(code);
            return { code: null };
          }
        }

        if (explicitLeave || room.status === RoomStatus.LOBBY) {
          this.revokeReconnectToken(code, room.players[playerIndex].id);
          room.players.splice(playerIndex, 1);
        } else {
          room.players[playerIndex].connected = false;
        }

        if (room.gameType === GameType.WHO_KNOW && room.status === RoomStatus.VOTING) {
          this.whoKnowService.checkVoteResolution(room);
        }
        if (room.gameType === GameType.SOUNDS_FISHY && room.status === RoomStatus.QUESTIONING) {
          this.soundsFishyService.checkAnswerResolution(room);
        }

        const activePlayers = room.players.filter((p) => p.connected !== false).length;
        if (activePlayers === 0) {
          this.deleteRoomData(code);
          return null;
        }

        this.rooms.set(code, room);
        return room;
      }
    }
    return null;
  }

  private revokeReconnectToken(code: string, playerId: string): void {
    const roomTokens = this.reconnectTokens.get(code);
    if (!roomTokens) return;

    for (const [token, tokenPlayerId] of roomTokens.entries()) {
      if (tokenPlayerId === playerId) roomTokens.delete(token);
    }
  }

  private deleteRoomData(code: string): void {
    this.rooms.delete(code);
    this.secretWords.delete(code);
    this.reconnectTokens.delete(code);
    this.musicTriviaService.deleteRoomData(code);
  }

  getAvailableRooms(): {
    code: string;
    gameType: GameType;
    hostName: string;
    playerCount: number;
  }[] {
    const availableRooms = [];
    for (const room of this.rooms.values()) {
      if (room.status === RoomStatus.LOBBY) {
        availableRooms.push({
          code: room.code,
          gameType: room.gameType,
          hostName: room.players.find((p) => p.socketId === room.roomHostId)?.name || 'Unknown',
          playerCount: room.players.length,
        });
      }
    }
    return availableRooms;
  }

  updateConfig(
    code: string,
    requesterId: string,
    config: Partial<RoomState['config']>,
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.LOBBY) return null;

    if (room.roomHostId !== requesterId) return null;

    const safeConfig = this.sanitizeRoomConfig(config);
    room.config = { ...room.config, ...safeConfig };
    this.rooms.set(code, room);
    return room;
  }

  private sanitizeRoomConfig(config: Partial<RoomConfig>): Partial<RoomConfig> {
    const result: Partial<RoomConfig> = {};
    const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
      Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
    const copyEnum = <K extends keyof RoomConfig>(key: K, allowed: readonly unknown[]) => {
      if (allowed.includes(config[key])) result[key] = config[key];
    };
    const copyBoolean = <K extends keyof RoomConfig>(key: K) => {
      if (typeof config[key] === 'boolean') result[key] = config[key];
    };
    const copyInteger = <K extends keyof RoomConfig>(key: K, min: number, max: number) => {
      if (isIntegerInRange(config[key], min, max)) {
        result[key] = config[key];
      }
    };

    copyEnum('hostSelection', ['ROUND_ROBIN', 'RANDOM', 'FIXED']);
    copyInteger('timerMin', 1, 60);
    copyInteger('rpsBestOf', 1, 9);
    copyEnum('rpsMode', ['1V1_ROUND_ROBIN', 'ALL_AT_ONCE']);
    copyEnum('language', ['en', 'th']);
    copyInteger('maxRounds', 1, 100);
    copyEnum('wordMode', ['HOST_INPUT', 'RANDOM', 'PLAYER_INPUT', 'AI_GENERATED']);
    if (typeof config.wordCategory === 'string' && config.wordCategory.length <= 100) {
      result.wordCategory = config.wordCategory;
    }
    copyBoolean('whoFirstPenalty');
    copyInteger('whoFirstCooldownMs', 100, 60_000);
    copyBoolean('whoFirstHostPlays');
    copyInteger('whoFirstMinCountdownMs', 100, 60_000);
    copyInteger('whoFirstMaxCountdownMs', 100, 60_000);
    copyBoolean('whoFirstInfiniteRounds');
    copyBoolean('whoFirstShowCounter');
    copyEnum('musicTriviaMode', ['TYPING', 'GAME_MASTER']);
    copyEnum('musicTriviaSource', ['ITUNES', 'SPOTIFY', 'YOUTUBE', 'DEEZER', 'SOUNDCLOUD']);
    if (typeof config.musicTriviaQuery === 'string' && config.musicTriviaQuery.length <= 200) {
      result.musicTriviaQuery = config.musicTriviaQuery;
    }
    if (
      typeof config.musicTriviaCountry === 'string' &&
      /^[A-Z]{2}$/.test(config.musicTriviaCountry)
    ) {
      result.musicTriviaCountry = config.musicTriviaCountry;
    }
    if (
      typeof config.musicTriviaAttribute === 'string' &&
      config.musicTriviaAttribute.length <= 30
    ) {
      result.musicTriviaAttribute = config.musicTriviaAttribute;
    }
    copyInteger('musicTriviaRounds', 1, 50);
    copyInteger('musicTriviaYearStart', 1900, new Date().getFullYear() + 1);
    copyInteger('musicTriviaYearEnd', 1900, new Date().getFullYear() + 1);
    copyBoolean('musicTriviaHostPlays');
    copyInteger('musicTriviaAnswerTimeoutMs', 1_000, 120_000);
    copyEnum('musicTriviaAudioPlayback', ['HOST_ONLY', 'EVERYONE']);
    copyEnum('musicTriviaAnswerCriteria', ['ANY', 'TITLE', 'ARTIST']);
    copyInteger('theMindStartingLives', 1, 10);
    copyInteger('theMindStartingShurikens', 0, 10);
    copyBoolean('theMindBlindMode');
    copyEnum('theMindMode', ['NORMAL', 'EXTREME']);
    copyBoolean('theMindTimeAttack');
    copyInteger('theMindMaxLevel', 1, 20);

    return result;
  }

  // --- Delegation to Game Services ---

  async assignRoles(
    code: string,
    requesterId: string,
  ): Promise<{ room: RoomState; roles: Record<string, Role> } | null> {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.gameType === GameType.SOUNDS_FISHY) {
      const result = await this.soundsFishyService.assignRoles(room, requesterId);
      if (result) this.rooms.set(code, result.room);
      return result;
    }

    if (room.gameType === GameType.RPS) {
      const result = this.rpsService.assignRoles(room, requesterId);
      if (result) this.rooms.set(code, result.room);
      return result;
    }

    if (room.gameType === GameType.DETECTIVE_CLUB) {
      const updatedRoom = this.detectiveClubService.startGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom ? { room: updatedRoom, roles: {} } : null; // Roles handled internally
    }

    if (room.gameType === GameType.WHO_AM_I) {
      let updatedRoom: RoomState | null = null;
      if (room.config.wordMode === 'HOST_INPUT') {
        updatedRoom = this.whoAmIService.startGameAwaitHostInput(room, requesterId);
      } else if (room.config.wordMode === 'RANDOM') {
        updatedRoom = await this.whoAmIService.startGameRandom(room, requesterId);
      } else if (room.config.wordMode === 'AI_GENERATED') {
        updatedRoom = await this.whoAmIService.startGameAiGenerated(room, requesterId);
      } else if (room.config.wordMode === 'PLAYER_INPUT') {
        updatedRoom = this.whoAmIService.startGamePlayerInput(room, requesterId);
      }

      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom ? { room: updatedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.WHO_FIRST) {
      const updatedRoom = this.whoFirstService.startGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom ? { room: updatedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.MUSIC_TRIVIA) {
      const updatedRoom = this.musicTriviaService.startGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom ? { room: updatedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.THE_MIND) {
      const updatedRoom = this.theMindService.startGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom ? { room: updatedRoom, roles: {} } : null;
    }

    // Default to WHO_KNOW
    const result = this.whoKnowService.assignRoles(room, requesterId);
    if (result) this.rooms.set(code, result.room);
    return result;
  }

  setWord(code: string, word: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.whoKnowService.setWord(room, word, requesterId, this.secretWords);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  stopTimer(code: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.whoKnowService.stopTimer(room, requesterId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  endQuestioning(code: string, requesterId: string, timeout: boolean = false): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.whoKnowService.endQuestioning(room, requesterId, timeout);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  submitVote(code: string, voterId: string, targetId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.whoKnowService.submitVote(room, voterId, targetId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  resetGame(code: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.gameType === GameType.WHO_AM_I) {
      const updatedRoom = this.whoAmIService.resetGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom;
    }

    if (room.gameType === GameType.WHO_FIRST) {
      const updatedRoom = this.whoFirstService.resetGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom;
    }

    if (room.gameType === GameType.MUSIC_TRIVIA) {
      const updatedRoom = this.musicTriviaService.resetGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom;
    }

    if (room.gameType === GameType.THE_MIND) {
      const updatedRoom = this.theMindService.resetGame(room, requesterId);
      if (updatedRoom) this.rooms.set(code, updatedRoom);
      return updatedRoom;
    }

    const updatedRoom = this.whoKnowService.resetGame(room, requesterId, this.secretWords);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  getSecretWord(code: string): string | undefined {
    return this.secretWords.get(code);
  }

  // --- Tic-Tac-Toe Logic ---

  tttJoinSide(code: string, clientId: string, side: 'X' | 'O'): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.ticTacToeService.joinSide(room, clientId, side);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  tttMakeMove(code: string, clientId: string, index: number): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.ticTacToeService.makeMove(room, clientId, index);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  tttReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.ticTacToeService.reset(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  // --- RPS Logic ---

  rpsMakeChoice(code: string, clientId: string, choice: RPSChoice): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.rpsService.makeChoice(room, clientId, choice);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  rpsNextRound(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.rpsService.nextRound(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  rpsReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.rpsService.reset(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  // --- Gobbler Tic-Tac-Toe Logic ---

  gobblerJoinSide(code: string, clientId: string, side: 'X' | 'O'): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.gobblerService.joinSide(room, clientId, side);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  gobblerPlacePiece(
    code: string,
    clientId: string,
    pieceId: string,
    toIndex: number,
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.gobblerService.placePiece(room, clientId, pieceId, toIndex);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  gobblerMovePiece(
    code: string,
    clientId: string,
    fromIndex: number,
    toIndex: number,
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.gobblerService.movePiece(room, clientId, fromIndex, toIndex);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  gobblerReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.gobblerService.reset(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  // --- Sounds Fishy Logic ---
  soundsFishyTypeAnswer(code: string, clientId: string, answer: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.soundsFishyService.typeAnswer(room, clientId, answer);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  soundsFishySubmitAnswer(code: string, clientId: string, answer: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.soundsFishyService.submitAnswer(room, clientId, answer);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  soundsFishyRevealPlayer(code: string, clientId: string, targetId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.soundsFishyService.revealPlayer(room, clientId, targetId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  soundsFishyEliminatePlayer(code: string, clientId: string, targetId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.soundsFishyService.eliminatePlayer(room, clientId, targetId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  soundsFishyBankPoints(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.soundsFishyService.bankPoints(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  soundsFishyNextRound(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const updatedRoom = this.soundsFishyService.nextRound(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  soundsFishyReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    // We can reuse the same nextRound logic to reset back to lobby
    const updatedRoom = this.soundsFishyService.nextRound(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  // --- Detective Club Actions ---

  detectiveClubSubmitWord(code: string, clientId: string, word: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.detectiveClubService.submitWord(room, clientId, word);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  detectiveClubPlayCard(code: string, clientId: string, cardIndex: number): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.detectiveClubService.playCard(room, clientId, cardIndex);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  detectiveClubNextPhase(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.detectiveClubService.nextPhase(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  detectiveClubVote(code: string, clientId: string, targetId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.detectiveClubService.submitVote(room, clientId, targetId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  detectiveClubNextRound(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.detectiveClubService.nextRound(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  detectiveClubReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.detectiveClubService.reset(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  // --- Who Am I Logic ---

  whoAmISubmitPlayerWord(
    code: string,
    clientId: string,
    word: string,
  ): { room: RoomState; error?: string } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const result = this.whoAmIService.submitPlayerWord(room, clientId, word);
    if (result && result.room) this.rooms.set(code, result.room);
    return result;
  }

  whoAmIGameAction(
    code: string,
    clientId: string,
    action: Record<string, unknown>,
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.whoAmIService.handleGameAction(room, clientId, action);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  whoFirstGameAction(
    code: string,
    clientId: string,
    action: { type: string; payload?: unknown },
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.whoFirstService.handleGameAction(
      room,
      clientId,
      action as Parameters<typeof this.whoFirstService.handleGameAction>[2],
    );
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  whoAmICategoriesList(lang?: string): Promise<WordCategory[]> {
    return this.whoAmIService.getCategories(lang);
  }

  // Specific start for HOST_INPUT if needed
  whoAmIStartHostInput(
    code: string,
    clientId: string,
    playerWords: Record<string, string>,
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.whoAmIService.startGameHostInput(room, clientId, playerWords);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  async musicTriviaGameAction(
    code: string,
    clientId: string,
    action: { type: string; payload?: unknown },
  ): Promise<MusicTriviaActionResult | null> {
    const room = this.rooms.get(code);
    if (!room) return null;
    const result = await this.musicTriviaService.handleGameAction(
      room,
      clientId,
      action as Parameters<typeof this.musicTriviaService.handleGameAction>[2],
    );
    if (result) this.rooms.set(code, result.room);
    return result;
  }

  musicTriviaFinalizeCountdown(code: string): MusicTriviaActionResult | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const result = this.musicTriviaService.finalizeCountdown(room);
    if (result) this.rooms.set(code, result.room);
    return result;
  }

  // --- The Mind Logic ---

  theMindReady(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.theMindService.ready(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  theMindPlayCard(
    code: string,
    clientId: string,
    card: number,
    pile?: 'UP' | 'DOWN',
  ): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.theMindService.playCard(room, clientId, card, pile);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  theMindNextLevel(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.theMindService.nextLevel(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  theMindProposeShuriken(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.theMindService.proposeShuriken(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  theMindVoteShuriken(code: string, clientId: string, agree: boolean): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = this.theMindService.voteShuriken(room, clientId, agree);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  theMindCancelShuriken(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.THE_MIND) return null;
    const updatedRoom = this.theMindService.cancelShurikenProposal(room, clientId);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }

  theMindTimeout(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.THE_MIND) return null;
    if (room.roomHostId !== clientId) return null;
    const updatedRoom = this.theMindService.handleTimeout(room);
    if (updatedRoom) this.rooms.set(code, updatedRoom);
    return updatedRoom;
  }
}
