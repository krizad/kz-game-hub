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
const private_state_service_1 = require("../private-state.service");
const ROOM_KEY = '__room__';
const DC_ROLE = 'dcRole';
const DC_HAND = 'dcHand';
const DC_WORD = 'dcWord';
const DC_ROOM_CONSPIRATOR = 'dcRoomConspirator';
const DC_ROOM_WORD = 'dcRoomWord';
const DC_ROOM_DECK = 'dcRoomDeck';
const DC_ROOM_DISCARD = 'dcRoomDiscard';
const MAX_WORD_LENGTH = 30;
let DetectiveClubService = DetectiveClubService_1 = class DetectiveClubService {
    constructor(privateState) {
        this.privateState = privateState;
        this.logger = new common_1.Logger(DetectiveClubService_1.name);
        this.availableCards = [];
        this.loadAvailableCards();
    }
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    loadAvailableCards() {
        try {
            const candidates = [
                process.env.DETECTIVE_CLUB_CARDS_DIR,
                path.join(process.cwd(), '..', 'web', 'public', 'images', 'detective-club'),
                path.join(process.cwd(), 'apps', 'web', 'public', 'images', 'detective-club'),
            ].filter((p) => !!p);
            for (const imagesDir of candidates) {
                if (fs.existsSync(imagesDir)) {
                    const files = fs.readdirSync(imagesDir);
                    this.availableCards = files.filter((file) => file.toLowerCase().endsWith('.jpg') ||
                        file.toLowerCase().endsWith('.png') ||
                        file.toLowerCase().endsWith('.jpeg'));
                    this.logger.log(`Loaded ${this.availableCards.length} detective club cards from ${imagesDir}`);
                    return;
                }
            }
            this.logger.warn('Detective club images directory not found');
        }
        catch (error) {
            this.logger.error('Failed to load detective club cards', error);
        }
    }
    isMember(room, socketId) {
        return room.players.some((p) => p.socketId === socketId);
    }
    getRole(room, socketId) {
        return this.privateState.get(room.code, socketId, DC_ROLE);
    }
    setRole(room, socketId, role) {
        this.privateState.set(room.code, socketId, DC_ROLE, role);
    }
    getHand(room, socketId) {
        return this.privateState.get(room.code, socketId, DC_HAND) ?? [];
    }
    setHand(room, socketId, hand) {
        if (hand.length === 0) {
            this.privateState.delete(room.code, socketId, DC_HAND);
        }
        else {
            this.privateState.set(room.code, socketId, DC_HAND, hand);
        }
    }
    getConspiratorId(room) {
        return this.privateState.get(room.code, ROOM_KEY, DC_ROOM_CONSPIRATOR) ?? null;
    }
    setConspiratorId(room, socketId) {
        this.privateState.set(room.code, ROOM_KEY, DC_ROOM_CONSPIRATOR, socketId);
    }
    getSecretWord(room) {
        return this.privateState.get(room.code, ROOM_KEY, DC_ROOM_WORD) ?? null;
    }
    setSecretWord(room, word) {
        this.privateState.set(room.code, ROOM_KEY, DC_ROOM_WORD, word);
    }
    getDeck(room) {
        return this.privateState.get(room.code, ROOM_KEY, DC_ROOM_DECK) ?? [];
    }
    setDeck(room, deck) {
        this.privateState.set(room.code, ROOM_KEY, DC_ROOM_DECK, deck);
    }
    getDiscard(room) {
        return this.privateState.get(room.code, ROOM_KEY, DC_ROOM_DISCARD) ?? [];
    }
    setDiscard(room, discard) {
        this.privateState.set(room.code, ROOM_KEY, DC_ROOM_DISCARD, discard);
    }
    drawCards(room, playerSocketId, count) {
        let deck = this.getDeck(room);
        let discard = this.getDiscard(room);
        for (let i = 0; i < count; i++) {
            if (deck.length === 0) {
                if (discard.length > 0) {
                    deck = this.shuffleArray(discard);
                    discard = [];
                }
                else {
                    deck = this.shuffleArray(this.availableCards);
                }
            }
            const card = deck.pop();
            if (card) {
                const cardUrl = card.startsWith('/') ? card : `/images/detective-club/${card}`;
                const hand = this.getHand(room, playerSocketId);
                hand.push(cardUrl);
                this.setHand(room, playerSocketId, hand);
            }
        }
        this.setDeck(room, deck);
        this.setDiscard(room, discard);
    }
    syncHandSizes(room) {
        const state = room.detectiveClubState;
        if (!state)
            return;
        for (const [socketId, player] of Object.entries(state.players)) {
            player.handSize = this.getHand(room, socketId).length;
        }
    }
    startGame(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        const connectedPlayers = room.players.filter((p) => p.connected !== false);
        if (connectedPlayers.length < 3)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const shuffledPlayers = this.shuffleArray(connectedPlayers);
        const informer = shuffledPlayers[0];
        const conspirator = shuffledPlayers[1];
        const deck = this.shuffleArray(this.availableCards);
        this.setDeck(room, deck);
        this.setDiscard(room, []);
        const playersRecord = {};
        const state = {
            currentPhase: types_1.DetectiveClubPhase.SETUP,
            informerId: informer.socketId,
            conspiratorId: null,
            word: null,
            activePlayerId: null,
            players: playersRecord,
            playOrder: [],
            round1StarterId: informer.socketId,
        };
        shuffledPlayers.forEach((player) => {
            let role = types_1.DetectiveClubRole.DETECTIVE;
            if (player.socketId === informer.socketId)
                role = types_1.DetectiveClubRole.INFORMER;
            if (player.socketId === conspirator.socketId)
                role = types_1.DetectiveClubRole.CONSPIRATOR;
            this.setRole(room, player.socketId, role);
            this.setHand(room, player.socketId, []);
            playersRecord[player.socketId] = {
                id: player.socketId,
                score: player.score || 0,
                handSize: 0,
                playedCards: [],
                votedFor: null,
            };
            this.drawCards(room, player.socketId, 5);
        });
        this.setConspiratorId(room, conspirator.socketId);
        room.status = types_1.RoomStatus.PLAYING;
        room.detectiveClubState = state;
        this.syncHandSizes(room);
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
        const trimmed = word.trim();
        if (!trimmed || trimmed.length > MAX_WORD_LENGTH)
            return null;
        this.setSecretWord(room, trimmed);
        const conspiratorId = this.getConspiratorId(room);
        for (const p of room.players) {
            if (p.connected === false)
                continue;
            if (p.socketId === conspiratorId)
                continue;
            this.privateState.set(room.code, p.socketId, DC_WORD, trimmed);
        }
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
        if (!this.isMember(room, playerId))
            return null;
        const player = state.players[playerId];
        if (!player)
            return null;
        const hand = this.getHand(room, playerId);
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length)
            return null;
        const playedCard = hand.splice(cardIndex, 1)[0];
        this.setHand(room, playerId, hand);
        player.playedCards.push(playedCard);
        this.drawCards(room, playerId, 1);
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
                state.word = this.getSecretWord(room);
            }
        }
        else {
            state.activePlayerId = nextPlayerId;
        }
        this.syncHandSizes(room);
        return room;
    }
    nextPhase(room, requesterId) {
        if (!room.detectiveClubState)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase !== types_1.DetectiveClubPhase.DISCUSSION)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        state.currentPhase = types_1.DetectiveClubPhase.VOTING;
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
        if (playerId === targetId)
            return null;
        if (!this.isMember(room, targetId))
            return null;
        if (targetId === state.informerId)
            return null;
        const player = state.players[playerId];
        if (!player)
            return null;
        if (player.votedFor !== null)
            return null;
        player.votedFor = targetId;
        const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
        const votingPlayers = Object.values(state.players).filter((p) => p.id !== state.informerId && activePlayerIds.has(p.id));
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
        const conspiratorId = this.getConspiratorId(room);
        state.conspiratorId = conspiratorId;
        state.word = this.getSecretWord(room);
        for (const [socketId, player] of Object.entries(state.players)) {
            player.role = this.getRole(room, socketId) ?? types_1.DetectiveClubRole.DETECTIVE;
        }
        let conspiratorVotes = 0;
        const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
        const votingPlayers = Object.values(state.players).filter((p) => p.id !== state.informerId && activePlayerIds.has(p.id));
        votingPlayers.forEach((p) => {
            if (p.votedFor === conspiratorId) {
                conspiratorVotes++;
            }
        });
        const SCORE_DETECTIVE_WIN = 3;
        const SCORE_CONSPIRATOR_WIN = 5;
        const SCORE_INFORMER_WIN = 4;
        votingPlayers.forEach((p) => {
            if (p.role === types_1.DetectiveClubRole.DETECTIVE && p.votedFor === conspiratorId) {
                p.score += SCORE_DETECTIVE_WIN;
                state.scoreDeltas[p.id] = SCORE_DETECTIVE_WIN;
            }
        });
        if (conspiratorVotes <= 1) {
            if (conspiratorId && state.players[conspiratorId]) {
                state.players[conspiratorId].score += SCORE_CONSPIRATOR_WIN;
                state.scoreDeltas[conspiratorId] =
                    (state.scoreDeltas[conspiratorId] || 0) + SCORE_CONSPIRATOR_WIN;
            }
            if (state.informerId && state.players[state.informerId]) {
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
    handlePlayerDisconnect(room, socketId) {
        const state = room.detectiveClubState;
        if (!state)
            return;
        const connectedIds = room.players
            .filter((p) => p.connected !== false && p.socketId !== socketId)
            .map((p) => p.socketId);
        if (state.currentPhase === types_1.DetectiveClubPhase.SETUP) {
            if (state.informerId === socketId && connectedIds.length > 0) {
                const newInformerId = connectedIds[0];
                state.informerId = newInformerId;
                state.round1StarterId = newInformerId;
                this.setRole(room, newInformerId, types_1.DetectiveClubRole.INFORMER);
                if (this.getConspiratorId(room) === newInformerId) {
                    const newConspirator = connectedIds.find((id) => id !== newInformerId);
                    if (newConspirator) {
                        this.setConspiratorId(room, newConspirator);
                        this.setRole(room, newConspirator, types_1.DetectiveClubRole.CONSPIRATOR);
                    }
                }
            }
            if (this.getConspiratorId(room) === socketId && connectedIds.length > 1) {
                const newConspirator = connectedIds.find((id) => id !== state.informerId);
                if (newConspirator) {
                    this.setConspiratorId(room, newConspirator);
                    this.setRole(room, newConspirator, types_1.DetectiveClubRole.CONSPIRATOR);
                }
            }
            return;
        }
        if ((state.currentPhase === types_1.DetectiveClubPhase.PLAYING_ROUND_1 ||
            state.currentPhase === types_1.DetectiveClubPhase.PLAYING_ROUND_2) &&
            state.activePlayerId === socketId) {
            const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
            state.activePlayerId =
                state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
            return;
        }
        if (state.currentPhase === types_1.DetectiveClubPhase.VOTING) {
            const activePlayerIds = new Set(room.players.filter((p) => p.connected !== false).map((p) => p.socketId));
            const votingPlayers = Object.values(state.players).filter((p) => p.id !== state.informerId && activePlayerIds.has(p.id));
            const allVoted = votingPlayers.every((p) => p.votedFor !== null);
            if (allVoted && votingPlayers.length > 0) {
                this.calculateScore(room);
            }
        }
    }
    nextRound(room, requesterId) {
        if (!room.detectiveClubState)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const state = room.detectiveClubState;
        if (state.currentPhase !== types_1.DetectiveClubPhase.SCORING)
            return null;
        const connectedIds = room.players.filter((p) => p.connected !== false).map((p) => p.socketId);
        let nextInformerId = state.informerId;
        const currentIndex = connectedIds.indexOf(state.informerId);
        if (currentIndex !== -1) {
            nextInformerId = connectedIds[(currentIndex + 1) % connectedIds.length];
        }
        else if (connectedIds.length > 0) {
            nextInformerId = connectedIds[0];
        }
        const nonInformerPlayers = connectedIds.filter((id) => id !== nextInformerId);
        if (nonInformerPlayers.length === 0)
            return null;
        const randomConspiratorIndex = Math.floor(Math.random() * nonInformerPlayers.length);
        const nextConspiratorId = nonInformerPlayers[randomConspiratorIndex];
        const activePlayerIds = new Set(connectedIds);
        Object.entries(state.players).forEach(([id, p]) => {
            if (!activePlayerIds.has(id)) {
                if (p.playedCards && p.playedCards.length > 0) {
                    this.setDiscard(room, [...this.getDiscard(room), ...p.playedCards]);
                }
            }
        });
        Object.keys(state.players).forEach((id) => {
            if (!activePlayerIds.has(id))
                delete state.players[id];
        });
        Object.values(state.players).forEach((p) => {
            if (p.playedCards && p.playedCards.length > 0) {
                this.setDiscard(room, [...this.getDiscard(room), ...p.playedCards]);
            }
            if (p.id === nextInformerId)
                this.setRole(room, p.id, types_1.DetectiveClubRole.INFORMER);
            else if (p.id === nextConspiratorId)
                this.setRole(room, p.id, types_1.DetectiveClubRole.CONSPIRATOR);
            else
                this.setRole(room, p.id, types_1.DetectiveClubRole.DETECTIVE);
            const hand = this.getHand(room, p.id);
            let drawn = 0;
            while (hand.length < 5 && drawn < 5) {
                this.drawCards(room, p.id, 1);
                drawn++;
            }
            p.playedCards = [];
            p.votedFor = null;
            p.role = undefined;
            p.handSize = this.getHand(room, p.id).length;
        });
        this.setConspiratorId(room, nextConspiratorId);
        this.privateState.delete(room.code, ROOM_KEY, DC_ROOM_WORD);
        for (const p of room.players) {
            this.privateState.delete(room.code, p.socketId, DC_WORD);
        }
        state.currentPhase = types_1.DetectiveClubPhase.SETUP;
        state.informerId = nextInformerId;
        state.conspiratorId = null;
        state.word = null;
        state.activePlayerId = null;
        state.playOrder = [];
        state.round1StarterId = nextInformerId;
        state.scoreDeltas = undefined;
        return room;
    }
    reset(room, requesterId) {
        if (!room.detectiveClubState)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.detectiveClubState = undefined;
        this.privateState.clearRoom(room.code);
        room.players.forEach((p) => {
            p.score = 0;
        });
        return room;
    }
};
exports.DetectiveClubService = DetectiveClubService;
exports.DetectiveClubService = DetectiveClubService = DetectiveClubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], DetectiveClubService);
//# sourceMappingURL=detective-club.service.js.map