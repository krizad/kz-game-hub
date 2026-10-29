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
exports.CipherGridService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const cipher_grid_words_1 = require("./cipher-grid-words");
const ROOM_KEY = '__room__';
const ROOM_KEYCARD = 'cgRoomKeycard';
const other = (team) => (team === 'SOLAR' ? 'LUNAR' : 'SOLAR');
const normalize = (word) => word.trim().toLocaleLowerCase();
let CipherGridService = class CipherGridService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    createInitialState(mode = 'WORDS', picturePack = 'MINIMAL') {
        return {
            mode,
            picturePack,
            phase: 'TEAM_SETUP',
            round: 0,
            teams: {},
            cipherLeads: {},
            board: [],
            startingTeam: null,
            currentTeam: null,
            currentClue: null,
            guessesThisTurn: 0,
            pings: {},
            remaining: { SOLAR: 0, LUNAR: 0 },
            winner: null,
            winReason: null,
            history: [],
            scores: { SOLAR: 0, LUNAR: 0 },
            turnEndsAt: null,
        };
    }
    startGame(room, requesterId) {
        if (room.roomHostId !== requesterId || room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (this.participants(room).length < types_1.CIPHER_GRID_MIN_PLAYERS)
            return null;
        const previous = room.cipherGridState;
        room.cipherGridState = this.createInitialState(room.config.cipherGridMode ?? 'WORDS', room.config.cipherGridPicturePack ?? 'MINIMAL');
        if (previous) {
            room.cipherGridState.teams = { ...previous.teams };
            room.cipherGridState.cipherLeads = { ...previous.cipherLeads };
            this.pruneTeams(room);
        }
        room.status = types_1.RoomStatus.PLAYING;
        this.clearKeycards(room);
        return room;
    }
    resetGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        if (room.cipherGridState) {
            const { teams, cipherLeads } = room.cipherGridState;
            room.cipherGridState = {
                ...this.createInitialState(room.config.cipherGridMode ?? 'WORDS', room.config.cipherGridPicturePack ?? 'MINIMAL'),
                teams,
                cipherLeads,
            };
        }
        this.clearKeycards(room);
        return room;
    }
    cancelRound(room, requesterId, round) {
        const state = room.cipherGridState;
        if (room.roomHostId !== requesterId)
            return { error: 'HOST_ONLY' };
        if (!state ||
            state.round !== round ||
            (state.phase !== 'CLUE_GIVING' && state.phase !== 'DECODING')) {
            return { error: 'NOT_LIVE_ROUND' };
        }
        this.clearRound(room);
        return { room };
    }
    assignTeam(room, requesterId, team, role = 'TRACKER', targetId) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'TEAM_SETUP')
            return { error: 'NOT_TEAM_SETUP' };
        const subjectId = targetId ?? requesterId;
        if (subjectId !== requesterId && room.roomHostId !== requesterId) {
            return { error: 'HOST_ONLY' };
        }
        if (team !== null && team !== 'SOLAR' && team !== 'LUNAR')
            return { error: 'TEAM_INVALID' };
        if (role !== 'TRACKER' && role !== 'CIPHER_LEAD')
            return { error: 'ROLE_INVALID' };
        if (!this.participants(room).includes(subjectId))
            return { error: 'NOT_A_PLAYER' };
        this.removeFromTeams(state, subjectId);
        if (team) {
            state.teams[subjectId] = team;
            if (role === 'CIPHER_LEAD')
                state.cipherLeads[team] = subjectId;
        }
        return { room };
    }
    randomizeTeams(room, requesterId) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'TEAM_SETUP')
            return { error: 'NOT_TEAM_SETUP' };
        if (room.roomHostId !== requesterId)
            return { error: 'HOST_ONLY' };
        const ids = this.shuffle(this.participants(room));
        state.teams = {};
        state.cipherLeads = {};
        ids.forEach((id, i) => {
            const team = i % 2 === 0 ? 'SOLAR' : 'LUNAR';
            state.teams[id] = team;
            if (!state.cipherLeads[team])
                state.cipherLeads[team] = id;
        });
        return { room };
    }
    startMatch(room, requesterId) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'TEAM_SETUP')
            return { error: 'NOT_TEAM_SETUP' };
        if (room.roomHostId !== requesterId)
            return { error: 'HOST_ONLY' };
        this.pruneTeams(room);
        for (const team of ['SOLAR', 'LUNAR']) {
            if (!state.cipherLeads[team])
                return { error: 'TEAM_NEEDS_LEAD' };
            if (this.trackers(state, team).length < 1)
                return { error: 'TEAM_NEEDS_TRACKER' };
            const connected = new Set(this.participants(room));
            if (!connected.has(state.cipherLeads[team]) ||
                !this.trackers(state, team).some((id) => connected.has(id))) {
                return { error: 'TEAM_DISCONNECTED' };
            }
        }
        const startingTeam = Math.random() < 0.5 ? 'SOLAR' : 'LUNAR';
        const preset = types_1.CIPHER_GRID_MODE_PRESETS[state.mode];
        const keycard = this.buildKeycard(startingTeam, state.mode);
        if (state.mode === 'PICTURES') {
            state.picturePack = room.config.cipherGridPicturePack ?? state.picturePack ?? 'MINIMAL';
        }
        const pictureCatalog = types_1.CIPHER_GRID_PICTURE_PACKS[state.picturePack ?? 'MINIMAL'] ?? types_1.CIPHER_GRID_PICTURES_MINIMAL;
        state.board =
            state.mode === 'PICTURES'
                ? this.shuffle(pictureCatalog)
                    .slice(0, preset.boardSize)
                    .map((picture) => ({ kind: 'PICTURE', pictureId: picture.id, revealed: false }))
                : this.pickWords(room.config.language).map((word) => ({
                    kind: 'WORD',
                    word,
                    revealed: false,
                }));
        state.startingTeam = startingTeam;
        state.currentTeam = startingTeam;
        state.currentClue = null;
        state.guessesThisTurn = 0;
        state.pings = {};
        state.remaining = {
            SOLAR: startingTeam === 'SOLAR' ? preset.first : preset.second,
            LUNAR: startingTeam === 'LUNAR' ? preset.first : preset.second,
        };
        state.winner = null;
        state.winReason = null;
        state.history = [];
        state.round += 1;
        state.phase = 'CLUE_GIVING';
        room.status = types_1.RoomStatus.PLAYING;
        this.privateState.set(room.code, ROOM_KEY, ROOM_KEYCARD, keycard);
        this.syncKeycards(room);
        this.armTurnTimer(room);
        return { room };
    }
    nextRound(room, requesterId) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'ROUND_END')
            return { error: 'NOT_ROUND_END' };
        if (room.roomHostId !== requesterId)
            return { error: 'HOST_ONLY' };
        state.phase = 'TEAM_SETUP';
        state.board = [];
        state.currentTeam = null;
        state.currentClue = null;
        state.guessesThisTurn = 0;
        state.pings = {};
        state.winner = null;
        state.winReason = null;
        state.history = [];
        state.turnEndsAt = null;
        room.status = types_1.RoomStatus.PLAYING;
        this.clearKeycards(room);
        return { room };
    }
    giveClue(room, requesterId, rawWord, count) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'CLUE_GIVING' || !state.currentTeam) {
            return { error: 'NOT_CLUE_PHASE' };
        }
        if (state.cipherLeads[state.currentTeam] !== requesterId)
            return { error: 'NOT_YOUR_TURN' };
        const word = typeof rawWord === 'string' ? rawWord.trim() : '';
        if (!word || word.length > types_1.CIPHER_GRID_MAX_CLUE_LENGTH)
            return { error: 'CLUE_INVALID' };
        if (/\s/.test(word))
            return { error: 'CLUE_MULTIPLE_WORDS' };
        if (!this.isValidCount(count))
            return { error: 'CLUE_COUNT_INVALID' };
        const key = normalize(word);
        if (state.board.some((card) => card.kind === 'WORD' && !card.revealed && normalize(card.word) === key)) {
            return { error: 'CLUE_ON_BOARD' };
        }
        state.currentClue = {
            id: (0, node_crypto_1.randomUUID)(),
            team: state.currentTeam,
            word,
            count,
            giverId: requesterId,
        };
        state.guessesThisTurn = 0;
        state.pings = {};
        state.phase = 'DECODING';
        state.history.push({
            kind: 'CLUE',
            team: state.currentTeam,
            playerId: requesterId,
            word,
            count,
        });
        return { room };
    }
    pingCard(room, requesterId, cardIndex) {
        const state = room.cipherGridState;
        const guard = this.guardTracker(state, requesterId, cardIndex);
        if (guard)
            return { error: guard };
        if (state.pings[requesterId] === cardIndex) {
            delete state.pings[requesterId];
        }
        else {
            state.pings[requesterId] = cardIndex;
        }
        return { room };
    }
    revealCard(room, requesterId, cardIndex) {
        const state = room.cipherGridState;
        const guard = this.guardTracker(state, requesterId, cardIndex);
        if (guard)
            return { error: guard };
        const keycard = this.keycard(room);
        if (!keycard)
            return { error: 'NO_BOARD' };
        const team = state.currentTeam;
        const type = keycard[cardIndex];
        this.markRevealed(state, cardIndex, type, team);
        state.guessesThisTurn += 1;
        state.history.push({ kind: 'REVEAL', team, playerId: requesterId, cardIndex, cardType: type });
        if (type === 'VIRUS') {
            this.finishRound(room, other(team), 'VIRUS');
            return { room };
        }
        if (type === 'SOLAR' || type === 'LUNAR') {
            if (state.remaining[type] === 0) {
                this.finishRound(room, type, 'ALL_FOUND');
                return { room };
            }
        }
        if (type !== team) {
            this.switchTurn(room);
            return { room };
        }
        const limit = this.guessLimit(state.currentClue.count);
        if (limit !== null && state.guessesThisTurn >= limit) {
            this.switchTurn(room);
        }
        return { room };
    }
    endTurn(room, requesterId) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'DECODING' || !state.currentTeam) {
            return { error: 'NOT_DECODING' };
        }
        if (!this.trackers(state, state.currentTeam).includes(requesterId)) {
            return { error: 'NOT_YOUR_TURN' };
        }
        if (state.guessesThisTurn < 1)
            return { error: 'MUST_GUESS_FIRST' };
        state.history.push({ kind: 'END_TURN', team: state.currentTeam, playerId: requesterId });
        this.switchTurn(room);
        return { room };
    }
    challengeClue(room, requesterId) {
        const state = room.cipherGridState;
        if (!state || state.phase !== 'DECODING' || !state.currentTeam || !state.currentClue) {
            return { error: 'NOT_DECODING' };
        }
        const challengerTeam = state.teams[requesterId];
        if (!challengerTeam || challengerTeam === state.currentTeam)
            return { error: 'NOT_OPPONENT' };
        if (state.currentClue.challenged)
            return { error: 'ALREADY_CHALLENGED' };
        state.currentClue.challenged = true;
        state.currentClue.challenge = { team: challengerTeam, status: 'PENDING' };
        state.history.push({
            kind: 'CHALLENGE',
            team: challengerTeam,
            playerId: requesterId,
            word: state.currentClue.word,
        });
        return { room };
    }
    respondChallenge(room, requesterId, clueId, accept) {
        const state = room.cipherGridState;
        const clue = state?.currentClue;
        if (!state ||
            state.phase !== 'DECODING' ||
            !clue ||
            clue.id !== clueId ||
            clue.challenge?.status !== 'PENDING') {
            return { error: 'CHALLENGE_EXPIRED' };
        }
        if (clue.giverId !== requesterId)
            return { error: 'NOT_CLUE_GIVER' };
        if (typeof accept !== 'boolean')
            return { error: 'INVALID_RESPONSE' };
        const challengerTeam = clue.challenge.team;
        clue.challenge.status = accept ? 'ACCEPTED' : 'REJECTED';
        state.history.push({
            kind: accept ? 'CHALLENGE_ACCEPTED' : 'CHALLENGE_REJECTED',
            team: clue.team,
            playerId: requesterId,
            word: clue.word,
        });
        if (!accept)
            return { room };
        const keycard = this.keycard(room);
        if (keycard && state.remaining[challengerTeam] > 1) {
            const candidates = state.board
                .map((card, index) => ({ card, index }))
                .filter(({ card, index }) => !card.revealed && keycard[index] === challengerTeam);
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            if (pick) {
                this.markRevealed(state, pick.index, challengerTeam, null);
                state.history.push({
                    kind: 'PENALTY_REVEAL',
                    team: challengerTeam,
                    cardIndex: pick.index,
                    cardType: challengerTeam,
                });
            }
        }
        this.switchTurn(room);
        return { room };
    }
    handleTurnTimeout(room, deadline) {
        const state = room.cipherGridState;
        if (!state || state.turnEndsAt !== deadline)
            return null;
        if (state.phase !== 'CLUE_GIVING' && state.phase !== 'DECODING')
            return null;
        if (state.currentTeam) {
            state.history.push({ kind: 'END_TURN', team: state.currentTeam });
        }
        this.switchTurn(room);
        return room;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (oldSocketId in state.teams) {
            state.teams[newSocketId] = state.teams[oldSocketId];
            delete state.teams[oldSocketId];
        }
        for (const team of ['SOLAR', 'LUNAR']) {
            if (state.cipherLeads[team] === oldSocketId)
                state.cipherLeads[team] = newSocketId;
        }
        if (oldSocketId in state.pings) {
            state.pings[newSocketId] = state.pings[oldSocketId];
            delete state.pings[oldSocketId];
        }
        if (state.currentClue?.giverId === oldSocketId)
            state.currentClue.giverId = newSocketId;
        for (const entry of state.history) {
            if (entry.playerId === oldSocketId)
                entry.playerId = newSocketId;
        }
    }
    handlePlayerRemoved(room, socketId) {
        const state = room.cipherGridState;
        if (!state)
            return;
        delete state.pings[socketId];
        if (room.players.some((player) => player.socketId === socketId))
            return;
        const wasSeated = !!state.teams[socketId];
        this.removeFromTeams(state, socketId);
        if (!wasSeated || (state.phase !== 'CLUE_GIVING' && state.phase !== 'DECODING'))
            return;
        const missingRole = ['SOLAR', 'LUNAR'].some((team) => !state.cipherLeads[team] || this.trackers(state, team).length === 0);
        if (missingRole) {
            this.clearRound(room);
        }
    }
    clearRound(room) {
        const { mode, picturePack, teams, cipherLeads, round, scores } = room.cipherGridState;
        room.cipherGridState = {
            ...this.createInitialState(mode, picturePack),
            teams,
            cipherLeads,
            round,
            scores,
        };
        room.status = types_1.RoomStatus.PLAYING;
        this.clearKeycards(room);
    }
    participants(room) {
        return room.players.filter((p) => p.connected !== false && !p.isViewer).map((p) => p.socketId);
    }
    trackers(state, team) {
        return Object.entries(state.teams)
            .filter(([id, t]) => t === team && state.cipherLeads[team] !== id)
            .map(([id]) => id);
    }
    removeFromTeams(state, socketId) {
        delete state.teams[socketId];
        for (const team of ['SOLAR', 'LUNAR']) {
            if (state.cipherLeads[team] === socketId)
                delete state.cipherLeads[team];
        }
    }
    pruneTeams(room) {
        const state = room.cipherGridState;
        const present = new Set(room.players.filter((p) => !p.isViewer).map((p) => p.socketId));
        for (const id of Object.keys(state.teams)) {
            if (!present.has(id))
                this.removeFromTeams(state, id);
        }
        for (const team of ['SOLAR', 'LUNAR']) {
            const lead = state.cipherLeads[team];
            if (lead && state.teams[lead] !== team)
                delete state.cipherLeads[team];
        }
    }
    guardTracker(state, requesterId, cardIndex) {
        if (!state || state.phase !== 'DECODING' || !state.currentTeam)
            return 'NOT_DECODING';
        if (!this.trackers(state, state.currentTeam).includes(requesterId))
            return 'NOT_YOUR_TURN';
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= state.board.length) {
            return 'BAD_CARD';
        }
        if (state.board[cardIndex].revealed)
            return 'CARD_REVEALED';
        return null;
    }
    isValidCount(count) {
        if (count === 'UNLIMITED')
            return true;
        return (typeof count === 'number' &&
            Number.isInteger(count) &&
            count >= 0 &&
            count <= types_1.CIPHER_GRID_MAX_CLUE_COUNT);
    }
    guessLimit(count) {
        if (count === 'UNLIMITED' || count === 0)
            return null;
        return count + 1;
    }
    markRevealed(state, index, type, by) {
        const card = state.board[index];
        card.revealed = true;
        card.type = type;
        card.revealedBy = by;
        if (type === 'SOLAR' || type === 'LUNAR')
            state.remaining[type] -= 1;
        for (const [id, pinged] of Object.entries(state.pings)) {
            if (pinged === index)
                delete state.pings[id];
        }
    }
    switchTurn(room) {
        const state = room.cipherGridState;
        state.currentTeam = state.currentTeam ? other(state.currentTeam) : state.startingTeam;
        state.currentClue = null;
        state.guessesThisTurn = 0;
        state.pings = {};
        state.phase = 'CLUE_GIVING';
        this.armTurnTimer(room);
    }
    finishRound(room, winner, reason) {
        const state = room.cipherGridState;
        const keycard = this.keycard(room);
        if (keycard) {
            state.board.forEach((card, index) => {
                card.type = keycard[index];
            });
        }
        state.winner = winner;
        state.winReason = reason;
        state.scores[winner] += 1;
        state.phase = 'ROUND_END';
        state.currentClue = null;
        state.pings = {};
        state.turnEndsAt = null;
        for (const player of room.players) {
            if (state.teams[player.socketId] === winner)
                player.score += 1;
        }
        room.status = types_1.RoomStatus.RESULT;
        this.clearKeycards(room);
    }
    armTurnTimer(room) {
        const seconds = room.config.cipherGridTurnSeconds ?? 0;
        room.cipherGridState.turnEndsAt = seconds > 0 ? Date.now() + seconds * 1000 : null;
    }
    keycard(room) {
        return this.privateState.get(room.code, ROOM_KEY, ROOM_KEYCARD);
    }
    syncKeycards(room) {
        const state = room.cipherGridState;
        const keycard = this.keycard(room);
        const leads = new Set(Object.values(state?.cipherLeads ?? {}));
        for (const player of room.players) {
            if (keycard && leads.has(player.socketId)) {
                this.privateState.set(room.code, player.socketId, types_1.CIPHER_GRID_PRIVATE_STATE_KEY, [...keycard]);
            }
            else {
                this.privateState.delete(room.code, player.socketId, types_1.CIPHER_GRID_PRIVATE_STATE_KEY);
            }
        }
    }
    clearKeycards(room) {
        this.privateState.delete(room.code, ROOM_KEY, ROOM_KEYCARD);
        for (const player of room.players) {
            this.privateState.delete(room.code, player.socketId, types_1.CIPHER_GRID_PRIVATE_STATE_KEY);
        }
    }
    pickWords(language) {
        const unique = Array.from(new Set((0, cipher_grid_words_1.cipherGridWordPool)(language)));
        return this.shuffle(unique).slice(0, types_1.CIPHER_GRID_BOARD_SIZE);
    }
    buildKeycard(startingTeam, mode) {
        const preset = types_1.CIPHER_GRID_MODE_PRESETS[mode];
        const cards = [
            ...Array(preset.first).fill(startingTeam),
            ...Array(preset.second).fill(other(startingTeam)),
            ...Array(preset.decoys).fill('DECOY'),
            'VIRUS',
        ];
        return this.shuffle(cards);
    }
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
};
exports.CipherGridService = CipherGridService;
exports.CipherGridService = CipherGridService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], CipherGridService);
//# sourceMappingURL=cipher-grid.service.js.map