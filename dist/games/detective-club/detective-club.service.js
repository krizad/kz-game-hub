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
var DetectiveClubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectiveClubService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("node:fs");
const path = require("node:path");
const types_1 = require("@repo/types");
let DetectiveClubService = DetectiveClubService_1 = class DetectiveClubService {
    constructor() {
        this.logger = new common_1.Logger(DetectiveClubService_1.name);
        this.availableCards = [];
        this.loadAvailableCards();
    }
    loadAvailableCards() {
        try {
            const imagesDir = path.join(process.cwd(), '..', 'web', 'public', 'images', 'detective-club');
            if (fs.existsSync(imagesDir)) {
                const files = fs.readdirSync(imagesDir);
                this.availableCards = files.filter((file) => file.toLowerCase().endsWith('.jpg') ||
                    file.toLowerCase().endsWith('.png') ||
                    file.toLowerCase().endsWith('.jpeg'));
                this.logger.log(`Loaded ${this.availableCards.length} detective club cards from ${imagesDir}`);
            }
            else {
                this.logger.warn(`Detective club images directory not found at ${imagesDir}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to load detective club cards', error);
        }
    }
    drawCards(state, player, count) {
        for (let i = 0; i < count; i++) {
            if (!state.deck || state.deck.length === 0) {
                if (state.discardPile && state.discardPile.length > 0) {
                    state.deck = [...state.discardPile].sort(() => 0.5 - Math.random());
                    state.discardPile = [];
                }
                else {
                    state.deck = [...this.availableCards].sort(() => 0.5 - Math.random());
                    state.discardPile = [];
                }
            }
            const card = state.deck.pop();
            if (card) {
                const cardUrl = card.startsWith('/') ? card : `/images/detective-club/${card}`;
                player.hand.push(cardUrl);
            }
        }
    }
    startGame(room, requesterId) {
        if (room.players.length < 3)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
        const informer = shuffledPlayers[0];
        const conspirator = shuffledPlayers[1];
        const deck = [...this.availableCards].sort(() => 0.5 - Math.random());
        const discardPile = [];
        const playersRecord = {};
        const state = {
            currentPhase: types_1.DetectiveClubPhase.SETUP,
            informerId: informer.socketId,
            conspiratorId: conspirator.socketId,
            word: null,
            activePlayerId: null,
            players: playersRecord,
            playOrder: [],
            round1StarterId: informer.socketId,
            deck,
            discardPile,
        };
        shuffledPlayers.forEach((player) => {
            let role = types_1.DetectiveClubRole.DETECTIVE;
            if (player.socketId === informer.socketId)
                role = types_1.DetectiveClubRole.INFORMER;
            if (player.socketId === conspirator.socketId)
                role = types_1.DetectiveClubRole.CONSPIRATOR;
            playersRecord[player.socketId] = {
                id: player.socketId,
                role,
                score: player.score || 0,
                hand: [],
                playedCards: [],
                votedFor: null,
            };
            this.drawCards(state, playersRecord[player.socketId], 5);
        });
        room.status = types_1.RoomStatus.PLAYING;
        room.detectiveClubState = state;
        return room;
    }
    submitWord(room, playerId, word) {
        if (!room.detectiveClubState)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase !== types_1.DetectiveClubPhase.SETUP)
            return null;
        if (playerId !== state.informerId)
            return null;
        state.word = word;
        state.currentPhase = types_1.DetectiveClubPhase.PLAYING_ROUND_1;
        const playerIds = room.players.map((p) => p.socketId);
        const informerIndex = playerIds.indexOf(state.informerId);
        state.playOrder = [];
        for (let i = 0; i < playerIds.length; i++) {
            state.playOrder.push(playerIds[(informerIndex + i) % playerIds.length]);
        }
        state.activePlayerId = state.informerId;
        return room;
    }
    playCard(room, playerId, cardIndex) {
        if (!room.detectiveClubState)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase !== types_1.DetectiveClubPhase.PLAYING_ROUND_1 &&
            state.currentPhase !== types_1.DetectiveClubPhase.PLAYING_ROUND_2) {
            return null;
        }
        if (playerId !== state.activePlayerId)
            return null;
        const player = state.players[playerId];
        if (!player || cardIndex < 0 || cardIndex >= player.hand.length)
            return null;
        const playedCard = player.hand.splice(cardIndex, 1)[0];
        player.playedCards.push(playedCard);
        this.drawCards(state, player, 1);
        const currentIndex = state.playOrder.indexOf(playerId);
        let nextIndex = (currentIndex + 1) % state.playOrder.length;
        let nextPlayerId = state.playOrder[nextIndex];
        const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
        let skippedCount = 0;
        while (!activePlayerIds.has(nextPlayerId) && skippedCount < state.playOrder.length) {
            nextIndex = (nextIndex + 1) % state.playOrder.length;
            nextPlayerId = state.playOrder[nextIndex];
            skippedCount++;
        }
        if ((nextIndex <= currentIndex && skippedCount > 0) || nextIndex === 0) {
            if (state.currentPhase === types_1.DetectiveClubPhase.PLAYING_ROUND_1) {
                state.currentPhase = types_1.DetectiveClubPhase.PLAYING_ROUND_2;
                state.activePlayerId =
                    state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
            }
            else {
                state.currentPhase = types_1.DetectiveClubPhase.DISCUSSION;
                state.activePlayerId =
                    state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
            }
        }
        else {
            state.activePlayerId = nextPlayerId;
        }
        return room;
    }
    nextPhase(room, requesterId) {
        if (!room.detectiveClubState)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase === types_1.DetectiveClubPhase.DISCUSSION) {
            if (room.roomHostId !== requesterId)
                return null;
            state.currentPhase = types_1.DetectiveClubPhase.VOTING;
        }
        return room;
    }
    submitVote(room, playerId, targetId) {
        if (!room.detectiveClubState)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase !== types_1.DetectiveClubPhase.VOTING)
            return null;
        if (playerId === state.informerId)
            return null;
        const player = state.players[playerId];
        if (!player || !state.players[targetId])
            return null;
        player.votedFor = targetId;
        const activePlayerIds = new Set(room.players.map((p) => p.socketId));
        const votingPlayers = Object.values(state.players).filter((p) => p.role !== types_1.DetectiveClubRole.INFORMER && activePlayerIds.has(p.id));
        const allVoted = votingPlayers.every((p) => p.votedFor !== null);
        if (allVoted && votingPlayers.length > 0) {
            this.calculateScore(room);
        }
        return room;
    }
    calculateScore(room) {
        const state = room.detectiveClubState;
        state.currentPhase = types_1.DetectiveClubPhase.SCORING;
        state.scoreDeltas = {};
        let conspiratorVotes = 0;
        const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
        const votingPlayers = Object.values(state.players).filter((p) => p.role !== types_1.DetectiveClubRole.INFORMER && activePlayerIds.has(p.id));
        votingPlayers.forEach((p) => {
            if (p.votedFor === state.conspiratorId) {
                conspiratorVotes++;
            }
        });
        const SCORE_DETECTIVE_WIN = 3;
        const SCORE_CONSPIRATOR_WIN = 5;
        const SCORE_INFORMER_WIN = 4;
        votingPlayers.forEach((p) => {
            if (p.role === types_1.DetectiveClubRole.DETECTIVE && p.votedFor === state.conspiratorId) {
                p.score += SCORE_DETECTIVE_WIN;
                state.scoreDeltas[p.id] = SCORE_DETECTIVE_WIN;
            }
        });
        if (conspiratorVotes <= 1) {
            if (state.players[state.conspiratorId]) {
                state.players[state.conspiratorId].score += SCORE_CONSPIRATOR_WIN;
                state.scoreDeltas[state.conspiratorId] =
                    (state.scoreDeltas[state.conspiratorId] || 0) + SCORE_CONSPIRATOR_WIN;
            }
            if (state.players[state.informerId]) {
                state.players[state.informerId].score += SCORE_INFORMER_WIN;
                state.scoreDeltas[state.informerId] =
                    (state.scoreDeltas[state.informerId] || 0) + SCORE_INFORMER_WIN;
            }
        }
        Object.values(state.players).forEach((p) => {
            if (state.scoreDeltas[p.id] === undefined) {
                state.scoreDeltas[p.id] = 0;
            }
        });
        Object.values(state.players).forEach((p) => {
            const roomPlayer = room.players.find((rp) => rp.socketId === p.id);
            if (roomPlayer) {
                roomPlayer.score = p.score;
            }
        });
    }
    nextRound(room, requesterId) {
        if (!room.detectiveClubState)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase !== types_1.DetectiveClubPhase.SCORING)
            return null;
        const playerIds = room.players.map((p) => p.socketId);
        let nextInformerId = state.informerId;
        const currentIndex = playerIds.indexOf(state.informerId);
        if (currentIndex !== -1) {
            nextInformerId = playerIds[(currentIndex + 1) % playerIds.length];
        }
        else if (playerIds.length > 0) {
            nextInformerId = playerIds[0];
        }
        const nonInformerPlayers = playerIds.filter((id) => id !== nextInformerId);
        if (nonInformerPlayers.length === 0)
            return null;
        const randomConspiratorIndex = Math.floor(Math.random() * nonInformerPlayers.length);
        const nextConspiratorId = nonInformerPlayers[randomConspiratorIndex];
        if (!state.discardPile)
            state.discardPile = [];
        const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
        Object.keys(state.players).forEach((id) => {
            if (!activePlayerIds.has(id))
                delete state.players[id];
        });
        Object.values(state.players).forEach((p) => {
            if (p.playedCards && p.playedCards.length > 0) {
                state.discardPile.push(...p.playedCards);
            }
            p.role = types_1.DetectiveClubRole.DETECTIVE;
            if (p.id === nextInformerId)
                p.role = types_1.DetectiveClubRole.INFORMER;
            if (p.id === nextConspiratorId)
                p.role = types_1.DetectiveClubRole.CONSPIRATOR;
            while (p.hand.length < 5)
                this.drawCards(state, p, 1);
            p.playedCards = [];
            p.votedFor = null;
        });
        state.currentPhase = types_1.DetectiveClubPhase.SETUP;
        state.informerId = nextInformerId;
        state.conspiratorId = nextConspiratorId;
        state.word = null;
        state.activePlayerId = null;
        state.playOrder = [];
        state.round1StarterId = nextInformerId;
        return room;
    }
    reset(room, requesterId) {
        if (!room.detectiveClubState)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.detectiveClubState = undefined;
        room.players.forEach((p) => {
            p.score = 0;
        });
        return room;
    }
};
exports.DetectiveClubService = DetectiveClubService;
exports.DetectiveClubService = DetectiveClubService = DetectiveClubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DetectiveClubService);
//# sourceMappingURL=detective-club.service.js.map