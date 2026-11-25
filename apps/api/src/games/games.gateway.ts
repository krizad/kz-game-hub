import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { RoomTimerService } from './room-timer.service';
import { PrivateStateService } from './private-state.service';
import { GameSettingsService } from './game-settings.service';
import { ArtistPresetService } from './artist-preset.service';
import { ActionReceiptService } from './action-receipt.service';
import { WsExceptionFilter } from './ws-exception.filter';
import { WsRateLimitService, extractClientIp } from './ws-rate-limit.service';
import { parseCorsOrigin } from '../common/cors.util';
import { isValidPayload } from './gateway/payload-validator';
import {
  AdminGatewayContext,
  handleAdminVerifyKeyHelper,
  handleDeleteArtistHelper,
  handleGetArtistPresetsHelper,
  handleSetArtistEnabledHelper,
  handleSetGameEnabledHelper,
} from './gateway/admin-gateway.helper';
import {
  SOCKET_EVENTS,
  ActionReceipt,
  RoomState,
  RoomStatus,
  Role,
  GameType,
  RoomConfig,
  RPSChoice,
  CoupActionType,
  CoupRole,
  CardGameAction,
  CardGameConfig,
  PokerAction,
  PokerV2Action,
  ThirtyOneAction,
  DeleteArtistPayload,
  GetArtistPresetsPayload,
  SetArtistEnabledPayload,
  SetGameEnabledPayload,
  AdminVerifyKeyPayload,
  ServerTimeRequestPayload,
  ServerTimeResponsePayload,
  BANANA_THIEF_REACTIONS,
  BananaThiefChooseFollowerPayload,
  CipherAssignTeamPayload,
  CipherGiveCluePayload,
  CipherCardIndexPayload,
  CipherRespondChallengePayload,
  DogRelayActionRequest,
  DOG_RELAY_MAX_PLAYERS,
  ResultRevealActionPayload,
  BOT_SOCKET_ID,
  WerewolfNightActionKind,
  WerewolfPhase,
  BattleshipPlaceShipsPayload,
  BattleshipFirePayload,
  BattleshipPingPayload,
} from '@repo/types';
import { buildDogRelayResultRows } from './dog-relay/dog-relay-results';
import { syncResultReveal } from './result-reveal';

/** Server string the client localizes via i18n/serverErrors. */
const GAME_DISABLED_MESSAGE = 'This game is currently disabled.';
import { MusicTriviaTimerCommand } from './music-trivia/music-trivia.service';

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: parseCorsOrigin(),
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  // Send pings well inside typical 30s-60s proxy read timeouts while tolerating
  // mobile network hiccups before declaring the socket dead.
  pingInterval: 15_000,
  pingTimeout: 45_000,
})
export class GamesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);
  private readonly recordedResults = new Set<string>();
  private readonly recordedScoreBaselines = new Map<string, Map<string, number>>();
  private readonly lastBroadcastSnapshot = new Map<string, string>();
  private static readonly QUIET_EVENTS = new Set<string>([
    SOCKET_EVENTS.SERVER_TIME_REQUEST,
    SOCKET_EVENTS.GET_AVAILABLE_ROOMS,
    SOCKET_EVENTS.GET_GAME_SETTINGS,
    SOCKET_EVENTS.GET_ARTIST_PRESETS,
    SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES,
  ]);

  constructor(
    private readonly gamesService: GamesService,
    private readonly leaderboardService: LeaderboardService,
    private readonly roomTimerService: RoomTimerService,
    private readonly privateStateService: PrivateStateService,
    private readonly gameSettingsService: GameSettingsService,
    private readonly artistPresetService: ArtistPresetService,
    private readonly actionReceiptService: ActionReceiptService = new ActionReceiptService(),
    private readonly wsRateLimitService: WsRateLimitService = new WsRateLimitService(),
  ) {}

  afterInit(): void {
    this.gamesService.setRoomLifecycleListener((event) => {
      if (event.type === 'ROOM_DELETED') {
        this.server.to(event.code).emit(SOCKET_EVENTS.ROOM_DELETED);
        this.forgetRecordedResult(event.code);
      } else {
        this.broadcastRoomState(event.room);
      }
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    });
    void this.gameSettingsService.load();
  }

  onModuleDestroy(): void {
    const roomCount =
      typeof this.gamesService?.getRoomCount === 'function'
        ? this.gamesService.getRoomCount()
        : undefined;
    const socketCount = this.server?.sockets?.sockets?.size;
    this.logger.warn(
      `[SYS] GamesGateway shutting down activeRooms=${roomCount ?? 'unknown'} connectedSockets=${socketCount ?? 'unknown'}`,
    );
  }

  handleConnection(client: Socket) {
    const transport = client.conn?.transport?.name ?? 'unknown';
    const origin =
      typeof client.handshake?.headers?.origin === 'string' ? client.handshake.headers.origin : '-';
    const totalSockets = this.server?.sockets?.sockets?.size ?? 'unknown';
    this.logger.log(
      `[WS] Connected socket=${client.id} transport=${transport} origin=${origin} totalSockets=${totalSockets}`,
    );

    client.conn?.on?.('upgrade', (nextTransport: { name?: string }) => {
      this.logger.log(
        `[WS] Transport upgraded socket=${client.id} to=${nextTransport?.name ?? 'unknown'}`,
      );
    });
    client.conn?.on?.('error', (error: unknown) => {
      this.logger.warn(
        `[WS] Transport error socket=${client.id} message=${error instanceof Error ? error.message : String(error)}`,
      );
    });
    client.once?.('disconnect', (reason: string) => {
      this.logger.log(
        `[WS] Socket closed socket=${client.id} reason=${reason} transport=${client.conn?.transport?.name ?? 'unknown'}`,
      );
    });

    client.use(([event, payload], next) => {
      if (!isValidPayload(event, payload)) {
        this.logger.warn(`[WS] Invalid payload socket=${client.id} event=${event}`);
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
        return next(new Error('Invalid request payload'));
      }

      const rateResult = this.wsRateLimitService.checkEvent({
        event,
        socketId: client.id,
        clientIp: extractClientIp(client.handshake),
        isQuietEvent: GamesGateway.QUIET_EVENTS.has(event),
        isExternalApiEvent: this.isExternalApiEvent(event, payload),
      });
      if (!rateResult.allowed) {
        const errorCode = rateResult.errorCode ?? 'RATE_LIMITED';
        this.logger.warn(`[WS] Rate limited socket=${client.id} event=${event} code=${errorCode}`);
        client.emit(SOCKET_EVENTS.ERROR, { message: errorCode });
        return next(new Error(errorCode));
      }

      const roomCode =
        payload &&
        typeof payload === 'object' &&
        'code' in payload &&
        typeof (payload as { code?: unknown }).code === 'string'
          ? (payload as { code: string }).code
          : undefined;
      if (roomCode && typeof this.gamesService?.touchRoomActivity === 'function') {
        this.gamesService.touchRoomActivity(roomCode);
      }

      this.logClientAction(client.id, event, payload);
      return next();
    });
    client.emit(SOCKET_EVENTS.GAME_SETTINGS_UPDATED, this.gameSettingsService.snapshot());
  }

  private isExternalApiEvent(event: string, payload: unknown): boolean {
    if (!payload || typeof payload !== 'object' || !('code' in payload)) return false;
    const code = (payload as { code?: unknown }).code;
    if (typeof code !== 'string') return false;
    const room =
      typeof this.gamesService?.getRoom === 'function'
        ? this.gamesService.getRoom(code)
        : undefined;
    if (!room) return false;
    if (event === SOCKET_EVENTS.START_GAME) {
      return (
        room.gameType === GameType.MUSIC_TRIVIA ||
        (room.gameType === GameType.WHO_AM_I && room.config?.wordMode === 'AI_GENERATED')
      );
    }
    if (event === SOCKET_EVENTS.GAME_ACTION) {
      const action = (payload as { action?: unknown }).action;
      return (
        action === 'NEXT_ROUND' &&
        room.gameType === GameType.WHO_AM_I &&
        room.config?.wordMode === 'AI_GENERATED'
      );
    }
    return false;
  }

  handleDisconnect(client: Socket) {
    this.wsRateLimitService.clearSocket(client.id);
    const previousRoomCode =
      typeof this.gamesService?.findRoomCodeBySocketId === 'function'
        ? this.gamesService.findRoomCodeBySocketId(client.id)
        : null;
    const result = this.gamesService.leaveRoom(client.id, false);
    this.logger.log(
      `[WS] Disconnected socket=${client.id} room=${previousRoomCode ?? '-'} outcome=${result.outcome}`,
    );
    this.handleLeaveResult(client, result);
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_ROOM)
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const result = this.gamesService.leaveRoom(client.id, true);
    this.logger.log(`[ROOM] Leave requested socket=${client.id} outcome=${result.outcome}`);
    this.handleLeaveResult(client, result);

    const roomCode =
      'room' in result ? result.room.code : 'code' in result ? result.code : undefined;
    const spectatingRoomCode = client.data?.spectatingRoomCode as string | undefined;
    if (roomCode) client.leave(roomCode);
    if (spectatingRoomCode && spectatingRoomCode !== roomCode) client.leave(spectatingRoomCode);
    if (client.data) client.data.spectatingRoomCode = undefined;
  }

  /** Shared post-leave handling for both explicit leaves and disconnects. */
  private handleLeaveResult(
    client: Socket,
    result:
      | { outcome: 'ROOM_CLOSED'; code: string }
      | { outcome: 'ROOM_EMPTIED'; code: string }
      | { outcome: 'PLAYER_LEFT'; room: RoomState }
      | { outcome: 'NOT_IN_ROOM' },
  ): void {
    switch (result.outcome) {
      case 'ROOM_CLOSED':
        // Host left — the service already deleted the room and its timers.
        // Spectators may still be in the socket.io room; notify them.
        this.logger.log(`[ROOM] Closed by host room=${result.code}`);
        this.server.to(result.code).emit(SOCKET_EVENTS.ROOM_DELETED);
        this.forgetRecordedResult(result.code);
        break;
      case 'ROOM_EMPTIED':
        this.logger.log(`[ROOM] Emptied and deleted room=${result.code}`);
        this.forgetRecordedResult(result.code);
        break;
      case 'PLAYER_LEFT':
        this.broadcastRoomState(result.room);
        break;
      case 'NOT_IN_ROOM':
        break;
    }
    this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
  }

  private forgetRecordedResult(code: string): void {
    this.recordedResults.delete(code);
    this.recordedScoreBaselines.delete(code);
    this.recordedDogRelayRounds.delete(code);
    this.lastBroadcastSnapshot.delete(code);
  }

  private readonly recordedDogRelayRounds = new Map<string, string>();

  @SubscribeMessage(SOCKET_EVENTS.DOG_RELAY_ACTION)
  handleDogRelayAction(@MessageBody() input: unknown, @ConnectedSocket() client: Socket) {
    if (!input || typeof input !== 'object') return;
    const data = input as DogRelayActionRequest;
    if (
      typeof data.code !== 'string' ||
      !this.actionReceiptService.isValidRequestId(data.requestId)
    ) {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'DOG_RELAY_INVALID_ACTION' });
      return;
    }
    const code = data.code.toUpperCase();
    const room = this.gamesService.getRoom(code);
    const player = room?.players.find((candidate) => candidate.socketId === client.id);
    if (!room || room.gameType !== GameType.DOG_RELAY || !player || player.isViewer) {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'DOG_RELAY_NOT_PLAYER' });
      return;
    }
    const cache = this.actionReceiptService.check(
      code,
      player.id,
      SOCKET_EVENTS.DOG_RELAY_ACTION,
      data.requestId,
      data,
    );
    if (cache.kind !== 'MISS') {
      client.emit(SOCKET_EVENTS.ACTION_RECEIPT, cache.receipt);
      return;
    }
    const receipt: ActionReceipt = {
      code,
      requestId: data.requestId,
      event: SOCKET_EVENTS.DOG_RELAY_ACTION,
      status: 'accepted',
      serverNow: Date.now(),
    };
    try {
      if (!data.action || typeof data.action !== 'object' || typeof data.action.type !== 'string') {
        throw new Error('DOG_RELAY_INVALID_ACTION');
      }
      this.gamesService.dogRelayAction(code, client.id, data);
    } catch (error) {
      receipt.status = 'rejected';
      receipt.reason =
        error instanceof Error && /^DOG_RELAY_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'DOG_RELAY_INVALID_ACTION';
    }
    this.actionReceiptService.record(
      code,
      player.id,
      SOCKET_EVENTS.DOG_RELAY_ACTION,
      data.requestId,
      data,
      receipt,
    );
    client.emit(SOCKET_EVENTS.ACTION_RECEIPT, receipt);
    if (receipt.status === 'accepted') {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, this.publicRoomView(room));
      client.emit(SOCKET_EVENTS.PRIVATE_STATE_UPDATED, {
        data: this.getOutboundPrivateState(room, client.id),
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GET_AVAILABLE_ROOMS)
  handleGetAvailableRooms(@ConnectedSocket() client: Socket) {
    client.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
  }

  @SubscribeMessage(SOCKET_EVENTS.GET_GAME_SETTINGS)
  handleGetGameSettings(@ConnectedSocket() client: Socket) {
    client.emit(SOCKET_EVENTS.GAME_SETTINGS_UPDATED, this.gameSettingsService.snapshot());
  }

  @SubscribeMessage(SOCKET_EVENTS.SERVER_TIME_REQUEST)
  handleServerTimeRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ServerTimeRequestPayload,
  ) {
    const serverNow = this.gamesService.getServerTime();
    client.emit(SOCKET_EVENTS.SERVER_TIME_RESPONSE, {
      clientSentAt: data.clientSentAt,
      serverNow,
    } satisfies ServerTimeResponsePayload);
  }

  private getAdminContext(): AdminGatewayContext {
    return {
      server: this.server,
      logger: this.logger,
      gamesService: this.gamesService,
      gameSettingsService: this.gameSettingsService,
      artistPresetService: this.artistPresetService,
    };
  }

  /** Admin-only: flip a game's enabled flag; needs ADMIN_SECRET from the server env. */
  @SubscribeMessage(SOCKET_EVENTS.SET_GAME_ENABLED)
  async handleSetGameEnabled(
    @MessageBody() data: SetGameEnabledPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return handleSetGameEnabledHelper(this.getAdminContext(), data, client);
  }

  /** Admin-only: verify an admin key before unlocking the client-side panel. */
  @SubscribeMessage(SOCKET_EVENTS.ADMIN_VERIFY_KEY)
  handleAdminVerifyKey(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AdminVerifyKeyPayload,
  ) {
    handleAdminVerifyKeyHelper(this.getAdminContext(), data, client);
  }

  /** Lobby list (enabled only); a valid adminKey unlocks the full list. */
  @SubscribeMessage(SOCKET_EVENTS.GET_ARTIST_PRESETS)
  async handleGetArtistPresets(
    @MessageBody() data: GetArtistPresetsPayload | undefined,
    @ConnectedSocket() client: Socket,
  ) {
    return handleGetArtistPresetsHelper(this.getAdminContext(), data, client);
  }

  /** Admin-only: enable/disable an artist preset (removed from new room setup while disabled). */
  @SubscribeMessage(SOCKET_EVENTS.SET_ARTIST_ENABLED)
  async handleSetArtistEnabled(
    @MessageBody() data: SetArtistEnabledPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return handleSetArtistEnabledHelper(this.getAdminContext(), data, client);
  }

  /** Admin-only: delete an artist preset together with its catalog. */
  @SubscribeMessage(SOCKET_EVENTS.DELETE_ARTIST)
  async handleDeleteArtist(
    @MessageBody() data: DeleteArtistPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return handleDeleteArtistHelper(this.getAdminContext(), data, client);
  }

  private leavePreviousRoom(client: Socket, nextRoomCode?: string): void {
    const previousRoomCode = this.gamesService.findRoomCodeBySocketId(client.id);
    if (previousRoomCode && previousRoomCode !== nextRoomCode) {
      const leaveResult = this.gamesService.leaveRoom(client.id, true);
      if (leaveResult.outcome !== 'NOT_IN_ROOM') {
        this.handleLeaveResult(client, leaveResult);
      }
      client.leave(previousRoomCode);
    }

    const spectatingRoomCode = client.data.spectatingRoomCode as string | undefined;
    if (spectatingRoomCode && spectatingRoomCode !== nextRoomCode) {
      client.leave(spectatingRoomCode);
      client.data.spectatingRoomCode = undefined;
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CREATE_ROOM)
  handleCreateRoom(
    @MessageBody() data: { name: string; gameType?: GameType; config?: Partial<RoomConfig> },
    @ConnectedSocket() client: Socket,
  ) {
    const requestedGameType = data.gameType ?? GameType.WHO_KNOW;
    if (!this.gamesService.isGameEnabled(requestedGameType)) {
      client.emit(SOCKET_EVENTS.ERROR, { message: GAME_DISABLED_MESSAGE });
      return;
    }
    if (
      typeof this.gamesService.isRoomLimitReached === 'function' &&
      this.gamesService.isRoomLimitReached()
    ) {
      this.logger.warn(`[ROOM] Create rejected: room limit reached socket=${client.id}`);
      client.emit(SOCKET_EVENTS.ERROR, { message: 'SERVER_ROOM_LIMIT_REACHED' });
      return;
    }
    this.leavePreviousRoom(client);
    let room: RoomState;
    try {
      room = this.gamesService.createRoom(client.id, data.gameType, data.config);
    } catch (error) {
      if (error instanceof Error && error.message === 'SERVER_ROOM_LIMIT_REACHED') {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'SERVER_ROOM_LIMIT_REACHED' });
        return;
      }
      throw error;
    }
    const updatedRoom = this.gamesService.joinRoom(room.code, {
      id: client.id,
      name: data.name.trim(),
      socketId: client.id,
    });

    if (updatedRoom) {
      client.join(updatedRoom.code);
      this.emitSessionToken(client, updatedRoom.code);
      this.logger.log(
        `[ROOM] Created room=${updatedRoom.code} game=${updatedRoom.gameType} host=${data.name.trim()} socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, this.publicRoomView(updatedRoom));
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      this.logger.warn(
        `[ROOM] Failed create-join rollback room=${room.code} game=${requestedGameType} socket=${client.id}`,
      );
      this.gamesService.deleteRoom(room.code);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  handleJoinRoom(
    @MessageBody() data: { code: string; name: string; reconnectToken?: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Block new entries into a disabled game, but never strand a seated player:
    // existing members (reconnecting) may always return to their room. After a
    // browser refresh the socket id is new, so also honor a valid session token.
    const requestedCode = data.code.toUpperCase();
    const targetRoom = this.gamesService.getRoom(requestedCode);
    if (!targetRoom) {
      this.logger.warn(
        `[ROOM] Join rejected room=${requestedCode} reason="Room not found" name=${data.name?.trim() || '-'} hasToken=${Boolean(data.reconnectToken)} socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }
    const name = data.name.trim();
    const isSeatedMember =
      !!data.reconnectToken &&
      this.gamesService.hasSeatedSession(requestedCode, data.reconnectToken, name);
    if (
      !isSeatedMember &&
      targetRoom.gameType === GameType.DOG_RELAY &&
      targetRoom.status === RoomStatus.LOBBY &&
      targetRoom.players.filter((player) => !player.isViewer).length >= DOG_RELAY_MAX_PLAYERS
    ) {
      this.logger.warn(
        `[ROOM] Join rejected room=${requestedCode} reason=DOG_RELAY_ROOM_FULL name=${name} socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: 'DOG_RELAY_ROOM_FULL' });
      return;
    }
    // A fresh join after play starts becomes a viewer. Keep that path subject
    // to the same policy as SPECTATE_JOIN, without locking out seated reconnects.
    if (
      !isSeatedMember &&
      targetRoom.status !== RoomStatus.LOBBY &&
      targetRoom.config?.allowSpectators === false
    ) {
      this.logger.warn(
        `[ROOM] Join rejected room=${requestedCode} reason=SPECTATORS_DISABLED name=${name} socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: 'SPECTATORS_DISABLED' });
      return;
    }
    if (!isSeatedMember && !this.gamesService.isGameEnabled(targetRoom.gameType)) {
      this.logger.warn(
        `[ROOM] Join rejected room=${requestedCode} reason=GAME_DISABLED game=${targetRoom.gameType} name=${name} socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: GAME_DISABLED_MESSAGE });
      return;
    }
    this.leavePreviousRoom(client, requestedCode);
    const room = this.gamesService.joinRoom(
      requestedCode,
      {
        id: client.id, // using socketId as temp ID
        name,
        socketId: client.id,
      },
      data.reconnectToken,
    );

    if (room) {
      const player = room.players.find((p) => p.socketId === client.id);
      this.logger.log(
        `[ROOM] Joined room=${room.code} game=${room.gameType} player=${name} rejoin=${isSeatedMember} viewer=${Boolean(player?.isViewer)} players=${room.players.length} socket=${client.id}`,
      );
      client.join(room.code);
      this.emitSessionToken(client, room.code);
      this.broadcastRoomState(room);
      this.emitMusicTriviaSyncPlay(room.code, client);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );

      const playerRole = this.gamesService.getPlayerRole(room.code, client.id);
      if (player && playerRole) {
        if (room.status === RoomStatus.WORD_SETTING) {
          if (playerRole === Role.Host) {
            client.emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: playerRole });
          }
        } else if (room.status !== RoomStatus.LOBBY) {
          client.emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: playerRole });

          const secretWord = this.gamesService.getSecretWord(room.code);
          if (secretWord && (playerRole === Role.Host || playerRole === Role.Know)) {
            client.emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: secretWord });
          }
        }
      }
    } else {
      this.logger.warn(
        `[ROOM] Join rejected room=${requestedCode} reason="Player name is already in use" name=${name} socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Player name is already in use',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.START_GAME)
  async handleStartGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const result = await this.gamesService.assignRoles(data.code, client.id);

    if (result && !result.error) {
      this.logger.log(
        `[GAME] Started room=${result.room.code} game=${result.room.gameType} players=${result.room.players.length} hostSocket=${client.id}`,
      );
      // Broadcast updated room state
      this.broadcastRoomState(result.room);
      this.syncTheMindTimer(result.room);
      this.syncWhoFirstTimer(result.room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );

      // ONLY dispatch the Host role upfront so they know they are the host to set the word
      const host = Object.entries(result.roles).find(([, role]) => role === Role.Host);
      if (host) {
        this.server.to(host[0]).emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: Role.Host });
      }
    } else {
      const roomInfo = this.gamesService.getRoom(data.code);
      const gameType = roomInfo?.gameType;
      let msg = result?.error ?? 'Cannot start game.';
      if (!result?.error) {
        if (gameType === GameType.WHO_KNOW) {
          msg = 'Cannot start game. Need at least 4 players (1 Host + 3 Players).';
        } else if (gameType === GameType.SOUNDS_FISHY) {
          msg = 'Cannot start game. Need at least 3 players.';
        } else if (gameType === GameType.MUSIC_TRIVIA) {
          msg = 'Cannot start game. Need at least 2 players and a music query.';
        } else if (gameType === GameType.DETECTIVE_CLUB) {
          msg = 'Cannot start game. Need at least 3 players.';
        } else if (gameType === GameType.COUP) {
          msg = 'Cannot start game. Need 3-6 players for Coup.';
        } else if (
          gameType === GameType.POKER ||
          gameType === GameType.POKER_V2 ||
          gameType === GameType.THIRTY_ONE
        ) {
          msg = 'Cannot start game. Need at least 2 players.';
        } else if (gameType === GameType.BANANA_THIEF) {
          msg = 'Cannot start game. Need at least 4 players.';
        } else if (gameType === GameType.CIPHER_GRID) {
          msg = 'Cannot start game. Need at least 4 players.';
        } else if (gameType === GameType.WEREWOLF) {
          msg = 'Cannot start game. Need 6-12 players for Werewolf.';
        }
      }
      this.logger.warn(
        `[GAME] Start rejected room=${data.code} game=${gameType ?? 'unknown'} reason="${msg}" socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: msg });
      const currentRoom = result?.room ?? roomInfo;
      if (currentRoom) {
        this.broadcastRoomState(currentRoom);
      }
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SET_WORD)
  handleSetWord(
    @MessageBody() data: { code: string; word: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.setWord(data.code, data.word, client.id);

    if (room) {
      // Send the word ONLY to the Insider and Game Host
      const insider = room.players.find(
        (p) => this.gamesService.getPlayerRole(room.code, p.socketId) === Role.Know,
      );
      const gameHost = room.players.find(
        (p) => this.gamesService.getPlayerRole(room.code, p.socketId) === Role.Host,
      );

      if (insider)
        this.server
          .to(insider.socketId)
          .emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: data.word });
      if (gameHost)
        this.server
          .to(gameHost.socketId)
          .emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: data.word });

      // Now that the word is set, reveal everyone's roles to them privately
      room.players.forEach((player) => {
        const role = this.gamesService.getPlayerRole(room.code, player.socketId);
        if (role && role !== Role.Host) {
          this.server.to(player.socketId).emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role });
        }
      });

      // Tell everyone else the phase changed
      this.broadcastRoomState(room);
      this.syncWhoKnowTimer(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Not authorized to set word or invalid room state.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.STOP_TIMER)
  handleStopTimer(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.stopTimer(data.code, client.id);

    if (room) {
      this.roomTimerService.cancel(room.code, 'who-know');
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Not authorized or invalid game state to stop timer.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.END_QUESTIONING)
  handleEndQuestioning(
    @MessageBody() data: { code: string; timeout?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.endQuestioning(data.code, client.id, data.timeout);

    if (room) {
      // Transition to Voting phase for everyone
      this.roomTimerService.cancel(room.code, 'who-know');
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Not authorized or invalid game state to end questioning.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_VOTE)
  handleSubmitVote(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.submitVote(data.code, client.id, data.targetId);

    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to submit vote.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RESET_GAME)
  handleResetGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);

    if (room) {
      // Cancel every game's round timers — leaving per-player reconnect-grace
      // timers intact. Each callback re-validates state, but an armed deadline
      // for a reset game is noise at best and a stale action at worst.
      for (const timerName of [
        'who-know',
        'dog-relay-phase',
        'the-mind',
        'who-first',
        'saboteur',
        'card-game',
        'poker',
        'poker-v2-turn',
        'poker-v2-deal',
        'coup-challenge',
        'coup-block',
        'music-trivia-countdown',
        'music-trivia-answer',
        'banana-thief',
        'cipher-grid',
      ]) {
        this.roomTimerService.cancel(room.code, timerName);
      }
      this.logger.log(
        `[GAME] Reset to lobby room=${room.code} game=${room.gameType} bySocket=${client.id}`,
      );
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Not authorized to reset game or invalid state.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.UPDATE_CONFIG)
  handleUpdateConfig(
    @MessageBody()
    data: {
      code: string;
      config: Partial<RoomState['config']>;
      cardGameConfig?: Partial<CardGameConfig>;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.updateConfig(
      data.code,
      client.id,
      data.config,
      data.cardGameConfig,
    );

    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Not authorized to update config or invalid state.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CARD_GAME_ACTION)
  handleCardGameAction(
    @MessageBody() data: { code: string; action: CardGameAction },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cardGameAction(data.code, client.id, data.action);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid card game action.' });
    }
  }

  // --- Poker Actions ---

  @SubscribeMessage(SOCKET_EVENTS.POKER_ACTION)
  handlePokerAction(
    @MessageBody() data: { code: string; action: PokerAction },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.pokerAction(data.code, client.id, data.action);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid poker action.' });
    }
  }

  // --- Poker V2 Actions ---

  @SubscribeMessage(SOCKET_EVENTS.POKER_V2_ACTION)
  handlePokerV2Action(
    @MessageBody() data: { code: string; action: PokerV2Action },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.pokerV2Action(data.code, client.id, data.action);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid poker action.' });
    }
  }

  // --- Thirty-One Actions ---

  @SubscribeMessage(SOCKET_EVENTS.THIRTY_ONE_ACTION)
  handleThirtyOneAction(
    @MessageBody() data: { code: string; action: ThirtyOneAction },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.thirtyOneAction(data.code, client.id, data.action);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
    }
  }

  // --- Tic-Tac-Toe Game Actions ---

  @SubscribeMessage(SOCKET_EVENTS.TTT_JOIN_SIDE)
  handleTTTJoinSide(
    @MessageBody() data: { code: string; side: 'X' | 'O' },
    @ConnectedSocket() client: Socket,
  ) {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const room = isTestEnv
      ? this.gamesService.tttJoinSide(data.code, client.id, data.side)
      : this.gamesService.tttJoinSide(data.code, client.id, data.side, { deferBotMove: true });
    if (room) {
      this.broadcastRoomState(room);
      this.scheduleTTTBotMoveIfNeeded(room);
      // If we transitioned to PLAYING, the available rooms list changed logic doesn't strictly need update
      // but safe to broadcast if lobby state changed.
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TTT_MAKE_MOVE)
  handleTTTMakeMove(
    @MessageBody() data: { code: string; index: number; requestId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.requestId !== undefined) {
      if (!this.actionReceiptService.isValidRequestId(data.requestId)) {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid requestId' });
        return;
      }
      const room = this.gamesService.getRoom(data.code);
      if (!room || room.gameType !== GameType.TIC_TAC_TOE) {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found or wrong game type' });
        return;
      }
      const player = room.players.find((p) => p.socketId === client.id);
      if (!player) {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Not a member of this room' });
        return;
      }
      const checkResult = this.actionReceiptService.check(
        data.code,
        player.id,
        SOCKET_EVENTS.TTT_MAKE_MOVE,
        data.requestId,
        data,
      );
      if (checkResult.kind === 'HIT' || checkResult.kind === 'CONFLICT') {
        client.emit(SOCKET_EVENTS.ACTION_RECEIPT, checkResult.receipt);
        return;
      }

      const isTestEnv = process.env.NODE_ENV === 'test';
      const updatedRoom = isTestEnv
        ? this.gamesService.tttMakeMove(data.code, client.id, data.index)
        : this.gamesService.tttMakeMove(data.code, client.id, data.index, { deferBotMove: true });
      const now = Date.now();
      if (updatedRoom) {
        const receipt: ActionReceipt = {
          code: data.code.toUpperCase(),
          requestId: data.requestId,
          event: SOCKET_EVENTS.TTT_MAKE_MOVE,
          status: 'accepted',
          serverNow: now,
        };
        this.actionReceiptService.record(
          data.code,
          player.id,
          SOCKET_EVENTS.TTT_MAKE_MOVE,
          data.requestId,
          data,
          receipt,
          now,
        );
        client.emit(SOCKET_EVENTS.ACTION_RECEIPT, receipt);
        this.broadcastRoomState(updatedRoom);
        this.scheduleTTTBotMoveIfNeeded(updatedRoom);
      } else {
        const receipt: ActionReceipt = {
          code: data.code.toUpperCase(),
          requestId: data.requestId,
          event: SOCKET_EVENTS.TTT_MAKE_MOVE,
          status: 'rejected',
          reason: 'Invalid move.',
          serverNow: now,
        };
        this.actionReceiptService.record(
          data.code,
          player.id,
          SOCKET_EVENTS.TTT_MAKE_MOVE,
          data.requestId,
          data,
          receipt,
          now,
        );
        client.emit(SOCKET_EVENTS.ACTION_RECEIPT, receipt);
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
      }
      return;
    }

    const isTestEnv = process.env.NODE_ENV === 'test';
    const room = isTestEnv
      ? this.gamesService.tttMakeMove(data.code, client.id, data.index)
      : this.gamesService.tttMakeMove(data.code, client.id, data.index, { deferBotMove: true });
    if (room) {
      this.broadcastRoomState(room);
      this.scheduleTTTBotMoveIfNeeded(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TTT_RESET)
  handleTTTReset(
    @MessageBody() data: { code: string; toLobby?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomTimerService.cancel(data.code, 'ttt-bot-move');
    const room = this.gamesService.tttReset(data.code, client.id, data.toLobby);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  // --- Ultimate Tic-Tac-Toe Game Actions ---

  @SubscribeMessage(SOCKET_EVENTS.UTTT_JOIN_SIDE)
  handleUTTTJoinSide(
    @MessageBody() data: { code: string; side: 'X' | 'O' },
    @ConnectedSocket() client: Socket,
  ) {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const room = isTestEnv
      ? this.gamesService.utttJoinSide(data.code, client.id, data.side)
      : this.gamesService.utttJoinSide(data.code, client.id, data.side, { deferBotMove: true });
    if (room) {
      this.broadcastRoomState(room);
      this.scheduleUTTTBotMoveIfNeeded(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.UTTT_MAKE_MOVE)
  handleUTTTMakeMove(
    @MessageBody() data: { code: string; macroIndex: number; microIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.utttMakeMove(
      data.code,
      client.id,
      data.macroIndex,
      data.microIndex,
    );
    if (room) {
      this.broadcastRoomState(room);
      if (room.status === RoomStatus.RESULT) {
        this.maybeRecordGameResult(room);
      } else {
        this.scheduleUTTTBotMoveIfNeeded(room);
      }
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.UTTT_RESET)
  handleUTTTReset(
    @MessageBody() data: { code: string; toLobby?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomTimerService.cancel(data.code, 'uttt-bot-move');
    const isTestEnv = process.env.NODE_ENV === 'test';
    const room = isTestEnv
      ? this.gamesService.utttReset(data.code, client.id, data.toLobby)
      : this.gamesService.utttReset(data.code, client.id, data.toLobby, { deferBotMove: true });
    if (room) {
      this.broadcastRoomState(room);
      this.scheduleUTTTBotMoveIfNeeded(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  // --- RPS Actions ---

  @SubscribeMessage(SOCKET_EVENTS.RPS_NEXT_ROUND)
  handleRPSNextRound(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.rpsNextRound(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RPS_MAKE_CHOICE)
  handleRPSMakeChoice(
    @MessageBody() data: { code: string; choice: RPSChoice; requestId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.requestId !== undefined) {
      if (!this.actionReceiptService.isValidRequestId(data.requestId)) {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid requestId' });
        return;
      }
      const room = this.gamesService.getRoom(data.code);
      if (!room || room.gameType !== GameType.RPS) {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found or wrong game type' });
        return;
      }
      const player = room.players.find((p) => p.socketId === client.id);
      if (!player) {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Not a member of this room' });
        return;
      }
      const checkResult = this.actionReceiptService.check(
        data.code,
        player.id,
        SOCKET_EVENTS.RPS_MAKE_CHOICE,
        data.requestId,
        data,
      );
      if (checkResult.kind === 'HIT' || checkResult.kind === 'CONFLICT') {
        client.emit(SOCKET_EVENTS.ACTION_RECEIPT, checkResult.receipt);
        return;
      }

      const updatedRoom = this.gamesService.rpsMakeChoice(data.code, client.id, data.choice);
      const now = Date.now();
      if (updatedRoom) {
        const receipt: ActionReceipt = {
          code: data.code.toUpperCase(),
          requestId: data.requestId,
          event: SOCKET_EVENTS.RPS_MAKE_CHOICE,
          status: 'accepted',
          serverNow: now,
        };
        this.actionReceiptService.record(
          data.code,
          player.id,
          SOCKET_EVENTS.RPS_MAKE_CHOICE,
          data.requestId,
          data,
          receipt,
          now,
        );
        client.emit(SOCKET_EVENTS.ACTION_RECEIPT, receipt);
        this.broadcastRoomState(updatedRoom);
        this.maybeRecordGameResult(updatedRoom);
      } else {
        const receipt: ActionReceipt = {
          code: data.code.toUpperCase(),
          requestId: data.requestId,
          event: SOCKET_EVENTS.RPS_MAKE_CHOICE,
          status: 'rejected',
          reason: 'Invalid choice or not your turn.',
          serverNow: now,
        };
        this.actionReceiptService.record(
          data.code,
          player.id,
          SOCKET_EVENTS.RPS_MAKE_CHOICE,
          data.requestId,
          data,
          receipt,
          now,
        );
        client.emit(SOCKET_EVENTS.ACTION_RECEIPT, receipt);
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid choice or not your turn.' });
      }
      return;
    }

    const room = this.gamesService.rpsMakeChoice(data.code, client.id, data.choice);
    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid choice or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RPS_RESET)
  handleRPSReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.rpsReset(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  // --- Gobbler Tic-Tac-Toe Actions ---

  @SubscribeMessage(SOCKET_EVENTS.GOBBLER_JOIN_SIDE)
  handleGobblerJoinSide(
    @MessageBody() data: { code: string; side: 'X' | 'O' },
    @ConnectedSocket() client: Socket,
  ) {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const room = isTestEnv
      ? this.gamesService.gobblerJoinSide(data.code, client.id, data.side)
      : this.gamesService.gobblerJoinSide(data.code, client.id, data.side, { deferBotMove: true });
    if (room) {
      this.broadcastRoomState(room);
      this.scheduleGobblerBotMoveIfNeeded(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GOBBLER_PLACE)
  handleGobblerPlace(
    @MessageBody() data: { code: string; pieceId: string; toIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.gobblerPlacePiece(
      data.code,
      client.id,
      data.pieceId,
      data.toIndex,
    );
    if (room) {
      this.broadcastRoomState(room);
      if (room.status === RoomStatus.RESULT) {
        this.maybeRecordGameResult(room);
      } else {
        this.scheduleGobblerBotMoveIfNeeded(room);
      }
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GOBBLER_MOVE)
  handleGobblerMove(
    @MessageBody() data: { code: string; fromIndex: number; toIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.gobblerMovePiece(
      data.code,
      client.id,
      data.fromIndex,
      data.toIndex,
    );
    if (room) {
      this.broadcastRoomState(room);
      if (room.status === RoomStatus.RESULT) {
        this.maybeRecordGameResult(room);
      } else {
        this.scheduleGobblerBotMoveIfNeeded(room);
      }
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GOBBLER_RESET)
  handleGobblerReset(
    @MessageBody() data: { code: string; toLobby?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomTimerService.cancel(data.code, 'gobbler-bot-move');
    const isTestEnv = process.env.NODE_ENV === 'test';
    const room = isTestEnv
      ? this.gamesService.gobblerReset(data.code, client.id, data.toLobby)
      : this.gamesService.gobblerReset(data.code, client.id, data.toLobby, { deferBotMove: true });
    if (room) {
      this.broadcastRoomState(room);
      this.scheduleGobblerBotMoveIfNeeded(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  // --- Sounds Fishy Actions ---

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_TYPE_ANSWER)
  handleSoundsFishyTypeAnswer(
    @MessageBody() data: { code: string; answer: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishyTypeAnswer(data.code, client.id, data.answer);
    if (room) {
      this.broadcastRoomState(room);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_SUBMIT_ANSWER)
  handleSoundsFishySubmitAnswer(
    @MessageBody() data: { code: string; answer: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishySubmitAnswer(data.code, client.id, data.answer);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid answer or not in submission phase.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_REVEAL_ANSWER)
  handleSoundsFishyRevealAnswer(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishyRevealPlayer(data.code, client.id, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot reveal player.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_ELIMINATE_PLAYER)
  handleSoundsFishyEliminatePlayer(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishyEliminatePlayer(data.code, client.id, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot eliminate player.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_BANK_POINTS)
  handleSoundsFishyBankPoints(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishyBankPoints(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot bank points.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_NEXT_ROUND)
  handleSoundsFishyNextRound(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishyNextRound(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot go to next round.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_RESET)
  handleSoundsFishyReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.soundsFishyReset(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  // --- Detective Club Actions ---

  @SubscribeMessage(SOCKET_EVENTS.DETECTIVE_CLUB_SUBMIT_WORD)
  handleDetectiveClubSubmitWord(
    @MessageBody() data: { code: string; word: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.detectiveClubSubmitWord(data.code, client.id, data.word);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot submit word' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.DETECTIVE_CLUB_PLAY_CARD)
  handleDetectiveClubPlayCard(
    @MessageBody() data: { code: string; cardIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.detectiveClubPlayCard(data.code, client.id, data.cardIndex);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid card play' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_PHASE)
  handleDetectiveClubNextPhase(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.detectiveClubNextPhase(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot move to next phase' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.DETECTIVE_CLUB_VOTE)
  handleDetectiveClubVote(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.detectiveClubVote(data.code, client.id, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid vote' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_ROUND)
  handleDetectiveClubNextRound(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.detectiveClubNextRound(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to move to next round' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.DETECTIVE_CLUB_RESET)
  handleDetectiveClubReset(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.detectiveClubReset(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game' });
    }
  }

  // --- Saboteur Actions ---

  @SubscribeMessage(SOCKET_EVENTS.SABOTEUR_PLACE_PATH)
  handleSaboteurPlacePath(
    @MessageBody()
    data: { code: string; cardIndex: number; x: number; y: number; rotation: number },
    @ConnectedSocket() client: Socket,
  ) {
    const rotation: 0 | 180 = data.rotation === 180 ? 180 : 0;
    const room = this.gamesService.saboteurPlacePath(
      data.code,
      client.id,
      data.cardIndex,
      data.x,
      data.y,
      rotation,
    );
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid tile placement' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SABOTEUR_PLAY_ACTION)
  handleSaboteurPlayAction(
    @MessageBody()
    data: {
      code: string;
      cardIndex: number;
      targetPlayerId?: string;
      repairTool?: string;
      goalIndex?: number;
      targetX?: number;
      targetY?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.saboteurPlayAction(data.code, client.id, {
      cardIndex: data.cardIndex,
      targetPlayerId: data.targetPlayerId,
      repairTool: data.repairTool as import('@repo/types').SaboteurTool | undefined,
      goalIndex: data.goalIndex,
      targetX: data.targetX,
      targetY: data.targetY,
    });
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action card' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SABOTEUR_DISCARD)
  handleSaboteurDiscard(
    @MessageBody() data: { code: string; cardIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.saboteurDiscard(data.code, client.id, data.cardIndex);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot discard card' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SABOTEUR_PICK_GOLD)
  handleSaboteurPickGold(
    @MessageBody() data: { code: string; poolIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.saboteurPickGold(data.code, client.id, data.poolIndex);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot pick gold' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SABOTEUR_NEXT_ROUND)
  handleSaboteurNextRound(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.saboteurNextRound(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to move to next round' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SABOTEUR_RESET)
  handleSaboteurReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.saboteurReset(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game' });
    }
  }

  // --- Coup Actions ---

  @SubscribeMessage(SOCKET_EVENTS.COUP_DECLARE)
  handleCoupDeclare(
    @MessageBody() data: { code: string; type: CoupActionType; targetId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.coupDeclare(data.code, client.id, data.type, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
      this.syncCoupChallengeTimer(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid Coup action' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.COUP_CHALLENGE)
  handleCoupChallenge(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.coupChallenge(data.code, client.id);
    if (room) {
      this.roomTimerService.cancel(room.code, 'coup-challenge');
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid Coup challenge' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.COUP_BLOCK)
  handleCoupBlock(
    @MessageBody() data: { code: string; role?: CoupRole },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.coupBlock(data.code, client.id, data.role);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid Coup block' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.COUP_EXCHANGE_SELECT)
  handleCoupExchangeSelect(
    @MessageBody() data: { code: string; keepIndices: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.coupExchangeSelect(data.code, client.id, data.keepIndices);
    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid Exchange select' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.COUP_RESET)
  handleCoupReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game' });
    }
  }

  // --- Who Am I Actions ---
  @SubscribeMessage(SOCKET_EVENTS.WHO_AM_I_SUBMIT_WORDS)
  handleWhoAmISubmitWords(
    @MessageBody() data: { code: string; playerWords: Record<string, string> },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.whoAmIStartHostInput(data.code, client.id, data.playerWords);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot start Host Input mode' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.WHO_AM_I_SUBMIT_PLAYER_WORD)
  handleWhoAmISubmitPlayerWord(
    @MessageBody() data: { code: string; word: string },
    @ConnectedSocket() client: Socket,
  ) {
    const result = this.gamesService.whoAmISubmitPlayerWord(data.code, client.id, data.word);
    if (result && result.room) {
      if (result.error) {
        client.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      }
      this.broadcastRoomState(result.room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot submit word' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES)
  async handleWhoAmIGetCategories(
    @MessageBody() data: { lang?: string; requestId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const categories = await this.gamesService.whoAmICategoriesList(data?.lang);
      if (data?.requestId !== undefined) {
        client.emit(SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, {
          categories,
          lang: data?.lang,
          requestId: data.requestId,
        });
      } else {
        client.emit(SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, categories);
      }
    } catch {
      if (data?.requestId !== undefined) {
        client.emit(SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, {
          categories: [],
          lang: data?.lang,
          requestId: data.requestId,
          error: 'CATEGORIES_UNAVAILABLE',
        });
      } else {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'CATEGORIES_UNAVAILABLE' });
      }
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GAME_ACTION)
  async handleGameAction(
    @MessageBody() data: { code: string; action: Record<string, unknown> },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
      return;
    }
    const roomInfo = this.gamesService.getRoom(data.code);
    if (roomInfo && roomInfo.gameType === GameType.WHO_AM_I) {
      const room = this.gamesService.whoAmIGameAction(data.code, client.id, data.action);
      if (room) {
        this.broadcastRoomState(room);
        this.maybeRecordGameResult(room);
      } else {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
      }
    } else if (roomInfo && roomInfo.gameType === GameType.WHO_FIRST) {
      const room = this.gamesService.whoFirstGameAction(
        data.code,
        client.id,
        data.action as { type: string; payload?: unknown },
      );
      if (room) {
        this.broadcastRoomState(room);
        this.syncWhoFirstTimer(room);
        this.maybeRecordGameResult(room);
      } else {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
      }
    } else if (roomInfo && roomInfo.gameType === GameType.MUSIC_TRIVIA) {
      const result = await this.gamesService.musicTriviaGameAction(
        data.code,
        client.id,
        data.action as { type: string; payload?: unknown },
      );
      if (result) {
        this.broadcastRoomState(result.room);

        // Emit sync play signal for audio synchronization
        if (result.syncPlay) {
          this.server
            .to(result.room.code)
            .emit(SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, result.syncPlay);
        }

        // Emit track answer privately to buzzed player (if applicable)
        if (result.trackAnswerTo) {
          this.server
            .to(result.trackAnswerTo.socketId)
            .emit(SOCKET_EVENTS.MUSIC_TRIVIA_TRACK_ANSWER, {
              roundNumber: result.trackAnswerTo.roundNumber,
            });
        }

        // Emit answer privately to host in GAME_MASTER mode
        if (result.hostAnswerTo) {
          this.server
            .to(result.hostAnswerTo.socketId)
            .emit(SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, {
              title: result.hostAnswerTo.title,
              artist: result.hostAnswerTo.artist,
              artworkUrl: result.hostAnswerTo.artworkUrl,
            });
        }

        this.applyMusicTriviaTimers(data.code, result.timerCommands);
        this.maybeRecordGameResult(result.room);
      } else {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
      }
    } else if (!roomInfo) {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Game action not supported for this game type' });
    }
  }

  // --- The Mind Actions ---

  @SubscribeMessage(SOCKET_EVENTS.THE_MIND_READY)
  handleTheMindReady(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.theMindReady(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.syncTheMindTimer(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot ready for game.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.THE_MIND_PLAY_CARD)
  handleTheMindPlayCard(
    @MessageBody() data: { code: string; card: number; pile?: 'UP' | 'DOWN' },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.theMindPlayCard(data.code, client.id, data.card, data.pile);
    if (room) {
      this.broadcastRoomState(room);
      this.syncTheMindTimer(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot play card right now.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.THE_MIND_NEXT_LEVEL)
  handleTheMindNextLevel(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.theMindNextLevel(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.syncTheMindTimer(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot advance to next level.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.THE_MIND_PROPOSE_SHURIKEN)
  handleTheMindProposeShuriken(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.theMindProposeShuriken(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.syncTheMindTimer(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot propose shuriken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.THE_MIND_VOTE_SHURIKEN)
  handleTheMindVoteShuriken(
    @MessageBody() data: { code: string; agree: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.theMindVoteShuriken(data.code, client.id, data.agree);
    if (room) {
      this.broadcastRoomState(room);
      this.syncTheMindTimer(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot vote on shuriken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.THE_MIND_CANCEL_SHURIKEN)
  handleTheMindCancelShuriken(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const updatedRoom = this.gamesService.theMindCancelShuriken(data.code, client.id);
    if (updatedRoom) {
      this.broadcastRoomState(updatedRoom);
      this.syncTheMindTimer(updatedRoom);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot cancel shuriken proposal.' });
    }
  }

  // --- Banana Thief Actions ---

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_READY)
  handleBananaThiefReady(
    @MessageBody() data: { code: string; force?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefReady(data.code, client.id, !!data.force);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot ready right now.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_ROLL_DIE)
  handleBananaThiefRollDie(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefRollDie(data.code, client.id);
    if (room) {
      // The die itself is private; only the (unchanged) public state is echoed.
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot roll the die right now.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_NEXT_HOUR)
  handleBananaThiefNextHour(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefNextHour(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot advance the night right now.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_PEEK)
  handleBananaThiefPeek(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefPeek(data.code, client.id, data.targetId);
    if (room) {
      // The peek result is private; only the wake/peer refresh is broadcast.
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot peek right now.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_VOTE)
  handleBananaThiefVote(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefVote(data.code, client.id, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid vote.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_CHOOSE_FOLLOWER)
  handleBananaThiefChooseFollower(
    @MessageBody() data: BananaThiefChooseFollowerPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.code || !data?.targetId) return;
    const room = this.gamesService.bananaThiefChooseFollower(data.code, client.id, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot choose this follower.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_START_VOTE)
  handleBananaThiefStartVote(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefStartVote(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot start the vote yet.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_NEXT_ROUND)
  handleBananaThiefNextRound(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.bananaThiefNextRound(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to start the next round.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_RESET)
  handleBananaThiefReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BANANA_THIEF_REACTION)
  handleBananaThiefReaction(
    @MessageBody() data: { code: string; emoji: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.gamesService.isRoomMember(data.code, client.id)) return;
    if (
      typeof data.emoji !== 'string' ||
      !(BANANA_THIEF_REACTIONS as readonly string[]).includes(data.emoji)
    ) {
      return;
    }
    const sender = this.gamesService
      .getRoom(data.code)
      ?.players.find((p) => p.socketId === client.id);
    // Reactions carry no game state — pure fun, broadcast to the room only.
    this.server.to(data.code).emit(SOCKET_EVENTS.BANANA_THIEF_REACTION, {
      fromName: sender?.name ?? '?',
      emoji: data.emoji,
    });
  }

  // --- Ciphergrid Actions ---

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_ASSIGN_TEAM)
  handleCipherAssignTeam(
    @MessageBody() data: { code: string } & CipherAssignTeamPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherAssignTeam(
      data.code,
      client.id,
      data.team ?? null,
      data.role,
      data.targetId,
    );
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot assign team right now.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_RANDOMIZE_TEAMS)
  handleCipherRandomizeTeams(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherRandomizeTeams(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot randomize teams.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_START_MATCH)
  handleCipherStartMatch(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.cipherStartMatch(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Cannot start match. Each team needs 1 Lead and at least 1 Tracker.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_GIVE_CLUE)
  handleCipherGiveClue(
    @MessageBody() data: { code: string } & CipherGiveCluePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const res = this.gamesService.cipherGiveClue(data.code, client.id, data.word, data.count);
    if (res.room) {
      this.broadcastRoomState(res.room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: res.error ?? 'Invalid clue.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_PING_CARD)
  handleCipherPingCard(
    @MessageBody() data: { code: string } & CipherCardIndexPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherPingCard(data.code, client.id, data.cardIndex);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot ping card.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_REVEAL_CARD)
  handleCipherRevealCard(
    @MessageBody() data: { code: string } & CipherCardIndexPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherRevealCard(data.code, client.id, data.cardIndex);
    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot reveal card.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_END_TURN)
  handleCipherEndTurn(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.cipherEndTurn(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Must make at least 1 guess before ending turn.',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_CHALLENGE_CLUE)
  handleCipherChallengeClue(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherChallengeClue(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot challenge clue.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_RESPOND_CHALLENGE)
  handleCipherRespondChallenge(
    @MessageBody() data: { code: string } & CipherRespondChallengePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherRespondChallenge(
      data.code,
      client.id,
      data.clueId,
      data.accept,
    );
    if (room) this.broadcastRoomState(room);
    else client.emit(SOCKET_EVENTS.ERROR, { message: 'CHALLENGE_EXPIRED' });
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_NEXT_ROUND)
  handleCipherNextRound(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.cipherNextRound(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Only host can start next round.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_RESET)
  handleCipherReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);
    if (room) {
      this.roomTimerService.cancel(room.code, 'cipher-grid');
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CIPHER_CANCEL_ROUND)
  handleCipherCancelRound(
    @MessageBody() data: { code: string; round: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.cipherCancelRound(data.code, client.id, data.round);
    if (room) {
      this.roomTimerService.cancel(room.code, 'cipher-grid');
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot cancel round.' });
    }
  }

  // --- Leaderboard ---

  @SubscribeMessage(SOCKET_EVENTS.RESULT_REVEAL_ACTION)
  handleResultRevealAction(
    @MessageBody() data: ResultRevealActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data || typeof data.code !== 'string' || typeof data.revealId !== 'string') return;
    const room = this.gamesService.resultRevealAction(data.code, client.id, data);
    if (room) this.broadcastRoomState(room);
  }

  // --- Werewolf (ADR 0015) ---

  @SubscribeMessage(SOCKET_EVENTS.WEREWOLF_NIGHT_ACTION)
  handleWerewolfNightAction(
    @MessageBody() data: { code: string; action: WerewolfNightActionKind; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.werewolfNightAction(
      data.code,
      client.id,
      data.action,
      data.targetId,
    );
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid night action' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.WEREWOLF_DAY_VOTE)
  handleWerewolfDayVote(
    @MessageBody() data: { code: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.werewolfDayVote(data.code, client.id, data.targetId);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid vote' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.WEREWOLF_SKIP_DISCUSSION)
  handleWerewolfSkipDiscussion(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.werewolfSkipDiscussion(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot skip discussion' });
    }
  }

  // --- Battleship (ADR 0016) ---

  @SubscribeMessage(SOCKET_EVENTS.BATTLESHIP_PLACE_SHIPS)
  handleBattleshipPlaceShips(
    @MessageBody() data: { code: string; payload: BattleshipPlaceShipsPayload },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.battleshipPlaceShips(data.code, client.id, data.payload);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid ship placement' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BATTLESHIP_FIRE)
  handleBattleshipFire(
    @MessageBody() data: { code: string; payload: BattleshipFirePayload },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.battleshipFire(data.code, client.id, data.payload);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shot' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BATTLESHIP_PING)
  handleBattleshipPing(
    @MessageBody() data: { code: string; payload: BattleshipPingPayload },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.battleshipPing(data.code, client.id, data.payload);
    if (room) {
      this.broadcastRoomState(room);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.BATTLESHIP_RESET)
  handleBattleshipReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.LEADERBOARD_GET)
  async handleLeaderboardGet(
    @MessageBody() data: { gameType?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const leaderboard = await this.leaderboardService.getLeaderboard(data?.gameType);
    client.emit(SOCKET_EVENTS.LEADERBOARD_DATA, leaderboard);
  }

  // --- Spectator ---

  @SubscribeMessage(SOCKET_EVENTS.SPECTATE_JOIN)
  handleSpectateJoin(
    @MessageBody() data: { code: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    const requestedCode = data.code.toUpperCase();
    const room = this.gamesService.getRoom(requestedCode);
    if (!room) {
      this.logger.warn(
        `[ROOM] Spectator rejected room=${requestedCode} reason="Room not found" socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }
    if (room.config?.allowSpectators === false) {
      this.logger.warn(
        `[ROOM] Spectator rejected room=${requestedCode} reason=SPECTATORS_DISABLED socket=${client.id}`,
      );
      client.emit(SOCKET_EVENTS.ERROR, { message: 'SPECTATORS_DISABLED' });
      return;
    }

    this.leavePreviousRoom(client, room.code);
    client.join(room.code);
    if (client.data) client.data.spectatingRoomCode = room.code;
    this.logger.log(
      `[ROOM] Spectator joined room=${room.code} game=${room.gameType} name=${data.name?.trim() || 'Viewer'} socket=${client.id}`,
    );
    client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, this.publicRoomView(room));
    this.emitMusicTriviaSyncPlay(room.code, client);
  }

  // --- Private helpers ---

  private logClientAction(clientId: string, event: string, payload: unknown): void {
    if (GamesGateway.QUIET_EVENTS.has(event)) return;

    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
    const rawCode = typeof record?.code === 'string' ? record.code.toUpperCase() : null;
    const resolvedCode =
      rawCode ??
      (typeof this.gamesService?.findRoomCodeBySocketId === 'function'
        ? this.gamesService.findRoomCodeBySocketId(clientId)
        : null);
    const room =
      resolvedCode && typeof this.gamesService?.getRoom === 'function'
        ? this.gamesService.getRoom(resolvedCode)
        : undefined;
    const playerName = room?.players?.find((p) => p.socketId === clientId)?.name;

    const nestedAction =
      record?.action && typeof record.action === 'object'
        ? (record.action as Record<string, unknown>).type
        : undefined;
    const rawAction =
      typeof nestedAction === 'string'
        ? nestedAction
        : typeof record?.type === 'string'
          ? record.type
          : typeof record?.kind === 'string'
            ? record.kind
            : undefined;
    const safeAction =
      rawAction && rawAction.length <= 40 ? `:${rawAction.replace(/\s+/g, '_')}` : '';

    this.logger.log(
      `[GAME] action=${event}${safeAction} room=${resolvedCode ?? '-'} game=${room?.gameType ?? '-'} player=${playerName ?? '-'} socket=${clientId}`,
    );
  }

  private getRoomStateSignature(room: RoomState): string {
    const phaseHolder =
      room.detectiveClubState ??
      room.soundsFishyState ??
      room.musicTriviaState ??
      room.saboteurState ??
      room.coupState ??
      room.whoAmIState ??
      room.whoFirstState ??
      room.cardGameState ??
      room.pokerState ??
      room.pokerV2State ??
      room.bananaThiefState ??
      room.cipherGridState ??
      room.dogRelayState ??
      room.werewolfState ??
      room.battleshipState ??
      room.thirtyOneState;
    const phase =
      phaseHolder && typeof phaseHolder === 'object' && 'phase' in phaseHolder
        ? String((phaseHolder as { phase?: unknown }).phase ?? '-')
        : '-';
    const round =
      phaseHolder && typeof phaseHolder === 'object' && 'round' in phaseHolder
        ? String((phaseHolder as { round?: unknown }).round ?? '-')
        : room.theMindState
          ? `L${room.theMindState.level}`
          : '-';
    return `${room.gameType}|${room.status}|phase=${phase}|round=${round}`;
  }

  private broadcastRoomState(room: RoomState): void {
    const signature = this.getRoomStateSignature(room);
    const previous = this.lastBroadcastSnapshot.get(room.code);
    if (previous !== signature) {
      this.lastBroadcastSnapshot.set(room.code, signature);
      const connectedCount = room.players.filter((p) => p.connected !== false).length;
      this.logger.log(
        `[GAME] State room=${room.code} ${previous ?? 'INIT'} -> ${signature} connected=${connectedCount}/${room.players.length}`,
      );
    }
    this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, this.publicRoomView(room));
    this.emitPrivateStates(room);
    if (room.gameType === GameType.MUSIC_TRIVIA) {
      const answer = this.gamesService.musicTriviaCurrentHostAnswer(room.code, room.roomHostId);
      if (answer) {
        this.server.to(room.roomHostId).emit(SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, answer);
      }
    }
    this.maybeRecordGameResult(room);
    if (room.gameType === GameType.DOG_RELAY) this.syncDogRelayTimer(room);
    if (room.gameType === GameType.WHO_KNOW) {
      this.revealSecretWordIfResult(room);
    }
    if (room.gameType === GameType.SABOTEUR) {
      this.syncSaboteurTimer(room);
    }
    if (room.gameType === GameType.COUP) {
      this.syncCoupChallengeTimer(room);
      this.syncCoupBlockTimer(room);
    }
    if (room.gameType === GameType.CARD_GAME) {
      this.syncCardGameTimer(room);
    }
    if (room.gameType === GameType.POKER) {
      this.syncPokerTimer(room);
    }
    if (room.gameType === GameType.POKER_V2) {
      this.syncPokerV2Timer(room);
    }
    if (room.gameType === GameType.BANANA_THIEF) {
      this.syncBananaThiefTimer(room);
    }
    if (room.gameType === GameType.CIPHER_GRID) {
      this.syncCipherGridTimer(room);
    }
    if (room.gameType === GameType.WEREWOLF) {
      this.syncWerewolfTimer(room);
    }
    if (room.gameType === GameType.BATTLESHIP) {
      this.syncBattleshipTimer(room);
    }
    if (room.gameType === GameType.THIRTY_ONE) {
      this.syncThirtyOneTimer(room);
    }
    if (room.gameType === GameType.TIC_TAC_TOE) {
      this.syncTicTacToeTimer(room);
    }
    if (room.gameType === GameType.RPS) {
      this.syncRpsTimer(room);
    }
    if (room.gameType === GameType.WHO_AM_I) {
      this.syncWhoAmITimer(room);
    }
    if (room.gameType === GameType.SOUNDS_FISHY) {
      this.syncSoundsFishyTimer(room);
    }
    if (room.gameType === GameType.DETECTIVE_CLUB) {
      this.syncDetectiveClubTimer(room);
    }
  }

  private syncThirtyOneTimer(room: RoomState): void {
    const state = room.thirtyOneState;
    if (!state || state.phase !== 'PLAYING' || !state.turnDeadline) {
      this.roomTimerService.cancel(room.code, 'thirty-one-turn');
      return;
    }
    const deadline = state.turnDeadline;
    this.roomTimerService.schedule(room.code, 'thirty-one-turn', deadline, () => {
      const updated = this.gamesService.thirtyOneTurnTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private syncBattleshipTimer(room: RoomState): void {
    const state = room.battleshipState;
    if (!state || state.phase === 'RESULT' || state.turnDeadline === null) {
      this.roomTimerService.cancel(room.code, 'battleship');
      return;
    }
    const deadline = state.turnDeadline;
    this.roomTimerService.schedule(room.code, 'battleship', deadline, () => {
      const updated = this.gamesService.battleshipPhaseTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  /**
   * Turn timers for the games that had no pacing (battleship pattern): the
   * service stamps a deadline into state; the gateway schedules the auto-action
   * and re-syncs on every broadcast. The stale-deadline guard inside each
   * service's handleTurnTimeout keeps an already-fired callback harmless.
   */
  private syncTicTacToeTimer(room: RoomState): void {
    const mode = room.config?.ticTacToeMode || 'CLASSIC';
    const deadline =
      mode === 'GOBBLER'
        ? (room.gobblerState?.turnDeadline ?? null)
        : mode === 'ULTIMATE'
          ? (room.ultimateTicTacToeState?.turnDeadline ?? null)
          : (room.ticTacToeState?.turnDeadline ?? null);
    if (room.status !== RoomStatus.PLAYING || !deadline) {
      this.roomTimerService.cancel(room.code, 'ttt-turn');
      return;
    }
    this.roomTimerService.schedule(room.code, 'ttt-turn', deadline, () => {
      const updated = this.gamesService.ticTacToeTurnTimeout(room.code, mode, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private syncRpsTimer(room: RoomState): void {
    const deadline = room.rpsState?.turnDeadline ?? null;
    if (room.status !== RoomStatus.PLAYING || !deadline) {
      this.roomTimerService.cancel(room.code, 'rps-turn');
      return;
    }
    this.roomTimerService.schedule(room.code, 'rps-turn', deadline, () => {
      const updated = this.gamesService.rpsTurnTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private syncWhoAmITimer(room: RoomState): void {
    const deadline = room.whoAmIState?.turnDeadline ?? null;
    if (room.status !== RoomStatus.PLAYING || !deadline) {
      this.roomTimerService.cancel(room.code, 'who-am-i-turn');
      return;
    }
    this.roomTimerService.schedule(room.code, 'who-am-i-turn', deadline, () => {
      const updated = this.gamesService.whoAmITurnTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private syncSoundsFishyTimer(room: RoomState): void {
    const deadline = room.soundsFishyState?.turnDeadline ?? null;
    // Sounds Fishy runs under QUESTIONING, not PLAYING — any other status cancels.
    if (room.status !== RoomStatus.QUESTIONING || !deadline) {
      this.roomTimerService.cancel(room.code, 'sounds-fishy-turn');
      return;
    }
    this.roomTimerService.schedule(room.code, 'sounds-fishy-turn', deadline, () => {
      const updated = this.gamesService.soundsFishyTurnTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private syncDetectiveClubTimer(room: RoomState): void {
    const deadline = room.detectiveClubState?.turnDeadline ?? null;
    if (room.status !== RoomStatus.PLAYING || !deadline) {
      this.roomTimerService.cancel(room.code, 'detective-club-turn');
      return;
    }
    this.roomTimerService.schedule(room.code, 'detective-club-turn', deadline, () => {
      const updated = this.gamesService.detectiveClubTurnTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  /**
   * Werewolf phases are deadline-driven: the service only stamps
   * `phaseEndsAt`; a paused phase has none, which cancels the timer.
   */
  private syncWerewolfTimer(room: RoomState): void {
    const state = room.werewolfState;
    if (
      !state ||
      state.phase === WerewolfPhase.GAME_OVER ||
      state.paused ||
      state.phaseEndsAt === null
    ) {
      this.roomTimerService.cancel(room.code, 'werewolf');
      return;
    }
    const deadline = state.phaseEndsAt;
    this.roomTimerService.schedule(room.code, 'werewolf', deadline, () => {
      const updated = this.gamesService.werewolfPhaseTimeout(room.code, deadline);
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private syncDogRelayTimer(room: RoomState): void {
    const state = room.dogRelayState;
    if (
      !state ||
      state.pause ||
      !state.roundId ||
      state.phaseEndsAt === null ||
      (state.phase !== 'DISCUSS' && state.phase !== 'VOTE_COUNTDOWN')
    ) {
      this.roomTimerService.cancel(room.code, 'dog-relay-phase');
      return;
    }
    const { roundId, phase, phaseEndsAt } = state;
    this.roomTimerService.schedule(room.code, 'dog-relay-phase', phaseEndsAt, () => {
      const updated = this.gamesService.dogRelayPhaseDeadline(
        room.code,
        roundId,
        phase,
        phaseEndsAt,
      );
      if (updated) this.broadcastRoomState(updated);
    });
  }

  private emitMusicTriviaSyncPlay(code: string, client: Socket): void {
    const syncPlay = this.gamesService.musicTriviaCurrentSyncPlay(code);
    if (syncPlay) client.emit(SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, syncPlay);
  }

  /**
   * Server-side view of a room safe to broadcast. Coup's face-down deck is
   * secret information — its exact order would let any client predict every
   * draw after a challenge reshuffle — so only its size is public.
   */
  private publicRoomView(room: RoomState): RoomState {
    syncResultReveal(room);
    if (room.gameType === GameType.COUP && room.coupState) {
      return {
        ...room,
        coupState: {
          ...room.coupState,
          deck: room.coupState.deck.map(() => 'HIDDEN' as CoupRole),
        },
      };
    }
    return room;
  }

  /** The word is secret only until voting resolves — then everyone gets to see it. */
  private revealSecretWordIfResult(room: RoomState): void {
    if (room.status !== RoomStatus.RESULT) return;
    const secretWord = this.gamesService.getSecretWord(room.code);
    if (secretWord) {
      this.server.to(room.code).emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: secretWord });
    }
  }

  private syncCoupChallengeTimer(room: RoomState): void {
    const deadline = room.coupState?.challengeWindowDeadline ?? null;
    const isChallengePhase = room.coupState?.phase === 'AWAITING_CHALLENGE' && !!deadline;
    if (!isChallengePhase) {
      // keep existing block-challenge timer handling separate; this cancels only when not in challenge
      if (room.coupState?.phase !== 'AWAITING_CHALLENGE') {
        this.roomTimerService.cancel(room.code, 'coup-challenge');
      }
      return;
    }
    const hasBlock = !!room.coupState?.pendingBlock;
    this.roomTimerService.schedule(room.code, 'coup-challenge', deadline, () => {
      const updated = hasBlock
        ? this.gamesService.coupBlockChallengeTimeout(room.code)
        : this.gamesService.coupChallengeTimeout(room.code);
      if (updated) {
        this.broadcastRoomState(updated);
        this.maybeRecordGameResult(updated);
      }
    });
  }

  private syncCoupBlockTimer(room: RoomState): void {
    const deadline = room.coupState?.blockWindowDeadline ?? null;
    if (room.coupState?.phase !== 'AWAITING_BLOCK' || !deadline) {
      this.roomTimerService.cancel(room.code, 'coup-block');
      return;
    }
    this.roomTimerService.schedule(room.code, 'coup-block', deadline, () => {
      const updated = this.gamesService.coupBlockTimeout(room.code);
      if (updated) {
        this.broadcastRoomState(updated);
        this.maybeRecordGameResult(updated);
      }
    });
  }

  /** Per-turn auto-pass timer for Saboteur (config-gated). */
  private syncSaboteurTimer(room: RoomState): void {
    const state = room.saboteurState;
    const enabled = room.config.saboteurTurnTimerEnabled;
    const seconds = room.config.saboteurTurnTimerSeconds ?? 60;

    if (!enabled || !state || state.currentPhase !== 'PLAYING' || !state.activePlayerId) {
      this.gamesService.clearSaboteurTurnDeadline(room.code);
      this.roomTimerService.cancel(room.code, 'saboteur');
      return;
    }

    const activePlayerId = state.activePlayerId;
    const deadline = this.gamesService.saboteurTurnDeadline(room.code, activePlayerId, seconds);
    this.roomTimerService.schedule(room.code, 'saboteur', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      const currentState = currentRoom?.saboteurState;
      if (
        !currentRoom ||
        !currentState ||
        currentState.currentPhase !== 'PLAYING' ||
        currentState.activePlayerId !== activePlayerId
      ) {
        return; // turn already advanced elsewhere
      }
      this.gamesService.clearSaboteurTurnDeadline(currentRoom.code);
      const updatedRoom = this.gamesService.saboteurAutoPass(currentRoom.code, activePlayerId);
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
      }
    });
  }

  /** Per-turn auto-action timer for card games (config-gated by the action policy). */
  private syncCardGameTimer(room: RoomState): void {
    const state = room.cardGameState;
    const activePlayerId = state?.phase === 'PLAYER_TURNS' ? state.activePlayerId : null;
    const deadline = state?.turnDeadline ?? null;

    if (!state || state.phase !== 'PLAYER_TURNS' || !activePlayerId || !deadline) {
      this.roomTimerService.cancel(room.code, 'card-game');
      return;
    }

    this.roomTimerService.schedule(room.code, 'card-game', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      const currentState = currentRoom?.cardGameState;
      if (
        !currentRoom ||
        !currentState ||
        currentState.phase !== 'PLAYER_TURNS' ||
        currentState.activePlayerId !== activePlayerId ||
        (currentState.turnDeadline ?? null) !== deadline
      ) {
        return; // turn already advanced elsewhere
      }
      const auto = this.gamesService.resolveCardGameAutoAction(currentRoom.code);
      if (!auto) return; // no legal auto-action for this position
      const updatedRoom = this.gamesService.cardGameAction(
        currentRoom.code,
        auto.playerId,
        auto.action,
      );
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
      }
    });
  }

  /**
   * One timer name drives all three timed phases. Night ticks advance the
   * clock; discussion expiry opens the ballot; voting expiry finalizes the
   * round. Every callback re-validates phase + deadline before acting.
   */
  private syncBananaThiefTimer(room: RoomState): void {
    const state = room.bananaThiefState;
    const deadline = state?.tickEndsAt ?? state?.phaseEndsAt ?? null;

    if (!state || !deadline) {
      this.roomTimerService.cancel(room.code, 'banana-thief');
      return;
    }
    if (
      state.phase === 'RESULT' ||
      (state.phase === 'NIGHT' && !state.tickEndsAt) ||
      ((state.phase === 'CHOOSE_FOLLOWER' ||
        state.phase === 'DISCUSSION' ||
        state.phase === 'VOTING') &&
        !state.phaseEndsAt)
    ) {
      this.roomTimerService.cancel(room.code, 'banana-thief');
      return;
    }

    const phase = state.phase;
    this.roomTimerService.schedule(room.code, 'banana-thief', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      const currentState = currentRoom?.bananaThiefState;
      if (!currentRoom || !currentState || currentState.phase !== phase) return;
      const currentDeadline = currentState.tickEndsAt ?? currentState.phaseEndsAt ?? null;
      if (currentDeadline !== deadline) return; // phase re-armed elsewhere

      const updated =
        phase === 'CHOOSE_FOLLOWER'
          ? this.gamesService.bananaThiefChooseFollowerTimeout(room.code)
          : phase === 'NIGHT'
            ? this.gamesService.bananaThiefTick(room.code)
            : phase === 'DISCUSSION'
              ? this.gamesService.bananaThiefStartVote(room.code, currentRoom.roomHostId)
              : this.gamesService.bananaThiefVotePhaseEnd(room.code);
      if (updated) {
        this.broadcastRoomState(updated);
        this.maybeRecordGameResult(updated);
      }
    });
  }

  /** Per-turn auto-action timer for poker (config-gated). */
  private syncPokerTimer(room: RoomState): void {
    const state = room.pokerState;
    const activePlayerId = state?.activePlayerId ?? null;
    const deadline = state?.turnDeadline ?? null;

    if (!state || !activePlayerId || !deadline) {
      this.roomTimerService.cancel(room.code, 'poker');
      return;
    }

    this.roomTimerService.schedule(room.code, 'poker', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      const currentState = currentRoom?.pokerState;
      if (
        !currentRoom ||
        !currentState ||
        currentState.activePlayerId !== activePlayerId ||
        (currentState.turnDeadline ?? null) !== deadline
      ) {
        return; // turn already advanced elsewhere
      }
      const auto = this.gamesService.resolvePokerAutoAction(currentRoom.code);
      if (!auto) return;
      const updatedRoom = this.gamesService.pokerAction(
        currentRoom.code,
        auto.playerId,
        auto.action,
      );
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
      }
    });
  }

  /**
   * Poker V2 timers: the per-turn auto-action while betting, and the next
   * hand's auto-deal while the table sits in HAND_RESULT.
   */
  private syncPokerV2Timer(room: RoomState): void {
    const state = room.pokerV2State;
    const activePlayerId = state?.activePlayerId ?? null;
    const turnDeadline = state?.turnDeadline ?? null;
    const nextHandDeadline = state?.nextHandDeadline ?? null;

    if (!state || !activePlayerId || !turnDeadline) {
      this.roomTimerService.cancel(room.code, 'poker-v2-turn');
    } else {
      this.roomTimerService.schedule(room.code, 'poker-v2-turn', turnDeadline, () => {
        const currentRoom = this.gamesService.getRoom(room.code);
        const currentState = currentRoom?.pokerV2State;
        if (
          !currentRoom ||
          !currentState ||
          currentState.activePlayerId !== activePlayerId ||
          (currentState.turnDeadline ?? null) !== turnDeadline
        ) {
          return; // turn already advanced elsewhere
        }
        const auto = this.gamesService.resolvePokerV2AutoAction(currentRoom.code);
        if (!auto) return;
        const updatedRoom = this.gamesService.pokerV2Action(
          currentRoom.code,
          auto.playerId,
          auto.action,
        );
        if (updatedRoom) {
          this.broadcastRoomState(updatedRoom);
        }
      });
    }

    if (!state || state.phase !== 'HAND_RESULT' || !nextHandDeadline) {
      this.roomTimerService.cancel(room.code, 'poker-v2-deal');
      return;
    }
    this.roomTimerService.schedule(room.code, 'poker-v2-deal', nextHandDeadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (!currentRoom || currentRoom.status !== RoomStatus.PLAYING) return;
      const currentState = currentRoom.pokerV2State;
      if (!currentState || (currentState.nextHandDeadline ?? null) !== nextHandDeadline) {
        return; // a new hand was dealt manually or the match ended
      }
      const updatedRoom = this.gamesService.pokerV2AutoDeal(currentRoom.code);
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
      }
    });
  }

  /** Turn timer for Ciphergrid (config-gated). */
  private syncCipherGridTimer(room: RoomState): void {
    const deadline = room.cipherGridState?.turnEndsAt ?? null;
    if (
      !deadline ||
      (room.cipherGridState?.phase !== 'CLUE_GIVING' && room.cipherGridState?.phase !== 'DECODING')
    ) {
      this.roomTimerService.cancel(room.code, 'cipher-grid');
      return;
    }

    this.roomTimerService.schedule(room.code, 'cipher-grid', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (
        !currentRoom ||
        currentRoom.gameType !== GameType.CIPHER_GRID ||
        currentRoom.cipherGridState?.turnEndsAt !== deadline
      ) {
        return;
      }

      const updated = this.gamesService.cipherTurnTimeout(room.code, deadline);
      if (updated) {
        this.broadcastRoomState(updated);
      }
    });
  }

  private getOutboundPrivateState(room: RoomState, socketId: string): Record<string, unknown> {
    const raw = this.privateStateService.getSocketData(room.code, socketId);
    if (room.gameType !== GameType.WHO_AM_I) {
      return raw;
    }

    const visibleWords = raw.waiVisibleWords;
    if (!visibleWords || typeof visibleWords !== 'object' || Array.isArray(visibleWords)) {
      return {};
    }

    const filteredVisibleWords: Record<string, string> = {};
    for (const [targetSocketId, word] of Object.entries(visibleWords as Record<string, unknown>)) {
      if (targetSocketId !== socketId && typeof word === 'string') {
        filteredVisibleWords[targetSocketId] = word;
      }
    }

    return Object.keys(filteredVisibleWords).length > 0
      ? { waiVisibleWords: filteredVisibleWords }
      : {};
  }

  private emitPrivateStates(room: RoomState): void {
    for (const player of room.players) {
      const data = this.getOutboundPrivateState(room, player.socketId);
      this.server.to(player.socketId).emit(SOCKET_EVENTS.PRIVATE_STATE_UPDATED, { data });
    }
  }

  private emitSessionToken(client: Socket, code: string): void {
    const reconnectToken = this.gamesService.getReconnectToken(code, client.id);
    const playerId = this.gamesService
      .getRoom(code)
      ?.players.find((player) => player.socketId === client.id)?.id;
    if (reconnectToken && playerId) {
      client.emit(SOCKET_EVENTS.SESSION_ASSIGNED, { code, reconnectToken, playerId });
    }
  }

  /** Execute the timer schedules/cancellations decided by MusicTriviaService. */
  private applyMusicTriviaTimers(
    code: string,
    commands: MusicTriviaTimerCommand[] | undefined,
  ): void {
    for (const command of commands ?? []) {
      if (command.kind === 'CANCEL') {
        this.roomTimerService.cancel(code, command.name);
        continue;
      }
      this.roomTimerService.schedule(code, command.name, command.deadline, () => {
        const result =
          command.name === 'music-trivia-countdown'
            ? this.gamesService.musicTriviaFinalizeCountdown(code)
            : this.gamesService.musicTriviaFinalizeAnswerTimeout(code);
        if (result) {
          this.broadcastRoomState(result.room);
          if (result.syncPlay) {
            this.server
              .to(result.room.code)
              .emit(SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, result.syncPlay);
          }
          // Timer-driven results can chain further timers (e.g. the answer
          // timeout armed when the countdown finalizes into PLAYING) — apply
          // them or they are silently dropped.
          this.applyMusicTriviaTimers(code, result.timerCommands);
        }
      });
    }
  }

  private syncWhoFirstTimer(room: RoomState): void {
    const deadline = room.whoFirstState?.countdownEndTime;
    if (room.whoFirstState?.phase !== 'COUNTDOWN' || !deadline) {
      this.roomTimerService.cancel(room.code, 'who-first');
      return;
    }

    this.roomTimerService.schedule(room.code, 'who-first', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (
        currentRoom?.whoFirstState?.phase !== 'COUNTDOWN' ||
        currentRoom.whoFirstState.countdownEndTime !== deadline
      ) {
        return;
      }

      const updatedRoom = this.gamesService.whoFirstSetActive(room.code);
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
        this.syncWhoFirstTimer(updatedRoom);
      }
    });
  }

  private syncWhoKnowTimer(room: RoomState): void {
    const deadline = room.endTime;
    if (room.status !== RoomStatus.QUESTIONING || !deadline) {
      this.roomTimerService.cancel(room.code, 'who-know');
      return;
    }

    this.roomTimerService.schedule(room.code, 'who-know', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (currentRoom?.status !== RoomStatus.QUESTIONING || currentRoom.endTime !== deadline) {
        return;
      }

      const updatedRoom = this.gamesService.whoKnowServerTimeout(room.code);
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
        this.maybeRecordGameResult(updatedRoom);
      }
    });
  }

  private syncTheMindTimer(room: RoomState): void {
    const deadline = room.theMindState?.levelEndTime;
    if (room.theMindState?.phase !== 'PLAYING' || !deadline) {
      this.roomTimerService.cancel(room.code, 'the-mind');
      return;
    }

    this.roomTimerService.schedule(room.code, 'the-mind', deadline, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (
        currentRoom?.theMindState?.phase !== 'PLAYING' ||
        currentRoom.theMindState.levelEndTime !== deadline
      ) {
        return;
      }

      const updatedRoom = this.gamesService.theMindServerTimeout(room.code);
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
        this.maybeRecordGameResult(updatedRoom);
      }
    });
  }

  private scheduleTTTBotMoveIfNeeded(room: RoomState): void {
    if (
      !room ||
      room.gameType !== GameType.TIC_TAC_TOE ||
      room.status !== RoomStatus.PLAYING ||
      !room.config?.ticTacToeVsBot ||
      !room.ticTacToeState
    ) {
      if (room?.code) {
        this.roomTimerService.cancel(room.code, 'ttt-bot-move');
      }
      return;
    }
    const ttt = room.ticTacToeState;
    const botSide =
      ttt.playerXId === BOT_SOCKET_ID ? 'X' : ttt.playerOId === BOT_SOCKET_ID ? 'O' : null;
    if (!botSide || ttt.currentTurn !== botSide || ttt.winner) {
      this.roomTimerService.cancel(room.code, 'ttt-bot-move');
      return;
    }

    const delayMs = 600 + Math.floor(Math.random() * 400);
    this.roomTimerService.schedule(room.code, 'ttt-bot-move', Date.now() + delayMs, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (!currentRoom || currentRoom.status !== RoomStatus.PLAYING) return;
      const botRoom = this.gamesService.tttExecuteBotMove(currentRoom.code);
      if (botRoom) {
        this.broadcastRoomState(botRoom);
        if (botRoom.status === RoomStatus.RESULT) {
          this.maybeRecordGameResult(botRoom);
        }
      }
    });
  }

  private scheduleGobblerBotMoveIfNeeded(room: RoomState): void {
    if (
      !room ||
      room.gameType !== GameType.TIC_TAC_TOE ||
      room.config.ticTacToeMode !== 'GOBBLER' ||
      room.status !== RoomStatus.PLAYING ||
      !room.config?.ticTacToeVsBot ||
      !room.gobblerState
    ) {
      if (room?.code) {
        this.roomTimerService.cancel(room.code, 'gobbler-bot-move');
      }
      return;
    }
    const gb = room.gobblerState;
    const botSide =
      gb.playerXId === BOT_SOCKET_ID ? 'X' : gb.playerOId === BOT_SOCKET_ID ? 'O' : null;
    if (!botSide || gb.currentTurn !== botSide || gb.winner) {
      this.roomTimerService.cancel(room.code, 'gobbler-bot-move');
      return;
    }

    const delayMs = 600 + Math.floor(Math.random() * 400);
    this.roomTimerService.schedule(room.code, 'gobbler-bot-move', Date.now() + delayMs, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (!currentRoom || currentRoom.status !== RoomStatus.PLAYING) return;
      const botRoom = this.gamesService.gobblerExecuteBotMove(currentRoom.code);
      if (botRoom) {
        this.broadcastRoomState(botRoom);
        if (botRoom.status === RoomStatus.RESULT) {
          this.maybeRecordGameResult(botRoom);
        }
      }
    });
  }

  private scheduleUTTTBotMoveIfNeeded(room: RoomState): void {
    if (
      !room ||
      room.gameType !== GameType.TIC_TAC_TOE ||
      room.config.ticTacToeMode !== 'ULTIMATE' ||
      room.status !== RoomStatus.PLAYING ||
      !room.config?.ticTacToeVsBot ||
      !room.ultimateTicTacToeState
    ) {
      if (room?.code) {
        this.roomTimerService.cancel(room.code, 'uttt-bot-move');
      }
      return;
    }
    const uttt = room.ultimateTicTacToeState;
    const botSide =
      uttt.playerXId === BOT_SOCKET_ID ? 'X' : uttt.playerOId === BOT_SOCKET_ID ? 'O' : null;
    if (!botSide || uttt.currentTurn !== botSide || uttt.winner) {
      this.roomTimerService.cancel(room.code, 'uttt-bot-move');
      return;
    }

    const delayMs = 600 + Math.floor(Math.random() * 400);
    this.roomTimerService.schedule(room.code, 'uttt-bot-move', Date.now() + delayMs, () => {
      const currentRoom = this.gamesService.getRoom(room.code);
      if (!currentRoom || currentRoom.status !== RoomStatus.PLAYING) return;
      const botRoom = this.gamesService.utttExecuteBotMove(currentRoom.code);
      if (botRoom) {
        this.broadcastRoomState(botRoom);
        if (botRoom.status === RoomStatus.RESULT) {
          this.maybeRecordGameResult(botRoom);
        }
      }
    });
  }

  private isValidPayload(event: string, payload: unknown): boolean {
    return isValidPayload(event, payload);
  }

  private getResultPlayerKey(player: { name?: string }): string {
    return (player.name ?? '').trim();
  }

  private isAbortedResultState(room: RoomState): boolean {
    if (room.gameType === GameType.RPS && room.rpsState) {
      return !room.rpsState.roundWinner;
    }
    if (
      room.gameType === GameType.TIC_TAC_TOE &&
      (room.ticTacToeState || room.gobblerState || room.ultimateTicTacToeState)
    ) {
      return (
        !room.ticTacToeState?.winner &&
        !room.gobblerState?.winner &&
        !room.ultimateTicTacToeState?.winner
      );
    }
    if (room.gameType === GameType.CARD_GAME && room.cardGameState) {
      return !room.cardGameState.result;
    }
    if (room.gameType === GameType.THIRTY_ONE && room.thirtyOneState) {
      return !room.thirtyOneState.winnerId;
    }
    return false;
  }

  private syncResultScoreBaselines(room: RoomState): void {
    const baselines = this.recordedScoreBaselines.get(room.code);
    if (!baselines) return;

    if (room.status === RoomStatus.LOBBY && room.players.every((p) => (p.score ?? 0) === 0)) {
      this.recordedScoreBaselines.delete(room.code);
      return;
    }

    const currentNames = new Set(
      room.players
        .filter((p) => p.name && p.name.trim().length > 0)
        .map((p) => this.getResultPlayerKey(p)),
    );

    for (const [key, previousBaseline] of baselines.entries()) {
      if (!currentNames.has(key)) {
        baselines.delete(key);
        continue;
      }
      const player = room.players.find((p) => this.getResultPlayerKey(p) === key);
      const currentScore = player?.score ?? 0;
      if (currentScore < previousBaseline) {
        baselines.set(key, currentScore);
      }
    }
  }

  private maybeRecordGameResult(room: RoomState) {
    if (room.gameType === GameType.DOG_RELAY) {
      const state = room.dogRelayState;
      if (room.status !== RoomStatus.RESULT || !state?.result || !state.roundId) return;
      if (this.recordedDogRelayRounds.get(room.code) === state.roundId) return;
      this.recordedDogRelayRounds.set(room.code, state.roundId);
      const dogRelayRows = buildDogRelayResultRows(room);
      this.logger.log(
        `[GAME] Result recorded room=${room.code} game=${room.gameType} roundId=${state.roundId} players=${dogRelayRows.length}`,
      );
      void this.leaderboardService.recordGameResult(room.gameType, room.code, dogRelayRows);
      return;
    }

    if (room.status !== RoomStatus.RESULT) {
      this.recordedResults.delete(room.code);
      this.syncResultScoreBaselines(room);
      return;
    }

    if (this.isAbortedResultState(room)) {
      return;
    }

    if (this.recordedResults.has(room.code)) {
      return;
    }
    this.recordedResults.add(room.code);

    let baselines = this.recordedScoreBaselines.get(room.code);
    if (!baselines) {
      baselines = new Map<string, number>();
      this.recordedScoreBaselines.set(room.code, baselines);
    }

    const activePlayers = room.players.filter(
      (p) => !p.isViewer && p.name && p.name.trim().length > 0,
    );

    const totalCurrentScore = activePlayers.reduce((sum, p) => sum + (p.score ?? 0), 0);
    let totalBaselineScore = 0;
    for (const player of activePlayers) {
      const key = this.getResultPlayerKey(player);
      totalBaselineScore += baselines.get(key) ?? 0;
    }
    const resetBaselines = totalCurrentScore < totalBaselineScore;

    const scoredPlayers = activePlayers
      .map((p) => {
        const key = this.getResultPlayerKey(p);
        const currentScore = p.score ?? 0;
        // Poker scores are final match stacks, not points accumulated across matches.
        const previousBaseline =
          room.gameType === GameType.POKER ||
          room.gameType === GameType.POKER_V2 ||
          room.gameType === GameType.THIRTY_ONE ||
          resetBaselines
            ? 0
            : (baselines.get(key) ?? 0);
        const effectiveBaseline = currentScore < previousBaseline ? 0 : previousBaseline;
        const score = Math.max(0, currentScore - effectiveBaseline);
        baselines.set(key, currentScore);
        return {
          playerName: p.name,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    if (scoredPlayers.length === 0) return;

    const topScore = scoredPlayers[0].score;
    let currentRank = 1;
    const results = scoredPlayers.map((entry, idx) => {
      if (topScore <= 0) {
        return {
          playerName: entry.playerName,
          score: entry.score,
          rank: 2,
        };
      }
      if (idx > 0 && entry.score < scoredPlayers[idx - 1].score) {
        currentRank = idx + 1;
      }
      return {
        playerName: entry.playerName,
        score: entry.score,
        rank: currentRank,
      };
    });

    this.logger.log(
      `[GAME] Result recorded room=${room.code} game=${room.gameType} top=${results[0]?.playerName ?? '-'}:${results[0]?.score ?? 0} players=${results.length}`,
    );
    void this.leaderboardService.recordGameResult(room.gameType, room.code, results);
  }
}
