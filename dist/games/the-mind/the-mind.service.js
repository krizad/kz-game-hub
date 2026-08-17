"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheMindService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
let TheMindService = class TheMindService {
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
    startGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        const playerCount = room.players.filter((p) => p.connected).length;
        if (playerCount < 2)
            return null;
        const deck = this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));
        const playerHands = {};
        const playerIds = room.players.filter((p) => p.connected).map((p) => p.id);
        playerIds.forEach((id) => {
            playerHands[id] = [];
        });
        const startingLives = room.config?.theMindStartingLives ?? playerCount;
        const startingShurikens = room.config?.theMindStartingShurikens ?? 1;
        room.theMindState = {
            phase: types_1.TheMindPhase.SETUP,
            deck,
            level: 1,
            maxLevel: room.config?.theMindMaxLevel ?? this.getMaxLevel(playerCount),
            lives: startingLives,
            shuriken: startingShurikens,
            pileTop: 0,
            pileTopDOWN: room.config?.theMindMode === 'EXTREME' ? 101 : null,
            pileTopPlayerId: null,
            playedCards: [],
            playerHands,
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
        const playerIds = room.players.filter((p) => p.connected).map((p) => p.id);
        const cardsPerPlayer = state.level;
        playerIds.forEach((id) => {
            const cards = state.deck.splice(0, cardsPerPlayer);
            state.playerHands[id] = cards.sort((a, b) => a - b);
        });
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
        delete state.levelEndTime;
    }
    ready(room, clientId) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.SETUP && state.phase !== types_1.TheMindPhase.LEVEL_RESULT)
            return null;
        if (!state.readyPlayers.includes(clientId)) {
            state.readyPlayers.push(clientId);
        }
        const playerCount = room.players.filter((p) => p.connected).length;
        if (state.readyPlayers.length >= playerCount) {
            state.phase = types_1.TheMindPhase.PLAYING;
            if (room.config?.theMindTimeAttack) {
                state.levelEndTime = Date.now() + state.level * 30000 + 10000;
            }
        }
        return room;
    }
    playCard(room, clientId, card, pile) {
        const state = room.theMindState;
        if (!state)
            return null;
        if (state.phase !== types_1.TheMindPhase.PLAYING)
            return null;
        const hand = state.playerHands[clientId];
        if (!hand || !hand.includes(card))
            return null;
        const isExtreme = room.config?.theMindMode === 'EXTREME';
        if (!isExtreme && hand.length > 0 && card !== hand[0])
            return null;
        if (!isExtreme && pile === 'DOWN')
            return null;
        if (isExtreme && !pile)
            return null;
        if (room.config?.theMindBlindMode) {
            if (pile === 'DOWN') {
                state.pileTopDOWN = card;
            }
            else {
                state.pileTop = card;
            }
            state.pileTopPlayerId = clientId;
            state.playedCards.push({ card, playerId: clientId, pile });
            state.playerHands[clientId] = hand.filter((c) => c !== card);
            const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
            if (allEmpty) {
                const isSuccess = (0, types_1.getTheMindInvalidPlayIndexes)(state.playedCards, isExtreme ? 'EXTREME' : 'NORMAL')
                    .length === 0;
                if (isSuccess) {
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
                else {
                    state.lives -= 1;
                    state.result = {
                        success: false,
                        failedPlayerId: undefined,
                        discardedCards: {},
                        livesLost: 1,
                        levelCleared: false,
                    };
                    state.phase = types_1.TheMindPhase.LEVEL_RESULT;
                    if (state.lives <= 0) {
                        state.phase = types_1.TheMindPhase.GAME_OVER;
                        room.status = types_1.RoomStatus.RESULT;
                    }
                }
            }
            return room;
        }
        const currentUP = state.pileTop;
        const currentDOWN = isExtreme ? state.pileTopDOWN : 101;
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
        for (const [pid, h] of Object.entries(state.playerHands)) {
            for (const c of h) {
                if (pid === clientId && c === card)
                    continue;
                let isDead = false;
                if (isExtreme) {
                    isDead = c <= nextUP && c >= nextDOWN;
                }
                else {
                    isDead = c <= nextUP;
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
                state.playerHands[pid] = state.playerHands[pid].filter((c) => !dCards.includes(c));
            }
            if (pile === 'DOWN') {
                state.pileTopDOWN = card;
            }
            else {
                state.pileTop = card;
            }
            state.pileTopPlayerId = clientId;
            state.playedCards.push({ card, playerId: clientId, pile });
            const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
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
            state.playerHands[clientId] = hand.filter((c) => c !== card);
            const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
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
        return room;
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
                const getNewDeck = () => {
                    return this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));
                };
                state.deck = state.deck.length > 0 ? this.shuffleArray(state.deck) : getNewDeck();
                if (state.deck.length < state.level * room.players.filter((p) => p.connected).length) {
                    state.deck = getNewDeck();
                }
                state.playedCards = [];
                state.pileTop = 0;
                state.pileTopPlayerId = null;
                this.dealCards(room);
                return room;
            }
            else {
                state.phase = types_1.TheMindPhase.PLAYING;
                state.result = null;
                state.discardedCards = {};
                state.failedPlayerId = null;
                return room;
            }
        }
        if (state.level < state.maxLevel) {
            state.level += 1;
            state.phase = types_1.TheMindPhase.SETUP;
            const getNewDeck = () => {
                if (room.config?.theMindMode === 'EXTREME') {
                    return this.shuffleArray([
                        ...Array.from({ length: 50 }, (_, i) => i + 1),
                        ...Array.from({ length: 50 }, (_, i) => -(i + 1)),
                    ]);
                }
                return this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));
            };
            state.deck = state.deck.length > 0 ? this.shuffleArray(state.deck) : getNewDeck();
            if (state.deck.length < state.level * room.players.filter((p) => p.connected).length) {
                state.deck = getNewDeck();
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
        const playerCount = room.players.filter((p) => p.connected).length;
        const voteCount = Object.keys(state.shurikenVotes).length;
        if (voteCount >= playerCount) {
            const allAgree = Object.values(state.shurikenVotes).every((v) => v);
            state.shurikenProposerId = null;
            state.shurikenVotes = {};
            if (allAgree) {
                state.shuriken -= 1;
                const discarded = {};
                for (const [pid, hand] of Object.entries(state.playerHands)) {
                    if (hand.length > 0) {
                        discarded[pid] = [hand[0]];
                        state.playerHands[pid] = hand.slice(1);
                    }
                }
                state.discardedCards = discarded;
                state.phase = types_1.TheMindPhase.SHURIKEN_RESULT;
                const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
                if (allEmpty) {
                    const isSuccess = !room.config?.theMindBlindMode ||
                        (0, types_1.getTheMindInvalidPlayIndexes)(state.playedCards, room.config?.theMindMode === 'EXTREME' ? 'EXTREME' : 'NORMAL').length === 0;
                    if (isSuccess) {
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
                        }
                    }
                }
            }
        }
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
        if (state.lives <= 0) {
            state.phase = types_1.TheMindPhase.GAME_OVER;
            room.status = types_1.RoomStatus.RESULT;
        }
        return room;
    }
};
exports.TheMindService = TheMindService;
exports.TheMindService = TheMindService = __decorate([
    (0, common_1.Injectable)()
], TheMindService);
//# sourceMappingURL=the-mind.service.js.map