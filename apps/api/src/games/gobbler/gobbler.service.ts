import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  GameType,
  GobblerPiece,
  GobblerSize,
  GobblerState,
  PlayerSide,
  BOT_SOCKET_ID,
} from '@repo/types';
import { v4 as uuidv4 } from 'uuid';
import { getGobblerMove } from './gobbler-ai';

@Injectable()
export class GobblerService {
  createInitialInventory(side: PlayerSide): GobblerPiece[] {
    return [
      { id: uuidv4(), side, size: 'SMALL' },
      { id: uuidv4(), side, size: 'SMALL' },
      { id: uuidv4(), side, size: 'MEDIUM' },
      { id: uuidv4(), side, size: 'MEDIUM' },
      { id: uuidv4(), side, size: 'LARGE' },
      { id: uuidv4(), side, size: 'LARGE' },
    ];
  }

  private isMember(room: RoomState, clientId: string): boolean {
    return clientId === BOT_SOCKET_ID || room.players.some((p) => p.socketId === clientId);
  }

  private isValidIndex(index: unknown): index is number {
    return Number.isInteger(index) && (index as number) >= 0 && (index as number) < 9;
  }

  private isGobblerRoom(room: RoomState): boolean {
    return room.gameType === GameType.TIC_TAC_TOE && room.config.ticTacToeMode === 'GOBBLER';
  }

  executeBotMoveIfNeeded(room: RoomState): boolean {
    if (!this.isGobblerRoom(room) || room.status !== RoomStatus.PLAYING) return false;
    if (!room.config.ticTacToeVsBot) return false;

    const gb = room.gobblerState;
    if (!gb || gb.winner) return false;

    const botSide: PlayerSide | null =
      gb.playerXId === BOT_SOCKET_ID ? 'X' : gb.playerOId === BOT_SOCKET_ID ? 'O' : null;
    if (!botSide || gb.currentTurn !== botSide) return false;

    const difficulty = room.config.ticTacToeBotDifficulty ?? 'GOD';
    const move = getGobblerMove(gb, botSide, difficulty);
    if (!move) return false;

    if (move.type === 'PLACE') {
      const res = this.placePiece(room, BOT_SOCKET_ID, move.pieceId, move.toIndex);
      return !!res;
    } else {
      const res = this.movePiece(room, BOT_SOCKET_ID, move.fromIndex, move.toIndex);
      return !!res;
    }
  }

  joinSide(
    room: RoomState,
    clientId: string,
    side: PlayerSide,
    options?: { deferBotMove?: boolean },
  ): RoomState | null {
    if (!this.isGobblerRoom(room) || room.status !== RoomStatus.LOBBY) return null;
    if (!room.gobblerState) return null;
    if (!this.isMember(room, clientId)) return null;
    if (side !== 'X' && side !== 'O') return null;

    const gb = room.gobblerState;
    const isVsBot = !!room.config.ticTacToeVsBot;

    if (isVsBot) {
      if (side === 'X') {
        gb.playerXId = clientId;
        gb.playerOId = BOT_SOCKET_ID;
      } else {
        gb.playerOId = clientId;
        gb.playerXId = BOT_SOCKET_ID;
      }
      room.status = RoomStatus.PLAYING;
      if (!options?.deferBotMove) {
        this.executeBotMoveIfNeeded(room);
      }
      return room;
    }

    const otherSide: PlayerSide = side === 'X' ? 'O' : 'X';
    const otherSideSeat = side === 'X' ? gb.playerOId : gb.playerXId;

    // Seat already taken by someone else
    const targetSeat = side === 'X' ? gb.playerXId : gb.playerOId;
    if (targetSeat && targetSeat !== clientId) return null;

    let changed = false;
    if (targetSeat !== clientId) {
      if (side === 'X') gb.playerXId = clientId;
      else gb.playerOId = clientId;
      changed = true;
    }

    // Free own previous seat on the other side if present
    if (otherSideSeat === clientId) {
      if (otherSide === 'X') gb.playerXId = undefined;
      else gb.playerOId = undefined;
      changed = true;
    }

    if (!changed) return null;

    if (gb.playerXId && gb.playerOId) {
      room.status = RoomStatus.PLAYING;
    }

    return room;
  }

  private checkWin(board: GobblerPiece[][]): {
    winner: PlayerSide | 'DRAW' | null;
    line?: number[];
  } {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // Rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // Cols
      [0, 4, 8],
      [2, 4, 6], // Diagonals
    ];

    let xWins = false;
    let oWins = false;
    let winningLine: number[] | undefined;

    for (const [a, b, c] of lines) {
      const topA = board[a].length > 0 ? board[a].at(-1) : null;
      const topB = board[b].length > 0 ? board[b].at(-1) : null;
      const topC = board[c].length > 0 ? board[c].at(-1) : null;

      if (topA && topB && topC && topA.side === topB.side && topA.side === topC.side) {
        if (topA.side === 'X') xWins = true;
        if (topA.side === 'O') oWins = true;
        if (!winningLine) winningLine = [a, b, c];
      }
    }

    if (xWins && oWins) return { winner: 'DRAW' };
    if (xWins) return { winner: 'X', line: winningLine };
    if (oWins) return { winner: 'O', line: winningLine };

    return { winner: null };
  }

  private sizeValue(size: GobblerSize): number {
    switch (size) {
      case 'SMALL':
        return 1;
      case 'MEDIUM':
        return 2;
      case 'LARGE':
        return 3;
    }
  }

  private canPlaceOver(newPiece: GobblerPiece, cell: GobblerPiece[]): boolean {
    if (cell.length === 0) return true;
    const topPiece = cell.at(-1)!;
    return this.sizeValue(newPiece.size) > this.sizeValue(topPiece.size);
  }

  placePiece(
    room: RoomState,
    clientId: string,
    pieceId: string,
    toIndex: number,
  ): RoomState | null {
    if (!this.isGobblerRoom(room) || room.status !== RoomStatus.PLAYING) return null;

    const gb = room.gobblerState;
    if (!gb || gb.winner) return null;
    if (!this.isMember(room, clientId)) return null;
    if (typeof pieceId !== 'string' || !this.isValidIndex(toIndex)) return null;

    let mySide: PlayerSide | null = null;
    if (gb.playerXId === clientId) mySide = 'X';
    else if (gb.playerOId === clientId) mySide = 'O';

    if (!mySide || gb.currentTurn !== mySide) return null;

    const inventory = mySide === 'X' ? gb.inventory.X : gb.inventory.O;
    const pieceIndex = inventory.findIndex((p) => p.id === pieceId);
    if (pieceIndex === -1) return null;

    const piece = inventory[pieceIndex];
    if (!this.canPlaceOver(piece, gb.board[toIndex])) return null;

    // Move piece from inventory to board
    inventory.splice(pieceIndex, 1);
    gb.board[toIndex].push(piece);

    return this.handlePostMove(room, gb);
  }

  movePiece(
    room: RoomState,
    clientId: string,
    fromIndex: number,
    toIndex: number,
  ): RoomState | null {
    if (!this.isGobblerRoom(room) || room.status !== RoomStatus.PLAYING) return null;

    const gb = room.gobblerState;
    if (!gb || gb.winner) return null;
    if (!this.isMember(room, clientId)) return null;
    if (!this.isValidIndex(fromIndex) || !this.isValidIndex(toIndex)) return null;

    let mySide: PlayerSide | null = null;
    if (gb.playerXId === clientId) mySide = 'X';
    else if (gb.playerOId === clientId) mySide = 'O';

    if (!mySide || gb.currentTurn !== mySide) return null;
    if (fromIndex === toIndex) return null;

    const sourceCell = gb.board[fromIndex];
    if (sourceCell.length === 0) return null;

    const topPiece = sourceCell.at(-1)!;
    if (topPiece.side !== mySide) return null; // Can only move your own exposed pieces

    if (!this.canPlaceOver(topPiece, gb.board[toIndex])) return null;

    // Move piece on board
    sourceCell.pop();
    gb.board[toIndex].push(topPiece);

    return this.handlePostMove(room, gb);
  }

  private handlePostMove(room: RoomState, gb: GobblerState): RoomState {
    const { winner, line } = this.checkWin(gb.board);
    if (winner) {
      gb.winner = winner;
      gb.winningLine = line;
      room.status = RoomStatus.RESULT;

      if (winner !== 'DRAW') {
        const winnerPlayerId = winner === 'X' ? gb.playerXId : gb.playerOId;
        const winnerPlayer = room.players.find((p) => p.socketId === winnerPlayerId);
        if (winnerPlayer) winnerPlayer.score += 1;
      }

      // Sync side scores from player scores (single source of truth: player.score)
      const xPlayer = room.players.find((p) => p.socketId === gb.playerXId);
      const oPlayer = room.players.find((p) => p.socketId === gb.playerOId);
      gb.scores.X = xPlayer?.score ?? gb.scores.X;
      gb.scores.O = oPlayer?.score ?? gb.scores.O;
    } else {
      gb.currentTurn = gb.currentTurn === 'X' ? 'O' : 'X';
    }

    return room;
  }

  reset(
    room: RoomState,
    clientId: string,
    toLobby = false,
    options?: { deferBotMove?: boolean },
  ): RoomState | null {
    if (!this.isGobblerRoom(room) || room.status !== RoomStatus.RESULT) return null;

    if (
      room.roomHostId !== clientId &&
      room.gobblerState?.playerXId !== clientId &&
      room.gobblerState?.playerOId !== clientId
    ) {
      return null;
    }

    const willStartImmediately =
      !toLobby && !!(room.gobblerState?.playerXId && room.gobblerState?.playerOId);
    room.status = willStartImmediately ? RoomStatus.PLAYING : RoomStatus.LOBBY;

    const previousWinner = room.gobblerState?.winner;

    room.gobblerState = {
      board: Array.from({ length: 9 }, () => []),
      playerXId: toLobby ? undefined : room.gobblerState?.playerXId,
      playerOId: toLobby ? undefined : room.gobblerState?.playerOId,
      currentTurn: previousWinner === 'X' ? 'O' : 'X',
      inventory: {
        X: this.createInitialInventory('X'),
        O: this.createInitialInventory('O'),
      },
      scores: room.gobblerState?.scores || { X: 0, O: 0 },
    };

    if (previousWinner === 'DRAW' || !previousWinner) {
      room.gobblerState.currentTurn = 'X';
    }

    if (room.status === RoomStatus.PLAYING && room.config.ticTacToeVsBot) {
      if (!options?.deferBotMove) {
        this.executeBotMoveIfNeeded(room);
      }
    }

    return room;
  }

  /** Re-point seat ownership to the new socket id on reconnection. */
  remapSocketId(state: GobblerState, oldSocketId: string, newSocketId: string): void {
    if (state.playerXId === oldSocketId) state.playerXId = newSocketId;
    if (state.playerOId === oldSocketId) state.playerOId = newSocketId;
  }
}
