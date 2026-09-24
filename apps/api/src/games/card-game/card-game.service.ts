import { Injectable } from '@nestjs/common';
import {
  CardDecision,
  CardGameAction,
  CardGameConfig,
  CardGameLogEntry,
  CardGameLogKind,
  CardGamePreset,
  CardGamePrivateState,
  CardGamePublicState,
  DeckPolicy,
  GameType,
  PlayingCard,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import {
  PileStacks,
  autoActionFor,
  createDeck as buildDeck,
  dealRound,
  drawFromStacks,
  mod10Score,
  resolveStarter,
  settleMod10Showdown,
  shuffleDeck,
  toPublicState,
  validateConfig,
} from './card-engine.service';
import { POK_DENG_PRESET } from './presets/pok-deng.preset';
import { CARD_GAME_PRESETS, presetForConfig } from './presets';
import { SlaveRuntime } from './slave.runtime';

const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const PILES_KEY = 'piles';

interface CardRuntimeAdapter {
  startRound(room: RoomState, config: CardGameConfig, playerIds: string[]): RoomState | null;
  handleAction(
    room: RoomState,
    socketId: string,
    action: CardGameAction,
    config: CardGameConfig,
  ): RoomState | null;
  /** The action the server takes on the active player's behalf when their deadline expires. */
  autoAction(room: RoomState, socketId: string, config: CardGameConfig): CardGameAction;
}

@Injectable()
export class CardGameService {
  private readonly cardRuntimes: Partial<Record<CardGamePreset, CardRuntimeAdapter>>;

  constructor(private readonly privateStateService: PrivateStateService) {
    this.cardRuntimes = {
      SLAVE: new SlaveRuntime(privateStateService),
    };
  }

  startCardRound(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.CARD_GAME || room.roomHostId !== requesterId) return null;
    if (room.status !== RoomStatus.LOBBY && room.status !== RoomStatus.RESULT) return null;
    const presetId = room.cardGameConfig?.preset ?? 'POK_DENG';
    const runtime = this.cardRuntimes[presetId];
    if (runtime) {
      const preset = CARD_GAME_PRESETS[presetId];
      const players = room.players.filter(
        (player) => !player.isViewer && player.connected !== false,
      );
      if (players.length < preset.minPlayers || players.length > preset.maxPlayers) return null;
      const started = runtime.startRound(
        room,
        this.configFor(room),
        players.map((player) => player.socketId),
      );
      if (started) {
        room.cardGameLog = [];
        this.refreshTurnDeadline(room);
      }
      return started;
    }
    const startedPokDeng = this.startPokDeng(room, requesterId);
    if (startedPokDeng) room.cardGameLog = [];
    return startedPokDeng;
  }

  startPokDeng(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.CARD_GAME || room.roomHostId !== requesterId) return null;
    const players = room.players.filter((player) => !player.isViewer && player.connected !== false);
    if (players.length < POK_DENG_PRESET.minPlayers || players.length > POK_DENG_PRESET.maxPlayers)
      return null;

    const config = this.configFor(room);
    const playerOrder = players.map((player) => player.socketId);
    const dealerId =
      resolveStarter(config.deal.starterPolicy, {
        playerOrder,
        previousStarterId: room.cardGameState?.dealerId,
        previousWinnerId: room.cardGameState?.result?.winnerIds[0],
      }) ?? playerOrder[0];

    const dealt = dealRound(
      this.shuffle(this.createDeck(config.deck)),
      playerOrder,
      config.deal,
      config.piles.reserveSize,
    );
    if (!dealt.ok || !dealt.hands) return null;
    const hands = dealt.hands;
    this.setPiles(room.code, {
      stock: dealt.stock ?? [],
      discards: [],
      reserve: dealt.reserve ?? [],
    });

    const chipBalances = room.cardGameChips ?? {};
    room.cardGameChips = chipBalances;
    for (const id of playerOrder) {
      chipBalances[id] = chipBalances[id] ?? config.scoring.startingChips;
    }

    const decisions: Record<string, CardDecision> = {};
    for (const id of playerOrder) {
      const natural = mod10Score(hands[id]) >= 8;
      decisions[id] = id === dealerId || natural ? 'NATURAL' : 'PENDING';
      this.setHand(room.code, id, hands[id]);
    }

    room.cardGameState = toPublicState(
      {
        preset: POK_DENG_PRESET.id,
        phase: 'PLAYER_TURNS',
        dealerId,
        activePlayerId: null,
        playerOrder,
        hands,
        chips: Object.fromEntries(playerOrder.map((id) => [id, chipBalances[id]])),
        decisions,
      },
      config.visibility,
    );
    room.status = RoomStatus.PLAYING;

    // House rule (D5): a dealer natural (8 or 9) resolves the round immediately.
    if (mod10Score(hands[dealerId]) >= 8) {
      this.resolve(room, config);
      return room;
    }

    this.advance(room);
    return room;
  }

  handleAction(room: RoomState, socketId: string, action: CardGameAction): RoomState | null {
    const state = room.cardGameState;
    if (!state || room.gameType !== GameType.CARD_GAME) return null;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return null;
    const presetId = room.cardGameConfig?.preset ?? 'POK_DENG';
    const runtime = this.cardRuntimes[presetId];
    if (runtime) {
      if (action.type === 'NEXT_ROUND') {
        if (state.phase !== 'RESULT' || socketId !== room.roomHostId) return null;
        return this.startCardRound(room, room.roomHostId);
      }
      const handled = runtime.handleAction(room, socketId, action, this.configFor(room));
      if (handled) {
        // A draw can end the round without drawing (empty stock) — do not log it.
        const exhaustedDraw =
          action.type === 'DRAW' && room.cardGameState?.decisions[socketId] === 'PENDING';
        if (!exhaustedDraw) this.appendLog(room, socketId, action);
        this.refreshTurnDeadline(room);
      }
      return handled;
    }
    if (action.type === 'NEXT_ROUND') {
      if (state.phase !== 'RESULT' || socketId !== room.roomHostId) return null;
      return this.startPokDeng(room, room.roomHostId);
    }
    if (room.status !== RoomStatus.PLAYING) return null;
    if (state.phase !== 'PLAYER_TURNS' || state.activePlayerId !== socketId) return null;

    const config = this.configFor(room);
    if (!config.actions.allowed.includes(action.type)) return null;
    const hand = this.getHand(room.code, socketId);
    if (!hand) return null;

    if (action.type === 'DRAW') {
      const drawn = drawFromStacks(this.pilesFor(room.code), config.piles);
      if (!drawn.ok || !drawn.card) {
        this.resolve(room, config);
        return room;
      }
      this.setPiles(room.code, drawn.stacks);
      hand.push(drawn.card);
      this.setHand(room.code, socketId, hand);
      state.handCounts[socketId] = hand.length;
      state.decisions[socketId] = 'DRAWN';
    } else {
      state.decisions[socketId] = 'STAND';
    }
    this.appendLog(room, socketId, action);
    this.advance(room);
    return room;
  }

  cancelRound(room: RoomState): void {
    const state = room.cardGameState;
    if (!state || room.gameType !== GameType.CARD_GAME) return;
    for (const socketId of state.playerOrder) {
      this.privateStateService.delete(room.code, socketId, PRIVATE_KEY);
    }
    this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, PILES_KEY);
    room.cardGameState = undefined;
    room.status = RoomStatus.LOBBY;
  }

  remapSocketId(state: CardGamePublicState, oldSocketId: string, newSocketId: string): void {
    if (state.dealerId === oldSocketId) state.dealerId = newSocketId;
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    state.handCounts = this.remapRecord(state.handCounts, oldSocketId, newSocketId);
    state.chips = this.remapRecord(state.chips, oldSocketId, newSocketId);
    state.decisions = this.remapRecord(state.decisions, oldSocketId, newSocketId);
    if (state.trick) {
      if (state.trick.leaderId === oldSocketId) state.trick.leaderId = newSocketId;
      if (state.trick.playedById === oldSocketId) state.trick.playedById = newSocketId;
      state.trick.passIds = state.trick.passIds.map((id) =>
        id === oldSocketId ? newSocketId : id,
      );
    }
    if (state.result) {
      state.result.playerScores = this.remapRecord(
        state.result.playerScores,
        oldSocketId,
        newSocketId,
      );
      state.result.outcomeTags = this.remapRecord(
        state.result.outcomeTags,
        oldSocketId,
        newSocketId,
      );
      state.result.winnerIds = state.result.winnerIds.map((id) =>
        id === oldSocketId ? newSocketId : id,
      );
      state.result.revealedHands = this.remapRecord(
        state.result.revealedHands,
        oldSocketId,
        newSocketId,
      );
      if (state.result.placements) {
        state.result.placements = state.result.placements.map((id) =>
          id === oldSocketId ? newSocketId : id,
        );
      }
    }
  }

  private appendLog(room: RoomState, socketId: string, action: CardGameAction): void {
    const kinds: Partial<Record<CardGameAction['type'], CardGameLogKind>> = {
      DRAW: 'DREW',
      STAND: 'STOOD',
      PLAY: 'PLAYED',
      PASS: 'PASSED',
      CLAIM: 'CLAIMED',
      DISCARD: 'DISCARDED',
      TAKE_CARD: 'TOOK',
    };
    const kind = kinds[action.type];
    if (!kind) return;
    const log = room.cardGameLog ?? [];
    const entry: CardGameLogEntry = { actorId: socketId, kind };
    if (action.type === 'PLAY') entry.count = action.cards.length;
    log.push(entry);
    if (log.length > 40) log.splice(0, log.length - 40);
    room.cardGameLog = log;
  }

  private configFor(room: RoomState): CardGameConfig {
    const preset = presetForConfig(room.cardGameConfig);
    const validated = validateConfig(room.cardGameConfig, preset);
    return validated.config ?? preset.defaultConfig;
  }

  /**
   * One place arms (or clears) the public turn deadline for both presets, so the
   * gateway auto-action timer applies to every card game turn the same way.
   */
  private refreshTurnDeadline(room: RoomState): void {
    const state = room.cardGameState;
    if (!state) return;
    if (state.phase !== 'PLAYER_TURNS' || !state.activePlayerId) {
      state.turnDeadline = null;
      return;
    }
    const { timeoutSeconds } = this.configFor(room).actions;
    state.turnDeadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : null;
  }

  /** The action the server takes for the active player when their deadline expires. */
  resolveAutoAction(room: RoomState): { playerId: string; action: CardGameAction } | null {
    const state = room.cardGameState;
    if (!state || state.phase !== 'PLAYER_TURNS' || !state.activePlayerId) return null;
    const config = this.configFor(room);
    const runtime = this.cardRuntimes[state.preset];
    const action = runtime
      ? runtime.autoAction(room, state.activePlayerId, config)
      : autoActionFor(config.actions);
    return action ? { playerId: state.activePlayerId, action } : null;
  }

  private advance(room: RoomState): void {
    const state = room.cardGameState!;
    const config = this.configFor(room);
    const next = state.playerOrder.find(
      (id) => id !== state.dealerId && state.decisions[id] === 'PENDING',
    );
    if (next) {
      state.activePlayerId = next;
      this.refreshTurnDeadline(room);
      return;
    }

    const dealerHand = this.getHand(room.code, state.dealerId) ?? [];
    if (mod10Score(dealerHand) < 5) {
      const drawn = drawFromStacks(this.pilesFor(room.code), config.piles);
      if (drawn.ok && drawn.card) {
        dealerHand.push(drawn.card);
        this.setHand(room.code, state.dealerId, dealerHand);
        this.setPiles(room.code, drawn.stacks);
        state.handCounts[state.dealerId] = dealerHand.length;
      }
    }
    this.resolve(room, config);
  }

  private resolve(room: RoomState, config: CardGameConfig): void {
    const state = room.cardGameState!;
    const hands: Record<string, PlayingCard[]> = {};
    for (const id of state.playerOrder) hands[id] = this.getHand(room.code, id) ?? [];

    const outcome = settleMod10Showdown({
      playerOrder: state.playerOrder,
      dealerId: state.dealerId,
      hands,
      tiePolicy: config.scoring.tiePolicy,
      baseStake: config.scoring.baseStake,
      multipliers: config.scoring.multipliers,
    });

    const chips: Record<string, number> = { ...state.chips };
    for (const id of state.playerOrder) {
      chips[id] = (chips[id] ?? 0) + (outcome.deltas[id] ?? 0);
    }
    room.cardGameChips = { ...room.cardGameChips, ...chips };

    room.cardGameState = toPublicState(
      {
        preset: POK_DENG_PRESET.id,
        phase: 'RESULT',
        dealerId: state.dealerId,
        activePlayerId: null,
        playerOrder: state.playerOrder,
        hands,
        chips,
        decisions: state.decisions,
        result: {
          dealerScore: outcome.dealerScore,
          playerScores: outcome.scores,
          outcomeTags: outcome.outcomeTags,
          winnerIds: outcome.winnerIds,
          revealedHands: outcome.revealedHands,
        },
      },
      config.visibility,
    );
    room.status = RoomStatus.RESULT;
  }

  private createDeck(policy: DeckPolicy): PlayingCard[] {
    return buildDeck(policy);
  }

  private shuffle(deck: PlayingCard[]): PlayingCard[] {
    return shuffleDeck(deck);
  }

  private setHand(roomCode: string, socketId: string, hand: PlayingCard[]): void {
    this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
      preset: 'POK_DENG',
      hand,
    } satisfies CardGamePrivateState);
  }

  private getHand(roomCode: string, socketId: string): PlayingCard[] | undefined {
    return this.privateStateService.get<CardGamePrivateState>(roomCode, socketId, PRIVATE_KEY)
      ?.hand;
  }

  private setPiles(roomCode: string, piles: PileStacks): void {
    this.privateStateService.set(roomCode, ENGINE_SOCKET_ID, PILES_KEY, piles);
  }

  private pilesFor(roomCode: string): PileStacks {
    return (
      this.privateStateService.get<PileStacks>(roomCode, ENGINE_SOCKET_ID, PILES_KEY) ?? {
        stock: [],
        discards: [],
        reserve: [],
      }
    );
  }

  private remapRecord<T>(
    record: Record<string, T>,
    oldKey: string,
    newKey: string,
  ): Record<string, T> {
    if (!(oldKey in record)) return record;
    const { [oldKey]: value, ...remaining } = record;
    return { ...remaining, [newKey]: value };
  }
}
