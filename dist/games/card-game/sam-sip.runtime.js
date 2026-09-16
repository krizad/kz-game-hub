"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamSipRuntime = void 0;
const types_1 = require("@repo/types");
const card_engine_service_1 = require("./card-engine.service");
const sam_sip_preset_1 = require("./presets/sam-sip.preset");
const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const PILES_KEY = 'piles';
class SamSipRuntime {
    constructor(privateStateService, buildShuffledDeck = (policy) => (0, card_engine_service_1.shuffleDeck)((0, card_engine_service_1.createDeck)(policy))) {
        this.privateStateService = privateStateService;
        this.buildShuffledDeck = buildShuffledDeck;
    }
    startRound(room, config, playerIds) {
        const dealt = (0, card_engine_service_1.dealRound)(this.buildShuffledDeck(config.deck), playerIds, config.deal, config.piles.reserveSize);
        if (!dealt.ok || !dealt.hands)
            return null;
        const hands = dealt.hands;
        const stock = [...(dealt.stock ?? [])];
        const flipped = stock.pop();
        const piles = {
            stock,
            discards: flipped ? [flipped] : [],
            reserve: dealt.reserve ?? [],
        };
        this.setPiles(room.code, piles);
        const chipBalances = room.cardGameChips ?? {};
        room.cardGameChips = chipBalances;
        const chips = {};
        const decisions = {};
        for (const id of playerIds) {
            chipBalances[id] = chipBalances[id] ?? config.scoring.startingChips;
            chips[id] = chipBalances[id];
            decisions[id] = 'PENDING';
            this.setHand(room.code, id, hands[id]);
        }
        const starterId = playerIds[0];
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: 'SAM_SIP',
            phase: 'PLAYER_TURNS',
            dealerId: starterId,
            activePlayerId: starterId,
            playerOrder: playerIds,
            hands,
            chips,
            decisions,
        }, config.visibility);
        room.cardGameState.discardTop = piles.discards.at(-1) ?? null;
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    handleAction(room, socketId, action, config) {
        const state = room.cardGameState;
        if (!state || room.gameType !== types_1.GameType.CARD_GAME)
            return null;
        if (room.status !== types_1.RoomStatus.PLAYING || state.phase !== 'PLAYER_TURNS')
            return null;
        if (action.type !== 'DRAW' && action.type !== 'CLAIM' && action.type !== 'DISCARD') {
            return null;
        }
        if (!config.actions.allowed.includes(action.type))
            return null;
        const hand = this.getHand(room.code, socketId);
        if (!hand)
            return null;
        const piles = this.pilesFor(room.code);
        if (action.type === 'DRAW' || action.type === 'CLAIM') {
            if (socketId !== state.activePlayerId || state.decisions[socketId] !== 'PENDING')
                return null;
            let acquired;
            if (action.type === 'DRAW') {
                acquired = piles.stock.pop();
                if (!acquired)
                    return this.endRoundByExhaustion(room, config);
            }
            else {
                const top = piles.discards.at(-1);
                if (!top || !this.canClaim(top, hand))
                    return null;
                piles.discards.pop();
                acquired = top;
            }
            hand.push(acquired);
            return this.finishAcquire(room, socketId, hand, piles, config, action.type === 'DRAW' ? 'DRAWN' : 'CLAIMED');
        }
        if (action.type === 'DISCARD') {
            if (socketId !== state.activePlayerId)
                return null;
            const decision = state.decisions[socketId];
            if (decision !== 'DRAWN' && decision !== 'CLAIMED')
                return null;
            const index = hand.findIndex((card) => card.id === action.cardId);
            if (index === -1)
                return null;
            const [discarded] = hand.splice(index, 1);
            piles.discards.push(discarded);
            this.setHand(room.code, socketId, hand);
            this.setPiles(room.code, piles);
            state.handCounts[socketId] = hand.length;
            state.decisions[socketId] = 'DISCARDED';
            state.discardTop = discarded;
            if (hand.length === 0)
                return this.settle(room, config, socketId);
            const nextId = this.nextPlayer(state, socketId);
            state.activePlayerId = nextId;
            state.decisions[nextId] = 'PENDING';
            return room;
        }
        return null;
    }
    finishAcquire(room, socketId, hand, piles, config, decision) {
        const state = room.cardGameState;
        const removed = this.removeSumTenPairs(hand);
        if (removed.length > 0)
            piles.discards.push(...removed);
        this.setHand(room.code, socketId, hand);
        this.setPiles(room.code, piles);
        state.handCounts[socketId] = hand.length;
        state.discardTop = piles.discards.at(-1) ?? null;
        if (hand.length === 0)
            return this.settle(room, config, socketId);
        state.decisions[socketId] = decision;
        return room;
    }
    endRoundByExhaustion(room, config) {
        const state = room.cardGameState;
        const counts = state.playerOrder.map((id) => state.handCounts[id] ?? 0);
        const minimum = Math.min(...counts);
        const fewest = state.playerOrder.filter((id) => (state.handCounts[id] ?? 0) === minimum);
        return this.settle(room, config, fewest.length === 1 ? fewest[0] : undefined);
    }
    settle(room, config, winnerId) {
        const state = room.cardGameState;
        const chips = { ...state.chips };
        const stake = config.scoring.baseStake;
        if (winnerId) {
            for (const id of state.playerOrder) {
                if (id === winnerId)
                    continue;
                chips[id] -= stake;
                chips[winnerId] += stake;
            }
        }
        room.cardGameChips = chips;
        const revealedHands = {};
        for (const id of state.playerOrder)
            revealedHands[id] = this.getHand(room.code, id) ?? [];
        const others = state.playerOrder.filter((id) => id !== winnerId);
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: 'SAM_SIP',
            phase: 'RESULT',
            dealerId: state.dealerId,
            activePlayerId: null,
            playerOrder: state.playerOrder,
            hands: revealedHands,
            chips,
            decisions: state.decisions,
            result: {
                playerScores: state.handCounts,
                winnerIds: winnerId ? [winnerId] : [],
                placements: winnerId ? [winnerId, ...others] : state.playerOrder,
                revealedHands,
            },
        }, config.visibility);
        room.cardGameState.discardTop = state.discardTop ?? null;
        room.status = types_1.RoomStatus.RESULT;
        return room;
    }
    canClaim(card, hand) {
        const value = sam_sip_preset_1.SAM_SIP_CARD_VALUES[card.rank];
        return hand.some((candidate) => sam_sip_preset_1.SAM_SIP_CARD_VALUES[candidate.rank] + value === 10);
    }
    removeSumTenPairs(hand) {
        const removed = [];
        let changed = true;
        while (changed) {
            changed = false;
            outer: for (let i = 0; i < hand.length; i += 1) {
                for (let j = i + 1; j < hand.length; j += 1) {
                    if (sam_sip_preset_1.SAM_SIP_CARD_VALUES[hand[i].rank] + sam_sip_preset_1.SAM_SIP_CARD_VALUES[hand[j].rank] === 10) {
                        const [second] = hand.splice(j, 1);
                        const [first] = hand.splice(i, 1);
                        removed.push(first, second);
                        changed = true;
                        break outer;
                    }
                }
            }
        }
        return removed;
    }
    nextPlayer(state, afterId) {
        const order = state.playerOrder;
        const start = order.indexOf(afterId);
        for (let step = 1; step <= order.length; step += 1) {
            const candidate = order[(start + step) % order.length];
            if ((state.handCounts[candidate] ?? 0) > 0)
                return candidate;
        }
        return order[(start + 1) % order.length];
    }
    setHand(roomCode, socketId, hand) {
        this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
            preset: 'SAM_SIP',
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
exports.SamSipRuntime = SamSipRuntime;
//# sourceMappingURL=sam-sip.runtime.js.map