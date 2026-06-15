import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  GameType,
  GobblerPiece,
  GobblerSize,
  GobblerState,
  PlayerSide,
} from '@repo/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GobblerService {
  private createInitialInventory(side: PlayerSide): GobblerPiece[] {
    return [
      { id: uuidv4(), side, size: 'SMALL' },
      { id: uuidv4(), side, size: 'SMALL' },
      { id: uuidv4(), side, size: 'MEDIUM' },
      { id: uuidv4(), side, size: 'MEDIUM' },
      { id: uuidv4(), side, size: 'LARGE' },
      { id: uuidv4(), side, size: 'LARGE' },
    ];
  }

  joinSide(room: RoomState, clientId: string, side: PlayerSide): RoomState | null {
    if (room.gameType !== GameType.GOBBLER_TIC_TAC_TOE || room.status !== RoomStatus.LOBBY)
      return null;
    if (!room.gobblerState) return null;

    if (room.gobblerState.playerXId === clientId) room.gobblerState.playerXId = undefined;
    if (room.gobblerState.playerOId === clientId) room.gobblerState.playerOId = undefined;

    if (side === 'X' && !room.gobblerState.playerXId) {
      room.gobblerState.playerXId = clientId;
    } else if (side === 'O' && !room.gobblerState.playerOId) {
      room.gobblerState.playerOId = clientId;
    }

    if (room.gobblerState.playerXId && room.gobblerState.playerOId) {
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
    if (room.gameType !== GameType.GOBBLER_TIC_TAC_TOE || room.status !== RoomStatus.PLAYING)
      return null;

    const gb = room.gobblerState;
    if (!gb || gb.winner) return null;

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
    if (room.gameType !== GameType.GOBBLER_TIC_TAC_TOE || room.status !== RoomStatus.PLAYING)
      return null;

    const gb = room.gobblerState;
    if (!gb || gb.winner) return null;

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

        // Update Gobbler specific team scores
        if (winner === 'X') gb.scores.X += 1;
        else if (winner === 'O') gb.scores.O += 1;
      }
    } else {
      gb.currentTurn = gb.currentTurn === 'X' ? 'O' : 'X';
    }

    return room;
  }

  reset(room: RoomState, clientId: string): RoomState | null {
    if (room.gameType !== GameType.GOBBLER_TIC_TAC_TOE || room.status !== RoomStatus.RESULT)
      return null;

    if (
      room.roomHostId !== clientId &&
      room.gobblerState?.playerXId !== clientId &&
      room.gobblerState?.playerOId !== clientId
    ) {
      return null;
    }

    const willStartImmediately = !!(room.gobblerState?.playerXId && room.gobblerState?.playerOId);
    room.status = willStartImmediately ? RoomStatus.PLAYING : RoomStatus.LOBBY;

    const previousWinner = room.gobblerState?.winner;

    room.gobblerState = {
      board: Array.from({ length: 9 }, () => []),
      playerXId: room.gobblerState?.playerXId,
      playerOId: room.gobblerState?.playerOId,
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

    return room;
  }
}
