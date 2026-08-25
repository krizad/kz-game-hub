import { Injectable, Logger } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  SaboteurState,
  SaboteurPhase,
  SaboteurRole,
  SaboteurTool,
  SaboteurActionKind,
  SaboteurPlayerState,
  SaboteurGoalContent,
  SaboteurCardDef,
  SaboteurBoardCell,
  SABOTEUR_DRAW_CARDS,
  SABOTEUR_START_CARD,
  SABOTEUR_GOAL_CARD,
  SABOTEUR_GOLD_DECK,
  SABOTEUR_ROLE_TABLE,
  SABOTEUR_HAND_SIZE_TABLE,
  SABOTEUR_TOTAL_ROUNDS,
  SABOTEUR_START_POS,
  SABOTEUR_GOAL_POSITIONS,
  saboteurCellKey,
  saboteurSimulatePlacement,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';

const ROOM_KEY = '__room__';
const SB_ROLE = 'sbRole';
const SB_HAND = 'sbHand';
const SB_PEEKED = 'sbPeekedGoals';
const SB_ROOM_DECK = 'sbRoomDeck';
const SB_ROOM_GOLD_DECK = 'sbRoomGoldDeck';
const SB_ROOM_GOALS = 'sbRoomGoals';
const SB_ROOM_LEFTOVER_ROLE = 'sbRoomLeftoverRole';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;

interface HandCard {
  cardId: string;
}

@Injectable()
export class SaboteurService {
  private readonly logger = new Logger(SaboteurService.name);

  constructor(private readonly privateState: PrivateStateService) {}

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Private state accessors ----------

  private getRole(room: RoomState, socketId: string): SaboteurRole | undefined {
    return this.privateState.get<SaboteurRole>(room.code, socketId, SB_ROLE);
  }

  private setRole(room: RoomState, socketId: string, role: SaboteurRole): void {
    this.privateState.set(room.code, socketId, SB_ROLE, role);
  }

  private getHand(room: RoomState, socketId: string): HandCard[] {
    return this.privateState.get<HandCard[]>(room.code, socketId, SB_HAND) ?? [];
  }

  private setHand(room: RoomState, socketId: string, hand: HandCard[]): void {
    if (hand.length === 0) {
      this.privateState.delete(room.code, socketId, SB_HAND);
    } else {
      this.privateState.set(room.code, socketId, SB_HAND, hand);
    }
  }

  private getPeekedGoals(room: RoomState, socketId: string): Record<string, SaboteurGoalContent> {
    return (
      this.privateState.get<Record<string, SaboteurGoalContent>>(room.code, socketId, SB_PEEKED) ??
      {}
    );
  }

  private getDeck(room: RoomState): string[] {
    return this.privateState.get<string[]>(room.code, ROOM_KEY, SB_ROOM_DECK) ?? [];
  }

  private setDeck(room: RoomState, deck: string[]): void {
    this.privateState.set(room.code, ROOM_KEY, SB_ROOM_DECK, deck);
  }

  private getGoldDeck(room: RoomState): number[] {
    return this.privateState.get<number[]>(room.code, ROOM_KEY, SB_ROOM_GOLD_DECK) ?? [];
  }

  private setGoldDeck(room: RoomState, goldDeck: number[]): void {
    this.privateState.set(room.code, ROOM_KEY, SB_ROOM_GOLD_DECK, goldDeck);
  }

  /** Goal contents aligned with SABOTEUR_GOAL_POSITIONS. Server-only. */
  private getGoalContents(room: RoomState): SaboteurGoalContent[] {
    return (
      this.privateState.get<SaboteurGoalContent[]>(room.code, ROOM_KEY, SB_ROOM_GOALS) ?? [
        'STONE',
        'STONE',
        'STONE',
      ]
    );
  }

  private setGoalContents(room: RoomState, contents: SaboteurGoalContent[]): void {
    this.privateState.set(room.code, ROOM_KEY, SB_ROOM_GOALS, contents);
  }

  private clearRoundPrivateData(room: RoomState): void {
    for (const p of room.players) {
      this.privateState.delete(room.code, p.socketId, SB_ROLE);
      this.privateState.delete(room.code, p.socketId, SB_HAND);
      this.privateState.delete(room.code, p.socketId, SB_PEEKED);
    }
    this.privateState.delete(room.code, ROOM_KEY, SB_ROOM_DECK);
    this.privateState.delete(room.code, ROOM_KEY, SB_ROOM_LEFTOVER_ROLE);
  }

  // ---------- Deck / round setup ----------

  private buildDrawPile(): string[] {
    const pile: string[] = [];
    for (const def of SABOTEUR_DRAW_CARDS) {
      for (let i = 0; i < def.quantity; i++) pile.push(def.id);
    }
    return this.shuffleArray(pile);
  }

  private isMember(room: RoomState, socketId: string): boolean {
    return room.players.some((p) => p.socketId === socketId);
  }

  private drawCard(room: RoomState, socketId: string): void {
    const state = room.saboteurState!;
    const deck = this.getDeck(room);
    const card = deck.pop();
    this.setDeck(room, deck);
    state.stockCount = deck.length;
    if (!card) return;
    const hand = this.getHand(room, socketId);
    hand.push({ cardId: card });
    this.setHand(room, socketId, hand);
  }

  private syncHandSizes(room: RoomState): void {
    const state = room.saboteurState!;
    for (const [socketId, player] of Object.entries(state.players)) {
      player.handSize = this.getHand(room, socketId).length;
    }
  }

  private connectedPlayerIds(room: RoomState): string[] {
    return room.players.filter((p) => p.connected !== false).map((p) => p.socketId);
  }

  /** Deal roles for one round using the official role table (+1 secret leftover).
   * Physical deck: 7 MINER + 4 SABOTEUR cards for up to 10 players. */
  private assignRoles(room: RoomState, playerIds: string[]): void {
    const saboteurCount = SABOTEUR_ROLE_TABLE[playerIds.length] ?? Math.floor(playerIds.length / 3);
    const shuffled = this.shuffleArray(playerIds);
    const saboteurs = new Set(shuffled.slice(0, saboteurCount));

    const undealtCount = 11 - playerIds.length;
    const undealtSaboteurs = 4 - saboteurCount;
    const leftoverSaboteur = undealtCount > 0 && Math.random() < undealtSaboteurs / undealtCount;
    this.privateState.set(
      room.code,
      ROOM_KEY,
      SB_ROOM_LEFTOVER_ROLE,
      leftoverSaboteur ? SaboteurRole.SABOTEUR : SaboteurRole.MINER,
    );

    for (const id of playerIds) {
      this.setRole(room, id, saboteurs.has(id) ? SaboteurRole.SABOTEUR : SaboteurRole.MINER);
    }
  }

  private buildInitialBoard(): Record<string, SaboteurBoardCell> {
    const board: Record<string, SaboteurBoardCell> = {};
    board[saboteurCellKey(SABOTEUR_START_POS.x, SABOTEUR_START_POS.y)] = {
      cardId: SABOTEUR_START_CARD.id,
      rotation: 0,
    };
    for (const goal of SABOTEUR_GOAL_POSITIONS) {
      board[saboteurCellKey(goal.x, goal.y)] = { cardId: SABOTEUR_GOAL_CARD.id, rotation: 0 };
    }
    return board;
  }

  private initPlayers(
    room: RoomState,
    turnOrder: string[],
    handSize: number,
    prevScores: Record<string, number>,
  ): Record<string, SaboteurPlayerState> {
    const players: Record<string, SaboteurPlayerState> = {};
    for (const id of turnOrder) {
      players[id] = {
        id,
        score: prevScores[id] ?? 0,
        handSize,
        brokenTools: [],
      };
      this.setHand(room, id, []);
    }
    return players;
  }

  /** Start a round: fresh board, goals, deck, hands and roles. */
  private startRound(room: RoomState, roundNumber: number): void {
    const turnOrder = this.connectedPlayerIds(room);
    const handSize = SABOTEUR_HAND_SIZE_TABLE[turnOrder.length] ?? 4;

    // Preserve cumulative scores across rounds before wiping state.
    const prevScores: Record<string, number> = {};
    for (const [id, p] of Object.entries(room.saboteurState?.players ?? {})) {
      prevScores[id] = p.score;
    }

    this.clearRoundPrivateData(room);
    this.assignRoles(room, turnOrder);

    const goldContents: SaboteurGoalContent[] = this.shuffleArray([
      'GOLD',
      'STONE',
      'STONE',
    ] as SaboteurGoalContent[]);
    this.setGoalContents(room, goldContents);

    const deck = this.buildDrawPile();
    this.setDeck(room, deck);
    if (this.getGoldDeck(room).length === 0) {
      this.setGoldDeck(room, this.shuffleArray(SABOTEUR_GOLD_DECK));
    }

    const starterIndex = (roundNumber - 1) % Math.max(turnOrder.length, 1);

    room.saboteurState = {
      currentPhase: SaboteurPhase.PLAYING,
      round: roundNumber,
      activePlayerId: turnOrder[starterIndex] ?? null,
      turnOrder,
      board: this.buildInitialBoard(),
      goalCells: SABOTEUR_GOAL_POSITIONS.map((g) => ({ x: g.x, y: g.y })),
      revealedGoals: [null, null, null],
      stockCount: deck.length,
      players: {},
      lastAction: null,
      roundResult: null,
      finalResults: null,
    };

    room.saboteurState.players = this.initPlayers(room, turnOrder, handSize, prevScores);
    for (const id of turnOrder) {
      for (let i = 0; i < handSize; i++) this.drawCard(room, id);
    }
    this.syncHandSizes(room);
  }

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;
    const connected = this.connectedPlayerIds(room);
    if (connected.length < MIN_PLAYERS || connected.length > MAX_PLAYERS) return null;

    this.setGoldDeck(room, this.shuffleArray(SABOTEUR_GOLD_DECK));
    this.startRound(room, 1);

    room.status = RoomStatus.PLAYING;
    return room;
  }

  // ---------- Turn flow ----------

  private advanceTurn(room: RoomState): void {
    const state = room.saboteurState!;
    const order = state.turnOrder;
    if (order.length === 0) return;
    const activeIds = new Set(this.connectedPlayerIds(room));

    // Once the stock is dry, players with empty hands have no legal action
    // (official rules: the round continues through whoever still holds cards).
    const deckDry = this.getDeck(room).length === 0 && state.stockCount === 0;
    const canAct = (id: string): boolean => {
      if (!deckDry) return true;
      return (state.players[id]?.handSize ?? 0) > 0;
    };

    const idx = order.indexOf(state.activePlayerId ?? order[0]);
    let fallback: string | null = null;
    for (let step = 1; step <= order.length; step++) {
      const candidate = order[(idx + step) % order.length];
      if (!activeIds.has(candidate)) continue;
      if (canAct(candidate)) {
        state.activePlayerId = candidate;
        return;
      }
      if (fallback === null) fallback = candidate;
    }
    // Nobody can act (safety net): park the turn; the next resolution ends the round.
    if (fallback) {
      state.activePlayerId = fallback;
      this.checkExhaustionEnd(room);
    }
  }

  private checkExhaustionEnd(room: RoomState): boolean {
    const state = room.saboteurState!;
    if (state.currentPhase !== SaboteurPhase.PLAYING) return false;
    const deckEmpty = this.getDeck(room).length === 0 && state.stockCount === 0;
    const handsEmpty = Object.values(state.players).every((p) => p.handSize === 0);
    if (!deckEmpty || !handsEmpty) return false;

    this.endRoundSaboteursWin(room);
    return true;
  }

  // ---------- Actions ----------

  placePath(
    room: RoomState,
    playerId: string,
    cardIndex: number,
    x: number,
    y: number,
    rotation: 0 | 180,
  ): RoomState | null {
    const state = room.saboteurState;
    if (!state || state.currentPhase !== SaboteurPhase.PLAYING) return null;
    if (state.activePlayerId !== playerId || !this.isMember(room, playerId)) return null;

    const hand = this.getHand(room, playerId);
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) return null;
    const cardId = hand[cardIndex].cardId;
    const def = SABOTEUR_DRAW_CARDS.find((d) => d.id === cardId);
    if (!def || def.kind !== 'PATH') return null;

    const player = state.players[playerId];
    if (!player || player.brokenTools.length > 0) return null;

    const check = saboteurSimulatePlacement(state.board, x, y, cardId, rotation);
    if (!check.valid) return null;

    hand.splice(cardIndex, 1);
    this.setHand(room, playerId, hand);
    state.board[saboteurCellKey(x, y)] = { cardId, rotation };
    state.lastAction = { playerId, kind: 'PLACE', detail: `${cardId}@${x},${y}` };

    return this.afterPlayResolved(room, playerId, check.revealedGoalKeys);
  }

  playAction(
    room: RoomState,
    playerId: string,
    payload: {
      cardIndex: number;
      targetPlayerId?: string;
      repairTool?: SaboteurTool;
      goalIndex?: number;
      targetX?: number;
      targetY?: number;
    },
  ): RoomState | null {
    const state = room.saboteurState;
    if (!state || state.currentPhase !== SaboteurPhase.PLAYING) return null;
    if (state.activePlayerId !== playerId || !this.isMember(room, playerId)) return null;

    const hand = this.getHand(room, playerId);
    const { cardIndex } = payload;
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) return null;
    const cardId = hand[cardIndex].cardId;
    const def = SABOTEUR_DRAW_CARDS.find((d) => d.id === cardId);
    if (!def || def.kind !== 'ACTION' || !def.action) return null;

    const ok = this.applyAction(room, playerId, def, payload);
    if (!ok) return null;

    hand.splice(cardIndex, 1);
    this.setHand(room, playerId, hand);
    this.drawCard(room, playerId);
    this.syncHandSizes(room);
    state.lastAction = { playerId, kind: 'ACTION', detail: cardId };

    if (this.checkExhaustionEnd(room)) return room;
    this.advanceTurn(room);
    return room;
  }

  private applyAction(
    room: RoomState,
    playerId: string,
    def: SaboteurCardDef,
    payload: {
      targetPlayerId?: string;
      repairTool?: SaboteurTool;
      goalIndex?: number;
      targetX?: number;
      targetY?: number;
    },
  ): boolean {
    const state = room.saboteurState!;
    const action = def.action!;

    switch (action.kind) {
      case SaboteurActionKind.BREAK: {
        const tool = action.tools![0];
        const target = payload.targetPlayerId ? state.players[payload.targetPlayerId] : undefined;
        if (!target) return false;
        if (target.brokenTools.includes(tool)) return false;
        target.brokenTools.push(tool);
        return true;
      }
      case SaboteurActionKind.REPAIR: {
        const target = payload.targetPlayerId ? state.players[payload.targetPlayerId] : undefined;
        if (!target) return false;
        const eligible = action.tools!.filter((t) => target.brokenTools.includes(t));
        if (eligible.length === 0) return false;
        const chosen =
          payload.repairTool && eligible.includes(payload.repairTool)
            ? payload.repairTool
            : eligible[0];
        target.brokenTools = target.brokenTools.filter((t) => t !== chosen);
        return true;
      }
      case SaboteurActionKind.MAP: {
        const goalIndex = payload.goalIndex;
        if (!Number.isInteger(goalIndex) || goalIndex! < 0 || goalIndex! > 2) return false;
        const contents = this.getGoalContents(room);
        const peeked = this.getPeekedGoals(room, playerId);
        peeked[String(goalIndex)] = contents[goalIndex!] ?? 'STONE';
        this.privateState.set(room.code, playerId, SB_PEEKED, peeked);
        return true;
      }
      case SaboteurActionKind.ROCKFALL: {
        const { targetX, targetY } = payload;
        if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) return false;
        const key = saboteurCellKey(targetX!, targetY!);
        const cell = state.board[key];
        if (!cell) return false;
        if (cell.cardId === SABOTEUR_START_CARD.id || cell.cardId === SABOTEUR_GOAL_CARD.id) {
          return false;
        }
        delete state.board[key];
        return true;
      }
      default:
        return false;
    }
  }

  discard(room: RoomState, playerId: string, cardIndex: number): RoomState | null {
    const state = room.saboteurState;
    if (!state || state.currentPhase !== SaboteurPhase.PLAYING) return null;
    if (state.activePlayerId !== playerId || !this.isMember(room, playerId)) return null;

    const hand = this.getHand(room, playerId);
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) return null;

    hand.splice(cardIndex, 1);
    this.setHand(room, playerId, hand);
    this.drawCard(room, playerId);
    this.syncHandSizes(room);
    state.lastAction = { playerId, kind: 'DISCARD' };

    if (this.checkExhaustionEnd(room)) return room;
    this.advanceTurn(room);
    return room;
  }

  /** Timer expiry: skip the active player's turn without playing or drawing. */
  autoPass(room: RoomState, playerId: string): RoomState | null {
    const state = room.saboteurState;
    if (!state || state.currentPhase !== SaboteurPhase.PLAYING) return null;
    if (state.activePlayerId !== playerId) return null;

    state.lastAction = { playerId, kind: 'PASS' };
    this.advanceTurn(room);
    return room;
  }

  // ---------- Round resolution ----------

  private afterPlayResolved(
    room: RoomState,
    playerId: string,
    revealedGoalKeys: string[],
  ): RoomState | null {
    const state = room.saboteurState!;
    this.drawCard(room, playerId);
    this.syncHandSizes(room);

    const contents = this.getGoalContents(room);
    let goldGoalIndex: number | null = null;
    for (const key of revealedGoalKeys) {
      const idx = state.goalCells.findIndex((g) => saboteurCellKey(g.x, g.y) === key);
      if (idx === -1) continue;
      if (state.revealedGoals[idx] === null) {
        state.revealedGoals[idx] = contents[idx] ?? 'STONE';
      }
      if (state.revealedGoals[idx] === 'GOLD') {
        goldGoalIndex = idx;
        break;
      }
    }

    if (goldGoalIndex !== null) {
      this.beginGoldPick(room, playerId, goldGoalIndex);
      return room;
    }

    if (this.checkExhaustionEnd(room)) return room;
    this.advanceTurn(room);
    return room;
  }

  private beginGoldPick(room: RoomState, finderId: string, revealedGoalIndex: number): void {
    const state = room.saboteurState!;
    const miners = state.turnOrder.filter((id) => this.getRole(room, id) === SaboteurRole.MINER);

    // Counter-clockwise picking order starting at the finder.
    const reverseOrder = [...state.turnOrder].reverse();
    const finderIdx = reverseOrder.indexOf(finderId);
    const pickOrder: string[] = [];
    for (let i = 0; i < reverseOrder.length; i++) {
      const id = reverseOrder[(finderIdx + i) % reverseOrder.length];
      if (miners.includes(id)) pickOrder.push(id);
    }

    const goldDeck = this.getGoldDeck(room);
    const goldPool: number[] = [];
    for (let i = 0; i < miners.length; i++) {
      const value = goldDeck.pop();
      if (value === undefined) break;
      goldPool.push(value);
    }
    this.setGoldDeck(room, goldDeck);

    state.currentPhase = SaboteurPhase.GOLD_PICK;
    state.roundResult = {
      winnerRole: SaboteurRole.MINER,
      revealedGoalIndex,
      goldPool,
      pickOrder,
      currentPickerId: pickOrder[0] ?? null,
      picks: {},
    };
  }

  pickGold(room: RoomState, playerId: string, poolIndex: number): RoomState | null {
    const state = room.saboteurState;
    if (!state || state.currentPhase !== SaboteurPhase.GOLD_PICK) return null;
    const result = state.roundResult;
    if (!result || result.currentPickerId !== playerId) return null;
    const pool = result.goldPool ?? [];
    if (!Number.isInteger(poolIndex) || poolIndex < 0 || poolIndex >= pool.length) return null;
    if (pool[poolIndex] < 0) return null; // already taken (marked negative)

    const value = pool[poolIndex];
    pool[poolIndex] = -value; // mark taken
    result.picks = { ...(result.picks ?? {}), [playerId]: value };

    const player = state.players[playerId];
    if (player) player.score += value;

    const remaining = (result.pickOrder ?? []).filter((id) => result.picks![id] === undefined);
    result.currentPickerId = remaining[0] ?? null;

    if (!result.currentPickerId) {
      this.finalizeRound(room);
    }
    return room;
  }

  private endRoundSaboteursWin(room: RoomState): void {
    const state = room.saboteurState!;
    const saboteurs = state.turnOrder.filter(
      (id) => this.getRole(room, id) === SaboteurRole.SABOTEUR,
    );
    const bonus = saboteurs.length === 1 ? 4 : 3;

    state.currentPhase = SaboteurPhase.ROUND_END;
    state.roundResult = {
      winnerRole: SaboteurRole.SABOTEUR,
      revealedGoalIndex: null,
      saboteurBonus: bonus,
    };
    for (const id of saboteurs) {
      const player = state.players[id];
      if (player) player.score += bonus;
    }
    this.finalizeRound(room);
  }

  /** Reveal all roles and sync scores into RoomState players. */
  private finalizeRound(room: RoomState): void {
    const state = room.saboteurState!;
    state.currentPhase = SaboteurPhase.ROUND_END;

    for (const [socketId, player] of Object.entries(state.players)) {
      player.role = this.getRole(room, socketId);
      const roomPlayer = room.players.find((rp) => rp.socketId === socketId);
      if (roomPlayer) roomPlayer.score = player.score;
    }
  }

  nextRound(room: RoomState, requesterId: string): RoomState | null {
    const state = room.saboteurState;
    if (!state || state.currentPhase !== SaboteurPhase.ROUND_END) return null;
    if (room.roomHostId !== requesterId) return null;

    if (state.round >= SABOTEUR_TOTAL_ROUNDS) {
      const scores: Record<string, number> = {};
      let best = -Infinity;
      for (const [id, p] of Object.entries(state.players)) {
        scores[id] = p.score;
        if (p.score > best) best = p.score;
      }
      state.currentPhase = SaboteurPhase.GAME_OVER;
      state.finalResults = {
        scores,
        winnerIds: Object.keys(scores).filter((id) => scores[id] === best),
      };
      return room;
    }

    const nextRoundNumber = state.round + 1;
    this.startRound(room, nextRoundNumber);
    return room;
  }

  reset(room: RoomState, requesterId: string): RoomState | null {
    if (!room.saboteurState) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.saboteurState = undefined;
    this.privateState.clearRoom(room.code);
    room.players.forEach((p) => {
      p.score = 0;
    });
    return room;
  }

  // ---------- Reconnection ----------

  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    const state = room.saboteurState;
    if (!state) return;

    if (state.currentPhase === SaboteurPhase.PLAYING && state.activePlayerId === socketId) {
      this.advanceTurn(room);
      return;
    }

    if (state.currentPhase === SaboteurPhase.GOLD_PICK) {
      const result = state.roundResult;
      if (result && result.currentPickerId === socketId) {
        result.pickOrder = (result.pickOrder ?? []).filter((id) => id !== socketId);
        const remaining = (result.pickOrder ?? []).filter((id) => result.picks?.[id] === undefined);
        result.currentPickerId = remaining[0] ?? null;
        if (!result.currentPickerId) {
          this.finalizeRound(room);
        }
      }
    }
  }

  /** Re-point every socket-id reference to the new socket id on reconnection. */
  remapSocketId(state: SaboteurState, oldSocketId: string, newSocketId: string): void {
    if (state.players[oldSocketId]) {
      state.players[newSocketId] = { ...state.players[oldSocketId], id: newSocketId };
      delete state.players[oldSocketId];
    }
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    state.turnOrder = state.turnOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    if (state.roundResult) {
      if (state.roundResult.currentPickerId === oldSocketId) {
        state.roundResult.currentPickerId = newSocketId;
      }
      if (state.roundResult.pickOrder) {
        state.roundResult.pickOrder = state.roundResult.pickOrder.map((id) =>
          id === oldSocketId ? newSocketId : id,
        );
      }
      if (state.roundResult.picks && state.roundResult.picks[oldSocketId] !== undefined) {
        state.roundResult.picks[newSocketId] = state.roundResult.picks[oldSocketId];
        delete state.roundResult.picks[oldSocketId];
      }
    }
  }
}
