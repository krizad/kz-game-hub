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
var SaboteurService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaboteurService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
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
let SaboteurService = SaboteurService_1 = class SaboteurService {
    constructor(privateState) {
        this.privateState = privateState;
        this.logger = new common_1.Logger(SaboteurService_1.name);
    }
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    getRole(room, socketId) {
        return this.privateState.get(room.code, socketId, SB_ROLE);
    }
    setRole(room, socketId, role) {
        this.privateState.set(room.code, socketId, SB_ROLE, role);
    }
    getHand(room, socketId) {
        return this.privateState.get(room.code, socketId, SB_HAND) ?? [];
    }
    setHand(room, socketId, hand) {
        if (hand.length === 0) {
            this.privateState.delete(room.code, socketId, SB_HAND);
        }
        else {
            this.privateState.set(room.code, socketId, SB_HAND, hand);
        }
    }
    getPeekedGoals(room, socketId) {
        return (this.privateState.get(room.code, socketId, SB_PEEKED) ??
            {});
    }
    getDeck(room) {
        return this.privateState.get(room.code, ROOM_KEY, SB_ROOM_DECK) ?? [];
    }
    setDeck(room, deck) {
        this.privateState.set(room.code, ROOM_KEY, SB_ROOM_DECK, deck);
    }
    getGoldDeck(room) {
        return this.privateState.get(room.code, ROOM_KEY, SB_ROOM_GOLD_DECK) ?? [];
    }
    setGoldDeck(room, goldDeck) {
        this.privateState.set(room.code, ROOM_KEY, SB_ROOM_GOLD_DECK, goldDeck);
    }
    getGoalContents(room) {
        return (this.privateState.get(room.code, ROOM_KEY, SB_ROOM_GOALS) ?? [
            'STONE',
            'STONE',
            'STONE',
        ]);
    }
    setGoalContents(room, contents) {
        this.privateState.set(room.code, ROOM_KEY, SB_ROOM_GOALS, contents);
    }
    clearRoundPrivateData(room) {
        for (const p of room.players) {
            this.privateState.delete(room.code, p.socketId, SB_ROLE);
            this.privateState.delete(room.code, p.socketId, SB_HAND);
            this.privateState.delete(room.code, p.socketId, SB_PEEKED);
        }
        this.privateState.delete(room.code, ROOM_KEY, SB_ROOM_DECK);
        this.privateState.delete(room.code, ROOM_KEY, SB_ROOM_LEFTOVER_ROLE);
    }
    buildDrawPile() {
        const pile = [];
        for (const def of types_1.SABOTEUR_DRAW_CARDS) {
            for (let i = 0; i < def.quantity; i++)
                pile.push(def.id);
        }
        return this.shuffleArray(pile);
    }
    isMember(room, socketId) {
        return room.players.some((p) => p.socketId === socketId);
    }
    drawCard(room, socketId) {
        const state = room.saboteurState;
        const deck = this.getDeck(room);
        const card = deck.pop();
        this.setDeck(room, deck);
        state.stockCount = deck.length;
        if (!card)
            return;
        const hand = this.getHand(room, socketId);
        hand.push({ cardId: card });
        this.setHand(room, socketId, hand);
    }
    syncHandSizes(room) {
        const state = room.saboteurState;
        for (const [socketId, player] of Object.entries(state.players)) {
            player.handSize = this.getHand(room, socketId).length;
        }
    }
    connectedPlayerIds(room) {
        return room.players.filter((p) => p.connected !== false).map((p) => p.socketId);
    }
    assignRoles(room, playerIds) {
        const saboteurCount = types_1.SABOTEUR_ROLE_TABLE[playerIds.length] ?? Math.floor(playerIds.length / 3);
        const shuffled = this.shuffleArray(playerIds);
        const saboteurs = new Set(shuffled.slice(0, saboteurCount));
        const undealtCount = 11 - playerIds.length;
        const undealtSaboteurs = 4 - saboteurCount;
        const leftoverSaboteur = undealtCount > 0 && Math.random() < undealtSaboteurs / undealtCount;
        this.privateState.set(room.code, ROOM_KEY, SB_ROOM_LEFTOVER_ROLE, leftoverSaboteur ? types_1.SaboteurRole.SABOTEUR : types_1.SaboteurRole.MINER);
        for (const id of playerIds) {
            this.setRole(room, id, saboteurs.has(id) ? types_1.SaboteurRole.SABOTEUR : types_1.SaboteurRole.MINER);
        }
    }
    buildInitialBoard() {
        const board = {};
        board[(0, types_1.saboteurCellKey)(types_1.SABOTEUR_START_POS.x, types_1.SABOTEUR_START_POS.y)] = {
            cardId: types_1.SABOTEUR_START_CARD.id,
            rotation: 0,
        };
        for (const goal of types_1.SABOTEUR_GOAL_POSITIONS) {
            board[(0, types_1.saboteurCellKey)(goal.x, goal.y)] = { cardId: types_1.SABOTEUR_GOAL_CARD.id, rotation: 0 };
        }
        return board;
    }
    initPlayers(room, turnOrder, handSize, prevScores) {
        const players = {};
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
    startRound(room, roundNumber) {
        const turnOrder = this.connectedPlayerIds(room);
        const handSize = types_1.SABOTEUR_HAND_SIZE_TABLE[turnOrder.length] ?? 4;
        const prevScores = {};
        for (const [id, p] of Object.entries(room.saboteurState?.players ?? {})) {
            prevScores[id] = p.score;
        }
        this.clearRoundPrivateData(room);
        this.assignRoles(room, turnOrder);
        const goldContents = this.shuffleArray([
            'GOLD',
            'STONE',
            'STONE',
        ]);
        this.setGoalContents(room, goldContents);
        const deck = this.buildDrawPile();
        this.setDeck(room, deck);
        if (this.getGoldDeck(room).length === 0) {
            this.setGoldDeck(room, this.shuffleArray(types_1.SABOTEUR_GOLD_DECK));
        }
        const starterIndex = (roundNumber - 1) % Math.max(turnOrder.length, 1);
        room.saboteurState = {
            currentPhase: types_1.SaboteurPhase.PLAYING,
            round: roundNumber,
            activePlayerId: turnOrder[starterIndex] ?? null,
            turnOrder,
            board: this.buildInitialBoard(),
            goalCells: types_1.SABOTEUR_GOAL_POSITIONS.map((g) => ({ x: g.x, y: g.y })),
            revealedGoals: [null, null, null],
            stockCount: deck.length,
            players: {},
            lastAction: null,
            roundResult: null,
            finalResults: null,
        };
        room.saboteurState.players = this.initPlayers(room, turnOrder, handSize, prevScores);
        for (const id of turnOrder) {
            for (let i = 0; i < handSize; i++)
                this.drawCard(room, id);
        }
        this.syncHandSizes(room);
    }
    startGame(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const connected = this.connectedPlayerIds(room);
        if (connected.length < MIN_PLAYERS || connected.length > MAX_PLAYERS)
            return null;
        this.setGoldDeck(room, this.shuffleArray(types_1.SABOTEUR_GOLD_DECK));
        this.startRound(room, 1);
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    advanceTurn(room) {
        const state = room.saboteurState;
        const order = state.turnOrder;
        if (order.length === 0)
            return;
        const activeIds = new Set(this.connectedPlayerIds(room));
        const deckDry = this.getDeck(room).length === 0 && state.stockCount === 0;
        const canAct = (id) => {
            if (!deckDry)
                return true;
            return (state.players[id]?.handSize ?? 0) > 0;
        };
        const idx = order.indexOf(state.activePlayerId ?? order[0]);
        let fallback = null;
        for (let step = 1; step <= order.length; step++) {
            const candidate = order[(idx + step) % order.length];
            if (!activeIds.has(candidate))
                continue;
            if (canAct(candidate)) {
                state.activePlayerId = candidate;
                return;
            }
            if (fallback === null)
                fallback = candidate;
        }
        if (fallback) {
            state.activePlayerId = fallback;
            this.checkExhaustionEnd(room);
        }
    }
    checkExhaustionEnd(room) {
        const state = room.saboteurState;
        if (state.currentPhase !== types_1.SaboteurPhase.PLAYING)
            return false;
        const deckEmpty = this.getDeck(room).length === 0 && state.stockCount === 0;
        const handsEmpty = Object.values(state.players).every((p) => p.handSize === 0);
        if (!deckEmpty || !handsEmpty)
            return false;
        this.endRoundSaboteursWin(room);
        return true;
    }
    placePath(room, playerId, cardIndex, x, y, rotation) {
        const state = room.saboteurState;
        if (!state || state.currentPhase !== types_1.SaboteurPhase.PLAYING)
            return null;
        if (state.activePlayerId !== playerId || !this.isMember(room, playerId))
            return null;
        const hand = this.getHand(room, playerId);
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length)
            return null;
        const cardId = hand[cardIndex].cardId;
        const def = types_1.SABOTEUR_DRAW_CARDS.find((d) => d.id === cardId);
        if (!def || def.kind !== 'PATH')
            return null;
        const player = state.players[playerId];
        if (!player || player.brokenTools.length > 0)
            return null;
        const check = (0, types_1.saboteurSimulatePlacement)(state.board, x, y, cardId, rotation);
        if (!check.valid)
            return null;
        hand.splice(cardIndex, 1);
        this.setHand(room, playerId, hand);
        state.board[(0, types_1.saboteurCellKey)(x, y)] = { cardId, rotation };
        state.lastAction = { playerId, kind: 'PLACE', detail: `${cardId}@${x},${y}` };
        return this.afterPlayResolved(room, playerId, check.revealedGoalKeys);
    }
    playAction(room, playerId, payload) {
        const state = room.saboteurState;
        if (!state || state.currentPhase !== types_1.SaboteurPhase.PLAYING)
            return null;
        if (state.activePlayerId !== playerId || !this.isMember(room, playerId))
            return null;
        const hand = this.getHand(room, playerId);
        const { cardIndex } = payload;
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length)
            return null;
        const cardId = hand[cardIndex].cardId;
        const def = types_1.SABOTEUR_DRAW_CARDS.find((d) => d.id === cardId);
        if (!def || def.kind !== 'ACTION' || !def.action)
            return null;
        const ok = this.applyAction(room, playerId, def, payload);
        if (!ok)
            return null;
        hand.splice(cardIndex, 1);
        this.setHand(room, playerId, hand);
        this.drawCard(room, playerId);
        this.syncHandSizes(room);
        state.lastAction = { playerId, kind: 'ACTION', detail: cardId };
        if (this.checkExhaustionEnd(room))
            return room;
        this.advanceTurn(room);
        return room;
    }
    applyAction(room, playerId, def, payload) {
        const state = room.saboteurState;
        const action = def.action;
        switch (action.kind) {
            case types_1.SaboteurActionKind.BREAK: {
                const tool = action.tools[0];
                const target = payload.targetPlayerId ? state.players[payload.targetPlayerId] : undefined;
                if (!target)
                    return false;
                if (target.brokenTools.includes(tool))
                    return false;
                target.brokenTools.push(tool);
                return true;
            }
            case types_1.SaboteurActionKind.REPAIR: {
                const target = payload.targetPlayerId ? state.players[payload.targetPlayerId] : undefined;
                if (!target)
                    return false;
                const eligible = action.tools.filter((t) => target.brokenTools.includes(t));
                if (eligible.length === 0)
                    return false;
                const chosen = payload.repairTool && eligible.includes(payload.repairTool)
                    ? payload.repairTool
                    : eligible[0];
                target.brokenTools = target.brokenTools.filter((t) => t !== chosen);
                return true;
            }
            case types_1.SaboteurActionKind.MAP: {
                const goalIndex = payload.goalIndex;
                if (!Number.isInteger(goalIndex) || goalIndex < 0 || goalIndex > 2)
                    return false;
                const contents = this.getGoalContents(room);
                const peeked = this.getPeekedGoals(room, playerId);
                peeked[String(goalIndex)] = contents[goalIndex] ?? 'STONE';
                this.privateState.set(room.code, playerId, SB_PEEKED, peeked);
                return true;
            }
            case types_1.SaboteurActionKind.ROCKFALL: {
                const { targetX, targetY } = payload;
                if (!Number.isInteger(targetX) || !Number.isInteger(targetY))
                    return false;
                const key = (0, types_1.saboteurCellKey)(targetX, targetY);
                const cell = state.board[key];
                if (!cell)
                    return false;
                if (cell.cardId === types_1.SABOTEUR_START_CARD.id || cell.cardId === types_1.SABOTEUR_GOAL_CARD.id) {
                    return false;
                }
                delete state.board[key];
                return true;
            }
            default:
                return false;
        }
    }
    discard(room, playerId, cardIndex) {
        const state = room.saboteurState;
        if (!state || state.currentPhase !== types_1.SaboteurPhase.PLAYING)
            return null;
        if (state.activePlayerId !== playerId || !this.isMember(room, playerId))
            return null;
        const hand = this.getHand(room, playerId);
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length)
            return null;
        hand.splice(cardIndex, 1);
        this.setHand(room, playerId, hand);
        this.drawCard(room, playerId);
        this.syncHandSizes(room);
        state.lastAction = { playerId, kind: 'DISCARD' };
        if (this.checkExhaustionEnd(room))
            return room;
        this.advanceTurn(room);
        return room;
    }
    autoPass(room, playerId) {
        const state = room.saboteurState;
        if (!state || state.currentPhase !== types_1.SaboteurPhase.PLAYING)
            return null;
        if (state.activePlayerId !== playerId)
            return null;
        state.lastAction = { playerId, kind: 'PASS' };
        this.advanceTurn(room);
        return room;
    }
    afterPlayResolved(room, playerId, revealedGoalKeys) {
        const state = room.saboteurState;
        this.drawCard(room, playerId);
        this.syncHandSizes(room);
        const contents = this.getGoalContents(room);
        let goldGoalIndex = null;
        for (const key of revealedGoalKeys) {
            const idx = state.goalCells.findIndex((g) => (0, types_1.saboteurCellKey)(g.x, g.y) === key);
            if (idx === -1)
                continue;
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
        if (this.checkExhaustionEnd(room))
            return room;
        this.advanceTurn(room);
        return room;
    }
    beginGoldPick(room, finderId, revealedGoalIndex) {
        const state = room.saboteurState;
        const miners = state.turnOrder.filter((id) => this.getRole(room, id) === types_1.SaboteurRole.MINER);
        const reverseOrder = [...state.turnOrder].reverse();
        const finderIdx = reverseOrder.indexOf(finderId);
        const pickOrder = [];
        for (let i = 0; i < reverseOrder.length; i++) {
            const id = reverseOrder[(finderIdx + i) % reverseOrder.length];
            if (miners.includes(id))
                pickOrder.push(id);
        }
        const goldDeck = this.getGoldDeck(room);
        const goldPool = [];
        for (let i = 0; i < miners.length; i++) {
            const value = goldDeck.pop();
            if (value === undefined)
                break;
            goldPool.push(value);
        }
        this.setGoldDeck(room, goldDeck);
        state.currentPhase = types_1.SaboteurPhase.GOLD_PICK;
        state.roundResult = {
            winnerRole: types_1.SaboteurRole.MINER,
            revealedGoalIndex,
            goldPool,
            pickOrder,
            currentPickerId: pickOrder[0] ?? null,
            picks: {},
        };
    }
    pickGold(room, playerId, poolIndex) {
        const state = room.saboteurState;
        if (!state || state.currentPhase !== types_1.SaboteurPhase.GOLD_PICK)
            return null;
        const result = state.roundResult;
        if (!result || result.currentPickerId !== playerId)
            return null;
        const pool = result.goldPool ?? [];
        if (!Number.isInteger(poolIndex) || poolIndex < 0 || poolIndex >= pool.length)
            return null;
        if (pool[poolIndex] < 0)
            return null;
        const value = pool[poolIndex];
        pool[poolIndex] = -value;
        result.picks = { ...(result.picks ?? {}), [playerId]: value };
        const player = state.players[playerId];
        if (player)
            player.score += value;
        const remaining = (result.pickOrder ?? []).filter((id) => result.picks[id] === undefined);
        result.currentPickerId = remaining[0] ?? null;
        if (!result.currentPickerId) {
            this.finalizeRound(room);
        }
        return room;
    }
    endRoundSaboteursWin(room) {
        const state = room.saboteurState;
        const saboteurs = state.turnOrder.filter((id) => this.getRole(room, id) === types_1.SaboteurRole.SABOTEUR);
        const bonus = saboteurs.length === 1 ? 4 : 3;
        state.currentPhase = types_1.SaboteurPhase.ROUND_END;
        state.roundResult = {
            winnerRole: types_1.SaboteurRole.SABOTEUR,
            revealedGoalIndex: null,
            saboteurBonus: bonus,
        };
        for (const id of saboteurs) {
            const player = state.players[id];
            if (player)
                player.score += bonus;
        }
        this.finalizeRound(room);
    }
    finalizeRound(room) {
        const state = room.saboteurState;
        state.currentPhase = types_1.SaboteurPhase.ROUND_END;
        for (const [socketId, player] of Object.entries(state.players)) {
            player.role = this.getRole(room, socketId);
            const roomPlayer = room.players.find((rp) => rp.socketId === socketId);
            if (roomPlayer)
                roomPlayer.score = player.score;
        }
    }
    nextRound(room, requesterId) {
        const state = room.saboteurState;
        if (!state || state.currentPhase !== types_1.SaboteurPhase.ROUND_END)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (state.round >= types_1.SABOTEUR_TOTAL_ROUNDS) {
            const scores = {};
            let best = -Infinity;
            for (const [id, p] of Object.entries(state.players)) {
                scores[id] = p.score;
                if (p.score > best)
                    best = p.score;
            }
            state.currentPhase = types_1.SaboteurPhase.GAME_OVER;
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
    reset(room, requesterId) {
        if (!room.saboteurState)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.saboteurState = undefined;
        this.privateState.clearRoom(room.code);
        room.players.forEach((p) => {
            p.score = 0;
        });
        return room;
    }
    handlePlayerDisconnect(room, socketId) {
        const state = room.saboteurState;
        if (!state)
            return;
        if (state.currentPhase === types_1.SaboteurPhase.PLAYING && state.activePlayerId === socketId) {
            this.advanceTurn(room);
            return;
        }
        if (state.currentPhase === types_1.SaboteurPhase.GOLD_PICK) {
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
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.players[oldSocketId]) {
            state.players[newSocketId] = { ...state.players[oldSocketId], id: newSocketId };
            delete state.players[oldSocketId];
        }
        if (state.activePlayerId === oldSocketId)
            state.activePlayerId = newSocketId;
        state.turnOrder = state.turnOrder.map((id) => (id === oldSocketId ? newSocketId : id));
        if (state.roundResult) {
            if (state.roundResult.currentPickerId === oldSocketId) {
                state.roundResult.currentPickerId = newSocketId;
            }
            if (state.roundResult.pickOrder) {
                state.roundResult.pickOrder = state.roundResult.pickOrder.map((id) => id === oldSocketId ? newSocketId : id);
            }
            if (state.roundResult.picks && state.roundResult.picks[oldSocketId] !== undefined) {
                state.roundResult.picks[newSocketId] = state.roundResult.picks[oldSocketId];
                delete state.roundResult.picks[oldSocketId];
            }
        }
    }
};
exports.SaboteurService = SaboteurService;
exports.SaboteurService = SaboteurService = SaboteurService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], SaboteurService);
//# sourceMappingURL=saboteur.service.js.map