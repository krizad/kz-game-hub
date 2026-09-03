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
exports.CoupService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const room_timer_service_1 = require("../room-timer.service");
let CoupService = class CoupService {
    constructor(privateStateService, roomTimerService) {
        this.privateStateService = privateStateService;
        this.roomTimerService = roomTimerService;
    }
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    buildDeck() {
        const roles = [
            types_1.CoupRole.DUKE,
            types_1.CoupRole.ASSASSIN,
            types_1.CoupRole.CAPTAIN,
            types_1.CoupRole.AMBASSADOR,
            types_1.CoupRole.CONTESSA,
        ];
        const deck = [];
        for (const r of roles) {
            deck.push(r, r, r);
        }
        return this.shuffle(deck);
    }
    startGame(room, requesterId) {
        if (room.gameType !== types_1.GameType.COUP)
            return null;
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (room.players.length < 3 || room.players.length > 6)
            return null;
        const deck = this.buildDeck();
        const coins = {};
        const influences = {};
        for (const p of room.players) {
            const hand = [deck.pop(), deck.pop()];
            this.privateStateService.set(room.code, p.socketId, 'coupHand', hand);
            coins[p.socketId] = 2;
            influences[p.socketId] = { count: 2, revealed: [] };
        }
        room.coupState = {
            phase: types_1.CoupPhase.PLAYING,
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
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    resetGame(room, requesterId) {
        if (room.gameType !== types_1.GameType.COUP)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        for (const p of room.players) {
            this.privateStateService.delete(room.code, p.socketId, 'coupHand');
        }
        this.roomTimerService.clearRoom(room.code);
        room.coupState = undefined;
        room.status = types_1.RoomStatus.LOBBY;
        return room;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.currentTurn === oldSocketId)
            state.currentTurn = newSocketId;
        if (state.winnerId === oldSocketId)
            state.winnerId = newSocketId;
        if (state.coins[oldSocketId] !== undefined) {
            state.coins[newSocketId] = state.coins[oldSocketId];
            delete state.coins[oldSocketId];
        }
        if (state.influences[oldSocketId]) {
            state.influences[newSocketId] = state.influences[oldSocketId];
            delete state.influences[oldSocketId];
        }
        if (state.pendingAction) {
            if (state.pendingAction.actorId === oldSocketId)
                state.pendingAction.actorId = newSocketId;
            if (state.pendingAction.targetId === oldSocketId)
                state.pendingAction.targetId = newSocketId;
        }
        if (state.pendingBlock && state.pendingBlock.blockerId === oldSocketId) {
            state.pendingBlock.blockerId = newSocketId;
        }
    }
    isAlive(state, socketId) {
        return (state.influences[socketId]?.count ?? 0) > 0;
    }
    aliveIds(room, state) {
        return room.players.filter((p) => this.isAlive(state, p.socketId)).map((p) => p.socketId);
    }
    advanceTurn(room, state) {
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
    checkWinner(room, state) {
        const alive = this.aliveIds(room, state);
        if (alive.length === 1) {
            state.winnerId = alive[0];
            state.phase = types_1.CoupPhase.RESULT;
            room.status = types_1.RoomStatus.RESULT;
            const winner = room.players.find((p) => p.socketId === alive[0]);
            if (winner)
                winner.score += 1;
        }
        else if (alive.length === 0) {
            state.phase = types_1.CoupPhase.RESULT;
            room.status = types_1.RoomStatus.RESULT;
        }
    }
    loseInfluence(room, state, targetId) {
        const inf = state.influences[targetId];
        if (!inf || inf.count <= 0)
            return;
        const hand = this.privateStateService.get(room.code, targetId, 'coupHand') ?? [];
        const lost = hand.shift();
        if (lost) {
            inf.revealed.push(lost);
            state.deadPile.push(lost);
            this.privateStateService.set(room.code, targetId, 'coupHand', hand);
        }
        inf.count = Math.max(0, inf.count - 1);
    }
    getClaimedRole(type) {
        switch (type) {
            case types_1.CoupActionType.TAX:
                return types_1.CoupRole.DUKE;
            case types_1.CoupActionType.ASSASSINATE:
                return types_1.CoupRole.ASSASSIN;
            case types_1.CoupActionType.STEAL:
                return types_1.CoupRole.CAPTAIN;
            case types_1.CoupActionType.EXCHANGE:
                return types_1.CoupRole.AMBASSADOR;
            default:
                return null;
        }
    }
    isBlockable(type) {
        return type === types_1.CoupActionType.FOREIGN_AID || type === types_1.CoupActionType.ASSASSINATE || type === types_1.CoupActionType.STEAL;
    }
    getBlockRole(type) {
        switch (type) {
            case types_1.CoupActionType.FOREIGN_AID:
                return [types_1.CoupRole.DUKE];
            case types_1.CoupActionType.ASSASSINATE:
                return [types_1.CoupRole.CONTESSA];
            case types_1.CoupActionType.STEAL:
                return [types_1.CoupRole.CAPTAIN, types_1.CoupRole.AMBASSADOR];
            default:
                return [];
        }
    }
    resolveActionSuccess(room, state, pending) {
        switch (pending.type) {
            case types_1.CoupActionType.TAX:
                state.coins[pending.actorId] = (state.coins[pending.actorId] ?? 0) + 3;
                break;
            case types_1.CoupActionType.FOREIGN_AID:
                state.coins[pending.actorId] = (state.coins[pending.actorId] ?? 0) + 2;
                break;
            case types_1.CoupActionType.ASSASSINATE: {
                const target = pending.targetId;
                this.loseInfluence(room, state, target);
                this.checkWinner(room, state);
                if (state.phase === types_1.CoupPhase.RESULT)
                    return false;
                break;
            }
            case types_1.CoupActionType.STEAL: {
                const target = pending.targetId;
                const targetCoins = state.coins[target] ?? 0;
                const amount = Math.min(2, targetCoins);
                state.coins[pending.actorId] = (state.coins[pending.actorId] ?? 0) + amount;
                state.coins[target] = targetCoins - amount;
                break;
            }
            case types_1.CoupActionType.EXCHANGE: {
                const actorHand = this.privateStateService.get(room.code, pending.actorId, 'coupHand') ?? [];
                const drawn = [];
                for (let i = 0; i < 2; i++) {
                    if (state.deck.length === 0)
                        break;
                    drawn.push(state.deck.pop());
                }
                actorHand.push(...drawn);
                this.privateStateService.set(room.code, pending.actorId, 'coupHand', actorHand);
                state.phase = types_1.CoupPhase.AWAITING_EXCHANGE;
                return true;
            }
            default:
                break;
        }
        return false;
    }
    handleChallengeTimeoutForRoom(room) {
        if (!room.coupState)
            return null;
        const state = room.coupState;
        if (state.phase !== types_1.CoupPhase.AWAITING_CHALLENGE || !state.pendingAction)
            return null;
        if (state.pendingBlock)
            return null;
        const pending = state.pendingAction;
        state.challengeWindowDeadline = null;
        if (this.isBlockable(pending.type)) {
            state.phase = types_1.CoupPhase.AWAITING_BLOCK;
            state.blockWindowDeadline = Date.now() + 7000;
            return room;
        }
        const wentExchange = this.resolveActionSuccess(room, state, pending);
        if (wentExchange)
            return room;
        state.pendingAction = null;
        state.phase = types_1.CoupPhase.PLAYING;
        this.advanceTurn(room, state);
        return room;
    }
    handleBlockTimeoutForRoom(room) {
        if (!room.coupState)
            return null;
        const state = room.coupState;
        if (state.phase !== types_1.CoupPhase.AWAITING_BLOCK || !state.pendingAction)
            return null;
        state.blockWindowDeadline = null;
        const pending = state.pendingAction;
        const wentExchange = this.resolveActionSuccess(room, state, pending);
        if (wentExchange)
            return room;
        if (state.phase === types_1.CoupPhase.RESULT) {
            state.pendingAction = null;
            return room;
        }
        state.pendingAction = null;
        state.phase = types_1.CoupPhase.PLAYING;
        this.advanceTurn(room, state);
        return room;
    }
    handleBlockChallengeTimeoutForRoom(room) {
        if (!room.coupState)
            return null;
        const state = room.coupState;
        if (state.phase !== types_1.CoupPhase.AWAITING_CHALLENGE || !state.pendingBlock || !state.pendingAction)
            return null;
        state.challengeWindowDeadline = null;
        state.pendingBlock = null;
        state.pendingAction = null;
        state.phase = types_1.CoupPhase.PLAYING;
        this.advanceTurn(room, state);
        return room;
    }
    challenge(room, challengerId) {
        if (room.gameType !== types_1.GameType.COUP || !room.coupState)
            return null;
        const state = room.coupState;
        if (!state.pendingAction)
            return null;
        if (state.pendingBlock) {
            if (state.phase !== types_1.CoupPhase.AWAITING_CHALLENGE)
                return null;
            if (challengerId === state.pendingBlock.blockerId)
                return null;
            if (!this.isAlive(state, challengerId))
                return null;
            if (!room.players.some((p) => p.socketId === challengerId))
                return null;
            const claimedRole = state.pendingBlock.claimedRole;
            const blockerHand = this.privateStateService.get(room.code, state.pendingBlock.blockerId, 'coupHand') ?? [];
            const hasRole = blockerHand.includes(claimedRole);
            this.roomTimerService.cancel(room.code, 'coup-challenge');
            state.challengeWindowDeadline = null;
            if (hasRole) {
                this.loseInfluence(room, state, challengerId);
                const idx = blockerHand.indexOf(claimedRole);
                if (idx !== -1) {
                    const [card] = blockerHand.splice(idx, 1);
                    state.deck.push(card);
                    for (let i = state.deck.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
                    }
                    blockerHand.push(state.deck.pop());
                    this.privateStateService.set(room.code, state.pendingBlock.blockerId, 'coupHand', blockerHand);
                }
                this.checkWinner(room, state);
                if (state.phase === types_1.CoupPhase.RESULT) {
                    state.pendingBlock = null;
                    state.pendingAction = null;
                    return room;
                }
                state.pendingBlock = null;
                state.pendingAction = null;
                state.phase = types_1.CoupPhase.PLAYING;
                this.advanceTurn(room, state);
                return room;
            }
            else {
                this.loseInfluence(room, state, state.pendingBlock.blockerId);
                this.checkWinner(room, state);
                const pending = state.pendingAction;
                state.pendingBlock = null;
                const wentExchange = this.resolveActionSuccess(room, state, pending);
                if (wentExchange)
                    return room;
                if (state.phase === types_1.CoupPhase.RESULT) {
                    state.pendingAction = null;
                    return room;
                }
                state.pendingAction = null;
                state.phase = types_1.CoupPhase.PLAYING;
                this.advanceTurn(room, state);
                return room;
            }
        }
        if (state.phase !== types_1.CoupPhase.AWAITING_CHALLENGE)
            return null;
        if (challengerId === state.pendingAction.actorId)
            return null;
        if (!this.isAlive(state, challengerId))
            return null;
        if (!room.players.some((p) => p.socketId === challengerId))
            return null;
        const actorId = state.pendingAction.actorId;
        const claimedRole = state.pendingAction.claimedRole;
        const actorHand = this.privateStateService.get(room.code, actorId, 'coupHand') ?? [];
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
                actorHand.push(state.deck.pop());
                this.privateStateService.set(room.code, actorId, 'coupHand', actorHand);
            }
            this.checkWinner(room, state);
            if (state.phase === types_1.CoupPhase.RESULT) {
                state.pendingAction = null;
                return room;
            }
            if (this.isBlockable(state.pendingAction.type)) {
                state.phase = types_1.CoupPhase.AWAITING_BLOCK;
                state.blockWindowDeadline = Date.now() + 7000;
                return room;
            }
            const wentExchange = this.resolveActionSuccess(room, state, state.pendingAction);
            if (wentExchange)
                return room;
            state.pendingAction = null;
            state.phase = types_1.CoupPhase.PLAYING;
            this.advanceTurn(room, state);
            return room;
        }
        else {
            this.loseInfluence(room, state, actorId);
            this.checkWinner(room, state);
            state.pendingAction = null;
            state.phase = types_1.CoupPhase.PLAYING;
            if (state.phase !== types_1.CoupPhase.RESULT) {
                this.advanceTurn(room, state);
            }
            return room;
        }
    }
    block(room, blockerId) {
        if (room.gameType !== types_1.GameType.COUP || !room.coupState)
            return null;
        const state = room.coupState;
        if (state.phase !== types_1.CoupPhase.AWAITING_BLOCK || !state.pendingAction)
            return null;
        if (!this.isAlive(state, blockerId))
            return null;
        if (!room.players.some((p) => p.socketId === blockerId))
            return null;
        if (blockerId === state.pendingAction.actorId)
            return null;
        const pending = state.pendingAction;
        const allowed = this.getBlockRole(pending.type);
        if (allowed.length === 0)
            return null;
        if (pending.type === types_1.CoupActionType.ASSASSINATE && blockerId !== pending.targetId)
            return null;
        if (pending.type === types_1.CoupActionType.STEAL && !allowed.some((r) => true))
            return null;
        const claimedRole = allowed[0];
        this.roomTimerService.cancel(room.code, 'coup-block');
        state.blockWindowDeadline = null;
        state.pendingBlock = { blockerId, claimedRole };
        state.phase = types_1.CoupPhase.AWAITING_CHALLENGE;
        state.challengeWindowDeadline = Date.now() + 7000;
        return room;
    }
    exchangeSelect(room, actorId, keepIndices) {
        if (room.gameType !== types_1.GameType.COUP || !room.coupState)
            return null;
        const state = room.coupState;
        if (state.phase !== types_1.CoupPhase.AWAITING_EXCHANGE || !state.pendingAction)
            return null;
        if (state.pendingAction.actorId !== actorId)
            return null;
        if (state.pendingAction.type !== types_1.CoupActionType.EXCHANGE)
            return null;
        if (!Array.isArray(keepIndices) || keepIndices.length !== 2)
            return null;
        if (new Set(keepIndices).size !== 2)
            return null;
        for (const idx of keepIndices) {
            if (!Number.isInteger(idx) || idx < 0 || idx > 3)
                return null;
        }
        const hand = this.privateStateService.get(room.code, actorId, 'coupHand') ?? [];
        if (hand.length !== 4)
            return null;
        const kept = keepIndices.map((i) => hand[i]);
        const returned = hand.filter((_, i) => !keepIndices.includes(i));
        state.deck.push(...returned);
        for (let i = state.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
        }
        this.privateStateService.set(room.code, actorId, 'coupHand', kept);
        state.pendingAction = null;
        state.phase = types_1.CoupPhase.PLAYING;
        this.advanceTurn(room, state);
        return room;
    }
    declareAction(room, actorId, type, targetId) {
        if (room.gameType !== types_1.GameType.COUP || !room.coupState)
            return null;
        const state = room.coupState;
        if (room.status !== types_1.RoomStatus.PLAYING)
            return null;
        if (state.phase !== types_1.CoupPhase.PLAYING)
            return null;
        if (state.currentTurn !== actorId)
            return null;
        if (!this.isAlive(state, actorId))
            return null;
        if (!room.players.some((p) => p.socketId === actorId))
            return null;
        const coins = state.coins[actorId] ?? 0;
        if (coins >= 10 && type !== types_1.CoupActionType.COUP)
            return null;
        const claimedRole = this.getClaimedRole(type);
        if (claimedRole) {
            if (type === types_1.CoupActionType.ASSASSINATE) {
                if (!targetId)
                    return null;
                if (!room.players.some((p) => p.socketId === targetId))
                    return null;
                if (targetId === actorId)
                    return null;
                if (!this.isAlive(state, targetId))
                    return null;
                if (coins < 3)
                    return null;
                state.coins[actorId] = coins - 3;
            }
            else if (type === types_1.CoupActionType.STEAL) {
                if (!targetId)
                    return null;
                if (!room.players.some((p) => p.socketId === targetId))
                    return null;
                if (targetId === actorId)
                    return null;
                if (!this.isAlive(state, targetId))
                    return null;
            }
            else if (type === types_1.CoupActionType.EXCHANGE) {
                if (state.deck.length < 2)
                    return null;
            }
            state.pendingAction = { actorId, type, targetId, claimedRole };
            state.phase = types_1.CoupPhase.AWAITING_CHALLENGE;
            state.challengeWindowDeadline = Date.now() + 7000;
            return room;
        }
        if (this.isBlockable(type)) {
            state.pendingAction = { actorId, type, targetId, claimedRole: undefined };
            state.phase = types_1.CoupPhase.AWAITING_BLOCK;
            state.blockWindowDeadline = Date.now() + 7000;
            return room;
        }
        switch (type) {
            case types_1.CoupActionType.INCOME: {
                state.coins[actorId] = coins + 1;
                break;
            }
            case types_1.CoupActionType.COUP: {
                if (!targetId)
                    return null;
                if (!room.players.some((p) => p.socketId === targetId))
                    return null;
                if (targetId === actorId)
                    return null;
                if (!this.isAlive(state, targetId))
                    return null;
                if (coins < 7)
                    return null;
                state.coins[actorId] = coins - 7;
                this.loseInfluence(room, state, targetId);
                this.checkWinner(room, state);
                if (state.phase === types_1.CoupPhase.RESULT)
                    return room;
                break;
            }
            default:
                return null;
        }
        if (state.phase !== types_1.CoupPhase.RESULT) {
            this.advanceTurn(room, state);
        }
        return room;
    }
    handlePlayerDisconnect(room, socketId) { }
};
exports.CoupService = CoupService;
exports.CoupService = CoupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService,
        room_timer_service_1.RoomTimerService])
], CoupService);
//# sourceMappingURL=coup.service.js.map