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
exports.TheMindService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const ROOM_KEY = '__room__';
const HAND_KEY = 'theMindHand';
const DECK_KEY = 'theMindDeck';
const BLIND_PLAYED_KEY = 'theMindBlindPlayed';
const BLIND_PILE_UP_KEY = 'theMindBlindPileUp';
const BLIND_PILE_DOWN_KEY = 'theMindBlindPileDown';
let TheMindService = class TheMindService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    getMaxLevel(playerCount) {
        if (playerCount <= 2)
            return 12;
        if (playerCount === 3)
            return 10;
        return 8;
    }
    socketIdOf(room, playerId) {
        return room.players.find((p) => p.id === playerId)?.socketId;
    }
    getHand(room, playerId) {
        const socketId = this.socketIdOf(room, playerId);
        if (!socketId)
            return [];
        return this.privateState.get(room.code, socketId, HAND_KEY) ?? [];
    }
    setHand(room, playerId, hand) {
        const socketId = this.socketIdOf(room, playerId);
        if (!socketId)
            return;
        if (hand.length === 0) {
            this.privateState.delete(room.code, socketId, HAND_KEY);
        }
        else {
            this.privateState.set(room.code, socketId, HAND_KEY, hand);
        }
    }
    getHands(room) {
        const hands = {};
        for (const player of room.players) {
            if (player.connected === false || player.isViewer)
                continue;
            hands[player.id] = this.getHand(room, player.id);
        }
        return hands;
    }
    syncHandSizes(room) {
        const state = room.theMindState;
        if (!state)
            return;
        state.handSizes = {};
        for (const [playerId, hand] of Object.entries(this.getHands(room))) {
            state.handSizes[playerId] = hand.length;
        }
    }
    getDeck(room) {
        return this.privateState.get(room.code, ROOM_KEY, DECK_KEY) ?? [];
    }
    setDeck(room, deck) {
        this.privateState.set(room.code, ROOM_KEY, DECK_KEY, deck);
    }
    getBlindPlayed(room) {
        return (this.privateState.get(room.code, ROOM_KEY, BLIND_PLAYED_KEY) ??
            []);
    }
    setBlindPlayed(room, played) {
        this.privateState.set(room.code, ROOM_KEY, BLIND_PLAYED_KEY, played);
    }
    clearBlindShadow(room) {
        this.privateState.delete(room.code, ROOM_KEY, BLIND_PLAYED_KEY);
        this.privateState.delete(room.code, ROOM_KEY, BLIND_PILE_UP_KEY);
        this.privateState.delete(room.code, ROOM_KEY, BLIND_PILE_DOWN_KEY);
    }
    buildDeck(room) {
        if (room.config?.theMindMode === 'EXTREME') {
            return this.shuffleArray([
                ...Array.from({ length: 50 }, (_, i) => i + 1),
                ...Array.from({ length: 50 }, (_, i) => -(i + 1)),
            ]);
        }
        return this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));
    }
    resetLevelEndTime(room) {
        const state = room.theMindState;
        if (!state)
            return;
        if (room.config?.theMindTimeAttack && state.phase === types_1.TheMindPhase.PLAYING) {
            state.levelEndTime = Date.now() + state.level * 30000 + 10000;
        }
        else {
            delete state.levelEndTime;
        }
    }
    startGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        const playerCount = room.players.filter((p) => p.connected && !p.isViewer).length;
        if (playerCount < 2)
            return null;
        this.setDeck(room, this.buildDeck(room));
        const startingLives = room.config?.theMindStartingLives ?? playerCount;
        const startingShurikens = room.config?.theMindStartingShurikens ?? 1;
        room.theMindState = {
            phase: types_1.TheMindPhase.SETUP,
            level: 1,
            maxLevel: room.config?.theMindMaxLevel ?? this.getMaxLevel(playerCount),
            lives: startingLives,
            shuriken: startingShurikens,
            pileTop: 0,
            pileTopDOWN: room.config?.theMindMode === 'EXTREME' ? 101 : null,
            pileTopPlayerId: null,
            playedCards: [],
            handSizes: {},
            readyPlayers: [],
            failedPlayerId: null,
            discardedCards: {},
            shurikenProposerId: null,
            shurikenVotes: {},
            result: null,
        };
        room.status = types_1.RoomStatus.PLAYING;
        this.dealCards(room);
        return room;
    }
    dealCards(room) {
        const state = room.theMindState;
        if (!state)
            return;
        const playerIds = room.players
            .filter((p) => p.connected && !p.isViewer)
            .map((p) => p.id);
        const cardsPerPlayer = state.level;
        const deck = this.getDeck(room);
        playerIds.forEach((id) => {
            const cards = deck.splice(0, cardsPerPlayer);
            this.setHand(room, id, cards.sort((a, b) => a - b));
        });
        this.setDeck(room, deck);
        state.pileTop = 0;
        state.pileTopDOWN = room.config?.theMindMode === 'EXTREME' ? 101 : null;
        state.pileTopPlayerId = null;
        state.playedCards = [];
        state.readyPlayers = [];
        state.failedPlayerId = null;
        state.discardedCards = {};
        state.shurikenProposerId = null;
        state.shurikenVotes = {};
        state.result = null;
        delete state.remainingHands;
        this.clearBlindShadow(room);
        this.resetLevelEndTime(room);
        this.syncHandSizes(room);
    }
    ready(room, clientId) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.SETUP)
            return null;
        if (!state.readyPlayers.includes(clientId)) {
            state.readyPlayers.push(clientId);
        }
        const playerCount = room.players.filter((p) => p.connected && !p.isViewer).length;
        if (state.readyPlayers.length >= playerCount) {
            state.phase = types_1.TheMindPhase.PLAYING;
            this.resetLevelEndTime(room);
        }
        return room;
    }
    playCard(room, clientId, card, pile) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.PLAYING)
            return null;
        const hand = this.getHand(room, clientId);
        if (!hand.length || !hand.includes(card))
            return null;
        const isExtreme = room.config?.theMindMode === 'EXTREME';
        if (!isExtreme && card !== hand[0])
            return null;
        if (!isExtreme && pile === 'DOWN')
            return null;
        if (isExtreme && !pile)
            return null;
        if (room.config?.theMindBlindMode) {
            return this.playCardBlind(room, clientId, hand, card, pile, isExtreme);
        }
        const currentUP = state.pileTop;
        const currentDOWN = isExtreme ? (state.pileTopDOWN ?? 101) : 101;
        let isDirectMistake = false;
        if (pile === 'DOWN') {
            if (card >= currentDOWN && card !== currentDOWN + 10)
                isDirectMistake = true;
        }
        else {
            if (card <= currentUP && card !== currentUP - 10)
                isDirectMistake = true;
        }
        const nextUP = pile === 'UP' ? card : currentUP;
        const nextDOWN = pile === 'DOWN' ? card : currentDOWN;
        const deadCards = [];
        for (const [pid, h] of Object.entries(this.getHands(room))) {
            for (const c of h) {
                if (pid === clientId && c === card)
                    continue;
                let isDead = false;
                if (isExtreme) {
                    isDead = c <= nextUP && c >= nextDOWN && c !== nextUP - 10 && c !== nextDOWN + 10;
                }
                else {
                    isDead = c <= nextUP && c !== nextUP - 10;
                }
                if (isDead) {
                    deadCards.push({ playerId: pid, card: c });
                }
            }
        }
        if (isDirectMistake || deadCards.length > 0) {
            state.lives -= 1;
            const discarded = {};
            for (const m of deadCards) {
                if (!discarded[m.playerId])
                    discarded[m.playerId] = [];
                discarded[m.playerId].push(m.card);
            }
            if (!discarded[clientId])
                discarded[clientId] = [];
            discarded[clientId].push(card);
            for (const [pid, dCards] of Object.entries(discarded)) {
                const h = this.getHand(room, pid);
                this.setHand(room, pid, h.filter((c) => !dCards.includes(c)));
            }
            if (pile === 'DOWN') {
                state.pileTopDOWN = card;
            }
            else {
                state.pileTop = card;
            }
            state.pileTopPlayerId = clientId;
            state.playedCards.push({ card, playerId: clientId, pile });
            const allEmpty = Object.values(this.getHands(room)).every((h) => h.length === 0);
            state.result = {
                success: false,
                failedPlayerId: clientId,
                discardedCards: discarded,
                livesLost: 1,
                levelCleared: allEmpty,
            };
            state.failedPlayerId = clientId;
            state.discardedCards = discarded;
            state.phase = types_1.TheMindPhase.LEVEL_RESULT;
            if (state.lives <= 0) {
                state.phase = types_1.TheMindPhase.GAME_OVER;
                room.status = types_1.RoomStatus.RESULT;
                state.remainingHands = this.remainingHands(room);
            }
        }
        else {
            if (pile === 'DOWN') {
                state.pileTopDOWN = card;
            }
            else {
                state.pileTop = card;
            }
            state.pileTopPlayerId = clientId;
            state.playedCards.push({ card, playerId: clientId, pile });
            this.setHand(room, clientId, hand.filter((c) => c !== card));
            const allEmpty = Object.values(this.getHands(room)).every((h) => h.length === 0);
            if (allEmpty) {
                if (state.level >= state.maxLevel) {
                    state.phase = types_1.TheMindPhase.GAME_OVER;
                    room.status = types_1.RoomStatus.RESULT;
                    state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
                    room.players.forEach((p) => {
                        p.score += state.level;
                    });
                }
                else {
                    state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
                    state.phase = types_1.TheMindPhase.LEVEL_RESULT;
                }
            }
        }
        this.syncHandSizes(room);
        return room;
    }
    remainingHands(room) {
        const remaining = {};
        for (const [playerId, hand] of Object.entries(this.getHands(room))) {
            if (hand.length > 0)
                remaining[playerId] = hand;
        }
        return remaining;
    }
    playCardBlind(room, clientId, hand, card, pile, isExtreme) {
        const state = room.theMindState;
        if (pile === 'DOWN') {
            this.privateState.set(room.code, ROOM_KEY, BLIND_PILE_DOWN_KEY, card);
        }
        else {
            this.privateState.set(room.code, ROOM_KEY, BLIND_PILE_UP_KEY, card);
        }
        state.pileTopPlayerId = clientId;
        const blindPlayed = this.getBlindPlayed(room);
        blindPlayed.push({ card, playerId: clientId, pile });
        this.setBlindPlayed(room, blindPlayed);
        state.playedCards.push({ card: null, playerId: null, pile });
        this.setHand(room, clientId, hand.filter((c) => c !== card));
        const allEmpty = Object.values(this.getHands(room)).every((h) => h.length === 0);
        if (allEmpty) {
            this.revealBlindPlayed(room);
            const isSuccess = (0, types_1.getTheMindInvalidPlayIndexes)(state.playedCards, isExtreme ? 'EXTREME' : 'NORMAL').length ===
                0;
            if (isSuccess) {
                if (state.level >= state.maxLevel) {
                    state.phase = types_1.TheMindPhase.GAME_OVER;
                    room.status = types_1.RoomStatus.RESULT;
                    state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
                    state.remainingHands = {};
                    room.players.forEach((p) => {
                        p.score += state.level;
                    });
                }
                else {
                    state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
                    state.phase = types_1.TheMindPhase.LEVEL_RESULT;
                }
            }
            else {
                state.lives -= 1;
                state.result = {
                    success: false,
                    failedPlayerId: undefined,
                    discardedCards: {},
                    livesLost: 1,
                    levelCleared: false,
                    invalidPlayIndexes: (0, types_1.getTheMindInvalidPlayIndexes)(state.playedCards, isExtreme ? 'EXTREME' : 'NORMAL'),
                };
                state.phase = types_1.TheMindPhase.LEVEL_RESULT;
                if (state.lives <= 0) {
                    state.phase = types_1.TheMindPhase.GAME_OVER;
                    room.status = types_1.RoomStatus.RESULT;
                    state.remainingHands = {};
                }
            }
        }
        this.syncHandSizes(room);
        return room;
    }
    revealBlindPlayed(room) {
        const state = room.theMindState;
        if (!state)
            return;
        state.playedCards = this.getBlindPlayed(room).map((pc) => ({
            card: pc.card,
            playerId: pc.playerId,
            pile: pc.pile,
        }));
        this.clearBlindShadow(room);
    }
    nextLevel(room, clientId) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== types_1.TheMindPhase.LEVEL_RESULT &&
            state.phase !== types_1.TheMindPhase.SETUP &&
            state.phase !== types_1.TheMindPhase.SHURIKEN_RESULT)
            return null;
        if (state.phase === types_1.TheMindPhase.SHURIKEN_RESULT) {
            state.phase = types_1.TheMindPhase.PLAYING;
            state.discardedCards = {};
            this.resetLevelEndTime(room);
            return room;
        }
        if (state.phase === types_1.TheMindPhase.LEVEL_RESULT &&
            state.result &&
            !state.result.success &&
            !state.result.levelCleared) {
            if (room.config?.theMindBlindMode) {
                state.phase = types_1.TheMindPhase.SETUP;
                state.result = null;
                state.discardedCards = {};
                state.failedPlayerId = null;
                const deck = this.getDeck(room);
                const deckSize = room.players.filter((p) => p.connected && !p.isViewer).length;
                if (deck.length < state.level * deckSize) {
                    this.setDeck(room, this.buildDeck(room));
                }
                else {
                    this.setDeck(room, this.shuffleArray(deck));
                }
                state.playedCards = [];
                state.pileTop = 0;
                state.pileTopPlayerId = null;
                this.clearBlindShadow(room);
                this.dealCards(room);
                return room;
            }
            else {
                state.phase = types_1.TheMindPhase.PLAYING;
                state.result = null;
                state.discardedCards = {};
                state.failedPlayerId = null;
                this.resetLevelEndTime(room);
                return room;
            }
        }
        if (state.level < state.maxLevel) {
            state.level += 1;
            state.phase = types_1.TheMindPhase.SETUP;
            const deck = this.getDeck(room);
            const deckSize = room.players.filter((p) => p.connected && !p.isViewer).length;
            if (deck.length < state.level * deckSize) {
                this.setDeck(room, this.buildDeck(room));
            }
            else {
                this.setDeck(room, this.shuffleArray(deck));
            }
            this.dealCards(room);
        }
        return room;
    }
    proposeShuriken(room, clientId) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.PLAYING)
            return null;
        if (state.shuriken <= 0)
            return null;
        state.shurikenProposerId = clientId;
        state.shurikenVotes = { [clientId]: true };
        state.phase = types_1.TheMindPhase.SHURIKEN_VOTE;
        return room;
    }
    voteShuriken(room, clientId, agree) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.SHURIKEN_VOTE)
            return null;
        state.shurikenVotes[clientId] = agree;
        const playerCount = room.players.filter((p) => p.connected && !p.isViewer).length;
        const voteCount = Object.keys(state.shurikenVotes).length;
        if (voteCount >= playerCount) {
            const allAgree = Object.values(state.shurikenVotes).every((v) => v);
            state.shurikenProposerId = null;
            state.shurikenVotes = {};
            if (allAgree) {
                state.shuriken -= 1;
                const discarded = {};
                for (const [pid, hand] of Object.entries(this.getHands(room))) {
                    if (hand.length > 0) {
                        discarded[pid] = [hand[0]];
                        this.setHand(room, pid, hand.slice(1));
                    }
                }
                state.discardedCards = discarded;
                state.phase = types_1.TheMindPhase.SHURIKEN_RESULT;
                const allEmpty = Object.values(this.getHands(room)).every((h) => h.length === 0);
                if (allEmpty) {
                    const isSuccess = !room.config?.theMindBlindMode ||
                        (0, types_1.getTheMindInvalidPlayIndexes)(room.config?.theMindBlindMode ? this.getBlindPlayed(room) : state.playedCards, room.config?.theMindMode === 'EXTREME' ? 'EXTREME' : 'NORMAL').length === 0;
                    if (isSuccess) {
                        if (room.config?.theMindBlindMode)
                            this.revealBlindPlayed(room);
                        if (state.level >= state.maxLevel) {
                            state.phase = types_1.TheMindPhase.GAME_OVER;
                            room.status = types_1.RoomStatus.RESULT;
                            state.result = {
                                success: true,
                                discardedCards: {},
                                livesLost: 0,
                                levelCleared: true,
                            };
                            room.players.forEach((p) => {
                                p.score += state.level;
                            });
                        }
                        else {
                            state.phase = types_1.TheMindPhase.LEVEL_RESULT;
                            state.result = {
                                success: true,
                                discardedCards: {},
                                livesLost: 0,
                                levelCleared: true,
                            };
                        }
                    }
                    else {
                        if (room.config?.theMindBlindMode)
                            this.revealBlindPlayed(room);
                        state.lives -= 1;
                        state.result = {
                            success: false,
                            discardedCards: {},
                            livesLost: 1,
                            levelCleared: false,
                        };
                        state.phase = types_1.TheMindPhase.LEVEL_RESULT;
                        if (state.lives <= 0) {
                            state.phase = types_1.TheMindPhase.GAME_OVER;
                            room.status = types_1.RoomStatus.RESULT;
                            state.remainingHands = this.remainingHands(room);
                        }
                    }
                }
            }
            else {
                state.phase = types_1.TheMindPhase.PLAYING;
                this.resetLevelEndTime(room);
            }
        }
        this.syncHandSizes(room);
        return room;
    }
    cancelShurikenProposal(room, clientId) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.SHURIKEN_VOTE)
            return null;
        if (state.shurikenProposerId !== clientId)
            return null;
        state.shurikenProposerId = null;
        state.shurikenVotes = {};
        state.phase = types_1.TheMindPhase.PLAYING;
        this.resetLevelEndTime(room);
        return room;
    }
    resetGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.theMindState = undefined;
        return room;
    }
    handleTimeout(room) {
        const state = room.theMindState;
        if (!state || state.phase !== types_1.TheMindPhase.PLAYING)
            return null;
        state.lives -= 1;
        state.result = {
            success: false,
            discardedCards: {},
            livesLost: 1,
            levelCleared: false,
            isTimeOut: true,
        };
        state.phase = types_1.TheMindPhase.LEVEL_RESULT;
        delete state.levelEndTime;
        if (state.lives <= 0) {
            state.phase = types_1.TheMindPhase.GAME_OVER;
            room.status = types_1.RoomStatus.RESULT;
            state.remainingHands = this.remainingHands(room);
        }
        return room;
    }
};
exports.TheMindService = TheMindService;
exports.TheMindService = TheMindService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], TheMindService);
//# sourceMappingURL=the-mind.service.js.map