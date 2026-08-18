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
exports.MusicTriviaService = void 0;
const common_1 = require("@nestjs/common");
const private_state_service_1 = require("../private-state.service");
const types_1 = require("@repo/types");
const itunes_adapter_1 = require("./adapters/itunes.adapter");
const spotify_adapter_1 = require("./adapters/spotify.adapter");
const youtube_adapter_1 = require("./adapters/youtube.adapter");
const deezer_adapter_1 = require("./adapters/deezer.adapter");
const soundcloud_adapter_1 = require("./adapters/soundcloud.adapter");
const music_source_adapter_1 = require("./music-source-adapter");
let MusicTriviaService = class MusicTriviaService {
    constructor(privateState) {
        this.privateState = privateState;
        this.sourceFactory = new music_source_adapter_1.MusicSourceFactory();
        this.sourceFactory.register(new itunes_adapter_1.ITunesAdapter());
        this.sourceFactory.register(new spotify_adapter_1.SpotifyAdapter());
        this.sourceFactory.register(new youtube_adapter_1.YouTubeAdapter());
        this.sourceFactory.register(new deezer_adapter_1.DeezerAdapter());
        this.sourceFactory.register(new soundcloud_adapter_1.SoundcloudAdapter());
    }
    startGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        if (room.players.length < 2)
            return null;
        const config = room.config;
        room.musicTriviaState = {
            phase: 'SETUP',
            mode: config.musicTriviaMode || 'TYPING',
            sourceType: config.musicTriviaSource || 'ITUNES',
            totalRounds: config.musicTriviaRounds || 10,
            currentRound: null,
            roundHistory: [],
            readyPlayerIds: [],
            scores: {},
            hostPlays: config.musicTriviaHostPlays ?? true,
            answerTimeoutMs: config.musicTriviaAnswerTimeoutMs || 15000,
        };
        for (const p of room.players) {
            room.musicTriviaState.scores[p.socketId] = 0;
        }
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    async handleGameAction(room, clientId, action) {
        const state = room.musicTriviaState;
        if (!state)
            return null;
        switch (action.type) {
            case 'CONFIGURE_SOURCE':
                return this.configureSource(room, clientId, action);
            case 'START_ROUND':
                return this.startRound(room, clientId);
            case 'PRESS_BUZZER':
                return this.pressBuzzer(room, clientId);
            case 'GIVE_UP':
                return this.giveUp(room, clientId);
            case 'SUBMIT_ANSWER':
                return this.submitAnswer(room, clientId, action.answer || '');
            case 'HOST_JUDGE':
                return this.hostJudge(room, clientId, action.correct ?? false);
            case 'REVEAL_ANSWER':
                return this.revealAnswer(room, clientId);
            case 'NEXT_ROUND':
                return this.nextRound(room, clientId);
            case 'PLAYER_READY':
                return this.playerReady(room, clientId);
            case 'START_COUNTDOWN':
                return this.startCountdown(room, clientId);
            case 'END_GAME':
                return this.endGame(room, clientId);
            default:
                return null;
        }
    }
    resetGame(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        this.privateState.clearRoom(room.code);
        room.musicTriviaState = undefined;
        room.status = types_1.RoomStatus.LOBBY;
        for (const p of room.players) {
            p.score = 0;
        }
        return room;
    }
    deleteRoomData(roomCode) {
        this.privateState.clearRoom(roomCode);
    }
    remapSocketId(state, oldId, newId) {
        if (state.scores[oldId] !== undefined) {
            state.scores[newId] = state.scores[oldId];
            delete state.scores[oldId];
        }
        if (state.currentRound) {
            if (state.currentRound.currentBuzzerId === oldId) {
                state.currentRound.currentBuzzerId = newId;
            }
            if (state.currentRound.winnerId === oldId) {
                state.currentRound.winnerId = newId;
            }
            state.currentRound.struckOutIds = state.currentRound.struckOutIds.map((id) => id === oldId ? newId : id);
            for (const press of state.currentRound.buzzerPresses) {
                if (press.playerId === oldId) {
                    press.playerId = newId;
                }
            }
        }
        if (state.readyPlayerIds) {
            state.readyPlayerIds = state.readyPlayerIds.map((id) => (id === oldId ? newId : id));
        }
        for (const h of state.roundHistory) {
            if (h.winnerId === oldId)
                h.winnerId = newId;
        }
    }
    playerReady(room, clientId) {
        const state = room.musicTriviaState;
        if (state.phase !== 'GET_READY')
            return null;
        if (!room.players.some((player) => player.socketId === clientId && player.connected !== false)) {
            return null;
        }
        if (!state.readyPlayerIds.includes(clientId)) {
            state.readyPlayerIds.push(clientId);
        }
        return { room };
    }
    startCountdown(room, clientId) {
        const state = room.musicTriviaState;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== 'GET_READY')
            return null;
        state.phase = 'COUNTDOWN';
        state.countdownEndsAt = Date.now() + 3000;
        return { room };
    }
    finalizeCountdown(room) {
        const state = room.musicTriviaState;
        if (state.phase !== 'COUNTDOWN')
            return null;
        state.phase = 'PLAYING';
        state.playStartTime = Date.now();
        state.countdownEndsAt = undefined;
        const round = state.currentRound;
        if (!round)
            return null;
        return {
            room,
            syncPlay: {
                roundNumber: round.roundNumber,
                playStartTime: state.playStartTime,
                previewUrl: round.track.previewUrl,
                sourceType: round.track.sourceType,
                durationMs: round.track.durationMs,
                artworkUrl: round.track.artworkUrl,
            },
        };
    }
    async configureSource(room, clientId, action) {
        const state = room.musicTriviaState;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== 'SETUP')
            return null;
        const query = action.query;
        if (!query || query.trim().length === 0)
            return null;
        const sourceType = action.sourceType || state.sourceType;
        state.phase = 'LOADING';
        state.sourceType = sourceType;
        try {
            const adapter = this.sourceFactory.get(sourceType);
            const fetchLimit = Math.max(state.totalRounds * 3, 50);
            const rawTracks = await adapter.search(query.trim(), fetchLimit, action.searchOptions);
            if (rawTracks.length === 0) {
                state.phase = 'SETUP';
                state.errorMessage = 'No songs found for this search. Try a different artist or genre.';
                return { room };
            }
            const uniqueTracks = [];
            const seen = new Set();
            for (const t of rawTracks) {
                const key = `${t.title.toLowerCase().trim()}::${t.artist.toLowerCase().trim()}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueTracks.push(t);
                }
            }
            for (let i = uniqueTracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
            }
            state.totalRounds = Math.min(state.totalRounds, uniqueTracks.length);
            const selectedTracks = uniqueTracks.slice(0, state.totalRounds);
            this.privateState.set(room.code, '__ROOM__', 'mtTrackAnswers', selectedTracks.map((t) => ({
                id: t.id,
                title: t.title,
                artist: t.artist,
                trackViewUrl: t.trackViewUrl,
                album: t.album,
                releaseYear: t.releaseYear,
            })));
            this.privateState.set(room.code, '__ROOM__', 'mtFullTracks', selectedTracks);
            const firstTrack = selectedTracks[0];
            state.currentRound = this.createRound(1, firstTrack);
            state.phase = 'GET_READY';
            state.readyPlayerIds = [];
            return { room };
        }
        catch (error) {
            console.error('[MusicTriviaService] configureSource error:', error);
            state.phase = 'SETUP';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while configuring source';
            state.errorMessage = errorMessage;
            return { room };
        }
    }
    startRound(room, clientId) {
        const state = room.musicTriviaState;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== 'ROUND_RESULT' && state.phase !== 'REVEAL')
            return null;
        return this.advanceToNextRound(room);
    }
    pressBuzzer(room, clientId) {
        const state = room.musicTriviaState;
        if (state.phase !== 'PLAYING')
            return null;
        const round = state.currentRound;
        if (!round)
            return null;
        const isPlayer = room.players.some((p) => p.socketId === clientId);
        if (!isPlayer)
            return null;
        const isHost = room.roomHostId === clientId;
        if (isHost && !state.hostPlays)
            return null;
        if (round.struckOutIds.includes(clientId))
            return null;
        if (round.buzzerPresses.some((p) => p.playerId === clientId))
            return null;
        const now = Date.now();
        const reactionTimeMs = state.playStartTime ? now - state.playStartTime : 0;
        round.buzzerPresses.push({
            playerId: clientId,
            timestamp: now,
            reactionTimeMs,
        });
        round.currentBuzzerId = clientId;
        state.phase = 'BUZZED';
        state.pausedAtMs = now;
        if (state.mode === 'TYPING') {
            state.phase = 'ANSWERING';
        }
        const result = { room };
        return result;
    }
    answerTimeout(room) {
        const state = room.musicTriviaState;
        if (!state || (state.phase !== 'ANSWERING' && state.phase !== 'BUZZED'))
            return null;
        const round = state.currentRound;
        if (!round || !round.currentBuzzerId)
            return null;
        return this.giveUp(room, round.currentBuzzerId);
    }
    giveUp(room, clientId) {
        const state = room.musicTriviaState;
        if (state.phase !== 'PLAYING')
            return null;
        const round = state.currentRound;
        if (!round)
            return null;
        const isPlayer = room.players.some((p) => p.socketId === clientId);
        if (!isPlayer)
            return null;
        const isHost = room.roomHostId === clientId;
        if (isHost && !state.hostPlays)
            return null;
        if (round.struckOutIds.includes(clientId))
            return null;
        round.struckOutIds.push(clientId);
        if (this.allPlayersStruckOut(room)) {
            state.phase = 'REVEAL';
            const answers = this.privateState.get(room.code, '__ROOM__', 'mtTrackAnswers');
            const trackAnswer = answers ? answers[round.roundNumber - 1] : null;
            if (trackAnswer) {
                state.revealedAnswer = {
                    title: trackAnswer.title,
                    artist: trackAnswer.artist,
                    artworkUrl: round.track.artworkUrl,
                    album: trackAnswer.album,
                    releaseYear: trackAnswer.releaseYear,
                };
            }
        }
        return { room };
    }
    submitAnswer(room, clientId, answer) {
        const state = room.musicTriviaState;
        if (state.mode !== 'TYPING')
            return null;
        if (state.phase !== 'ANSWERING')
            return null;
        const round = state.currentRound;
        if (!round || round.currentBuzzerId !== clientId)
            return null;
        const answers = this.privateState.get(room.code, '__ROOM__', 'mtTrackAnswers');
        if (!answers)
            return null;
        const trackAnswer = answers[round.roundNumber - 1];
        if (!trackAnswer)
            return null;
        const criteria = room.config.musicTriviaAnswerCriteria || 'ANY';
        const matchTitle = this.fuzzyMatch(answer, trackAnswer.title);
        const matchArtist = this.fuzzyMatch(answer, trackAnswer.artist);
        let isCorrect = false;
        if (criteria === 'TITLE') {
            isCorrect = matchTitle;
        }
        else if (criteria === 'ARTIST') {
            isCorrect = matchArtist;
        }
        else {
            isCorrect = matchTitle || matchArtist;
        }
        if (isCorrect) {
            round.answeredCorrectly = true;
            round.winnerId = clientId;
            state.scores[clientId] = (state.scores[clientId] || 0) + 1;
            const player = room.players.find((p) => p.socketId === clientId);
            if (player)
                player.score = state.scores[clientId];
            state.phase = 'ANSWER_RESULT';
            state.revealedAnswer = {
                title: trackAnswer.title,
                artist: trackAnswer.artist,
                artworkUrl: round.track.artworkUrl,
                album: trackAnswer.album,
                releaseYear: trackAnswer.releaseYear,
                successfulAnswerText: answer.trim(),
            };
        }
        else {
            round.struckOutIds.push(clientId);
            round.currentBuzzerId = null;
            if (this.allPlayersStruckOut(room)) {
                state.phase = 'REVEAL';
                state.revealedAnswer = {
                    title: trackAnswer.title,
                    artist: trackAnswer.artist,
                    artworkUrl: round.track.artworkUrl,
                    album: trackAnswer.album,
                    releaseYear: trackAnswer.releaseYear,
                };
            }
            else {
                state.phase = 'PLAYING';
                if (state.playStartTime && state.pausedAtMs) {
                    const pauseDuration = Date.now() - state.pausedAtMs;
                    state.playStartTime += pauseDuration;
                }
                else {
                    state.playStartTime = Date.now();
                }
                state.pausedAtMs = undefined;
                const result = {
                    room,
                    syncPlay: {
                        roundNumber: round.roundNumber,
                        playStartTime: state.playStartTime,
                        previewUrl: round.track.previewUrl,
                        sourceType: round.track.sourceType,
                        durationMs: round.track.durationMs,
                        artworkUrl: round.track.artworkUrl,
                    },
                };
                return result;
            }
        }
        return { room };
    }
    hostJudge(room, clientId, correct) {
        const state = room.musicTriviaState;
        if (state.mode !== 'GAME_MASTER')
            return null;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== 'BUZZED')
            return null;
        const round = state.currentRound;
        if (!round || !round.currentBuzzerId)
            return null;
        const buzzerId = round.currentBuzzerId;
        const answers = this.privateState.get(room.code, '__ROOM__', 'mtTrackAnswers');
        const trackAnswer = answers ? answers[round.roundNumber - 1] : null;
        if (correct) {
            round.answeredCorrectly = true;
            round.winnerId = buzzerId;
            state.scores[buzzerId] = (state.scores[buzzerId] || 0) + 1;
            const player = room.players.find((p) => p.socketId === buzzerId);
            if (player)
                player.score = state.scores[buzzerId];
            state.phase = 'ANSWER_RESULT';
            if (trackAnswer) {
                state.revealedAnswer = {
                    title: trackAnswer.title,
                    artist: trackAnswer.artist,
                    artworkUrl: round.track.artworkUrl,
                    album: trackAnswer.album,
                    releaseYear: trackAnswer.releaseYear,
                };
            }
        }
        else {
            round.struckOutIds.push(buzzerId);
            round.currentBuzzerId = null;
            if (this.allPlayersStruckOut(room)) {
                state.phase = 'REVEAL';
                if (trackAnswer) {
                    state.revealedAnswer = {
                        title: trackAnswer.title,
                        artist: trackAnswer.artist,
                        artworkUrl: round.track.artworkUrl,
                        album: trackAnswer.album,
                        releaseYear: trackAnswer.releaseYear,
                    };
                }
            }
            else {
                state.phase = 'PLAYING';
                if (state.playStartTime && state.pausedAtMs) {
                    const pauseDuration = Date.now() - state.pausedAtMs;
                    state.playStartTime += pauseDuration;
                }
                else {
                    state.playStartTime = Date.now();
                }
                state.pausedAtMs = undefined;
                return {
                    room,
                    syncPlay: {
                        roundNumber: round.roundNumber,
                        playStartTime: state.playStartTime,
                        previewUrl: round.track.previewUrl,
                        sourceType: round.track.sourceType,
                        durationMs: round.track.durationMs,
                        artworkUrl: round.track.artworkUrl,
                    },
                };
            }
        }
        return { room };
    }
    revealAnswer(room, clientId) {
        const state = room.musicTriviaState;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== 'PLAYING' && state.phase !== 'BUZZED' && state.phase !== 'ANSWERING')
            return null;
        const round = state.currentRound;
        if (!round)
            return null;
        const answers = this.privateState.get(room.code, '__ROOM__', 'mtTrackAnswers');
        const trackAnswer = answers ? answers[round.roundNumber - 1] : null;
        state.phase = 'REVEAL';
        if (trackAnswer) {
            state.revealedAnswer = {
                title: trackAnswer.title,
                artist: trackAnswer.artist,
                artworkUrl: round.track.artworkUrl,
                album: trackAnswer.album,
                releaseYear: trackAnswer.releaseYear,
            };
        }
        return { room };
    }
    nextRound(room, clientId) {
        const state = room.musicTriviaState;
        if (room.roomHostId !== clientId)
            return null;
        if (state.phase !== 'ANSWER_RESULT' &&
            state.phase !== 'REVEAL' &&
            state.phase !== 'ROUND_RESULT')
            return null;
        return this.advanceToNextRound(room);
    }
    endGame(room, clientId) {
        const state = room.musicTriviaState;
        if (room.roomHostId !== clientId)
            return null;
        state.phase = 'FINISHED';
        room.status = types_1.RoomStatus.RESULT;
        for (const p of room.players) {
            p.score = state.scores[p.socketId] || 0;
        }
        return { room };
    }
    advanceToNextRound(room) {
        const state = room.musicTriviaState;
        const round = state.currentRound;
        if (round) {
            const answers = this.privateState.get(room.code, '__ROOM__', 'mtTrackAnswers');
            const trackAnswer = answers ? answers[round.roundNumber - 1] : null;
            const historyEntry = {
                roundNumber: round.roundNumber,
                winnerId: round.winnerId,
                trackTitle: trackAnswer?.title || 'Unknown',
                artistName: trackAnswer?.artist || 'Unknown',
                artworkUrl: round.track.artworkUrl,
                trackViewUrl: trackAnswer?.trackViewUrl,
                album: trackAnswer?.album,
                releaseYear: trackAnswer?.releaseYear,
                successfulAnswerText: state.revealedAnswer?.successfulAnswerText,
            };
            state.roundHistory.push(historyEntry);
        }
        const nextRoundNumber = (round?.roundNumber || 0) + 1;
        if (nextRoundNumber > state.totalRounds) {
            state.phase = 'FINISHED';
            state.currentRound = null;
            room.status = types_1.RoomStatus.RESULT;
            for (const p of room.players) {
                p.score = state.scores[p.socketId] || 0;
            }
            return { room };
        }
        const answers = this.privateState.get(room.code, '__ROOM__', 'mtTrackAnswers');
        if (!answers || !answers[nextRoundNumber - 1]) {
            state.phase = 'FINISHED';
            room.status = types_1.RoomStatus.RESULT;
            return { room };
        }
        const fullTracks = this.getFullTracks(room.code);
        if (!fullTracks || !fullTracks[nextRoundNumber - 1]) {
            state.phase = 'FINISHED';
            room.status = types_1.RoomStatus.RESULT;
            return { room };
        }
        const nextTrack = fullTracks[nextRoundNumber - 1];
        state.currentRound = this.createRound(nextRoundNumber, nextTrack);
        state.phase = 'COUNTDOWN';
        state.countdownEndsAt = Date.now() + 3000;
        state.revealedAnswer = undefined;
        const trackAnswer = answers[nextRoundNumber - 1];
        const result = {
            room,
        };
        if (state.mode === 'GAME_MASTER' && !state.hostPlays) {
            const hostPlayer = room.players.find((p) => p.socketId === room.roomHostId);
            if (hostPlayer) {
                result.hostAnswerTo = {
                    socketId: hostPlayer.socketId,
                    title: trackAnswer.title,
                    artist: trackAnswer.artist,
                    artworkUrl: nextTrack.artworkUrl,
                    trackViewUrl: trackAnswer.trackViewUrl,
                };
            }
        }
        return result;
    }
    createRound(roundNumber, track) {
        return {
            roundNumber,
            track: {
                id: track.id,
                previewUrl: track.previewUrl,
                sourceType: track.sourceType,
                durationMs: track.durationMs,
                artworkUrl: track.artworkUrl,
            },
            buzzerPresses: [],
            currentBuzzerId: null,
            struckOutIds: [],
            answeredCorrectly: false,
            winnerId: null,
        };
    }
    allPlayersStruckOut(room) {
        const state = room.musicTriviaState;
        const round = state.currentRound;
        const eligiblePlayers = room.players.filter((p) => {
            if (p.connected === false)
                return false;
            if (!state.hostPlays && p.socketId === room.roomHostId)
                return false;
            return true;
        });
        return eligiblePlayers.every((p) => round.struckOutIds.includes(p.socketId));
    }
    getFullTracks(roomCode) {
        return this.privateState.get(roomCode, '__ROOM__', 'mtFullTracks');
    }
    levenshteinDistance(a, b) {
        const m = a.length;
        const n = b.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++)
            dp[i][0] = i;
        for (let j = 0; j <= n; j++)
            dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] =
                    a[i - 1] === b[j - 1]
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return dp[m][n];
    }
    fuzzyMatch(input, target) {
        const a = input.toLowerCase().trim().replace(/\s+/g, ' ');
        if (a.length === 0)
            return false;
        const variations = new Set();
        variations.add(target.replace(/\s*\(.*?\)\s*/g, ''));
        const parenMatches = target.match(/\((.*?)\)/g);
        if (parenMatches) {
            parenMatches.forEach((m) => variations.add(m.replace(/[()]/g, '')));
        }
        const separators = /\||-|\/|:/;
        target.split(separators).forEach((part) => {
            variations.add(part.replace(/\s*\(.*?\)\s*/g, ''));
        });
        for (const v of variations) {
            const cleanTarget = v.toLowerCase().trim().replace(/\s+/g, ' ');
            if (cleanTarget.length === 0)
                continue;
            if (a === cleanTarget)
                return true;
            const distance = this.levenshteinDistance(a, cleanTarget);
            const maxLen = Math.max(a.length, cleanTarget.length);
            const similarity = 1 - distance / maxLen;
            if (similarity >= 0.85)
                return true;
            if (cleanTarget.includes(a) && a.length >= cleanTarget.length * 0.7 && a.length >= 3)
                return true;
        }
        return false;
    }
};
exports.MusicTriviaService = MusicTriviaService;
exports.MusicTriviaService = MusicTriviaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], MusicTriviaService);
//# sourceMappingURL=music-trivia.service.js.map