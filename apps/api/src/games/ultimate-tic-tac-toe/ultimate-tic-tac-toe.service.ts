import { Injectable } from '@nestjs/common';
import {
  GameType,
  RoomState,
  RoomStatus,
  UltimateSubBoardState,
  UltimateTicTacToeState,
  UltimateTTTCell,
} from '@repo/types';

@Injectable()
export class UltimateTicTacToeService {
  private readonly winningLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  createInitialState(): UltimateTicTacToeState {
    return {
      subBoards: Array.from({ length: 9 }, () => ({
        cells: Array(9).fill(null),
      })),
      macroBoard: Array(9).fill(null),
      currentTurn: 'X',
      activeMacroIndex: null, // Free move on turn 1
    };
  }

  private isMember(room: RoomState, clientId: string): boolean {
    return room.players.some((p) => p.socketId === clientId);
  }

  private isValidIndex(index: unknown): index is number {
    return Number.isInteger(index) && (index as number) >= 0 && (index as number) < 9;
  }

  checkWin(cells: (UltimateTTTCell | 'DRAW')[]): {
    winner: 'X' | 'O' | null;
    line?: number[];
  } {
    for (let i = 0; i < this.winningLines.length; i++) {
      const [a, b, c] = this.winningLines[i];
      if (cells[a] && cells[a] !== 'DRAW' && cells[a] === cells[b] && cells[a] === cells[c]) {
        return { winner: cells[a] as 'X' | 'O', line: this.winningLines[i] };
      }
    }
    return { winner: null };
  }

  joinSide(room: RoomState, clientId: string, side: 'X' | 'O'): RoomState | null {
    if (room.gameType !== GameType.ULTIMATE_TIC_TAC_TOE || room.status !== RoomStatus.LOBBY) {
      return null;
    }
    if (!room.ultimateTicTacToeState) return null;
    if (!this.isMember(room, clientId)) return null;
    if (side !== 'X' && side !== 'O') return null;

    const uttt = room.ultimateTicTacToeState;
    const otherSide: 'X' | 'O' = side === 'X' ? 'O' : 'X';
    const targetSeat = side === 'X' ? uttt.playerXId : uttt.playerOId;

    // Seat already taken by someone else
    if (targetSeat && targetSeat !== clientId) return null;

    let changed = false;
    if (targetSeat !== clientId) {
      if (side === 'X') uttt.playerXId = clientId;
      else uttt.playerOId = clientId;
      changed = true;
    }

    // Free own previous seat on the other side if present
    const otherSeat = otherSide === 'X' ? uttt.playerXId : uttt.playerOId;
    if (otherSeat === clientId) {
      if (otherSide === 'X') uttt.playerXId = undefined;
      else uttt.playerOId = undefined;
      changed = true;
    }

    if (!changed) return null;

    if (uttt.playerXId && uttt.playerOId) {
      room.status = RoomStatus.PLAYING;
    }

    return room;
  }

  makeMove(
    room: RoomState,
    clientId: string,
    macroIndex: number,
    microIndex: number,
  ): RoomState | null {
    if (room.gameType !== GameType.ULTIMATE_TIC_TAC_TOE || room.status !== RoomStatus.PLAYING) {
      return null;
    }

    const uttt = room.ultimateTicTacToeState;
    if (!uttt || uttt.winner) return null;
    if (!this.isMember(room, clientId)) return null;
    if (!this.isValidIndex(macroIndex) || !this.isValidIndex(microIndex)) return null;

    // Validate player side and turn
    const mySide = uttt.playerXId === clientId ? 'X' : uttt.playerOId === clientId ? 'O' : null;
    if (!mySide || uttt.currentTurn !== mySide) return null;

    // Validate active macro board constraint
    if (uttt.activeMacroIndex !== null && uttt.activeMacroIndex !== macroIndex) {
      return null;
    }

    const subBoard: UltimateSubBoardState = uttt.subBoards[macroIndex];
    if (!subBoard) return null;

    // Cannot play in a sub-board that has already been won or drawn
    if (subBoard.winner) return null;

    // Cell must be empty
    if (subBoard.cells[microIndex] !== null) return null;

    // Apply move
    subBoard.cells[microIndex] = mySide;
    uttt.lastMove = { macroIndex, microIndex };

    // Check if this sub-board is won
    const subWin = this.checkWin(subBoard.cells);
    if (subWin.winner) {
      subBoard.winner = subWin.winner;
      subBoard.winningLine = subWin.line;
      uttt.macroBoard[macroIndex] = subWin.winner;
    } else if (!subBoard.cells.includes(null)) {
      // Sub-board full with no winner -> DRAW
      subBoard.winner = 'DRAW';
      uttt.macroBoard[macroIndex] = 'DRAW';
    }

    // Check if macro board has been won
    const macroWin = this.checkWin(uttt.macroBoard);
    if (macroWin.winner) {
      uttt.winner = macroWin.winner;
      uttt.winningMacroLine = macroWin.line;
      room.status = RoomStatus.RESULT;

      const winnerPlayerId = macroWin.winner === 'X' ? uttt.playerXId : uttt.playerOId;
      const winnerPlayer = room.players.find((p) => p.socketId === winnerPlayerId);
      if (winnerPlayer) winnerPlayer.score += 1;
      return room;
    }

    // Check if overall game is a DRAW (all sub-boards won/drawn or no legal moves exist)
    const hasPlayableSubBoard = uttt.subBoards.some((sb) => !sb.winner && sb.cells.includes(null));
    if (!hasPlayableSubBoard) {
      uttt.winner = 'DRAW';
      room.status = RoomStatus.RESULT;
      return room;
    }

    // Determine active macro board for the next turn
    const targetSubBoard = uttt.subBoards[microIndex];
    if (targetSubBoard.winner || !targetSubBoard.cells.includes(null)) {
      // Target board is finished (won or draw/full) -> Free Move!
      uttt.activeMacroIndex = null;
    } else {
      uttt.activeMacroIndex = microIndex;
    }

    // Switch turn
    uttt.currentTurn = uttt.currentTurn === 'X' ? 'O' : 'X';

    return room;
  }

  reset(room: RoomState, clientId: string): RoomState | null {
    if (room.gameType !== GameType.ULTIMATE_TIC_TAC_TOE || room.status !== RoomStatus.RESULT) {
      return null;
    }

    if (
      room.roomHostId !== clientId &&
      room.ultimateTicTacToeState?.playerXId !== clientId &&
      room.ultimateTicTacToeState?.playerOId !== clientId
    ) {
      return null;
    }

    const uttt = room.ultimateTicTacToeState;
    const willStartImmediately = !!(uttt?.playerXId && uttt?.playerOId);
    room.status = willStartImmediately ? RoomStatus.PLAYING : RoomStatus.LOBBY;

    const previousWinner = uttt?.winner;

    room.ultimateTicTacToeState = {
      subBoards: Array.from({ length: 9 }, () => ({
        cells: Array(9).fill(null),
      })),
      macroBoard: Array(9).fill(null),
      playerXId: uttt?.playerXId,
      playerOId: uttt?.playerOId,
      currentTurn: previousWinner === 'X' ? 'O' : 'X',
      activeMacroIndex: null,
    };

    if (previousWinner === 'DRAW') {
      room.ultimateTicTacToeState.currentTurn = 'X';
    }

    return room;
  }

  remapSocketId(state: UltimateTicTacToeState, oldSocketId: string, newSocketId: string): void {
    if (state.playerXId === oldSocketId) state.playerXId = newSocketId;
    if (state.playerOId === oldSocketId) state.playerOId = newSocketId;
  }
}
