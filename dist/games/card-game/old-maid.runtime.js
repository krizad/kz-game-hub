"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OldMaidRuntime = void 0;
const types_1 = require("@repo/types");
const card_engine_service_1 = require("./card-engine.service");
const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const PILES_KEY = 'piles';
const REMOVED_CARD_ID = 'Q-SPADES';
class OldMaidRuntime {
    constructor(privateStateService, buildShuffledDeck = (policy) => (0, card_engine_service_1.shuffleDeck)((0, card_engine_service_1.createDeck)(policy))) {
        this.privateStateService = privateStateService;
        this.buildShuffledDeck = buildShuffledDeck;
    }
    startRound(room, config, playerIds) {
        if (playerIds.length < 2)
            return null;
        const deck = this.buildShuffledDeck(config.deck);
        const removedIndex = deck.findIndex((card) => card.id === REMOVED_CARD_ID);
        if (removedIndex >= 0)
            deck.splice(removedIndex, 1);
        const hands = {};
        for (const id of playerIds)
            hands[id] = [];
        deck.forEach((card, index) => hands[playerIds[index % playerIds.length]].push(card));
        const discards = [];
        for (const id of playerIds)
            discards.push(...this.removeRankPairs(hands[id]));
        this.setPiles(room.code, { stock: [], discards, reserve: [] });
        const chipBalances = room.cardGameChips ?? {};
        room.cardGameChips = chipBalances;
        for (const id of playerIds)
            chipBalances[id] = chipBalances[id] ?? config.scoring.startingChips;
        const decisions = {};
        for (const id of playerIds) {
            decisions[id] = 'PENDING';
            this.setHand(room.code, id, hands[id]);
        }
        const activePlayerId = playerIds.find((id) => hands[id].length > 0) ?? playerIds[0];
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: 'OLD_MAID',
            phase: 'PLAYER_TURNS',
            dealerId: playerIds[0],
            activePlayerId,
            playerOrder: playerIds,
            hands,
            chips: Object.fromEntries(playerIds.map((id) => [id, chipBalances[id]])),
            decisions,
        }, config.visibility);
        room.status = types_1.RoomStatus.PLAYING;
        const holders = playerIds.filter((id) => hands[id].length > 0);
        if (holders.length <= 1)
            return this.settle(room, config, holders[0] ?? null);
        return room;
    }
    handleAction(room, socketId, action, config) {
        const state = room.cardGameState;
        if (!state || room.gameType !== types_1.GameType.CARD_GAME)
            return null;
        if (room.status !== types_1.RoomStatus.PLAYING || state.phase !== 'PLAYER_TURNS')
            return null;
        if (action.type !== 'TAKE_CARD')
            return null;
        if (state.activePlayerId !== socketId)
            return null;
        const targetId = this.nextHolder(state, socketId);
        if (!targetId)
            return null;
        const targetHand = this.getHand(room.code, targetId);
        if (!targetHand || targetHand.length === 0)
            return null;
        if (!Number.isInteger(action.index) || action.index < 0 || action.index >= targetHand.length) {
            return null;
        }
        const [taken] = targetHand.splice(action.index, 1);
        this.setHand(room.code, targetId, targetHand);
        state.handCounts[targetId] = targetHand.length;
        const myHand = this.getHand(room.code, socketId) ?? [];
        myHand.push(taken);
        const matched = this.removeRankPairs(myHand);
        if (matched.length > 0) {
            const piles = this.pilesFor(room.code);
            piles.discards.push(...matched);
            this.setPiles(room.code, piles);
        }
        this.setHand(room.code, socketId, myHand);
        state.handCounts[socketId] = myHand.length;
        state.decisions[socketId] = 'TOOK';
        const holders = state.playerOrder.filter((id) => (state.handCounts[id] ?? 0) > 0);
        if (holders.length <= 1)
            return this.settle(room, config, holders[0] ?? null);
        const nextId = this.nextHolder(state, socketId);
        if (!nextId)
            return this.settle(room, config, null);
        state.activePlayerId = nextId;
        state.decisions[nextId] = 'PENDING';
        return room;
    }
    settle(room, config, loserId) {
        const state = room.cardGameState;
        const chips = { ...state.chips };
        const stake = config.scoring.baseStake;
        const winnerIds = state.playerOrder.filter((id) => id !== loserId);
        if (loserId) {
            for (const id of winnerIds) {
                chips[id] += stake;
                chips[loserId] -= stake;
            }
        }
        room.cardGameChips = chips;
        const revealedHands = {};
        for (const id of state.playerOrder)
            revealedHands[id] = this.getHand(room.code, id) ?? [];
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: 'OLD_MAID',
            phase: 'RESULT',
            dealerId: state.dealerId,
            activePlayerId: null,
            playerOrder: state.playerOrder,
            hands: revealedHands,
            chips,
            decisions: state.decisions,
            result: {
                playerScores: state.handCounts,
                winnerIds,
                placements: loserId ? [...winnerIds, loserId] : [...state.playerOrder],
                revealedHands,
            },
        }, config.visibility);
        room.status = types_1.RoomStatus.RESULT;
        return room;
    }
    nextHolder(state, afterId) {
        const index = state.playerOrder.indexOf(afterId);
        if (index === -1)
            return null;
        for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
            const candidate = state.playerOrder[(index + offset) % state.playerOrder.length];
            if (candidate !== afterId && (state.handCounts[candidate] ?? 0) > 0)
                return candidate;
        }
        return null;
    }
    removeRankPairs(hand) {
        const removed = [];
        let index = 0;
        while (index < hand.length) {
            const partner = hand.findIndex((card, other) => other > index && card.rank === hand[index].rank);
            if (partner === -1) {
                index += 1;
                continue;
            }
            removed.push(hand[partner], hand[index]);
            hand.splice(partner, 1);
            hand.splice(index, 1);
        }
        return removed;
    }
    setHand(roomCode, socketId, hand) {
        this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
            preset: 'OLD_MAID',
            hand,
        });
    }
    getHand(roomCode, socketId) {
        return this.privateStateService.get(roomCode, socketId, PRIVATE_KEY)
            ?.hand;
    }
    setPiles(roomCode, piles) {
        this.privateStateService.set(roomCode, ENGINE_SOCKET_ID, PILES_KEY, piles);
    }
    pilesFor(roomCode) {
        return (this.privateStateService.get(roomCode, ENGINE_SOCKET_ID, PILES_KEY) ?? {
            stock: [],
            discards: [],
            reserve: [],
        });
    }
}
exports.OldMaidRuntime = OldMaidRuntime;
//# sourceMappingURL=old-maid.runtime.js.map