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
exports.PokerV2Service = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const poker_v2_advisor_1 = require("./poker-v2-advisor");
const poker_engine_1 = require("../poker/poker-engine");
const PRIVATE_KEY = 'pokerV2';
const ENGINE_SOCKET_ID = '__poker-v2-engine__';
const DECK_KEY = 'deck';
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 9;
const MAX_HISTORY = 20;
let PokerV2Service = class PokerV2Service {
    constructor(privateStateService) {
        this.privateStateService = privateStateService;
    }
    startMatch(room, requesterId) {
        if (room.gameType !== types_1.GameType.POKER_V2 || room.roomHostId !== requesterId)
            return null;
        if (room.status !== types_1.RoomStatus.LOBBY && room.status !== types_1.RoomStatus.RESULT) {
            return null;
        }
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
        room.pokerV2State = {
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
            nextHandDeadline: null,
            history: [],
        };
        room.status = types_1.RoomStatus.PLAYING;
        this.clearAllPrivate(room);
        this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
        this.dealHand(room);
        return room;
    }
    resetMatch(room, requesterId) {
        if (room.gameType !== types_1.GameType.POKER_V2 || room.roomHostId !== requesterId)
            return null;
        room.pokerV2State = undefined;
        this.clearAllPrivate(room);
        this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, DECK_KEY);
        room.status = types_1.RoomStatus.LOBBY;
        return room;
    }
    handleAction(room, socketId, action) {
        const state = room.pokerV2State;
        if (!state || room.gameType !== types_1.GameType.POKER_V2)
            return null;
        if (!action || typeof action !== 'object' || typeof action.type !== 'string')
            return null;
        const isHost = room.roomHostId === socketId;
        switch (action.type) {
            case 'START_HAND':
                if (!state.playerOrder.includes(socketId))
                    return null;
                if (state.phase !== 'HAND_RESULT')
                    return null;
                this.dealHand(room);
                return room;
            case 'END_MATCH':
                if (!isHost)
                    return null;
                this.endMatch(room);
                return room;
            case 'FOLD':
            case 'CHECK':
            case 'CALL':
            case 'BET':
            case 'ALL_IN':
                return this.applyBettingAction(room, socketId, action) ? room : null;
            default:
                return null;
        }
    }
    resolveAutoAction(room) {
        const state = room.pokerV2State;
        if (!state || !isStreetPhase(state.phase) || !state.activePlayerId)
            return null;
        const seat = state.seats[state.activePlayerId];
        if (!seat)
            return null;
        const toCall = Math.max(0, state.currentBet - seat.bet);
        return {
            playerId: state.activePlayerId,
            action: { type: toCall === 0 ? 'CHECK' : 'FOLD' },
        };
    }
    autoDealIfDue(room) {
        const state = room.pokerV2State;
        if (!state || state.phase !== 'HAND_RESULT')
            return false;
        if (!state.nextHandDeadline || Date.now() < state.nextHandDeadline)
            return false;
        this.dealHand(room);
        return true;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.dealerId === oldSocketId)
            state.dealerId = newSocketId;
        if (state.activePlayerId === oldSocketId)
            state.activePlayerId = newSocketId;
        state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
        state.seats = remapRecord(state.seats, oldSocketId, newSocketId);
        if (state.showdown) {
            state.showdown.revealedCards = remapRecord(state.showdown.revealedCards, oldSocketId, newSocketId);
        }
        if (state.handResult) {
            state.handResult.pots = state.handResult.pots.map((pot) => ({
                ...pot,
                winnerIds: pot.winnerIds.map((id) => (id === oldSocketId ? newSocketId : id)),
                eligiblePlayerIds: pot.eligiblePlayerIds?.map((id) => id === oldSocketId ? newSocketId : id),
            }));
            if (state.handResult.uncalledRefund?.playerId === oldSocketId) {
                state.handResult.uncalledRefund.playerId = newSocketId;
            }
        }
    }
    handlePlayerRemoved(room, socketId) {
        const state = room.pokerV2State;
        if (!state || !isStreetPhase(state.phase))
            return;
        const seat = state.seats[socketId];
        if (!seat || seat.status !== 'ACTIVE')
            return;
        seat.status = 'FOLDED';
        seat.lastAction = 'FOLD';
        this.deletePrivate(room, socketId);
        this.recomputeAdvisors(room);
        this.advanceAfterAction(room, socketId);
    }
    dealHand(room) {
        const state = room.pokerV2State;
        const bigBlind = this.bigBlind(room);
        for (const id of state.playerOrder) {
            this.deletePrivate(room, id);
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
            seat.handCategory = undefined;
            seat.handRank = undefined;
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
        state.nextHandDeadline = null;
        state.dealerId = state.dealerId
            ? this.nextSeatIn(eligible, state.dealerId)
            : eligible[(0, crypto_1.randomInt)(eligible.length)];
        const deck = (0, poker_engine_1.shuffleDeck)((0, poker_engine_1.createDeck)());
        this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);
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
        for (const id of eligible) {
            const holeCards = [deck.pop(), deck.pop()];
            this.privateStateService.set(room.code, id, PRIVATE_KEY, {
                holeCards,
            });
        }
        state.phase = 'PREFLOP';
        this.recomputeAdvisors(room);
        if (bettingRoundComplete(state)) {
            this.closeStreet(room);
        }
        else {
            this.setActive(room, this.nextSeatAfter(state, bbId));
        }
    }
    applyBettingAction(room, socketId, action) {
        const state = room.pokerV2State;
        if (!isStreetPhase(state.phase) || state.activePlayerId !== socketId)
            return false;
        const seat = state.seats[socketId];
        const moves = legalMoves(state, socketId);
        if (!moves)
            return false;
        switch (action.type) {
            case 'FOLD':
                seat.status = 'FOLDED';
                seat.lastAction = 'FOLD';
                this.deletePrivate(room, socketId);
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
                const raiseTo = action.amount;
                if (raiseTo < moves.minRaiseTo || raiseTo > moves.maxRaiseTo)
                    return false;
                const previousBet = state.currentBet;
                this.commit(room, socketId, raiseTo - seat.bet, previousBet === 0 ? 'BET' : 'RAISE');
                this.recordRaise(state, socketId, raiseTo, previousBet);
                break;
            }
            case 'ALL_IN': {
                if (moves.maxRaiseTo <= state.currentBet && seat.bet === state.currentBet)
                    return false;
                const target = moves.maxRaiseTo;
                const isRaise = target > state.currentBet;
                if (isRaise && seat.raiseLocked)
                    return false;
                if (isRaise &&
                    !state.playerOrder.some((id) => id !== socketId && state.seats[id].status === 'ACTIVE')) {
                    return false;
                }
                const previousBet = state.currentBet;
                this.commit(room, socketId, target - seat.bet, 'ALL_IN');
                if (isRaise) {
                    this.recordRaise(state, socketId, target, previousBet);
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
        this.advanceAfterAction(room, socketId);
        return true;
    }
    advanceAfterAction(room, actorId) {
        const state = room.pokerV2State;
        for (const id of state.playerOrder) {
            if (id !== actorId &&
                state.seats[id].status === 'ACTIVE' &&
                state.seats[id].bet < state.currentBet) {
                state.seats[id].hasActed = false;
            }
        }
        if (state.seats[actorId].status === 'FOLDED') {
            this.recomputeAdvisors(room);
        }
        if (bettingRoundComplete(state)) {
            this.closeStreet(room);
        }
        else {
            this.setActive(room, this.nextToAct(state, actorId));
        }
    }
    recordRaise(state, raiserId, raiseTo, previousBet) {
        const fullIncrement = Math.max(1, state.minRaiseTo - previousBet);
        const increment = raiseTo - previousBet;
        state.currentBet = raiseTo;
        state.minRaiseTo = raiseTo + (increment >= fullIncrement ? increment : fullIncrement);
        if (increment >= fullIncrement) {
            for (const id of state.playerOrder)
                state.seats[id].raiseLocked = false;
        }
        else {
            for (const id of state.playerOrder) {
                if (id === raiserId)
                    continue;
                const seat = state.seats[id];
                if (seat.status !== 'ACTIVE' || (!seat.hasActed && !seat.raiseLocked))
                    continue;
                seat.raiseLocked = raiseTo - seat.bet < fullIncrement;
            }
        }
    }
    closeStreet(room) {
        const state = room.pokerV2State;
        for (const id of state.playerOrder) {
            state.pot += state.seats[id].bet;
            state.seats[id].bet = 0;
            state.seats[id].hasActed = false;
            state.seats[id].raiseLocked = false;
        }
        state.currentBet = 0;
        state.minRaiseTo = this.bigBlind(room);
        state.activePlayerId = null;
        state.turnDeadline = null;
        if (state.phase === 'RIVER') {
            this.enterShowdown(room);
            return;
        }
        const street = nextStreet(state.phase);
        const deck = this.privateStateService.get(room.code, ENGINE_SOCKET_ID, DECK_KEY) ?? [];
        const count = street === 'FLOP' ? 3 : street === 'TURN' || street === 'RIVER' ? 1 : 0;
        for (let i = 0; i < count; i++) {
            const card = deck.pop();
            if (card)
                state.board.push(card);
        }
        this.privateStateService.set(room.code, ENGINE_SOCKET_ID, DECK_KEY, deck);
        state.phase = street;
        if (!bettingPossible(state)) {
            while (state.phase !== 'RIVER') {
                const next = nextStreet(state.phase);
                for (let i = 0; i < (next === 'FLOP' ? 3 : 1); i++) {
                    const card = deck.pop();
                    if (card)
                        state.board.push(card);
                }
                state.phase = next;
            }
            this.enterShowdown(room);
            return;
        }
        this.recomputeAdvisors(room);
        this.setActive(room, this.nextSeatAfter(state, state.dealerId));
    }
    enterShowdown(room) {
        const state = room.pokerV2State;
        state.activePlayerId = null;
        state.turnDeadline = null;
        const live = state.playerOrder.filter((id) => state.seats[id].status === 'ACTIVE' || state.seats[id].status === 'ALL_IN');
        for (const id of state.playerOrder) {
            state.pot += state.seats[id].bet;
            state.seats[id].bet = 0;
        }
        const revealedCards = {};
        const evaluations = new Map();
        for (const id of live) {
            const cards = this.holeCards(room.code, id) ?? [];
            revealedCards[id] = cards;
            evaluations.set(id, (0, poker_engine_1.evaluateHand)([...cards, ...state.board]));
        }
        state.showdown = { revealedCards };
        const results = this.settlePots(room, live, evaluations);
        state.handResult = { pots: results };
        for (const id of state.playerOrder) {
            this.deletePrivate(room, id);
        }
        state.phase = 'HAND_RESULT';
        this.recordHistory(room);
        const fundable = state.playerOrder.filter((id) => state.seats[id].chips > 0);
        if (fundable.length <= 1) {
            state.handResult.matchEnded = true;
            this.endMatch(room);
            return;
        }
        this.armNextHand(room);
    }
    recordHistory(room) {
        const state = room.pokerV2State;
        const result = state.handResult;
        if (!result)
            return;
        const revealedCards = {};
        const seatHands = {};
        for (const [id, cards] of Object.entries(state.showdown?.revealedCards ?? {})) {
            if (cards.length > 0)
                revealedCards[id] = [...cards];
        }
        for (const id of Object.keys(revealedCards)) {
            const category = state.seats[id]?.handCategory;
            if (category)
                seatHands[id] = category;
        }
        state.history = [
            ...state.history,
            {
                handNumber: state.handNumber,
                board: [...state.board],
                pots: result.pots.map((pot) => ({
                    winnerIds: [...pot.winnerIds],
                    amount: pot.amount,
                    handCategory: pot.handCategory,
                })),
                revealedCards,
                seatHands,
                ...(result.uncalledRefund ? { uncalledRefund: { ...result.uncalledRefund } } : {}),
            },
        ].slice(-MAX_HISTORY);
    }
    settlePots(room, live, evaluations) {
        const state = room.pokerV2State;
        const pots = (0, poker_engine_1.buildSidePots)(state.seats);
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
                eligiblePlayerIds: pot.eligiblePlayerIds,
                handCategory: best.category,
                bestCards: winners.length === 1 ? best.best : undefined,
            });
        }
        for (const id of live) {
            const evaluation = evaluations.get(id);
            if (!evaluation)
                continue;
            state.seats[id].handCategory = evaluation.category;
            state.seats[id].handRank = evaluation.catIndex;
        }
        for (const id of state.playerOrder)
            state.seats[id].totalBet = 0;
        state.pot = 0;
        return results;
    }
    awardUncontested(room, winnerId) {
        const state = room.pokerV2State;
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
            pots: [{ amount: award, winnerIds: [winnerId], eligiblePlayerIds: [winnerId] }],
            ...(refund && refund.playerId === winnerId ? { uncalledRefund: refund } : {}),
        };
        for (const id of state.playerOrder) {
            state.seats[id].totalBet = 0;
            state.seats[id].bet = 0;
        }
        state.pot = 0;
        state.showdown = { revealedCards: {} };
        for (const id of state.playerOrder) {
            this.deletePrivate(room, id);
        }
        state.phase = 'HAND_RESULT';
        state.activePlayerId = null;
        state.turnDeadline = null;
        this.recordHistory(room);
        const fundable = state.playerOrder.filter((id) => state.seats[id].chips > 0);
        if (fundable.length <= 1) {
            state.handResult.matchEnded = true;
            this.endMatch(room);
            return;
        }
        this.armNextHand(room);
    }
    armNextHand(room) {
        const state = room.pokerV2State;
        const seconds = this.autoDealSeconds(room);
        state.nextHandSeconds = seconds;
        state.nextHandDeadline = Date.now() + seconds * 1000;
    }
    endMatch(room) {
        const state = room.pokerV2State;
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
            state.nextHandDeadline = null;
        }
        this.clearAllPrivate(room);
        room.status = types_1.RoomStatus.RESULT;
    }
    recomputeAdvisors(room) {
        const state = room.pokerV2State;
        if (!state || room.status !== types_1.RoomStatus.PLAYING)
            return;
        if (!isStreetPhase(state.phase))
            return;
        if (room.config.pokerV2AdvisorEnabled === false)
            return;
        const live = [];
        for (const id of state.playerOrder) {
            const seat = state.seats[id];
            if (seat.status !== 'ACTIVE' && seat.status !== 'ALL_IN')
                continue;
            const hole = this.holeCards(room.code, id);
            if (!hole || hole.length !== 2)
                continue;
            live.push({ socketId: id, holeCards: hole });
        }
        const equities = (0, poker_v2_advisor_1.simulateEquity)(live, state.board);
        for (const entry of live) {
            const equity = equities.get(entry.socketId) ?? 0;
            const advisor = (0, poker_v2_advisor_1.buildAdvisor)(entry.holeCards, state.board, equity);
            const current = this.privateStateService.get(room.code, entry.socketId, PRIVATE_KEY);
            this.privateStateService.set(room.code, entry.socketId, PRIVATE_KEY, {
                ...current,
                advisor,
            });
        }
    }
    commit(room, playerId, amount, action) {
        const state = room.pokerV2State;
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
        const state = room.pokerV2State;
        const seatsOrder = this.seatsFromDealer(state);
        const ordered = [...winnerIds].sort((a, b) => seatsOrder.indexOf(a) - seatsOrder.indexOf(b));
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
        const state = room.pokerV2State;
        state.activePlayerId = playerId;
        const enabled = room.config.pokerV2TurnTimerEnabled !== false;
        const seconds = room.config.pokerV2TurnTimerSeconds ?? 20;
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
        return this.privateStateService.get(roomCode, socketId, PRIVATE_KEY)
            ?.holeCards;
    }
    deletePrivate(room, socketId) {
        this.privateStateService.delete(room.code, socketId, PRIVATE_KEY);
    }
    clearAllPrivate(room) {
        for (const player of room.players) {
            this.deletePrivate(room, player.socketId);
        }
    }
    smallBlind(room) {
        return Math.max(1, room.config.pokerV2SmallBlind ?? 10);
    }
    bigBlind(room) {
        return Math.max(this.smallBlind(room), room.config.pokerV2BigBlind ?? 20);
    }
    ante(room) {
        return Math.max(0, room.config.pokerV2Ante ?? 0);
    }
    startingStack(room) {
        return Math.max(10, room.config.pokerV2StartingStack ?? 1000);
    }
    autoDealSeconds(room) {
        return Math.min(60, Math.max(3, room.config.pokerV2AutoDealSeconds ?? 10));
    }
};
exports.PokerV2Service = PokerV2Service;
exports.PokerV2Service = PokerV2Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], PokerV2Service);
const POKER_V2_STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
function isStreetPhase(phase) {
    return POKER_V2_STREETS.includes(phase);
}
function nextStreet(phase) {
    switch (phase) {
        case 'PREFLOP':
            return 'FLOP';
        case 'FLOP':
            return 'TURN';
        case 'TURN':
            return 'RIVER';
        default:
            return null;
    }
}
function actableSeats(state) {
    return state.playerOrder.filter((id) => state.seats[id]?.status === 'ACTIVE');
}
function bettingRoundComplete(state) {
    const inHand = state.playerOrder.filter((id) => {
        const status = state.seats[id]?.status;
        return status === 'ACTIVE' || status === 'ALL_IN';
    });
    if (inHand.length <= 1)
        return true;
    const actionable = actableSeats(state);
    if (actionable.length === 0)
        return true;
    if (actionable.length === 1) {
        const seat = state.seats[actionable[0]];
        return seat.hasActed && seat.bet >= state.currentBet;
    }
    return actionable.every((id) => {
        const seat = state.seats[id];
        return seat.hasActed && seat.bet === state.currentBet;
    });
}
function bettingPossible(state) {
    return actableSeats(state).length >= 2;
}
function legalMoves(state, playerId) {
    const seat = state.seats[playerId];
    if (!seat || seat.status !== 'ACTIVE')
        return null;
    const toCall = Math.max(0, state.currentBet - seat.bet);
    const callAmount = Math.min(toCall, seat.chips);
    const maxRaiseTo = seat.chips + seat.bet;
    const canCheck = toCall === 0;
    const othersActive = state.playerOrder.some((id) => id !== playerId && state.seats[id].status === 'ACTIVE');
    const minRaiseTo = Math.max(state.minRaiseTo, state.currentBet + 1);
    return {
        canFold: true,
        canCheck,
        callAmount,
        canBet: othersActive && !seat.raiseLocked && maxRaiseTo >= minRaiseTo,
        minRaiseTo,
        maxRaiseTo,
    };
}
function remapRecord(record, oldKey, newKey) {
    if (!(oldKey in record))
        return record;
    const { [oldKey]: value, ...remaining } = record;
    return { ...remaining, [newKey]: value };
}
//# sourceMappingURL=poker-v2.service.js.map