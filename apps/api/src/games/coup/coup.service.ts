import { Injectable } from '@nestjs/common';
import { CoupRole, CoupState, CoupPhase, GameType, RoomState, RoomStatus } from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { RoomTimerService } from '../room-timer.service';

@Injectable()
export class CoupService {
  constructor(
    private readonly privateStateService: PrivateStateService,
    private readonly roomTimerService: RoomTimerService,
  ) {}

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private buildDeck(): CoupRole[] {
    const roles = [
      CoupRole.DUKE,
      CoupRole.ASSASSIN,
      CoupRole.CAPTAIN,
      CoupRole.AMBASSADOR,
      CoupRole.CONTESSA,
    ];
    const deck: CoupRole[] = [];
    for (const r of roles) {
      deck.push(r, r, r);
    }
    return this.shuffle(deck);
  }

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.COUP) return null;
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;
    if (room.players.length < 3 || room.players.length > 6) return null;

    const deck = this.buildDeck();
    const coins: Record<string, number> = {};
    const influences: Record<string, { count: number; revealed: CoupRole[] }> = {};

    // Deal 2 per player
    for (const p of room.players) {
      const hand = [deck.pop()!, deck.pop()!];
      this.privateStateService.set(room.code, p.socketId, 'coupHand', hand);
      coins[p.socketId] = 2;
      influences[p.socketId] = { count: 2, revealed: [] };
    }

    room.coupState = {
      phase: CoupPhase.PLAYING,
      deck,
      deadPile: [],
      coins,
      influences,
      currentTurn: room.roomHostId,
      winnerId: null,
      pendingAction: null,
      challengeWindowDeadline: null,
      blockWindowDeadline: null,
    };
    room.status = RoomStatus.PLAYING;
    return room;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.COUP) return null;
    // Allow host to reset from RESULT or PLAYING for scaffold
    if (room.roomHostId !== requesterId) return null;
    // Clear private hands
    for (const p of room.players) {
      this.privateStateService.delete(room.code, p.socketId, 'coupHand');
    }
    this.roomTimerService.clearRoom(room.code);
    room.coupState = undefined;
    room.status = RoomStatus.LOBBY;
    // Clear viewer flags handled by GamesService, but ensure isViewer cleared if someone stays
    return room;
  }

  remapSocketId(state: CoupState, oldSocketId: string, newSocketId: string): void {
    if (state.currentTurn === oldSocketId) state.currentTurn = newSocketId;
    if (state.winnerId === oldSocketId) state.winnerId = newSocketId;

    if (state.coins[oldSocketId] !== undefined) {
      state.coins[newSocketId] = state.coins[oldSocketId];
      delete state.coins[oldSocketId];
    }
    if (state.influences[oldSocketId]) {
      state.influences[newSocketId] = state.influences[oldSocketId];
      delete state.influences[oldSocketId];
    }
    if (state.pendingAction) {
      if (state.pendingAction.actorId === oldSocketId) state.pendingAction.actorId = newSocketId;
      if (state.pendingAction.targetId === oldSocketId) state.pendingAction.targetId = newSocketId;
    }
    // PrivateStateService remap is done by GamesService, not here
  }

  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    // No auto action for scaffold; future tickets handle Challenge/Block timeout
  }
}
