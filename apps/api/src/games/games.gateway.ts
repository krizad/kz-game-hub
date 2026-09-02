import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { RoomTimerService } from './room-timer.service';
import { PrivateStateService } from './private-state.service';
import { WsExceptionFilter } from './ws-exception.filter';
import { SOCKET_EVENTS, RoomState, RoomStatus, Role, GameType, RPSChoice, CoupActionType } from '@repo/types';
import {
  MusicTriviaActionResult,
  MusicTriviaTimerCommand,
} from './music-trivia/music-trivia.service';

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*',
  },
  // Tolerate flaky mobile networks: give clients up to ~80s of silence
  // (interval + timeout) before the server declares the connection dead.
  pingInterval: 20_000,
  pingTimeout: 60_000,
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);
  private readonly recordedResults = new Set<string>();

  constructor(
    private readonly gamesService: GamesService,
    private readonly leaderboardService: LeaderboardService,
    private readonly roomTimerService: RoomTimerService,
    private readonly privateStateService: PrivateStateService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.use(([event, payload], next) => {
      if (this.isValidPayload(event, payload)) return next();
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
      next(new Error('Invalid request payload'));
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const result = this.gamesService.leaveRoom(client.id, false);
    this.handleLeaveResult(client, result);
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_ROOM)
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const result = this.gamesService.leaveRoom(client.id, true);
    this.handleLeaveResult(client, result);

    const roomCode =
      'room' in result ? result.room.code : 'code' in result ? result.code : undefined;
    if (roomCode) {
      client.leave(roomCode);
    }
    client.data.spectatingRoomCode = undefined;
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
        this.server.to(result.code).emit(SOCKET_EVENTS.ROOM_DELETED);
        this.forgetRecordedResult(result.code);
        break;
      case 'ROOM_EMPTIED':
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
  }

  @SubscribeMessage(SOCKET_EVENTS.GET_AVAILABLE_ROOMS)
  handleGetAvailableRooms(@ConnectedSocket() client: Socket) {
    client.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
  }

  @SubscribeMessage(SOCKET_EVENTS.CREATE_ROOM)
  handleCreateRoom(
    @MessageBody() data: { name: string; gameType?: GameType },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.createRoom(client.id, data.gameType);
    const updatedRoom = this.gamesService.joinRoom(room.code, {
      id: client.id,
      name: data.name.trim(),
      socketId: client.id,
    });

    if (updatedRoom) {
      client.join(updatedRoom.code);
      this.emitSessionToken(client, updatedRoom.code);
      client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, updatedRoom);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  handleJoinRoom(
    @MessageBody() data: { code: string; name: string; reconnectToken?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.joinRoom(
      data.code.toUpperCase(),
      {
        id: client.id, // using socketId as temp ID
        name: data.name.trim(),
        socketId: client.id,
      },
      data.reconnectToken,
    );

    if (room) {
      client.join(room.code);
      this.emitSessionToken(client, room.code);
      this.broadcastRoomState(room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );

      const player = room.players.find((p) => p.socketId === client.id);
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
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Room not found or player name is already in use',
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.START_GAME)
  async handleStartGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const result = await this.gamesService.assignRoles(data.code, client.id);

    if (result) {
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
      let msg = 'Cannot start game.';
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
      }
      client.emit(SOCKET_EVENTS.ERROR, { message: msg });
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
      this.roomTimerService.cancel(room.code, 'who-know');
      this.roomTimerService.cancel(room.code, 'the-mind');
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
    @MessageBody() data: { code: string; config: Partial<RoomState['config']> },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.updateConfig(data.code, client.id, data.config);

    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Not authorized to update config or invalid state.',
      });
    }
  }

  // --- Tic-Tac-Toe Game Actions ---

  @SubscribeMessage(SOCKET_EVENTS.TTT_JOIN_SIDE)
  handleTTTJoinSide(
    @MessageBody() data: { code: string; side: 'X' | 'O' },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.tttJoinSide(data.code, client.id, data.side);
    if (room) {
      this.broadcastRoomState(room);
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
    @MessageBody() data: { code: string; index: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.tttMakeMove(data.code, client.id, data.index);
    if (room) {
      this.broadcastRoomState(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TTT_RESET)
  handleTTTReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.tttReset(data.code, client.id);
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
    @MessageBody() data: { code: string; choice: RPSChoice },
    @ConnectedSocket() client: Socket,
  ) {
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
    const room = this.gamesService.gobblerJoinSide(data.code, client.id, data.side);
    if (room) {
      this.broadcastRoomState(room);
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
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GOBBLER_RESET)
  handleGobblerReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.gobblerReset(data.code, client.id);
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
      this.maybeRecordGameResult(room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid Coup action' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.COUP_RESET)
  handleCoupReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);
    if (room) {
      this.broadcastRoomState(room);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
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
    @MessageBody() data: { lang?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const categories = await this.gamesService.whoAmICategoriesList(data?.lang);
    client.emit(SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, categories);
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

  // --- Leaderboard ---

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
    const room = this.gamesService.getRoom(data.code.toUpperCase());
    if (!room) {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }

    client.join(room.code);
    client.data.spectatingRoomCode = room.code;
    client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
  }

  // --- Private helpers ---

  private broadcastRoomState(room: RoomState): void {
    this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    this.emitPrivateStates(room);
    if (room.gameType === GameType.SABOTEUR) {
      this.syncSaboteurTimer(room);
    }
  }

  /** Per-turn auto-pass timer for Saboteur (config-gated). */
  private syncSaboteurTimer(room: RoomState): void {
    const state = room.saboteurState;
    const enabled = room.config.saboteurTurnTimerEnabled;
    const seconds = room.config.saboteurTurnTimerSeconds ?? 60;

    if (!enabled || !state || state.currentPhase !== 'PLAYING' || !state.activePlayerId) {
      this.roomTimerService.cancel(room.code, 'saboteur');
      return;
    }

    const activePlayerId = state.activePlayerId;
    const deadline = Date.now() + seconds * 1000;
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
      const updatedRoom = this.gamesService.saboteurAutoPass(currentRoom.code, activePlayerId);
      if (updatedRoom) {
        this.broadcastRoomState(updatedRoom);
      }
    });
  }

  private emitPrivateStates(room: RoomState): void {
    for (const player of room.players) {
      const data = this.privateStateService.getSocketData(room.code, player.socketId);
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

  private isValidPayload(event: string, payload: unknown): boolean {
    if (event === SOCKET_EVENTS.LEAVE_ROOM || event === SOCKET_EVENTS.GET_AVAILABLE_ROOMS)
      return true;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;

    const data = payload as Record<string, unknown>;
    if (!this.hasSafeValues(data)) return false;
    if (event === SOCKET_EVENTS.CREATE_ROOM) {
      return (
        this.isValidName(data.name) &&
        (data.gameType === undefined || Object.values(GameType).includes(data.gameType as GameType))
      );
    }
    if (event === SOCKET_EVENTS.LEADERBOARD_GET) {
      return data.gameType === undefined || typeof data.gameType === 'string';
    }
    if (typeof data.code !== 'string' || !/^[a-z0-9]{6}$/i.test(data.code)) return false;
    if (event === SOCKET_EVENTS.JOIN_ROOM || event === SOCKET_EVENTS.SPECTATE_JOIN) {
      return (
        this.isValidName(data.name) &&
        (data.reconnectToken === undefined ||
          (typeof data.reconnectToken === 'string' && data.reconnectToken.length <= 100))
      );
    }
    if (event === SOCKET_EVENTS.UPDATE_CONFIG) {
      return !!data.config && typeof data.config === 'object' && !Array.isArray(data.config);
    }
    if (event === SOCKET_EVENTS.GAME_ACTION) {
      return !!data.action && typeof data.action === 'object' && !Array.isArray(data.action);
    }
    const isSmallInt = (v: unknown): v is number =>
      typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 10_000;
    if (event === SOCKET_EVENTS.SABOTEUR_PLACE_PATH) {
      return (
        isSmallInt(data.cardIndex) &&
        isSmallInt(data.x) &&
        isSmallInt(data.y) &&
        (data.rotation === 0 || data.rotation === 180)
      );
    }
    if (event === SOCKET_EVENTS.SABOTEUR_PLAY_ACTION) {
      return (
        isSmallInt(data.cardIndex) &&
        (data.targetPlayerId === undefined || typeof data.targetPlayerId === 'string') &&
        (data.repairTool === undefined || typeof data.repairTool === 'string') &&
        (data.goalIndex === undefined || isSmallInt(data.goalIndex)) &&
        (data.targetX === undefined || isSmallInt(data.targetX)) &&
        (data.targetY === undefined || isSmallInt(data.targetY))
      );
    }
    if (event === SOCKET_EVENTS.SABOTEUR_DISCARD) {
      return isSmallInt(data.cardIndex);
    }
    if (event === SOCKET_EVENTS.SABOTEUR_PICK_GOLD) {
      return isSmallInt(data.poolIndex);
    }
    if (event === SOCKET_EVENTS.COUP_DECLARE) {
      return (
        typeof data.type === 'string' &&
        ['INCOME', 'FOREIGN_AID', 'COUP', 'TAX', 'ASSASSINATE', 'STEAL', 'EXCHANGE'].includes(data.type) &&
        (data.targetId === undefined || typeof data.targetId === 'string')
      );
    }
    return true;
  }

  private isValidName(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40;
  }

  private hasSafeValues(value: unknown, depth = 0): boolean {
    if (depth > 4) return false;
    if (typeof value === 'string') return value.length <= 500;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean' || value === null || value === undefined) return true;
    if (Array.isArray(value)) {
      return value.length <= 100 && value.every((item) => this.hasSafeValues(item, depth + 1));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      return (
        entries.length <= 50 &&
        entries.every(([key, item]) => key.length <= 100 && this.hasSafeValues(item, depth + 1))
      );
    }
    return false;
  }

  private maybeRecordGameResult(room: RoomState) {
    if (room.status !== RoomStatus.RESULT) {
      this.recordedResults.delete(room.code);
      return;
    }
    if (this.recordedResults.has(room.code)) return;
    this.recordedResults.add(room.code);

    const results = [...room.players]
      .filter((p) => p.name)
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({
        playerName: p.name,
        score: p.score,
        rank: idx + 1,
      }));

    this.leaderboardService.recordGameResult(room.gameType, room.code, results);
  }
}
