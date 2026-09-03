import { Injectable } from '@nestjs/common';
import { CoupRole, CoupState, CoupPhase, CoupActionType, GameType, RoomState, RoomStatus } from '@repo/types';
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
      pendingBlock: null,
    };
    room.status = RoomStatus.PLAYING;
    return room;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.COUP) return null;
    if (room.roomHostId !== requesterId) return null;
    for (const p of room.players) {
      this.privateStateService.delete(room.code, p.socketId, 'coupHand');
    }
    this.roomTimerService.clearRoom(room.code);
    room.coupState = undefined;
    room.status = RoomStatus.LOBBY;
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
    if (state.pendingBlock && state.pendingBlock.blockerId === oldSocketId) {
      state.pendingBlock.blockerId = newSocketId;
    }
  }

  private isAlive(state: CoupState, socketId: string): boolean {
    return (state.influences[socketId]?.count ?? 0) > 0;
  }

  private aliveIds(room: RoomState, state: CoupState): string[] {
    return room.players.filter((p) => this.isAlive(state, p.socketId)).map((p) => p.socketId);
  }

  private advanceTurn(room: RoomState, state: CoupState): void {
    const order = room.players.map((p) => p.socketId);
    const currentIdx = order.indexOf(state.currentTurn ?? '');
    for (let i = 1; i <= order.length; i++) {
      const nextIdx = (currentIdx + i) % order.length;
      const candidate = order[nextIdx];
      if (this.isAlive(state, candidate)) {
        state.currentTurn = candidate;
        return;
      }
    }
  }

  private checkWinner(room: RoomState, state: CoupState): void {
    const alive = this.aliveIds(room, state);
    if (alive.length === 1) {
      state.winnerId = alive[0];
      state.phase = CoupPhase.RESULT;
      room.status = RoomStatus.RESULT;
      const winner = room.players.find((p) => p.socketId === alive[0]);
      if (winner) winner.score += 1;
    } else if (alive.length === 0) {
      state.phase = CoupPhase.RESULT;
      room.status = RoomStatus.RESULT;
    }
  }

  private loseInfluence(room: RoomState, state: CoupState, targetId: string): void {
    const inf = state.influences[targetId];
    if (!inf || inf.count <= 0) return;
    const hand = this.privateStateService.get<CoupRole[]>(room.code, targetId, 'coupHand') ?? [];
    const lost = hand.shift();
    if (lost) {
      inf.revealed.push(lost);
      state.deadPile.push(lost);
      this.privateStateService.set(room.code, targetId, 'coupHand', hand);
    }
    inf.count = Math.max(0, inf.count - 1);
  }

  private getClaimedRole(type: CoupActionType): CoupRole | null {
    switch (type) {
      case CoupActionType.TAX:
        return CoupRole.DUKE;
      case CoupActionType.ASSASSINATE:
        return CoupRole.ASSASSIN;
      case CoupActionType.STEAL:
        return CoupRole.CAPTAIN;
      case CoupActionType.EXCHANGE:
        return CoupRole.AMBASSADOR;
      default:
        return null;
    }
  }

  private isBlockable(type: CoupActionType): boolean {
    return type === CoupActionType.FOREIGN_AID || type === CoupActionType.ASSASSINATE || type === CoupActionType.STEAL;
  }

  private getBlockRole(type: CoupActionType): CoupRole[] {
    switch (type) {
      case CoupActionType.FOREIGN_AID:
        return [CoupRole.DUKE];
      case CoupActionType.ASSASSINATE:
        return [CoupRole.CONTESSA];
      case CoupActionType.STEAL:
        return [CoupRole.CAPTAIN, CoupRole.AMBASSADOR];
      default:
        return [];
    }
  }

  private resolveActionSuccess(room: RoomState, state: CoupState, pending: NonNullable<CoupState['pendingAction']>): void {
    switch (pending.type) {
      case CoupActionType.TAX:
        state.coins[pending.actorId] = (state.coins[pending.actorId] ?? 0) + 3;
        break;
      case CoupActionType.FOREIGN_AID:
        state.coins[pending.actorId] = (state.coins[pending.actorId] ?? 0) + 2;
        break;
      case CoupActionType.ASSASSINATE: {
        const target = pending.targetId!;
        // coins already deducted at declare; now make target lose 1
        this.loseInfluence(room, state, target);
        this.checkWinner(room, state);
        if ((state.phase as string) === CoupPhase.RESULT) return;
        break;
      }
      default:
        break;
    }
  }

  handleChallengeTimeoutForRoom(room: RoomState): RoomState | null {
    if (!room.coupState) return null;
    const state = room.coupState;
    if (state.phase !== CoupPhase.AWAITING_CHALLENGE || !state.pendingAction) return null;
    if (state.pendingBlock) return null;
    const pending = state.pendingAction;
    state.challengeWindowDeadline = null;
    if (this.isBlockable(pending.type)) {
      state.phase = CoupPhase.AWAITING_BLOCK;
      state.blockWindowDeadline = Date.now() + 7000;
      return room;
    }
    // Not blockable — success
    if (pending.type === CoupActionType.TAX) {
      state.coins[pending.actorId] = (state.coins[pending.actorId] ?? 0) + 3;
    }
    state.pendingAction = null;
    state.phase = CoupPhase.PLAYING;
    this.advanceTurn(room, state);
    return room;
  }

  handleBlockTimeoutForRoom(room: RoomState): RoomState | null {
    if (!room.coupState) return null;
    const state = room.coupState;
    if (state.phase !== CoupPhase.AWAITING_BLOCK || !state.pendingAction) return null;
    state.blockWindowDeadline = null;
    // No block — action succeeds
    const pending = state.pendingAction;
    this.resolveActionSuccess(room, state, pending);
    if ((state.phase as string) === CoupPhase.RESULT) {
      state.pendingAction = null;
      return room;
    }
    state.pendingAction = null;
    state.phase = CoupPhase.PLAYING;
    this.advanceTurn(room, state);
    return room;
  }

  handleBlockChallengeTimeoutForRoom(room: RoomState): RoomState | null {
    if (!room.coupState) return null;
    const state = room.coupState;
    if (state.phase !== CoupPhase.AWAITING_CHALLENGE || !state.pendingBlock || !state.pendingAction) return null;
    // No challenge to block — block stands, action fails
    state.challengeWindowDeadline = null;
    state.pendingBlock = null;
    state.pendingAction = null;
    state.phase = CoupPhase.PLAYING;
    this.advanceTurn(room, state);
    return room;
  }

  challenge(room: RoomState, challengerId: string): RoomState | null {
    if (room.gameType !== GameType.COUP || !room.coupState) return null;
    const state = room.coupState;
    if (!state.pendingAction) return null;

    // Distinguish between declare challenge and block challenge via pendingBlock presence
    if (state.pendingBlock) {
      // Challenge to block
      if (state.phase !== CoupPhase.AWAITING_CHALLENGE) return null;
      if (challengerId === state.pendingBlock.blockerId) return null;
      if (!this.isAlive(state, challengerId)) return null;
      if (!room.players.some((p) => p.socketId === challengerId)) return null;

      const claimedRole = state.pendingBlock.claimedRole;
      const blockerHand = this.privateStateService.get<CoupRole[]>(room.code, state.pendingBlock.blockerId, 'coupHand') ?? [];
      const hasRole = blockerHand.includes(claimedRole);

      this.roomTimerService.cancel(room.code, 'coup-challenge');
      state.challengeWindowDeadline = null;

      if (hasRole) {
        // Challenge fails — challenger loses
        this.loseInfluence(room, state, challengerId);
        // Blocker shuffles and draws
        const idx = blockerHand.indexOf(claimedRole);
        if (idx !== -1) {
          const [card] = blockerHand.splice(idx, 1);
          state.deck.push(card);
          for (let i = state.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
          }
          blockerHand.push(state.deck.pop()!);
          this.privateStateService.set(room.code, state.pendingBlock.blockerId, 'coupHand', blockerHand);
        }
        this.checkWinner(room, state);
        if ((state.phase as string) === CoupPhase.RESULT) {
          state.pendingBlock = null;
          state.pendingAction = null;
          return room;
        }
        // Block stands — action fails
        state.pendingBlock = null;
        state.pendingAction = null;
        state.phase = CoupPhase.PLAYING;
        this.advanceTurn(room, state);
        return room;
      } else {
        // Challenge succeeds — blocker loses, block fails, original action succeeds
        this.loseInfluence(room, state, state.pendingBlock.blockerId);
        this.checkWinner(room, state);
        const pending = state.pendingAction;
        state.pendingBlock = null;
        // Original action now succeeds
        this.resolveActionSuccess(room, state, pending);
        if ((state.phase as string) === CoupPhase.RESULT) {
          state.pendingAction = null;
          return room;
        }
        state.pendingAction = null;
        state.phase = CoupPhase.PLAYING;
        this.advanceTurn(room, state);
        return room;
      }
    }

    // Challenge to declare
    if (state.phase !== CoupPhase.AWAITING_CHALLENGE) return null;
    if (challengerId === state.pendingAction.actorId) return null;
    if (!this.isAlive(state, challengerId)) return null;
    if (!room.players.some((p) => p.socketId === challengerId)) return null;

    const actorId = state.pendingAction.actorId;
    const claimedRole = state.pendingAction.claimedRole!;
    const actorHand = this.privateStateService.get<CoupRole[]>(room.code, actorId, 'coupHand') ?? [];
    const hasRole = actorHand.includes(claimedRole);

    this.roomTimerService.cancel(room.code, 'coup-challenge');
    state.challengeWindowDeadline = null;

    if (hasRole) {
      this.loseInfluence(room, state, challengerId);
      const idx = actorHand.indexOf(claimedRole);
      if (idx !== -1) {
        const [card] = actorHand.splice(idx, 1);
        state.deck.push(card);
        for (let i = state.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
        }
        actorHand.push(state.deck.pop()!);
        this.privateStateService.set(room.code, actorId, 'coupHand', actorHand);
      }
      this.checkWinner(room, state);
      if ((state.phase as string) === CoupPhase.RESULT) {
        state.pendingAction = null;
        return room;
      }
      if (this.isBlockable(state.pendingAction.type)) {
        state.phase = CoupPhase.AWAITING_BLOCK;
        state.blockWindowDeadline = Date.now() + 7000;
        return room;
      }
      if (state.pendingAction.type === CoupActionType.TAX) {
        state.coins[actorId] = (state.coins[actorId] ?? 0) + 3;
      }
      state.pendingAction = null;
      state.phase = CoupPhase.PLAYING;
      this.advanceTurn(room, state);
      return room;
    } else {
      this.loseInfluence(room, state, actorId);
      // If assassinate, refund? No, per rule keep cost? For Tax no cost. For Assassinate we already deducted at declare, keep deducted.
      this.checkWinner(room, state);
      state.pendingAction = null;
      state.phase = CoupPhase.PLAYING;
      if ((state.phase as string) !== CoupPhase.RESULT) {
        this.advanceTurn(room, state);
      }
      return room;
    }
  }

  block(room: RoomState, blockerId: string): RoomState | null {
    if (room.gameType !== GameType.COUP || !room.coupState) return null;
    const state = room.coupState;
    if (state.phase !== CoupPhase.AWAITING_BLOCK || !state.pendingAction) return null;
    if (!this.isAlive(state, blockerId)) return null;
    if (!room.players.some((p) => p.socketId === blockerId)) return null;
    if (blockerId === state.pendingAction.actorId) return null;

    const pending = state.pendingAction;
    const allowed = this.getBlockRole(pending.type);
    if (allowed.length === 0) return null;

    // Assassinate can only be blocked by target
    if (pending.type === CoupActionType.ASSASSINATE && blockerId !== pending.targetId) return null;

    // For Foreign Aid any non-actor can block; already checked
    // Pick first allowed role as claimed (for 04 Duke/Contessa)
    const claimedRole = allowed[0];

    this.roomTimerService.cancel(room.code, 'coup-block');
    state.blockWindowDeadline = null;
    state.pendingBlock = { blockerId, claimedRole };
    state.phase = CoupPhase.AWAITING_CHALLENGE;
    state.challengeWindowDeadline = Date.now() + 7000;
    return room;
  }

  declareAction(
    room: RoomState,
    actorId: string,
    type: CoupActionType,
    targetId?: string,
  ): RoomState | null {
    if (room.gameType !== GameType.COUP || !room.coupState) return null;
    const state = room.coupState;
    if (room.status !== RoomStatus.PLAYING) return null;
    if (state.phase !== CoupPhase.PLAYING) return null;
    if (state.currentTurn !== actorId) return null;
    if (!this.isAlive(state, actorId)) return null;
    if (!room.players.some((p) => p.socketId === actorId)) return null;

    const coins = state.coins[actorId] ?? 0;
    if (coins >= 10 && type !== CoupActionType.COUP) return null;

    const claimedRole = this.getClaimedRole(type);

    if (claimedRole) {
      // Assassinate cost handling
      if (type === CoupActionType.ASSASSINATE) {
        if (!targetId) return null;
        if (!room.players.some((p) => p.socketId === targetId)) return null;
        if (targetId === actorId) return null;
        if (!this.isAlive(state, targetId)) return null;
        if (coins < 3) return null;
        state.coins[actorId] = coins - 3;
      }
      state.pendingAction = { actorId, type, targetId, claimedRole };
      state.phase = CoupPhase.AWAITING_CHALLENGE;
      state.challengeWindowDeadline = Date.now() + 7000;
      return room;
    }

    if (this.isBlockable(type)) {
      // Foreign Aid blockable but not challengeable
      state.pendingAction = { actorId, type, targetId, claimedRole: undefined as any };
      state.phase = CoupPhase.AWAITING_BLOCK;
      state.blockWindowDeadline = Date.now() + 7000;
      return room;
    }

    switch (type) {
      case CoupActionType.INCOME: {
        state.coins[actorId] = coins + 1;
        break;
      }
      case CoupActionType.COUP: {
        if (!targetId) return null;
        if (!room.players.some((p) => p.socketId === targetId)) return null;
        if (targetId === actorId) return null;
        if (!this.isAlive(state, targetId)) return null;
        if (coins < 7) return null;
        state.coins[actorId] = coins - 7;
        this.loseInfluence(room, state, targetId);
        this.checkWinner(room, state);
        if ((state.phase as string) === CoupPhase.RESULT) return room;
        break;
      }
      default:
        return null;
    }

    if ((state.phase as string) !== CoupPhase.RESULT) {
      this.advanceTurn(room, state);
    }
    return room;
  }

  handlePlayerDisconnect(room: RoomState, socketId: string): void {}
}
