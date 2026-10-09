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
exports.PokerService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const poker_engine_1 = require("./poker-engine");
const PRIVATE_KEY = 'poker';
const ENGINE_SOCKET_ID = '__poker-engine__';
const DECK_KEY = 'deck';
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
let PokerService = class PokerService {
    constructor(privateStateService) {
        this.privateStateService = privateStateService;
    }
    startMatch(room, requesterId) {
        if (room.gameType !== types_1.GameType.POKER || room.roomHostId !== requesterId)
            return null;
        if (room.status !== types_1.RoomStatus.LOBBY && room.status !== types_1.RoomStatus.RESULT)
            return null;
        const players = room.players.filter((p) => !p.isViewer && p.connected !== false);
        if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS)
            return null;
        const seats = {};
        for (const player of players) {
            seats[player.socketId] = {
                chips: this.startingStack(room),
                bet: 0,
                totalBet: 0,
                status: 'ACTIVE',
                hasActed: false,
            };
        }
        room.pokerState = {
            mode: (room.config.pokerMode ?? 'ONLINE'),
            phase: 'HAND_RESULT',
            handNumber: 0,
            playerOrder: players.map((p) => p.socketId),
            seats,
            dealerId: null,
            activePlayerId: null,
            currentBet: 0,
            minRaiseTo: 0,
            pot: 0,
            board: [],
            smallBlind: this.smallBlind(room),
            bigBlind: this.bigBlind(room),
            ante: this.ante(room),
            turnDeadline: null,
        };
        room.status = types_1.RoomStatus.PLAYING;
        this.clearAllHoleCards(room);
        this.dealHand(room);
        return room;
    }
    resetMatch(room, requesterId) {
        if (room.gameType !== types_1.GameType.POKER || room.roomHostId !== requesterId)
            return null;
        room.pokerState = undefined;
        this.clearAllHoleCards(room);
        this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
        room.status = types_1.RoomStatus.LOBBY;
        return room;
    }
    handleAction(room, socketId, action) {
        const state = room.pokerState;
        if (!state || room.gameType !== types_1.GameType.POKER)
            return null;
        if (!action || typeof action !== 'object' || typeof action.type !== 'string')
            return null;
        const isHost = room.roomHostId === socketId;
        switch (action.type) {
            case 'START_HAND':
                if (!isHost)
                    return null;
                if (state.phase !== 'HAND_RESULT' && state.phase !== 'SHOWDOWN')
                    return null;
                this.dealHand(room);
                return room;
            case 'END_MATCH':
                if (!isHost)
                    return null;
                this.endMatch(room);
                return room;
            case 'REBUY':
                if (!isHost)
                    return null;
                return this.rebuy(room, action.targetId) ? room : null;
            case 'ADJUST_CHIPS':
                if (!isHost || state.mode !== 'CHIPS_LEDGER')
                    return null;
                return this.adjustChips(room, action.targetId, action.amount) ? room : null;
            case 'POT_AWARD':
                if (!isHost || state.mode !== 'CHIPS_LEDGER')
                    return null;
                return this.awardPot(room, action.targetIds) ? room : null;
            case 'FOLD':
            case 'CHECK':
            case 'CALL':
            case 'BET':
            case 'ALL_IN':
                return this.applyBettingAction(room, socketId, action) ? room : null;
            case 'SHOW':
            case 'MUCK':
                return this.applyReveal(room, socketId, action.type === 'SHOW') ? room : null;
            default:
                return null;
        }
    }
    resolveAutoAction(room) {
        const state = room.pokerState;
        if (!state || !(0, poker_engine_1.isStreetPhase)(state.phase) || !state.activePlayerId)
            return null;
        return { playerId: state.activePlayerId, action: { type: (0, poker_engine_1.autoAction)(state) } };
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.dealerId === oldSocketId)
            state.dealerId = newSocketId;
        if (state.activePlayerId === oldSocketId)
            state.activePlayerId = newSocketId;
        state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
        state.seats = this.remapRecord(state.seats, oldSocketId, newSocketId);
        if (state.showdown) {
            state.showdown.awaitingRevealIds = state.showdown.awaitingRevealIds.map((id) => id === oldSocketId ? newSocketId : id);
            state.showdown.revealedCards = this.remapRecord(state.showdown.revealedCards, oldSocketId, newSocketId);
            state.showdown.pendingPots = state.showdown.pendingPots.map((pot) => ({
                ...pot,
                eligiblePlayerIds: pot.eligiblePlayerIds.map((id) => id === oldSocketId ? newSocketId : id),
            }));
        }
        if (state.handResult) {
            state.handResult.pots = state.handResult.pots.map((pot) => ({
                ...pot,
                winnerIds: pot.winnerIds.map((id) => (id === oldSocketId ? newSocketId : id)),
            }));
            if (state.handResult.uncalledRefund?.playerId === oldSocketId) {
                state.handResult.uncalledRefund.playerId = newSocketId;
            }
        }
    }
    handlePlayerDisconnect(room, socketId) {
        const state = room.pokerState;
        if (!state)
            return;
        if ((0, poker_engine_1.isStreetPhase)(state.phase) && state.playerOrder.includes(socketId)) {
            this.cancelHand(room);
        }
    }
    cancelHand(room) {
        room.pokerState = undefined;
        this.clearAllHoleCards(room);
        this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
        room.status = types_1.RoomStatus.LOBBY;
    }
    dealHand(room) {
        const state = room.pokerState;
        const bigBlind = this.bigBlind(room);
        for (const id of state.playerOrder) {
            this.privateStateService.delete(room.code, id, PRIVATE_KEY);
        }
        for (const id of state.playerOrder) {
            const seat = state.seats[id];
            seat.status = seat.chips > 0 ? 'ACTIVE' : 'OUT';
            seat.bet = 0;
            seat.totalBet = 0;
            seat.hasActed = false;
            seat.raiseLocked = false;
            seat.lastAction = undefined;
            seat.lastActionAmount = undefined;
            seat.cardsRevealed = false;
            seat.handCategory = undefined;
        }
        const eligible = state.playerOrder.filter((id) => state.seats[id].status === 'ACTIVE');
        if (eligible.length < MIN_PLAYERS) {
            this.endMatch(room);
            return;
        }
        state.handNumber += 1;
        state.pot = 0;
        state.board = [];
        state.currentBet = 0;
        state.minRaiseTo = bigBlind * 2;
        state.activePlayerId = null;
        state.showdown = undefined;
        state.handResult = undefined;
        state.turnDeadline = null;
        state.dealerId = state.dealerId
            ? this.nextSeatIn(eligible, state.dealerId)
            : eligible[(0, crypto_1.randomInt)(eligible.length)];
        const deck = (0, poker_engine_1.shuffleDeck)((0, poker_engine_1.createDeck)());
        this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, state.mode === 'ONLINE' ? deck : []);
        if (state.ante > 0) {
            for (const id of eligible) {
                this.commit(room, id, Math.min(state.ante, state.seats[id].chips), 'ANTE');
            }
        }
        const sbId = eligible.length === MIN_PLAYERS
            ? state.dealerId
            : this.nextSeatIn(eligible, state.dealerId);
        const bbId = this.nextSeatIn(eligible, sbId);
        this.commit(room, sbId, Math.min(state.smallBlind, state.seats[sbId].chips), 'SMALL_BLIND');
        this.commit(room, bbId, Math.min(bigBlind, state.seats[bbId].chips), 'BIG_BLIND');
        state.currentBet = bigBlind;
        state.minRaiseTo = bigBlind;
        if (state.mode === 'ONLINE') {
            for (const id of eligible) {
                const holeCards = [deck.pop(), deck.pop()];
                this.privateStateService.set(room.code, id, PRIVATE_KEY, { holeCards });
            }
        }
        state.phase = 'PREFLOP';
        if ((0, poker_engine_1.bettingRoundComplete)(state)) {
            this.closeStreet(room);
        }
        else {
            this.setActive(room, this.nextSeatAfter(state, bbId));
        }
    }
    applyBettingAction(room, socketId, action) {
        const state = room.pokerState;
        if (!(0, poker_engine_1.isStreetPhase)(state.phase) || state.activePlayerId !== socketId)
            return false;
        const seat = state.seats[socketId];
        const moves = (0, poker_engine_1.legalMoves)(state, socketId);
        if (!moves)
            return false;
        switch (action.type) {
            case 'FOLD':
                seat.status = 'FOLDED';
                seat.lastAction = 'FOLD';
                break;
            case 'CHECK':
                if (!moves.canCheck)
                    return false;
                seat.lastAction = 'CHECK';
                break;
            case 'CALL': {
                if (moves.canCheck || moves.callAmount <= 0)
                    return false;
                this.commit(room, socketId, moves.callAmount, 'CALL');
                break;
            }
            case 'BET': {
                if (!moves.canBet || !Number.isInteger(action.amount))
                    return false;
                if (seat.raiseLocked)
                    return false;
                const betBefore = seat.bet;
                const raiseTo = Math.min(Math.max(action.amount, moves.minRaiseTo), moves.maxRaiseTo);
                const isFullRaise = raiseTo >= moves.minRaiseTo;
                const isShortAllIn = raiseTo === moves.maxRaiseTo && !isFullRaise;
                this.commit(room, socketId, raiseTo - seat.bet, state.currentBet === 0 ? 'BET' : 'RAISE');
                state.currentBet = raiseTo;
                if (isFullRaise) {
                    const raiseSize = raiseTo - betBefore;
                    state.minRaiseTo = raiseTo + raiseSize;
                    for (const id of state.playerOrder)
                        state.seats[id].raiseLocked = false;
                }
                else if (isShortAllIn) {
                    for (const id of state.playerOrder) {
                        if (id !== socketId && state.seats[id].hasActed)
                            state.seats[id].raiseLocked = true;
                    }
                }
                break;
            }
            case 'ALL_IN': {
                if (moves.maxRaiseTo <= state.currentBet && seat.bet === state.currentBet)
                    return false;
                const target = moves.maxRaiseTo;
                const isRaise = target > state.currentBet;
                if (isRaise && seat.raiseLocked)
                    return false;
                const betBefore = seat.bet;
                this.commit(room, socketId, target - seat.bet, 'ALL_IN');
                if (isRaise) {
                    state.currentBet = target;
                    if (target >= moves.minRaiseTo) {
                        const raiseSize = target - betBefore;
                        state.minRaiseTo = target + raiseSize;
                        for (const id of state.playerOrder)
                            state.seats[id].raiseLocked = false;
                    }
                    else {
                        for (const id of state.playerOrder) {
                            if (id !== socketId && state.seats[id].hasActed)
                                state.seats[id].raiseLocked = true;
                        }
                    }
                }
                break;
            }
            default:
                return false;
        }
        seat.hasActed = true;
        const live = state.playerOrder.filter((id) => state.seats[id].status === 'ACTIVE' || state.seats[id].status === 'ALL_IN');
        if (live.length === 1) {
            this.awardUncontested(room, live[0]);
            return true;
        }
        for (const id of state.playerOrder) {
            if (id !== socketId &&
                state.seats[id].status === 'ACTIVE' &&
                state.seats[id].bet < state.currentBet) {
                state.seats[id].hasActed = false;
            }
        }
        if ((0, poker_engine_1.bettingRoundComplete)(state)) {
            this.closeStreet(room);
        }
        else {
            this.setActive(room, this.nextToAct(state, socketId));
        }
        return true;
    }
    closeStreet(room) {
        const state = room.pokerState;
        for (const id of state.playerOrder) {
            state.pot += state.seats[id].bet;
            state.seats[id].bet = 0;
            state.seats[id].hasActed = false;
            state.seats[id].raiseLocked = false;
        }
        state.currentBet = 0;
        state.minRaiseTo = this.bigBlind(room);
        state.activePlayerId = null;
        if (state.phase === 'RIVER') {
            this.enterShowdown(room);
            return;
        }
        const street = (0, poker_engine_1.nextStreet)(state.phase);
        if (state.mode === 'ONLINE')
            this.dealCommunity(room, street);
        state.phase = street;
        if (!(0, poker_engine_1.bettingPossible)(state)) {
            if (state.mode === 'ONLINE') {
                let phase = street;
                while (phase !== 'RIVER') {
                    phase = (0, poker_engine_1.nextStreet)(phase);
                    this.dealCommunity(room, phase);
                }
            }
            state.phase = 'RIVER';
            this.enterShowdown(room);
            return;
        }
        this.setActive(room, this.nextSeatAfter(state, state.dealerId));
    }
    dealCommunity(room, street) {
        const state = room.pokerState;
        const deck = this.privateStateService.get(room.code, ENGINE_SOCKET_ID, DECK_KEY) ?? [];
        const count = street === 'FLOP' ? 3 : street === 'TURN' || street === 'RIVER' ? 1 : 0;
        for (let i = 0; i < count; i++) {
            const card = deck.pop();
            if (card)
                state.board.push(card);
        }
        this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);
    }
    enterShowdown(room) {
        const state = room.pokerState;
        state.activePlayerId = null;
        state.turnDeadline = null;
        const live = state.playerOrder.filter((id) => state.seats[id].status === 'ACTIVE' || state.seats[id].status === 'ALL_IN');
        for (const id of state.playerOrder) {
            state.pot += state.seats[id].bet;
            state.seats[id].bet = 0;
        }
        if (state.mode === 'CHIPS_LEDGER') {
            state.showdown = {
                awaitingRevealIds: [],
                revealedCards: {},
                pendingPots: (0, poker_engine_1.buildSidePots)(state.seats),
            };
            state.phase = 'SHOWDOWN';
            return;
        }
        const results = this.settlePots(room, live);
        state.handResult = { pots: results };
        state.showdown = {
            awaitingRevealIds: [...live],
            revealedCards: {},
            pendingPots: [],
        };
        state.phase = 'SHOWDOWN';
    }
    settlePots(room, live) {
        const state = room.pokerState;
        const pots = (0, poker_engine_1.buildSidePots)(state.seats);
        const board = state.board;
        const evaluations = new Map();
        for (const id of live) {
            const hole = this.holeCards(room.code, id) ?? [];
            evaluations.set(id, (0, poker_engine_1.evaluateHand)([...hole, ...board]));
        }
        const results = [];
        for (const pot of pots) {
            const contenders = pot.eligiblePlayerIds.filter((id) => evaluations.has(id));
            if (contenders.length === 0)
                continue;
            let winners = [contenders[0]];
            for (const id of contenders.slice(1)) {
                const cmp = (0, poker_engine_1.compareEvaluations)(evaluations.get(id), evaluations.get(winners[0]));
                if (cmp > 0)
                    winners = [id];
                else if (cmp === 0)
                    winners.push(id);
            }
            this.distribute(room, pot.amount, winners);
            const best = evaluations.get(winners[0]);
            results.push({
                amount: pot.amount,
                winnerIds: winners,
                handCategory: best.category,
                bestCards: winners.length === 1 ? best.best : undefined,
            });
        }
        for (const id of state.playerOrder)
            state.seats[id].totalBet = 0;
        state.pot = 0;
        return results;
    }
    applyReveal(room, socketId, show) {
        const state = room.pokerState;
        if (state.phase !== 'SHOWDOWN' || state.mode !== 'ONLINE' || !state.showdown)
            return false;
        if (!state.showdown.awaitingRevealIds.includes(socketId))
            return false;
        state.showdown.awaitingRevealIds = state.showdown.awaitingRevealIds.filter((id) => id !== socketId);
        if (show) {
            const cards = this.holeCards(room.code, socketId) ?? [];
            state.showdown.revealedCards[socketId] = cards;
            state.seats[socketId].cardsRevealed = true;
            const board = state.board;
            if (cards.length > 0 && board.length >= 3) {
                state.seats[socketId].handCategory = (0, poker_engine_1.evaluateHand)([...cards, ...board]).category;
            }
        }
        if (state.showdown.awaitingRevealIds.length === 0) {
            state.phase = 'HAND_RESULT';
        }
        return true;
    }
    awardUncontested(room, winnerId) {
        const state = room.pokerState;
        const refund = (0, poker_engine_1.uncalledBetPortion)(state.seats);
        let potTotal = state.pot;
        for (const id of state.playerOrder)
            potTotal += state.seats[id].bet;
        let award = potTotal;
        if (refund && refund.playerId === winnerId) {
            award -= refund.amount;
            state.seats[winnerId].chips += refund.amount;
        }
        state.seats[winnerId].chips += award;
        state.handResult = {
            pots: [{ amount: award, winnerIds: [winnerId] }],
            ...(refund && refund.playerId === winnerId ? { uncalledRefund: refund } : {}),
        };
        for (const id of state.playerOrder) {
            state.seats[id].totalBet = 0;
            state.seats[id].bet = 0;
        }
        state.pot = 0;
        state.showdown = { awaitingRevealIds: [], revealedCards: {}, pendingPots: [] };
        state.phase = 'HAND_RESULT';
        state.activePlayerId = null;
        state.turnDeadline = null;
    }
    awardPot(room, targetIds) {
        const state = room.pokerState;
        if (state.phase !== 'SHOWDOWN' || !state.showdown)
            return false;
        const pot = state.showdown.pendingPots[0];
        if (!pot)
            return false;
        if (!Array.isArray(targetIds) || targetIds.length === 0)
            return false;
        if (!targetIds.every((id) => pot.eligiblePlayerIds.includes(id)))
            return false;
        this.distribute(room, pot.amount, targetIds);
        state.handResult = {
            pots: [...(state.handResult?.pots ?? []), { amount: pot.amount, winnerIds: [...targetIds] }],
        };
        state.showdown.pendingPots = state.showdown.pendingPots.slice(1);
        if (state.showdown.pendingPots.length === 0) {
            for (const id of state.playerOrder)
                state.seats[id].totalBet = 0;
            state.pot = 0;
            state.phase = 'HAND_RESULT';
        }
        return true;
    }
    rebuy(room, targetId) {
        const state = room.pokerState;
        if (!state)
            return false;
        const seat = state.seats[targetId];
        if (!seat || seat.chips > 0)
            return false;
        if (!room.players.some((p) => p.socketId === targetId && !p.isViewer))
            return false;
        seat.chips += this.startingStack(room);
        return true;
    }
    adjustChips(room, targetId, amount) {
        const state = room.pokerState;
        const seat = state.seats[targetId];
        if (!seat || !Number.isInteger(amount))
            return false;
        seat.chips = Math.max(0, seat.chips + amount);
        return true;
    }
    endMatch(room) {
        const state = room.pokerState;
        const seats = state?.seats ?? {};
        for (const player of room.players) {
            if (player.isViewer)
                continue;
            player.score = seats[player.socketId]?.chips ?? 0;
        }
        if (state) {
            state.phase = 'HAND_RESULT';
            state.activePlayerId = null;
            state.turnDeadline = null;
        }
        this.clearAllHoleCards(room);
        room.status = types_1.RoomStatus.RESULT;
    }
    commit(room, playerId, amount, action) {
        const state = room.pokerState;
        const seat = state.seats[playerId];
        const pay = Math.min(amount, seat.chips);
        seat.chips -= pay;
        seat.bet += pay;
        seat.totalBet += pay;
        seat.lastAction = pay < amount && action !== 'ANTE' ? 'ALL_IN' : action;
        seat.lastActionAmount = pay;
        if (seat.chips === 0 && seat.status === 'ACTIVE')
            seat.status = 'ALL_IN';
    }
    distribute(room, amount, winnerIds) {
        const state = room.pokerState;
        const ordered = [...winnerIds].sort((a, b) => this.seatsFromDealer(state).indexOf(a) - this.seatsFromDealer(state).indexOf(b));
        const base = Math.floor(amount / ordered.length);
        let remainder = amount - base * ordered.length;
        for (const id of ordered) {
            const share = base + (remainder > 0 ? 1 : 0);
            if (remainder > 0)
                remainder -= 1;
            state.seats[id].chips += share;
        }
    }
    seatsFromDealer(state) {
        const eligible = state.playerOrder.filter((id) => state.seats[id]);
        if (!state.dealerId)
            return eligible;
        const dealerIndex = eligible.indexOf(state.dealerId);
        if (dealerIndex === -1)
            return eligible;
        return [...eligible.slice(dealerIndex + 1), ...eligible.slice(0, dealerIndex + 1)];
    }
    setActive(room, playerId) {
        const state = room.pokerState;
        state.activePlayerId = playerId;
        const enabled = room.config.pokerTurnTimerEnabled !== false;
        const seconds = room.config.pokerTurnTimerSeconds ?? 30;
        state.turnDeadline = playerId && enabled && seconds > 0 ? Date.now() + seconds * 1000 : null;
    }
    nextToAct(state, afterId) {
        const order = this.seatsFromDealer(state);
        const startIndex = order.indexOf(afterId);
        for (let i = 1; i <= order.length; i++) {
            const id = order[(startIndex + i) % order.length];
            const seat = state.seats[id];
            if (seat.status !== 'ACTIVE')
                continue;
            if (!seat.hasActed || seat.bet < state.currentBet)
                return id;
        }
        const anyActive = order.find((id) => state.seats[id].status === 'ACTIVE');
        return anyActive ?? null;
    }
    nextSeatAfter(state, afterId) {
        const order = this.seatsFromDealer(state);
        const startIndex = order.indexOf(afterId);
        for (let i = 1; i <= order.length; i++) {
            const id = order[(startIndex + i) % order.length];
            if (state.seats[id].status === 'ACTIVE')
                return id;
        }
        return null;
    }
    nextSeatIn(ids, afterId) {
        const index = ids.indexOf(afterId);
        return ids[(index + 1) % ids.length];
    }
    holeCards(roomCode, socketId) {
        return this.privateStateService.get(roomCode, socketId, PRIVATE_KEY)?.holeCards;
    }
    clearAllHoleCards(room) {
        for (const player of room.players) {
            this.privateStateService.delete(room.code, player.socketId, PRIVATE_KEY);
        }
    }
    remapRecord(record, oldKey, newKey) {
        if (!(oldKey in record))
            return record;
        const { [oldKey]: value, ...remaining } = record;
        return { ...remaining, [newKey]: value };
    }
    smallBlind(room) {
        return Math.max(1, room.config.pokerSmallBlind ?? 10);
    }
    bigBlind(room) {
        return Math.max(this.smallBlind(room), room.config.pokerBigBlind ?? 20);
    }
    ante(room) {
        return Math.max(0, room.config.pokerAnte ?? 0);
    }
    startingStack(room) {
        return Math.max(10, room.config.pokerStartingStack ?? 1000);
    }
};
exports.PokerService = PokerService;
exports.PokerService = PokerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], PokerService);
//# sourceMappingURL=poker.service.js.map