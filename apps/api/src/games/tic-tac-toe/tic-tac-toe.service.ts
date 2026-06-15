import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, TicTacToeCell, GameType } from '@repo/types';

@Injectable()
export class TicTacToeService {
  joinSide(room: RoomState, clientId: string, side: 'X' | 'O'): RoomState | null {
    if (room.gameType !== GameType.TIC_TAC_TOE || room.status !== RoomStatus.LOBBY) return null;
    if (!room.ticTacToeState) return null;

    if (room.ticTacToeState.playerXId === clientId) room.ticTacToeState.playerXId = undefined;
    if (room.ticTacToeState.playerOId === clientId) room.ticTacToeState.playerOId = undefined;

    if (side === 'X' && !room.ticTacToeState.playerXId) {
      room.ticTacToeState.playerXId = clientId;
    } else if (side === 'O' && !room.ticTacToeState.playerOId) {
      room.ticTacToeState.playerOId = clientId;
    }

    if (room.ticTacToeState.playerXId && room.ticTacToeState.playerOId) {
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
    if (room.gameType !== GameType.TIC_TAC_TOE || room.status !== RoomStatus.PLAYING) return null;

    const ttt = room.ticTacToeState;
    if (!ttt || ttt.winner) return null;

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
    }

    return room;
  }

  reset(room: RoomState, clientId: string): RoomState | null {
    if (room.gameType !== GameType.TIC_TAC_TOE || room.status !== RoomStatus.RESULT) return null;

    if (
      room.roomHostId !== clientId &&
      room.ticTacToeState?.playerXId !== clientId &&
      room.ticTacToeState?.playerOId !== clientId
    ) {
      return null;
    }

    const willStartImmediately = !!(
      room.ticTacToeState?.playerXId && room.ticTacToeState?.playerOId
    );
    room.status = willStartImmediately ? RoomStatus.PLAYING : RoomStatus.LOBBY;

    const previousWinner = room.ticTacToeState?.winner;

    room.ticTacToeState = {
      board: Array(9).fill(null),
      playerXId: room.ticTacToeState?.playerXId,
      playerOId: room.ticTacToeState?.playerOId,
      currentTurn: previousWinner === 'X' ? 'O' : 'X',
    };

    if (previousWinner === 'DRAW') {
      room.ticTacToeState.currentTurn = 'X';
    }

    return room;
  }
}
