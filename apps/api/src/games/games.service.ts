import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  Role,
  UserState,
  GameType,
  RPSChoice,
  WordCategory,
} from '@repo/types';
import { v4 as uuidv4 } from 'uuid';
import { WhoKnowService } from './who-know/who-know.service';
import { TicTacToeService } from './tic-tac-toe/tic-tac-toe.service';
import { RPSService } from './rps/rps.service';
import { GobblerService } from './gobbler/gobbler.service';
import { SoundsFishyService } from './sounds-fishy/sounds-fishy.service';
import { DetectiveClubService } from './detective-club/detective-club.service';
import { WhoAmIService } from './who-am-i/who-am-i.service';

@Injectable()
export class GamesService {
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

  createRoom(hostId: string, gameType: GameType = GameType.WHO_KNOW): RoomState {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
    }

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, user: Omit<UserState, 'score' | 'roomId' | 'role'>): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const existingPlayer = room.players.find((p) => p.name === user.name);

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
    } else {
      room.players.push({
        ...user,
        score: 0,
        roomId: room.id,
        connected: true,
      });
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
            this.rooms.delete(code);
            this.secretWords.delete(code);
            return { code: null };
          }
        }

        if (explicitLeave || room.status === RoomStatus.LOBBY) {
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
          this.rooms.delete(code);
          this.secretWords.delete(code);
          return null;
        }

        this.rooms.set(code, room);
        return room;
      }
    }
    return null;
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

    room.config = { ...room.config, ...config };
    this.rooms.set(code, room);
    return room;
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
        // In hub, we don't have playerWords at START_GAME. So HOST_INPUT must be handled by a specific event or we initialize it empty.
        // Wait, for HOST_INPUT the original used a separate event or sent playerWords.
        // Let's assume the host input starts with COLLECTING_WORDS just like PLAYER_INPUT for now, or requires a custom event.
        // Actually, the original Who Am I had `whoAmIStartGameHostInput` passing `playerWords`.
        // We'll return null here and let a custom event handle it, OR just initialize it.
        // Let's use custom socket events for Who Am I starts to pass extra data if needed, or we adapt it here.
        // Wait, I can just initialize PLAYER_INPUT here and let HOST_INPUT be handled separately.
        updatedRoom = this.whoAmIService.startGamePlayerInput(room, requesterId);
      } else if (room.config.wordMode === 'RANDOM') {
        updatedRoom = await this.whoAmIService.startGameRandom(room, requesterId);
      } else if (room.config.wordMode === 'PLAYER_INPUT') {
        updatedRoom = this.whoAmIService.startGamePlayerInput(room, requesterId);
      }

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
}
