import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DogRelayAction,
  DogRelayPair,
  DogRelayPhase,
  DogRelayPrivateState,
  DogRelayPublicState,
  DogRelayRole,
  RoomState,
  RoomStatus,
  GameType,
  DOG_RELAY_CARDS,
  DOG_RELAY_MIN_PLAYERS,
  DOG_RELAY_MAX_PLAYERS,
  DOG_RELAY_DISCUSSION_MS,
  DOG_RELAY_COUNTDOWN_MS,
  DOG_RELAY_RECONNECT_MS,
  DOG_RELAY_PRIVATE_STATE_KEY,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { isDogRelayPairCorrect, resolveDogRelayWinner } from './dog-relay.rules';

type CancellationReason = NonNullable<DogRelayPublicState['cancellationReason']>;
export interface DogRelaySecrets {
  roundId: string;
  roles: Record<string, DogRelayRole>;
  truePair: DogRelayPair;
  candidateIds: string[];
  ballots: Record<string, string>;
}
export class DogRelayDomainError extends Error {}
function requireRule(valid: unknown, code: string): asserts valid {
  if (!valid) throw new DogRelayDomainError(`DOG_RELAY_${code}`);
}
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class DogRelayService {
  constructor(private readonly privateState: PrivateStateService) {}

  initLobby(room: RoomState): void {
    this.assertGame(room);
    const previous = room.dogRelayState;
    const activeIds = room.players.filter((p) => !p.isViewer).map((p) => p.id);
    const order = [...new Set(previous?.seatOrder.filter((id) => activeIds.includes(id)) ?? [])];
    order.push(...activeIds.filter((id) => !order.includes(id)));
    room.dogRelayState = {
      seatOrder: order,
      roundId: null,
      roundNumber: previous?.roundNumber ?? 0,
      revision: previous?.revision ?? 0,
      phase: null,
      leaderId: null,
      lastLeaderId: previous?.lastLeaderId ?? previous?.leaderId ?? null,
      relayOrder: [],
      relayIndex: 0,
      readyIds: [],
      candidateIds: [],
      guess: null,
      voteSubmittedIds: [],
      phaseEndsAt: null,
      pause: null,
      result: null,
      awards: null,
      cancellationReason: previous?.cancellationReason ?? null,
    };
    room.status = RoomStatus.LOBBY;
  }

  startRound(room: RoomState, actorPlayerId: string): void {
    this.assertGame(room);
    this.assertHost(room, actorPlayerId);
    requireRule(
      room.status === RoomStatus.LOBBY || room.status === RoomStatus.RESULT,
      'WRONG_PHASE',
    );
    const active = room.players.filter((p) => !p.isViewer);
    requireRule(
      active.length >= DOG_RELAY_MIN_PLAYERS && active.length <= DOG_RELAY_MAX_PLAYERS,
      'PLAYER_COUNT',
    );
    requireRule(
      active.every((p) => p.connected !== false),
      'DISCONNECTED_PLAYER',
    );
    const previous = room.dogRelayState;
    const ids = active.map((p) => p.id);
    const seats =
      room.status === RoomStatus.RESULT && previous
        ? [
            ...previous.seatOrder.filter((id) => ids.includes(id)),
            ...ids.filter((id) => !previous.seatOrder.includes(id)),
          ]
        : (previous?.seatOrder ?? ids);
    requireRule(this.exactPermutation(seats, ids), 'INVALID_SEATS');
    const lastLeaderIndex = seats.indexOf(previous?.lastLeaderId ?? previous?.leaderId ?? '');
    const leaderId =
      room.config.dogRelayLeaderSelection === 'ROUND_ROBIN'
        ? seats[(lastLeaderIndex + 1) % seats.length]
        : shuffle(seats)[0];
    const evilId = shuffle(seats.filter((id) => id !== leaderId))[0];
    const leaderIndex = seats.indexOf(leaderId);
    const relayOrder = [...seats.slice(leaderIndex), ...seats.slice(0, leaderIndex)];
    const cards = shuffle(DOG_RELAY_CARDS.map((card) => card.id));
    const roundId = randomUUID();
    const roles: Record<string, DogRelayRole> = {};
    for (const id of seats)
      roles[id] = id === leaderId ? 'LEADER' : id === evilId ? 'EVIL' : 'GOOD';
    this.clear(room);
    this.privateState.set(room.code, '__room__', 'dogRelaySecrets', {
      roundId,
      roles,
      truePair: { suspectId: cards[0], victimId: cards[1] },
      candidateIds: shuffle(cards.slice(0, 10)),
      ballots: {},
    } satisfies DogRelaySecrets);
    room.dogRelayState = {
      seatOrder: [...seats],
      roundId,
      roundNumber: (previous?.roundNumber ?? 0) + 1,
      revision: (previous?.revision ?? 0) + 1,
      phase: 'ROLE_REVEAL',
      leaderId,
      lastLeaderId: leaderId,
      relayOrder,
      relayIndex: 0,
      readyIds: [],
      candidateIds: [],
      guess: null,
      voteSubmittedIds: [],
      phaseEndsAt: null,
      pause: null,
      result: null,
      awards: null,
      cancellationReason: null,
    };
    for (const player of active) {
      player.score = 0;
      delete player.role;
    }
    room.status = RoomStatus.PLAYING;
    this.refreshPrivateStates(room);
  }

  act(room: RoomState, actorPlayerId: string, action: DogRelayAction, now: number): void {
    this.assertGame(room);
    const state = room.dogRelayState;
    requireRule(state, 'NO_STATE');
    const actor = room.players.find((p) => p.id === actorPlayerId);
    requireRule(
      actor &&
        !actor.isViewer &&
        actor.connected !== false &&
        state.seatOrder.includes(actorPlayerId),
      'NOT_ACTIVE_PLAYER',
    );
    requireRule(
      action && typeof action === 'object' && typeof action.type === 'string',
      'INVALID_ACTION',
    );
    requireRule(!state.pause, 'PAUSED');
    const phase = (expected: DogRelayPhase | null) =>
      requireRule(state.phase === expected, 'WRONG_PHASE');
    const host = () => this.assertHost(room, actorPlayerId);
    switch (action.type) {
      case 'REORDER_SEATS': {
        phase(null);
        host();
        const activeIds = room.players.filter((p) => !p.isViewer).map((p) => p.id);
        requireRule(
          Array.isArray(action.playerIds) && this.exactPermutation(action.playerIds, activeIds),
          'INVALID_SEATS',
        );
        state.seatOrder = [...action.playerIds];
        break;
      }
      case 'ACK_ROLE':
        phase('ROLE_REVEAL');
        if (state.readyIds.includes(actorPlayerId)) return;
        state.readyIds.push(actorPlayerId);
        if (state.readyIds.length === state.seatOrder.length) state.phase = 'LEADER_PREP';
        break;
      case 'BEGIN_RELAY':
        phase('LEADER_PREP');
        requireRule(actorPlayerId === state.leaderId, 'NOT_LEADER');
        state.phase = 'RELAY';
        break;
      case 'CONFIRM_HANDOFF':
        phase('RELAY');
        requireRule(
          Number.isInteger(action.relayIndex) && action.relayIndex === state.relayIndex,
          'STALE_HANDOFF',
        );
        requireRule(state.relayOrder[state.relayIndex + 1] === actorPlayerId, 'NOT_VIEWER');
        if (state.relayIndex === state.relayOrder.length - 2) {
          state.phase = 'RESTORE';
          state.candidateIds = [...this.secrets(room).candidateIds];
        } else state.relayIndex++;
        break;
      case 'SUBMIT_GUESS': {
        phase('RESTORE');
        requireRule(
          state.relayOrder[state.relayOrder.length - 1] === actorPlayerId,
          'NOT_FINAL_PLAYER',
        );
        requireRule(
          action.pair &&
            typeof action.pair.suspectId === 'string' &&
            typeof action.pair.victimId === 'string' &&
            action.pair.suspectId !== action.pair.victimId &&
            state.candidateIds.includes(action.pair.suspectId) &&
            state.candidateIds.includes(action.pair.victimId),
          'INVALID_PAIR',
        );
        state.guess = { suspectId: action.pair.suspectId, victimId: action.pair.victimId };
        if (isDogRelayPairCorrect(this.secrets(room).truePair, state.guess))
          this.finish(room, 'GOOD', 'CORRECT_PAIR');
        else {
          state.phase = 'DISCUSS';
          state.phaseEndsAt = now + DOG_RELAY_DISCUSSION_MS;
        }
        break;
      }
      case 'END_DISCUSSION':
        phase('DISCUSS');
        host();
        state.phase = 'VOTE_COUNTDOWN';
        state.phaseEndsAt = now + DOG_RELAY_COUNTDOWN_MS;
        break;
      case 'SUBMIT_VOTE': {
        phase('VOTE');
        requireRule(
          typeof action.targetPlayerId === 'string' &&
            state.seatOrder.includes(action.targetPlayerId) &&
            action.targetPlayerId !== actorPlayerId &&
            action.targetPlayerId !== state.leaderId,
          'INVALID_VOTE',
        );
        const secrets = this.secrets(room);
        requireRule(
          !Object.prototype.hasOwnProperty.call(secrets.ballots, actorPlayerId),
          'ALREADY_VOTED',
        );
        secrets.ballots[actorPlayerId] = action.targetPlayerId;
        state.voteSubmittedIds.push(actorPlayerId);
        if (state.voteSubmittedIds.length === state.seatOrder.length) {
          const evilId = state.seatOrder.find((id) => secrets.roles[id] === 'EVIL')!;
          const winningTeam = resolveDogRelayWinner(evilId, secrets.ballots);
          this.finish(room, winningTeam, winningTeam === 'GOOD' ? 'EVIL_CAUGHT' : 'EVIL_ESCAPED');
        }
        break;
      }
      case 'SET_AWARDS':
        phase('RESULT');
        requireRule(actorPlayerId === state.leaderId, 'NOT_LEADER');
        requireRule(
          typeof action.bestActorId === 'string' &&
            typeof action.worstActorId === 'string' &&
            action.bestActorId !== action.worstActorId &&
            state.seatOrder.includes(action.bestActorId) &&
            state.seatOrder.includes(action.worstActorId),
          'INVALID_AWARDS',
        );
        state.awards = { bestActorId: action.bestActorId, worstActorId: action.worstActorId };
        break;
      case 'NEXT_ROUND':
        phase('RESULT');
        host();
        this.startRound(room, actorPlayerId);
        return;
      case 'RETURN_TO_LOBBY':
        phase('RESULT');
        host();
        this.cancelRound(room, 'HOST_RESET');
        return;
      default:
        requireRule(false, 'INVALID_ACTION');
    }
    state.revision++;
    this.refreshPrivateStates(room);
  }

  onDisconnect(room: RoomState, playerId: string, now: number): void {
    const state = room.dogRelayState;
    if (!state?.roundId || state.phase === 'RESULT' || !state.seatOrder.includes(playerId)) return;
    if (state.pause?.disconnectedIds.includes(playerId)) return;
    state.pause ??= {
      disconnectedIds: [],
      graceEndsAtById: {},
      remainingPhaseMs: state.phaseEndsAt === null ? null : Math.max(0, state.phaseEndsAt - now),
    };
    state.pause.disconnectedIds.push(playerId);
    state.pause.graceEndsAtById[playerId] = now + DOG_RELAY_RECONNECT_MS;
    state.phaseEndsAt = null;
    state.revision++;
  }

  onReconnect(room: RoomState, playerId: string, now: number): void {
    const state = room.dogRelayState;
    if (!state?.pause?.disconnectedIds.includes(playerId)) {
      this.refreshPrivateStates(room);
      return;
    }
    if (Object.values(state.pause.graceEndsAtById).some((deadline) => now >= deadline)) {
      this.cancelRound(room, 'RECONNECT_EXPIRED');
      return;
    }
    state.pause.disconnectedIds = state.pause.disconnectedIds.filter((id) => id !== playerId);
    delete state.pause.graceEndsAtById[playerId];
    if (!state.pause.disconnectedIds.length) {
      state.phaseEndsAt =
        state.pause.remainingPhaseMs === null ? null : now + state.pause.remainingPhaseMs;
      state.pause = null;
    }
    state.revision++;
    this.refreshPrivateStates(room);
  }

  onRemoved(room: RoomState, playerId: string, reason: CancellationReason): void {
    const state = room.dogRelayState;
    if (!state?.seatOrder.includes(playerId)) return;
    if (state.roundId && state.phase !== 'RESULT') this.cancelRound(room, reason);
    if (room.status === RoomStatus.LOBBY)
      room.dogRelayState!.seatOrder = room.dogRelayState!.seatOrder.filter((id) => id !== playerId);
  }

  onPhaseDeadline(
    room: RoomState,
    roundId: string,
    phase: DogRelayPhase,
    deadline: number,
    now: number,
  ): boolean {
    const state = room.dogRelayState;
    if (
      room.gameType !== GameType.DOG_RELAY ||
      room.status !== RoomStatus.PLAYING ||
      !state ||
      state.roundId !== roundId ||
      state.phase !== phase ||
      state.phaseEndsAt !== deadline ||
      state.pause ||
      now < deadline
    )
      return false;
    if (phase === 'DISCUSS') {
      state.phase = 'VOTE_COUNTDOWN';
      state.phaseEndsAt = now + DOG_RELAY_COUNTDOWN_MS;
    } else if (phase === 'VOTE_COUNTDOWN') {
      state.phase = 'VOTE';
      state.phaseEndsAt = null;
    } else return false;
    state.revision++;
    return true;
  }

  cancelRound(room: RoomState, reason: CancellationReason): void {
    this.assertGame(room);
    this.clear(room);
    this.initLobby(room);
    room.dogRelayState!.revision++;
    room.dogRelayState!.cancellationReason = reason;
  }

  refreshPrivateStates(room: RoomState): void {
    const state = room.dogRelayState;
    const secrets = this.privateState.get<DogRelaySecrets>(
      room.code,
      '__room__',
      'dogRelaySecrets',
    );
    for (const player of room.players) {
      this.privateState.delete(room.code, player.socketId, DOG_RELAY_PRIVATE_STATE_KEY);
      if (
        !state?.roundId ||
        !secrets ||
        !Object.prototype.hasOwnProperty.call(secrets.roles, player.id) ||
        player.isViewer
      )
        continue;
      const projection: DogRelayPrivateState = {
        roundId: state.roundId,
        role: secrets.roles[player.id],
      };
      if (
        player.id === state.leaderId &&
        ['ROLE_REVEAL', 'LEADER_PREP', 'RESULT'].includes(state.phase!)
      )
        projection.truePair = { ...secrets.truePair };
      if (secrets.ballots[player.id]) projection.ownVoteTargetId = secrets.ballots[player.id];
      this.privateState.set(room.code, player.socketId, DOG_RELAY_PRIVATE_STATE_KEY, projection);
    }
  }

  clear(room: RoomState): void {
    this.privateState.takeRoomData(room.code, DOG_RELAY_PRIVATE_STATE_KEY);
    this.privateState.delete(room.code, '__room__', 'dogRelaySecrets');
  }

  private finish(
    room: RoomState,
    winningTeam: 'GOOD' | 'EVIL',
    reason: NonNullable<DogRelayPublicState['result']>['reason'],
  ): void {
    const state = room.dogRelayState!;
    const secrets = this.secrets(room);
    const winnerIds = state.seatOrder.filter((id) =>
      winningTeam === 'EVIL' ? secrets.roles[id] === 'EVIL' : secrets.roles[id] !== 'EVIL',
    );
    state.result = {
      winningTeam,
      reason,
      truePair: { ...secrets.truePair },
      roles: { ...secrets.roles },
      ballots: { ...secrets.ballots },
      winnerIds,
    };
    state.phase = 'RESULT';
    state.phaseEndsAt = null;
    state.pause = null;
    room.status = RoomStatus.RESULT;
    for (const player of room.players)
      if (state.seatOrder.includes(player.id)) player.score = winnerIds.includes(player.id) ? 1 : 0;
  }
  private secrets(room: RoomState): DogRelaySecrets {
    const secrets = this.privateState.get<DogRelaySecrets>(
      room.code,
      '__room__',
      'dogRelaySecrets',
    );
    requireRule(secrets && secrets.roundId === room.dogRelayState?.roundId, 'NO_SECRETS');
    return secrets;
  }
  private assertGame(room: RoomState): void {
    requireRule(room.gameType === GameType.DOG_RELAY, 'WRONG_GAME');
  }
  private assertHost(room: RoomState, playerId: string): void {
    requireRule(
      room.players.some(
        (p) =>
          p.id === playerId &&
          p.socketId === room.roomHostId &&
          !p.isViewer &&
          p.connected !== false,
      ),
      'NOT_HOST',
    );
  }
  private exactPermutation(actual: string[], expected: string[]): boolean {
    return (
      actual.length === expected.length &&
      new Set(actual).size === actual.length &&
      actual.every((id) => typeof id === 'string' && expected.includes(id))
    );
  }
}
