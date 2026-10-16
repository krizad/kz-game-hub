"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DogRelayService = exports.DogRelayDomainError = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const dog_relay_rules_1 = require("./dog-relay.rules");
class DogRelayDomainError extends Error {
}
exports.DogRelayDomainError = DogRelayDomainError;
function requireRule(valid, code) {
    if (!valid)
        throw new DogRelayDomainError(`DOG_RELAY_${code}`);
}
function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
let DogRelayService = class DogRelayService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    initLobby(room) {
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
        room.status = types_1.RoomStatus.LOBBY;
    }
    startRound(room, actorPlayerId) {
        this.assertGame(room);
        this.assertHost(room, actorPlayerId);
        requireRule(room.status === types_1.RoomStatus.LOBBY || room.status === types_1.RoomStatus.RESULT, 'WRONG_PHASE');
        const active = room.players.filter((p) => !p.isViewer);
        requireRule(active.length >= types_1.DOG_RELAY_MIN_PLAYERS && active.length <= types_1.DOG_RELAY_MAX_PLAYERS, 'PLAYER_COUNT');
        requireRule(active.every((p) => p.connected !== false), 'DISCONNECTED_PLAYER');
        const previous = room.dogRelayState;
        const ids = active.map((p) => p.id);
        const seats = room.status === types_1.RoomStatus.RESULT && previous
            ? [
                ...previous.seatOrder.filter((id) => ids.includes(id)),
                ...ids.filter((id) => !previous.seatOrder.includes(id)),
            ]
            : (previous?.seatOrder ?? ids);
        requireRule(this.exactPermutation(seats, ids), 'INVALID_SEATS');
        const lastLeaderIndex = seats.indexOf(previous?.lastLeaderId ?? previous?.leaderId ?? '');
        const leaderId = room.config.dogRelayLeaderSelection === 'ROUND_ROBIN'
            ? seats[(lastLeaderIndex + 1) % seats.length]
            : shuffle(seats)[0];
        const evilId = shuffle(seats.filter((id) => id !== leaderId))[0];
        const leaderIndex = seats.indexOf(leaderId);
        const relayOrder = [...seats.slice(leaderIndex), ...seats.slice(0, leaderIndex)];
        const cards = shuffle(types_1.DOG_RELAY_CARDS.map((card) => card.id));
        const roundId = (0, crypto_1.randomUUID)();
        const roles = {};
        for (const id of seats)
            roles[id] = id === leaderId ? 'LEADER' : id === evilId ? 'EVIL' : 'GOOD';
        this.clear(room);
        this.privateState.set(room.code, '__room__', 'dogRelaySecrets', {
            roundId,
            roles,
            truePair: { suspectId: cards[0], victimId: cards[1] },
            candidateIds: shuffle(cards.slice(0, 10)),
            ballots: {},
        });
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
        room.status = types_1.RoomStatus.PLAYING;
        this.refreshPrivateStates(room);
    }
    act(room, actorPlayerId, action, now) {
        this.assertGame(room);
        const state = room.dogRelayState;
        requireRule(state, 'NO_STATE');
        const actor = room.players.find((p) => p.id === actorPlayerId);
        requireRule(actor &&
            !actor.isViewer &&
            actor.connected !== false &&
            state.seatOrder.includes(actorPlayerId), 'NOT_ACTIVE_PLAYER');
        requireRule(action && typeof action === 'object' && typeof action.type === 'string', 'INVALID_ACTION');
        requireRule(!state.pause, 'PAUSED');
        const phase = (expected) => requireRule(state.phase === expected, 'WRONG_PHASE');
        const host = () => this.assertHost(room, actorPlayerId);
        switch (action.type) {
            case 'REORDER_SEATS': {
                phase(null);
                host();
                const activeIds = room.players.filter((p) => !p.isViewer).map((p) => p.id);
                requireRule(Array.isArray(action.playerIds) && this.exactPermutation(action.playerIds, activeIds), 'INVALID_SEATS');
                state.seatOrder = [...action.playerIds];
                break;
            }
            case 'ACK_ROLE':
                phase('ROLE_REVEAL');
                if (state.readyIds.includes(actorPlayerId))
                    return;
                state.readyIds.push(actorPlayerId);
                if (state.readyIds.length === state.seatOrder.length)
                    state.phase = 'LEADER_PREP';
                break;
            case 'BEGIN_RELAY':
                phase('LEADER_PREP');
                requireRule(actorPlayerId === state.leaderId, 'NOT_LEADER');
                state.phase = 'RELAY';
                break;
            case 'CONFIRM_HANDOFF':
                phase('RELAY');
                requireRule(Number.isInteger(action.relayIndex) && action.relayIndex === state.relayIndex, 'STALE_HANDOFF');
                requireRule(state.relayOrder[state.relayIndex + 1] === actorPlayerId, 'NOT_VIEWER');
                if (state.relayIndex === state.relayOrder.length - 2) {
                    state.phase = 'RESTORE';
                    state.candidateIds = [...this.secrets(room).candidateIds];
                }
                else
                    state.relayIndex++;
                break;
            case 'SUBMIT_GUESS': {
                phase('RESTORE');
                requireRule(state.relayOrder[state.relayOrder.length - 1] === actorPlayerId, 'NOT_FINAL_PLAYER');
                requireRule(action.pair &&
                    typeof action.pair.suspectId === 'string' &&
                    typeof action.pair.victimId === 'string' &&
                    action.pair.suspectId !== action.pair.victimId &&
                    state.candidateIds.includes(action.pair.suspectId) &&
                    state.candidateIds.includes(action.pair.victimId), 'INVALID_PAIR');
                state.guess = { suspectId: action.pair.suspectId, victimId: action.pair.victimId };
                if ((0, dog_relay_rules_1.isDogRelayPairCorrect)(this.secrets(room).truePair, state.guess))
                    this.finish(room, 'GOOD', 'CORRECT_PAIR');
                else {
                    state.phase = 'DISCUSS';
                    state.phaseEndsAt = now + types_1.DOG_RELAY_DISCUSSION_MS;
                }
                break;
            }
            case 'END_DISCUSSION':
                phase('DISCUSS');
                host();
                state.phase = 'VOTE_COUNTDOWN';
                state.phaseEndsAt = now + types_1.DOG_RELAY_COUNTDOWN_MS;
                break;
            case 'SUBMIT_VOTE': {
                phase('VOTE');
                requireRule(typeof action.targetPlayerId === 'string' &&
                    state.seatOrder.includes(action.targetPlayerId) &&
                    action.targetPlayerId !== actorPlayerId &&
                    action.targetPlayerId !== state.leaderId, 'INVALID_VOTE');
                const secrets = this.secrets(room);
                requireRule(!Object.prototype.hasOwnProperty.call(secrets.ballots, actorPlayerId), 'ALREADY_VOTED');
                secrets.ballots[actorPlayerId] = action.targetPlayerId;
                state.voteSubmittedIds.push(actorPlayerId);
                if (state.voteSubmittedIds.length === state.seatOrder.length) {
                    const evilId = state.seatOrder.find((id) => secrets.roles[id] === 'EVIL');
                    const winningTeam = (0, dog_relay_rules_1.resolveDogRelayWinner)(evilId, secrets.ballots);
                    this.finish(room, winningTeam, winningTeam === 'GOOD' ? 'EVIL_CAUGHT' : 'EVIL_ESCAPED');
                }
                break;
            }
            case 'SET_AWARDS':
                phase('RESULT');
                requireRule(actorPlayerId === state.leaderId, 'NOT_LEADER');
                requireRule(typeof action.bestActorId === 'string' &&
                    typeof action.worstActorId === 'string' &&
                    action.bestActorId !== action.worstActorId &&
                    state.seatOrder.includes(action.bestActorId) &&
                    state.seatOrder.includes(action.worstActorId), 'INVALID_AWARDS');
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
    onDisconnect(room, playerId, now) {
        const state = room.dogRelayState;
        if (!state?.roundId || state.phase === 'RESULT' || !state.seatOrder.includes(playerId))
            return;
        if (state.pause?.disconnectedIds.includes(playerId))
            return;
        state.pause ??= {
            disconnectedIds: [],
            graceEndsAtById: {},
            remainingPhaseMs: state.phaseEndsAt === null ? null : Math.max(0, state.phaseEndsAt - now),
        };
        state.pause.disconnectedIds.push(playerId);
        state.pause.graceEndsAtById[playerId] = now + types_1.DOG_RELAY_RECONNECT_MS;
        state.phaseEndsAt = null;
        state.revision++;
    }
    onReconnect(room, playerId, now) {
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
    onRemoved(room, playerId, reason) {
        const state = room.dogRelayState;
        if (!state?.seatOrder.includes(playerId))
            return;
        if (state.roundId && state.phase !== 'RESULT')
            this.cancelRound(room, reason);
        if (room.status === types_1.RoomStatus.LOBBY)
            room.dogRelayState.seatOrder = room.dogRelayState.seatOrder.filter((id) => id !== playerId);
    }
    onPhaseDeadline(room, roundId, phase, deadline, now) {
        const state = room.dogRelayState;
        if (room.gameType !== types_1.GameType.DOG_RELAY ||
            room.status !== types_1.RoomStatus.PLAYING ||
            !state ||
            state.roundId !== roundId ||
            state.phase !== phase ||
            state.phaseEndsAt !== deadline ||
            state.pause ||
            now < deadline)
            return false;
        if (phase === 'DISCUSS') {
            state.phase = 'VOTE_COUNTDOWN';
            state.phaseEndsAt = now + types_1.DOG_RELAY_COUNTDOWN_MS;
        }
        else if (phase === 'VOTE_COUNTDOWN') {
            state.phase = 'VOTE';
            state.phaseEndsAt = null;
        }
        else
            return false;
        state.revision++;
        return true;
    }
    cancelRound(room, reason) {
        this.assertGame(room);
        this.clear(room);
        this.initLobby(room);
        room.dogRelayState.revision++;
        room.dogRelayState.cancellationReason = reason;
    }
    refreshPrivateStates(room) {
        const state = room.dogRelayState;
        const secrets = this.privateState.get(room.code, '__room__', 'dogRelaySecrets');
        for (const player of room.players) {
            this.privateState.delete(room.code, player.socketId, types_1.DOG_RELAY_PRIVATE_KEY);
            if (!state?.roundId ||
                !secrets ||
                !Object.prototype.hasOwnProperty.call(secrets.roles, player.id) ||
                player.isViewer)
                continue;
            const projection = {
                roundId: state.roundId,
                role: secrets.roles[player.id],
            };
            if (player.id === state.leaderId &&
                ['ROLE_REVEAL', 'LEADER_PREP', 'RESULT'].includes(state.phase))
                projection.truePair = { ...secrets.truePair };
            if (secrets.ballots[player.id])
                projection.ownVoteTargetId = secrets.ballots[player.id];
            this.privateState.set(room.code, player.socketId, types_1.DOG_RELAY_PRIVATE_KEY, projection);
        }
    }
    clear(room) {
        this.privateState.takeRoomData(room.code, types_1.DOG_RELAY_PRIVATE_KEY);
        this.privateState.delete(room.code, '__room__', 'dogRelaySecrets');
    }
    finish(room, winningTeam, reason) {
        const state = room.dogRelayState;
        const secrets = this.secrets(room);
        const winnerIds = state.seatOrder.filter((id) => winningTeam === 'EVIL' ? secrets.roles[id] === 'EVIL' : secrets.roles[id] !== 'EVIL');
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
        room.status = types_1.RoomStatus.RESULT;
        for (const player of room.players)
            if (state.seatOrder.includes(player.id))
                player.score = winnerIds.includes(player.id) ? 1 : 0;
    }
    secrets(room) {
        const secrets = this.privateState.get(room.code, '__room__', 'dogRelaySecrets');
        requireRule(secrets && secrets.roundId === room.dogRelayState?.roundId, 'NO_SECRETS');
        return secrets;
    }
    assertGame(room) {
        requireRule(room.gameType === types_1.GameType.DOG_RELAY, 'WRONG_GAME');
    }
    assertHost(room, playerId) {
        requireRule(room.players.some((p) => p.id === playerId &&
            p.socketId === room.roomHostId &&
            !p.isViewer &&
            p.connected !== false), 'NOT_HOST');
    }
    exactPermutation(actual, expected) {
        return (actual.length === expected.length &&
            new Set(actual).size === actual.length &&
            actual.every((id) => typeof id === 'string' && expected.includes(id)));
    }
};
exports.DogRelayService = DogRelayService;
exports.DogRelayService = DogRelayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], DogRelayService);
//# sourceMappingURL=dog-relay.service.js.map