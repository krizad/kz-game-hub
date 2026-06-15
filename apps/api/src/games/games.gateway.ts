import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { SOCKET_EVENTS, RoomState, RoomStatus, Role, GameType, RPSChoice } from '@repo/types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gamesService: GamesService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    const currentRoomCode = this.gamesService.findRoomCodeBySocketId(client.id) ?? '';
    const result = this.gamesService.leaveRoom(client.id, false);
    if (result && 'code' in result && result.code === null) {
      // Room was deleted because the host left, notify everyone in that room
      if (currentRoomCode) {
        this.server.to(currentRoomCode).emit(SOCKET_EVENTS.ROOM_DELETED);
      }
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else if (result) {
      // Player left, room still exists
      this.server.to(result.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      // Room was deleted because everyone left
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    }
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const currentRoomCode = this.gamesService.findRoomCodeBySocketId(client.id) ?? '';

    const result = this.gamesService.leaveRoom(client.id, true);
    if (result && 'code' in result && result.code === null) {
      if (currentRoomCode) {
        this.server.to(currentRoomCode).emit(SOCKET_EVENTS.ROOM_DELETED);
      }
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else if (result) {
      this.server.to(result.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    } else {
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    }

    if (currentRoomCode) {
      client.leave(currentRoomCode);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GET_AVAILABLE_ROOMS)
  handleGetAvailableRooms(@ConnectedSocket() client: Socket) {
    client.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
  }

  @SubscribeMessage('create_room')
  handleCreateRoom(
    @MessageBody() data: { name: string; gameType?: GameType },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.createRoom(client.id, data.gameType);
    const updatedRoom = this.gamesService.joinRoom(room.code, {
      id: client.id,
      name: data.name,
      socketId: client.id,
    });

    if (updatedRoom) {
      client.join(updatedRoom.code);
      client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, updatedRoom);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  handleJoinRoom(
    @MessageBody() data: { code: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.joinRoom(data.code.toUpperCase(), {
      id: client.id, // using socketId as temp ID
      name: data.name,
      socketId: client.id,
    });

    if (room) {
      client.join(room.code);
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      this.server.emit(
        SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED,
        this.gamesService.getAvailableRooms(),
      );

      const player = room.players.find((p) => p.socketId === client.id);
      if (player?.role) {
        if (room.status === RoomStatus.WORD_SETTING) {
          if (player.role === Role.Host) {
            client.emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: player.role });
          }
        } else if (room.status !== RoomStatus.LOBBY) {
          client.emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: player.role });

          const secretWord = this.gamesService.getSecretWord(room.code);
          if (secretWord && (player.role === Role.Host || player.role === Role.Know)) {
            client.emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: secretWord });
          }
        }
      }
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.START_GAME)
  async handleStartGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const result = await this.gamesService.assignRoles(data.code, client.id);

    if (result) {
      // Broadcast updated room state
      this.server.to(result.room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result.room);
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
      client.emit(SOCKET_EVENTS.ERROR, {
        message: 'Cannot start game. Need at least 4 players (1 Host + 3 Players).',
      });
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
      const insider = room.players.find((p) => p.role === Role.Know);
      const gameHost = room.players.find((p) => p.role === Role.Host);

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
        if (player.role && player.role !== Role.Host) {
          this.server.to(player.socketId).emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: player.role });
        }
      });

      // Tell everyone else the phase changed
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to submit vote.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RESET_GAME)
  handleResetGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);

    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TTT_RESET)
  handleTTTReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.tttReset(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid choice or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RPS_RESET)
  handleRPSReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.rpsReset(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GOBBLER_RESET)
  handleGobblerReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.gobblerReset(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_SUBMIT_ANSWER)
  handleSoundsFishySubmitAnswer(
    @MessageBody() data: { code: string; answer: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.soundsFishySubmitAnswer(data.code, client.id, data.answer);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot go to next round.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SOUNDS_FISHY_RESET)
  handleSoundsFishyReset(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.soundsFishyReset(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
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
      this.server.to(result.room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result.room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot submit word' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES)
  async handleWhoAmIGetCategories(@ConnectedSocket() client: Socket) {
    const categories = await this.gamesService.whoAmICategoriesList();
    client.emit(SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, categories);
  }

  @SubscribeMessage(SOCKET_EVENTS.GAME_ACTION)
  handleWhoAmIGameAction(
    @MessageBody() data: { code: string; action: Record<string, unknown> },
    @ConnectedSocket() client: Socket,
  ) {
    // Check gameType first
    const roomInfo = this.gamesService.getRoom(data.code);
    if (roomInfo && roomInfo.gameType === GameType.WHO_AM_I) {
      const room = this.gamesService.whoAmIGameAction(data.code, client.id, data.action);
      if (room) {
        this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      } else {
        client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
      }
    }
  }
}
