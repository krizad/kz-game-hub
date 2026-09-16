import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  TicTacToeCell,
  TicTacToeState,
  GameType,
  BOT_SOCKET_ID,
} from '@repo/types';
import { getRandomMove, getBestMove } from './tic-tac-toe-ai';

@Injectable()
export class TicTacToeService {
  private isMember(room: RoomState, clientId: string): boolean {
    return room.players.some((p) => p.socketId === clientId);
  }

  private isClassicTTTRoom(room: RoomState): boolean {
    return (
      room.gameType === GameType.TIC_TAC_TOE &&
      (!room.config.ticTacToeMode || room.config.ticTacToeMode === 'CLASSIC')
    );
  }

  private isValidIndex(index: unknown): index is number {
    return Number.isInteger(index) && (index as number) >= 0 && (index as number) < 9;
  }

  executeBotMoveIfNeeded(room: RoomState): boolean {
    if (!this.isClassicTTTRoom(room) || room.status !== RoomStatus.PLAYING) return false;
    if (!room.config.ticTacToeVsBot) return false;

    const ttt = room.ticTacToeState;
    if (!ttt || ttt.winner) return false;

    const botSide: 'X' | 'O' | null =
      ttt.playerXId === BOT_SOCKET_ID ? 'X' : ttt.playerOId === BOT_SOCKET_ID ? 'O' : null;
    if (!botSide || ttt.currentTurn !== botSide) return false;

    const difficulty = room.config.ticTacToeBotDifficulty ?? 'GOD';
    const move = difficulty === 'EASY' ? getRandomMove(ttt.board) : getBestMove(ttt.board, botSide);

    if (move < 0 || move >= 9 || ttt.board[move] !== null) return false;

    ttt.board[move] = botSide;

    const { winner, line } = this.checkWin(ttt.board);
    if (winner) {
      ttt.winner = winner;
      ttt.winningLine = line;
      room.status = RoomStatus.RESULT;

      const botPlayer = room.players.find((p) => p.socketId === BOT_SOCKET_ID);
      if (botPlayer) botPlayer.score += 1;
    } else if (!ttt.board.includes(null)) {
      ttt.winner = 'DRAW';
      room.status = RoomStatus.RESULT;
    } else {
      ttt.currentTurn = botSide === 'X' ? 'O' : 'X';
    }

    return true;
  }

  joinSide(room: RoomState, clientId: string, side: 'X' | 'O'): RoomState | null {
    if (!this.isClassicTTTRoom(room) || room.status !== RoomStatus.LOBBY) return null;
    if (!room.ticTacToeState) return null;
    if (!this.isMember(room, clientId)) return null;
    if (side !== 'X' && side !== 'O') return null;

    const ttt = room.ticTacToeState;
    const isVsBot = !!room.config.ticTacToeVsBot;

    if (isVsBot) {
      if (side === 'X') {
        ttt.playerXId = clientId;
        ttt.playerOId = BOT_SOCKET_ID;
      } else {
        ttt.playerOId = clientId;
        ttt.playerXId = BOT_SOCKET_ID;
      }
      room.status = RoomStatus.PLAYING;
      this.executeBotMoveIfNeeded(room);
      return room;
    }

    const otherSide: 'X' | 'O' = side === 'X' ? 'O' : 'X';
    const targetSeat = side === 'X' ? ttt.playerXId : ttt.playerOId;

    // Seat already taken by someone else
    if (targetSeat && targetSeat !== clientId) return null;

    let changed = false;
    if (targetSeat !== clientId) {
      if (side === 'X') ttt.playerXId = clientId;
      else ttt.playerOId = clientId;
      changed = true;
    }

    // Free own previous seat on the other side if present
    const otherSeat = otherSide === 'X' ? ttt.playerXId : ttt.playerOId;
    if (otherSeat === clientId) {
      if (otherSide === 'X') ttt.playerXId = undefined;
      else ttt.playerOId = undefined;
      changed = true;
    }

    if (!changed) return null;

    if (ttt.playerXId && ttt.playerOId) {
      room.status = RoomStatus.PLAYING;
    }

    return room;
  }

  private checkWin(board: TicTacToeCell[]): { winner: 'X' | 'O' | null; line?: number[] } {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a] as 'X' | 'O', line: lines[i] };
      }
    }
    return { winner: null };
  }

  makeMove(room: RoomState, clientId: string, index: number): RoomState | null {
    if (!this.isClassicTTTRoom(room) || room.status !== RoomStatus.PLAYING) return null;

    const ttt = room.ticTacToeState;
    if (!ttt || ttt.winner) return null;
    if (!this.isMember(room, clientId)) return null;
    if (!this.isValidIndex(index)) return null;

    const mySide = ttt.playerXId === clientId ? 'X' : ttt.playerOId === clientId ? 'O' : null;
    if (!mySide || ttt.currentTurn !== mySide) return null;
    if (ttt.board[index] !== null) return null;

    ttt.board[index] = mySide;

    const { winner, line } = this.checkWin(ttt.board);
    if (winner) {
      ttt.winner = winner;
      ttt.winningLine = line;
      room.status = RoomStatus.RESULT;

      const winnerPlayerId = winner === 'X' ? ttt.playerXId : ttt.playerOId;
      const winnerPlayer = room.players.find((p) => p.socketId === winnerPlayerId);
      if (winnerPlayer) winnerPlayer.score += 1;
    } else if (!ttt.board.includes(null)) {
      ttt.winner = 'DRAW';
      room.status = RoomStatus.RESULT;
    } else {
      ttt.currentTurn = ttt.currentTurn === 'X' ? 'O' : 'X';
      if (room.config.ticTacToeVsBot) {
        this.executeBotMoveIfNeeded(room);
      }
    }

    return room;
  }

  reset(room: RoomState, clientId: string, toLobby = false): RoomState | null {
    if (!this.isClassicTTTRoom(room) || room.status !== RoomStatus.RESULT) return null;

    if (
      room.roomHostId !== clientId &&
      room.ticTacToeState?.playerXId !== clientId &&
      room.ticTacToeState?.playerOId !== clientId
    ) {
      return null;
    }

    const willStartImmediately =
      !toLobby && !!(room.ticTacToeState?.playerXId && room.ticTacToeState?.playerOId);
    room.status = willStartImmediately ? RoomStatus.PLAYING : RoomStatus.LOBBY;

    const previousWinner = room.ticTacToeState?.winner;

    room.ticTacToeState = {
      board: Array(9).fill(null),
      playerXId: toLobby ? undefined : room.ticTacToeState?.playerXId,
      playerOId: toLobby ? undefined : room.ticTacToeState?.playerOId,
      currentTurn: previousWinner === 'X' ? 'O' : 'X',
    };

    if (previousWinner === 'DRAW') {
      room.ticTacToeState.currentTurn = 'X';
    }

    if (room.status === RoomStatus.PLAYING && room.config.ticTacToeVsBot) {
      this.executeBotMoveIfNeeded(room);
    }

    return room;
  }

  /** Re-point seat ownership to the new socket id on reconnection. */
  remapSocketId(state: TicTacToeState, oldSocketId: string, newSocketId: string): void {
    if (state.playerXId === oldSocketId) state.playerXId = newSocketId;
    if (state.playerOId === oldSocketId) state.playerOId = newSocketId;
  }
}
