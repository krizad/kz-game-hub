"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlaveRuntime = void 0;
const types_1 = require("@repo/types");
const card_engine_service_1 = require("./card-engine.service");
const slave_preset_1 = require("./presets/slave.preset");
const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const FIRST_PLAY_KEY = 'slaveFirstPlay';
const LEADER_CARD_ID = '3-CLUBS';
const MAX_GROUP = 3;
class SlaveRuntime {
    constructor(privateStateService, buildShuffledDeck = (policy) => (0, card_engine_service_1.shuffleDeck)((0, card_engine_service_1.createDeck)(policy))) {
        this.privateStateService = privateStateService;
        this.buildShuffledDeck = buildShuffledDeck;
    }
    startRound(room, config, playerIds) {
        const dealt = (0, card_engine_service_1.dealRound)(this.buildShuffledDeck(config.deck), playerIds, config.deal, config.piles.reserveSize);
        if (!dealt.ok || !dealt.hands)
            return room;
        const hands = dealt.hands;
        const chips = room.cardGameChips ?? {};
        room.cardGameChips = chips;
        for (const id of playerIds)
            chips[id] = chips[id] ?? config.scoring.startingChips;
        const leaderCardDealt = playerIds.some((id) => (hands[id] ?? []).some((card) => card.id === LEADER_CARD_ID));
        const leaderId = playerIds.find((id) => (hands[id] ?? []).some((card) => card.id === LEADER_CARD_ID)) ??
            (0, card_engine_service_1.resolveStarter)(config.deal.starterPolicy, {
                playerOrder: playerIds,
                previousStarterId: room.cardGameState?.dealerId,
            }) ??
            playerIds[0];
        const decisions = {};
        for (const id of playerIds) {
            decisions[id] = 'PENDING';
            this.setHand(room.code, id, hands[id] ?? []);
        }
        this.setFirstPlayed(room.code, !leaderCardDealt);
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: 'SLAVE',
            phase: 'PLAYER_TURNS',
            dealerId: leaderId,
            activePlayerId: leaderId,
            playerOrder: playerIds,
            hands,
            chips: { ...chips },
            decisions,
        }, config.visibility);
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    handleAction(room, socketId, action, config) {
        const state = room.cardGameState;
        if (!state || room.gameType !== types_1.GameType.CARD_GAME)
            return null;
        if (room.status !== types_1.RoomStatus.PLAYING || state.phase !== 'PLAYER_TURNS')
            return null;
        if (state.activePlayerId !== socketId)
            return null;
        const hand = this.getHand(room.code, socketId);
        if (!hand)
            return null;
        if (action.type === 'PLAY') {
            const played = this.resolvePlayedCards(hand, action.cards);
            if (!played || !(0, card_engine_service_1.isSameRankGroup)(played, MAX_GROUP))
                return null;
            const trick = state.trick;
            if (!trick || trick.playedById === null) {
                if (!this.hasFirstPlayed(room.code) && !played.some((card) => card.id === LEADER_CARD_ID)) {
                    return null;
                }
            }
            else if (!(0, card_engine_service_1.beatsRankGroup)(played, trick.cards, slave_preset_1.SLAVE_RANK_ORDER)) {
                return null;
            }
            const playedIds = new Set(played.map((card) => card.id));
            const remaining = hand.filter((card) => !playedIds.has(card.id));
            this.setHand(room.code, socketId, remaining);
            state.handCounts[socketId] = remaining.length;
            state.decisions[socketId] = 'PLAYED';
            state.trick = {
                leaderId: trick?.leaderId ?? socketId,
                playedById: socketId,
                cards: played,
                passIds: [],
            };
            this.setFirstPlayed(room.code, true);
            if (remaining.length === 0) {
                this.settle(room, config, socketId);
                return room;
            }
            state.activePlayerId = this.nextCardHolder(state, socketId);
            return room;
        }
        if (action.type !== 'PASS')
            return null;
        const trick = state.trick;
        if (!trick || trick.playedById === null || trick.playedById === socketId)
            return null;
        if (!trick.passIds.includes(socketId))
            trick.passIds.push(socketId);
        state.decisions[socketId] = 'PASSED';
        if (this.everyoneElsePassed(state, trick)) {
            const nextLeader = (state.handCounts[trick.playedById] ?? 0) > 0
                ? trick.playedById
                : this.nextCardHolder(state, trick.playedById);
            state.trick = { leaderId: nextLeader, playedById: null, cards: [], passIds: [] };
            state.dealerId = nextLeader;
            state.activePlayerId = nextLeader;
            for (const id of state.playerOrder)
                state.decisions[id] = 'PENDING';
            return room;
        }
        state.activePlayerId = this.nextActiveAfterPass(state, socketId, trick);
        return room;
    }
    autoAction(room, socketId, config) {
        const state = room.cardGameState;
        const following = Boolean(state.trick && state.trick.playedById !== null);
        if (following)
            return { type: 'PASS' };
        const hand = this.getHand(room.code, socketId) ?? [];
        const lead = !this.hasFirstPlayed(room.code)
            ? hand.find((card) => card.id === LEADER_CARD_ID)
            : [...hand].sort((a, b) => slave_preset_1.SLAVE_RANK_ORDER.indexOf(a.rank) - slave_preset_1.SLAVE_RANK_ORDER.indexOf(b.rank))[0];
        return { type: 'PLAY', cards: lead ? [lead.id] : [] };
    }
    resolvePlayedCards(hand, cardIds) {
        if (!cardIds || cardIds.length === 0 || cardIds.length > MAX_GROUP)
            return null;
        if (new Set(cardIds).size !== cardIds.length)
            return null;
        const played = [];
        for (const id of cardIds) {
            const card = hand.find((candidate) => candidate.id === id);
            if (!card)
                return null;
            played.push(card);
        }
        return played;
    }
    nextCardHolder(state, afterId) {
        const order = state.playerOrder;
        const start = order.indexOf(afterId);
        for (let offset = 1; offset <= order.length; offset += 1) {
            const candidate = order[(start + offset) % order.length];
            if ((state.handCounts[candidate] ?? 0) > 0)
                return candidate;
        }
        return afterId;
    }
    nextActiveAfterPass(state, afterId, trick) {
        const order = state.playerOrder;
        const start = order.indexOf(afterId);
        for (let offset = 1; offset <= order.length; offset += 1) {
            const candidate = order[(start + offset) % order.length];
            if (candidate === trick.playedById)
                continue;
            if (trick.passIds.includes(candidate))
                continue;
            if ((state.handCounts[candidate] ?? 0) > 0)
                return candidate;
        }
        return trick.playedById ?? afterId;
    }
    everyoneElsePassed(state, trick) {
        return state.playerOrder.every((id) => {
            if (id === trick.playedById)
                return true;
            if ((state.handCounts[id] ?? 0) <= 0)
                return true;
            return trick.passIds.includes(id);
        });
    }
    settle(room, config, winnerId) {
        const state = room.cardGameState;
        const chips = { ...state.chips };
        const stake = config.scoring.baseStake;
        for (const id of state.playerOrder) {
            if (id === winnerId)
                continue;
            chips[id] = (chips[id] ?? config.scoring.startingChips) - stake;
            chips[winnerId] = (chips[winnerId] ?? config.scoring.startingChips) + stake;
        }
        room.cardGameChips = { ...room.cardGameChips, ...chips };
        const revealedHands = {};
        for (const id of state.playerOrder)
            revealedHands[id] = this.getHand(room.code, id) ?? [];
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: 'SLAVE',
            phase: 'RESULT',
            dealerId: state.dealerId,
            activePlayerId: null,
            playerOrder: state.playerOrder,
            hands: revealedHands,
            chips,
            decisions: state.decisions,
            result: {
                playerScores: state.handCounts,
                placements: [winnerId, ...state.playerOrder.filter((id) => id !== winnerId)],
                winnerIds: [winnerId],
                revealedHands,
            },
        }, config.visibility);
        room.status = types_1.RoomStatus.RESULT;
    }
    setHand(roomCode, socketId, hand) {
        this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
            preset: 'SLAVE',
            hand,
        });
    }
    getHand(roomCode, socketId) {
        return this.privateStateService.get(roomCode, socketId, PRIVATE_KEY)
            ?.hand;
    }
    setFirstPlayed(roomCode, played) {
        this.privateStateService.set(roomCode, ENGINE_SOCKET_ID, FIRST_PLAY_KEY, played);
    }
    hasFirstPlayed(roomCode) {
        return (this.privateStateService.get(roomCode, ENGINE_SOCKET_ID, FIRST_PLAY_KEY) === true);
    }
}
exports.SlaveRuntime = SlaveRuntime;
//# sourceMappingURL=slave.runtime.js.map