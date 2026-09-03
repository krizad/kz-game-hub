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
  CoupActionType,
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
import { SaboteurService } from './saboteur/saboteur.service';
import { CoupService } from './coup/coup.service';
import { PlayerSessionService } from './player-session.service';
import { PrivateStateService } from './private-state.service';
import { RoomTimerService } from './room-timer.service';

/** Result of leaving a room, so callers can react without sniffing shapes. */
export type LeaveRoomResult =
  | { outcome: 'ROOM_CLOSED'; code: string }
  | { outcome: 'ROOM_EMPTIED'; code: string }
  | { outcome: 'PLAYER_LEFT'; room: RoomState }
  | { outcome: 'NOT_IN_ROOM' };

/** RoomTimerService timer name prefix for per-player reconnect grace windows. */
const RECONNECT_GRACE_TIMER = 'reconnect-grace';

@Injectable()
export class GamesService {
  /** How long a dropped connection may reclaim its seat before being removed. */
  private static readonly RECONNECT_GRACE_MS = 60_000;

  private rooms: Map<string, RoomState> = new Map();
  private readonly secretWords: Map<string, string> = new Map();

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
    private readonly saboteurService: SaboteurService,
    private readonly coupService: CoupService,
    private readonly playerSessionService: PlayerSessionService,
    private readonly privateStateService: PrivateStateService,
    private readonly roomTimerService: RoomTimerService,
  ) {}

  isRoomMember(code: string, socketId: string): boolean {
    const room = this.rooms.get(code);
    return !!room?.players.some((p) => p.socketId === socketId);
  }

  getPrivateSocketData(code: string, socketId: string): Record<string, unknown> {
    return this.privateStateService.getSocketData(code, socketId);
  }

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

    return this.playerSessionService.takePendingToken(socketId);
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
        choicesMade: [],
        scores: {},
      };
    } else if (gameType === GameType.GOBBLER_TIC_TAC_TOE) {
      room.gobblerState = {
        board: Array.from({ length: 9 }, () => []),
        currentTurn: 'X',
        inventory: {
          X: this.gobblerService.createInitialInventory('X'),
          O: this.gobblerService.createInitialInventory('O'),
        },
        scores: { X: 0, O: 0 },
      };
    } else if (gameType === GameType.WHO_AM_I) {
      room.config.maxRounds = 3;
      room.config.wordMode = 'RANDOM';
    } else if (gameType === GameType.WHO_FIRST) {
      room.config.whoFirstPenalty = true;
      room.config.whoFirstHostPlays = false;
      room.config.whoFirstMaxRounds = 5;
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
    } else if (gameType === GameType.SABOTEUR) {
      room.config.saboteurTurnTimerEnabled = false;
      room.config.saboteurTurnTimerSeconds = 60;
      room.config.saboteurStoneEndsRound = false;
      // SaboteurState is initialized when the game starts via assignRoles
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
      ? this.playerSessionService.consume(code, reconnectToken)
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

      // Player made it back within the grace window — cancel pending removal.
      this.roomTimerService.cancel(
        code,
        `${RECONNECT_GRACE_TIMER}:${existingPlayer.id}`,
      );

      if (room.roomHostId === oldSocketId) {
        room.roomHostId = user.socketId;
      }

      // Each game service owns the socket-id references inside its own state
      if (room.votes) this.whoKnowService.remapVotes(room.votes, oldSocketId, user.socketId);
      if (room.ticTacToeState) {
        this.ticTacToeService.remapSocketId(room.ticTacToeState, oldSocketId, user.socketId);
      }
      if (room.rpsState) {
        this.rpsService.remapSocketId(room.rpsState, oldSocketId, user.socketId);
      }
      if (room.gobblerState) {
        this.gobblerService.remapSocketId(room.gobblerState, oldSocketId, user.socketId);
      }
      if (room.soundsFishyState) {
        this.soundsFishyService.remapSocketId(room.soundsFishyState, oldSocketId, user.socketId);
      }
      if (room.detectiveClubState) {
        this.detectiveClubService.remapSocketId(
          room.detectiveClubState,
          oldSocketId,
          user.socketId,
        );
      }
      if (room.whoAmIState) {
        this.whoAmIService.remapSocketId(room.whoAmIState, oldSocketId, user.socketId);
      }
      if (room.whoFirstState) {
        this.whoFirstService.remapSocketId(room.whoFirstState, oldSocketId, user.socketId);
      }
      if (room.musicTriviaState) {
        this.musicTriviaService.remapSocketId(room.musicTriviaState, oldSocketId, user.socketId);
      }
      if (room.saboteurState) {
        this.saboteurService.remapSocketId(room.saboteurState, oldSocketId, user.socketId);
      }
      if (room.coupState) {
        this.coupService.remapSocketId(room.coupState, oldSocketId, user.socketId);
      }

      this.privateStateService.remapSocketId(code, oldSocketId, user.socketId);
      this.playerSessionService.issue(code, existingPlayer.id, user.socketId);
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
      // Joining after the game started → spectator for the rest of this game
      if (room.status !== RoomStatus.LOBBY) {
        newPlayer.isViewer = true;
      }
      this.playerSessionService.issue(code, newPlayer.id, user.socketId);
    }

    this.rooms.set(code, room);
    return room;
  }

  leaveRoom(clientId: string, explicitLeave: boolean = false): LeaveRoomResult {
    for (const [code, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.socketId === clientId);
      if (playerIndex === -1) continue;

      const isHost = room.roomHostId === clientId;

      // Only an explicit leave by the host closes the room. A lost connection
      // keeps it alive and hands ownership to a remaining connected player.
      if (isHost && explicitLeave) {
        this.deleteRoomData(code);
        return { outcome: 'ROOM_CLOSED', code };
      }

      if (explicitLeave) {
        this.removePlayerFromRoom(code, room, playerIndex);

        const activePlayers = room.players.filter((p) => p.connected !== false).length;
        if (activePlayers === 0) {
          this.deleteRoomData(code);
          return { outcome: 'ROOM_EMPTIED', code };
        }
      } else {
        // Lost connection (network blip, app backgrounded, ...): keep the
        // seat — and its session token — alive for a short grace window so
        // the player can silently rejoin instead of being kicked.
        const dropped = room.players[playerIndex];
        dropped.connected = false;
        this.privateStateService.clearSocket(code, clientId);
        this.scheduleReconnectGrace(code, dropped.id);
        this.runDisconnectHooks(code, room, clientId);
      }

      if (isHost && !explicitLeave) {
        this.transferHost(room, clientId);
      }

      this.rooms.set(code, room);
      return { outcome: 'PLAYER_LEFT', room };
    }
    return { outcome: 'NOT_IN_ROOM' };
  }

  /** Remove a player whose reconnect grace window expired without a rejoin. */
  private removeExpiredPlayer(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1 || room.players[playerIndex].connected !== false) return;

    const socketId = room.players[playerIndex].socketId;
    const wasHost = room.roomHostId === socketId;
    this.removePlayerFromRoom(code, room, playerIndex);

    if (wasHost) {
      this.transferHost(room, socketId);
    }

    if (!room.players.some((p) => p.connected !== false)) {
      this.deleteRoomData(code);
      return;
    }

    this.rooms.set(code, room);
  }

  private scheduleReconnectGrace(code: string, playerId: string): void {
    this.roomTimerService.schedule(
      code,
      `${RECONNECT_GRACE_TIMER}:${playerId}`,
      Date.now() + GamesService.RECONNECT_GRACE_MS,
      () => this.removeExpiredPlayer(code, playerId),
    );
  }

  /** Shared post-removal cleanup: tokens, slots and game-specific handlers. */
  private removePlayerFromRoom(
    code: string,
    room: RoomState,
    playerIndex: number,
  ): void {
    const [player] = room.players.splice(playerIndex, 1);
    this.playerSessionService.revokePlayer(code, player.id);
    this.privateStateService.clearSocket(code, player.socketId);

    if (room.ticTacToeState) {
      if (room.ticTacToeState.playerXId === player.socketId)
        room.ticTacToeState.playerXId = undefined;
      if (room.ticTacToeState.playerOId === player.socketId)
        room.ticTacToeState.playerOId = undefined;
    }
    if (room.gobblerState) {
      if (room.gobblerState.playerXId === player.socketId)
        room.gobblerState.playerXId = undefined;
      if (room.gobblerState.playerOId === player.socketId)
        room.gobblerState.playerOId = undefined;
    }

    this.runDisconnectHooks(code, room, player.socketId);
  }

  /** Let each game reconcile its state after one of its players dropped. */
  private runDisconnectHooks(code: string, room: RoomState, socketId: string): void {
    if (room.gameType === GameType.WHO_KNOW && room.status === RoomStatus.VOTING) {
      this.whoKnowService.checkVoteResolution(room);
    }
    if (room.gameType === GameType.SOUNDS_FISHY && room.status === RoomStatus.QUESTIONING) {
      this.soundsFishyService.checkAnswerResolution(room);
    }
    if (room.gameType === GameType.DETECTIVE_CLUB && room.detectiveClubState) {
      this.detectiveClubService.handlePlayerDisconnect(room, socketId);
    }
    if (room.gameType === GameType.SABOTEUR && room.saboteurState) {
      this.saboteurService.handlePlayerDisconnect(room, socketId);
    }
  }

  /** Hand room ownership to the first remaining connected player after the host lost connection. */
  private transferHost(room: RoomState, formerHostSocketId: string): void {
    const candidates = room.players.filter(
      (p) => p.connected !== false && p.socketId !== formerHostSocketId,
    );
    const nextHost = candidates.find((p) => !p.isViewer) ?? candidates[0];
    if (!nextHost) return;
    room.roomHostId = nextHost.socketId;
  }

  private deleteRoomData(code: string): void {
    this.rooms.delete(code);
    this.secretWords.delete(code);
    this.roomTimerService.clearRoom(code);
    this.playerSessionService.clearRoom(code);
    this.musicTriviaService.deleteRoomData(code);
    this.privateStateService.clearRoom(code);
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
    copyBoolean('whoFirstHostPlays');
    copyInteger('whoFirstMinCountdownMs', 100, 60_000);
    copyInteger('whoFirstMaxCountdownMs', 100, 60_000);
    copyBoolean('whoFirstInfiniteRounds');
    copyBoolean('whoFirstShowCounter');
    copyInteger('whoFirstMaxRounds', 1, 100);
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
    copyBoolean('saboteurTurnTimerEnabled');
    copyInteger('saboteurTurnTimerSeconds', 5, 300);
    copyBoolean('saboteurStoneEndsRound');

    return result;
  }

  // --- Helpers ---

  /** Viewers joined mid-game: they may watch but never act. */
  private isViewerClient(room: RoomState, socketId: string): boolean {
    return room.players.some((p) => p.socketId === socketId && p.isViewer === true);
  }

  /** Guard for client-triggered gameplay actions; returns null when the client is a viewer. */
  private rejectViewer(code: string, clientId: string): boolean {
    const room = this.rooms.get(code);
    return !room || this.isViewerClient(room, clientId);
  }

  /** Load the room, run the mutation, and persist the returned room state. */
  private withRoom(code: string, mutate: (room: RoomState) => RoomState | null): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = mutate(room);
    if (updatedRoom) {
      this.clearViewerFlagsOnLobby(updatedRoom);
      this.rooms.set(code, updatedRoom);
    }
    return updatedRoom;
  }

  /** Same as withRoom for actions returning `{ room, ...extras }` payloads. */
  private withRoomResult<R extends { room: RoomState }>(
    code: string,
    action: (room: RoomState) => R | null,
  ): R | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const result = action(room);
    if (result) {
      this.clearViewerFlagsOnLobby(result.room);
      this.rooms.set(code, result.room);
    }
    return result;
  }

  /** Same as withRoomResult for async actions. */
  private async withRoomResultAsync<R extends { room: RoomState }>(
    code: string,
    action: (room: RoomState) => Promise<R | null>,
  ): Promise<R | null> {
    const room = this.rooms.get(code);
    if (!room) return null;
    const result = await action(room);
    if (result) {
      this.clearViewerFlagsOnLobby(result.room);
      this.rooms.set(code, result.room);
    }
    return result;
  }

  /** Back in the lobby → everyone may play the next game again. */
  private clearViewerFlagsOnLobby(room: RoomState): void {
    if (room.status !== RoomStatus.LOBBY) return;
    for (const p of room.players) delete p.isViewer;
  }

  // --- Delegation to Game Services ---

  async assignRoles(
    code: string,
    requesterId: string,
  ): Promise<{ room: RoomState; roles: Record<string, Role> } | null> {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.gameType === GameType.SOUNDS_FISHY) {
      return this.withRoomResultAsync(code, (r) =>
        this.soundsFishyService.assignRoles(r, requesterId),
      );
    }

    if (room.gameType === GameType.RPS) {
      return this.withRoomResult(code, (r) => this.rpsService.assignRoles(r, requesterId));
    }

    if (room.gameType === GameType.DETECTIVE_CLUB) {
      const startedRoom = this.withRoom(code, (r) =>
        this.detectiveClubService.startGame(r, requesterId),
      );
      return startedRoom ? { room: startedRoom, roles: {} } : null; // Roles handled internally
    }

    if (room.gameType === GameType.WHO_AM_I) {
      const startedRoom = await this.withRoomAsync(code, (r) => this.startWhoAmI(r, requesterId));
      return startedRoom ? { room: startedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.WHO_FIRST) {
      const startedRoom = this.withRoom(code, (r) =>
        this.whoFirstService.startGame(r, requesterId),
      );
      return startedRoom ? { room: startedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.MUSIC_TRIVIA) {
      const startedRoom = this.withRoom(code, (r) =>
        this.musicTriviaService.startGame(r, requesterId),
      );
      return startedRoom ? { room: startedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.THE_MIND) {
      const startedRoom = this.withRoom(code, (r) => this.theMindService.startGame(r, requesterId));
      return startedRoom ? { room: startedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.SABOTEUR) {
      const startedRoom = this.withRoom(code, (r) =>
        this.saboteurService.startGame(r, requesterId),
      );
      return startedRoom ? { room: startedRoom, roles: {} } : null;
    }

    if (room.gameType === GameType.COUP) {
      const startedRoom = this.withRoom(code, (r) => this.coupService.startGame(r, requesterId));
      return startedRoom ? { room: startedRoom, roles: {} } : null;
    }

    // Default to WHO_KNOW
    return this.withRoomResult(code, (r) => this.whoKnowService.assignRoles(r, requesterId));
  }

  private async startWhoAmI(room: RoomState, requesterId: string): Promise<RoomState | null> {
    switch (room.config.wordMode) {
      case 'HOST_INPUT':
        return this.whoAmIService.startGameAwaitHostInput(room, requesterId);
      case 'RANDOM':
        return this.whoAmIService.startGameRandom(room, requesterId);
      case 'AI_GENERATED':
        return this.whoAmIService.startGameAiGenerated(room, requesterId);
      case 'PLAYER_INPUT':
        return this.whoAmIService.startGamePlayerInput(room, requesterId);
      default:
        return null;
    }
  }

  /** Async counterpart of withRoom. */
  private async withRoomAsync(
    code: string,
    action: (room: RoomState) => Promise<RoomState | null>,
  ): Promise<RoomState | null> {
    const room = this.rooms.get(code);
    if (!room) return null;
    const updatedRoom = await action(room);
    if (updatedRoom) {
      this.clearViewerFlagsOnLobby(updatedRoom);
      this.rooms.set(code, updatedRoom);
    }
    return updatedRoom;
  }

  setWord(code: string, word: string, requesterId: string): RoomState | null {
    return this.withRoom(code, (room) =>
      this.whoKnowService.setWord(room, word, requesterId, this.secretWords),
    );
  }

  stopTimer(code: string, requesterId: string): RoomState | null {
    return this.withRoom(code, (room) => this.whoKnowService.stopTimer(room, requesterId));
  }

  endQuestioning(code: string, requesterId: string, timeout: boolean = false): RoomState | null {
    return this.withRoom(code, (room) =>
      this.whoKnowService.endQuestioning(room, requesterId, timeout),
    );
  }

  submitVote(code: string, voterId: string, targetId: string): RoomState | null {
    if (this.rejectViewer(code, voterId)) return null;
    return this.withRoom(code, (room) => this.whoKnowService.submitVote(room, voterId, targetId));
  }

  resetGame(code: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.gameType === GameType.COUP) {
      return this.withRoom(code, (r) => this.coupService.resetGame(r, requesterId));
    }

    switch (room.gameType) {
      case GameType.WHO_AM_I:
        return this.withRoom(code, (r) => this.whoAmIService.resetGame(r, requesterId));
      case GameType.WHO_FIRST:
        return this.withRoom(code, (r) => this.whoFirstService.resetGame(r, requesterId));
      case GameType.MUSIC_TRIVIA:
        return this.withRoom(code, (r) => this.musicTriviaService.resetGame(r, requesterId));
      case GameType.THE_MIND:
        return this.withRoom(code, (r) => this.theMindService.resetGame(r, requesterId));
      default:
        return this.withRoom(code, (r) =>
          this.whoKnowService.resetGame(r, requesterId, this.secretWords),
        );
    }
  }

  getSecretWord(code: string): string | undefined {
    return this.secretWords.get(code);
  }

  getPlayerRole(code: string, socketId: string): Role | undefined {
    const data = this.privateStateService.getSocketData(code, socketId);
    return (data['wkRole'] as Role | undefined) ?? (data['sfRole'] as Role | undefined);
  }

  whoKnowServerTimeout(code: string): RoomState | null {
    return this.withRoom(code, (room) => this.whoKnowService.handleQuestioningTimeout(room));
  }

  // --- Tic-Tac-Toe Logic ---

  tttJoinSide(code: string, clientId: string, side: 'X' | 'O'): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.ticTacToeService.joinSide(room, clientId, side));
  }

  tttMakeMove(code: string, clientId: string, index: number): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.ticTacToeService.makeMove(room, clientId, index));
  }

  tttReset(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.ticTacToeService.reset(room, clientId));
  }

  // --- RPS Logic ---

  rpsMakeChoice(code: string, clientId: string, choice: RPSChoice): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.rpsService.makeChoice(room, clientId, choice));
  }

  rpsNextRound(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.rpsService.nextRound(room, clientId));
  }

  rpsReset(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.rpsService.reset(room, clientId));
  }

  // --- Gobbler Tic-Tac-Toe Logic ---

  gobblerJoinSide(code: string, clientId: string, side: 'X' | 'O'): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.gobblerService.joinSide(room, clientId, side));
  }

  gobblerPlacePiece(
    code: string,
    clientId: string,
    pieceId: string,
    toIndex: number,
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.gobblerService.placePiece(room, clientId, pieceId, toIndex),
    );
  }

  gobblerMovePiece(
    code: string,
    clientId: string,
    fromIndex: number,
    toIndex: number,
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.gobblerService.movePiece(room, clientId, fromIndex, toIndex),
    );
  }

  gobblerReset(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.gobblerService.reset(room, clientId));
  }

  // --- Sounds Fishy Logic ---

  soundsFishyTypeAnswer(code: string, clientId: string, answer: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.soundsFishyService.typeAnswer(room, clientId, answer),
    );
  }

  soundsFishySubmitAnswer(code: string, clientId: string, answer: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.soundsFishyService.submitAnswer(room, clientId, answer),
    );
  }

  soundsFishyRevealPlayer(code: string, clientId: string, targetId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.soundsFishyService.revealPlayer(room, clientId, targetId),
    );
  }

  soundsFishyEliminatePlayer(code: string, clientId: string, targetId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.soundsFishyService.eliminatePlayer(room, clientId, targetId),
    );
  }

  soundsFishyBankPoints(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.soundsFishyService.bankPoints(room, clientId));
  }

  soundsFishyNextRound(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.soundsFishyService.nextRound(room, clientId));
  }

  soundsFishyReset(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.soundsFishyService.reset(room, clientId));
  }

  // --- Detective Club Actions ---

  detectiveClubSubmitWord(code: string, clientId: string, word: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.detectiveClubService.submitWord(room, clientId, word),
    );
  }

  detectiveClubPlayCard(code: string, clientId: string, cardIndex: number): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.detectiveClubService.playCard(room, clientId, cardIndex),
    );
  }

  detectiveClubNextPhase(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.detectiveClubService.nextPhase(room, clientId));
  }

  detectiveClubVote(code: string, clientId: string, targetId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.detectiveClubService.submitVote(room, clientId, targetId),
    );
  }

  detectiveClubNextRound(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.detectiveClubService.nextRound(room, clientId));
  }

  detectiveClubReset(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.detectiveClubService.reset(room, clientId));
  }

  // --- Saboteur Actions ---

  saboteurPlacePath(
    code: string,
    clientId: string,
    cardIndex: number,
    x: number,
    y: number,
    rotation: 0 | 180,
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.saboteurService.placePath(room, clientId, cardIndex, x, y, rotation),
    );
  }

  saboteurPlayAction(
    code: string,
    clientId: string,
    payload: {
      cardIndex: number;
      targetPlayerId?: string;
      repairTool?: import('@repo/types').SaboteurTool;
      goalIndex?: number;
      targetX?: number;
      targetY?: number;
    },
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.saboteurService.playAction(room, clientId, payload));
  }

  saboteurDiscard(code: string, clientId: string, cardIndex: number): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.saboteurService.discard(room, clientId, cardIndex));
  }

  saboteurPickGold(code: string, clientId: string, poolIndex: number): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.saboteurService.pickGold(room, clientId, poolIndex));
  }

  saboteurNextRound(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.saboteurService.nextRound(room, clientId));
  }

  saboteurReset(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.saboteurService.reset(room, clientId));
  }

  saboteurAutoPass(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.saboteurService.autoPass(room, clientId));
  }

  // --- Coup Actions ---

  coupDeclare(
    code: string,
    clientId: string,
    type: CoupActionType,
    targetId?: string,
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.coupService.declareAction(room, clientId, type, targetId));
  }

  coupChallenge(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.coupService.challenge(room, clientId));
  }

  coupChallengeTimeout(code: string): RoomState | null {
    return this.withRoom(code, (room) => this.coupService.handleChallengeTimeoutForRoom(room));
  }

  coupBlock(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.coupService.block(room, clientId));
  }

  coupBlockTimeout(code: string): RoomState | null {
    return this.withRoom(code, (room) => this.coupService.handleBlockTimeoutForRoom(room));
  }

  coupBlockChallengeTimeout(code: string): RoomState | null {
    return this.withRoom(code, (room) => this.coupService.handleBlockChallengeTimeoutForRoom(room));
  }

  // --- Who Am I / Who First Actions ---

  whoAmISubmitPlayerWord(
    code: string,
    clientId: string,
    word: string,
  ): { room: RoomState; error?: string } | null {
    if (this.rejectViewer(code, clientId)) return null;
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
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.whoAmIService.handleGameAction(room, clientId, action),
    );
  }

  whoFirstGameAction(
    code: string,
    clientId: string,
    action: { type: string; payload?: unknown },
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) =>
      this.whoFirstService.handleGameAction(
        room,
        clientId,
        action as Parameters<typeof this.whoFirstService.handleGameAction>[2],
      ),
    );
  }

  whoFirstSetActive(code: string): RoomState | null {
    return this.withRoom(code, (room) => this.whoFirstService.setActive(room));
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
    return this.withRoom(code, (room) =>
      this.whoAmIService.startGameHostInput(room, clientId, playerWords),
    );
  }

  // --- Music Trivia Logic ---

  async musicTriviaGameAction(
    code: string,
    clientId: string,
    action: { type: string; payload?: unknown },
  ): Promise<MusicTriviaActionResult | null> {
    if (this.rejectViewer(code, clientId)) return null;
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

  musicTriviaFinalizeAnswerTimeout(code: string): MusicTriviaActionResult | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const result = this.musicTriviaService.answerTimeout(room);
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
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => {
      const playerId = this.getPlayerId(room, clientId);
      return playerId ? this.theMindService.ready(room, playerId) : null;
    });
  }

  theMindPlayCard(
    code: string,
    clientId: string,
    card: number,
    pile?: 'UP' | 'DOWN',
  ): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => {
      const playerId = this.getPlayerId(room, clientId);
      return playerId ? this.theMindService.playCard(room, playerId, card, pile) : null;
    });
  }

  theMindNextLevel(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => this.theMindService.nextLevel(room, clientId));
  }

  theMindProposeShuriken(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => {
      const playerId = this.getPlayerId(room, clientId);
      return playerId ? this.theMindService.proposeShuriken(room, playerId) : null;
    });
  }

  theMindVoteShuriken(code: string, clientId: string, agree: boolean): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => {
      const playerId = this.getPlayerId(room, clientId);
      return playerId ? this.theMindService.voteShuriken(room, playerId, agree) : null;
    });
  }

  theMindCancelShuriken(code: string, clientId: string): RoomState | null {
    if (this.rejectViewer(code, clientId)) return null;
    return this.withRoom(code, (room) => {
      if (room.gameType !== GameType.THE_MIND) return null;
      const playerId = this.getPlayerId(room, clientId);
      return playerId ? this.theMindService.cancelShurikenProposal(room, playerId) : null;
    });
  }

  theMindServerTimeout(code: string): RoomState | null {
    return this.withRoom(code, (room) => {
      if (room.gameType !== GameType.THE_MIND) return null;
      return this.theMindService.handleTimeout(room);
    });
  }

  private getPlayerId(room: RoomState, socketId: string): string | null {
    return room.players.find((player) => player.socketId === socketId)?.id ?? null;
  }
}
