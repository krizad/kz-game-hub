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
exports.GamesService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const uuid_1 = require("uuid");
const who_know_service_1 = require("./who-know/who-know.service");
const tic_tac_toe_service_1 = require("./tic-tac-toe/tic-tac-toe.service");
const rps_service_1 = require("./rps/rps.service");
const gobbler_service_1 = require("./gobbler/gobbler.service");
const sounds_fishy_service_1 = require("./sounds-fishy/sounds-fishy.service");
const detective_club_service_1 = require("./detective-club/detective-club.service");
const who_am_i_service_1 = require("./who-am-i/who-am-i.service");
const who_first_service_1 = require("./who-first/who-first.service");
const music_trivia_service_1 = require("./music-trivia/music-trivia.service");
const the_mind_service_1 = require("./the-mind/the-mind.service");
const player_session_service_1 = require("./player-session.service");
let GamesService = class GamesService {
    constructor(whoKnowService, ticTacToeService, rpsService, gobblerService, soundsFishyService, detectiveClubService, whoAmIService, whoFirstService, musicTriviaService, theMindService, playerSessionService) {
        this.whoKnowService = whoKnowService;
        this.ticTacToeService = ticTacToeService;
        this.rpsService = rpsService;
        this.gobblerService = gobblerService;
        this.soundsFishyService = soundsFishyService;
        this.detectiveClubService = detectiveClubService;
        this.whoAmIService = whoAmIService;
        this.whoFirstService = whoFirstService;
        this.musicTriviaService = musicTriviaService;
        this.theMindService = theMindService;
        this.playerSessionService = playerSessionService;
        this.rooms = new Map();
        this.secretWords = new Map();
    }
    findRoomCodeBySocketId(socketId) {
        for (const [code, room] of this.rooms.entries()) {
            if (room.players.some((p) => p.socketId === socketId)) {
                return code;
            }
        }
        return null;
    }
    getRoom(code) {
        return this.rooms.get(code);
    }
    getReconnectToken(code, socketId) {
        const room = this.rooms.get(code);
        const player = room?.players.find((candidate) => candidate.socketId === socketId);
        if (!player)
            return null;
        return this.playerSessionService.takePendingToken(socketId);
    }
    createRoom(hostId, gameType = types_1.GameType.WHO_KNOW) {
        let code;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.rooms.has(code));
        const room = {
            id: (0, uuid_1.v4)(),
            gameType,
            code,
            status: types_1.RoomStatus.LOBBY,
            roomHostId: hostId,
            players: [],
            createdAt: new Date(),
            config: {
                hostSelection: 'ROUND_ROBIN',
                timerMin: 5,
                rpsBestOf: 3,
                rpsMode: '1V1_ROUND_ROBIN',
                language: 'th',
            },
        };
        if (gameType === types_1.GameType.TIC_TAC_TOE) {
            room.ticTacToeState = {
                board: Array(9).fill(null),
                currentTurn: 'X',
            };
        }
        else if (gameType === types_1.GameType.RPS) {
            room.rpsState = {
                activePlayers: [],
                queue: [],
                choices: {},
                scores: {},
            };
        }
        else if (gameType === types_1.GameType.GOBBLER_TIC_TAC_TOE) {
            room.gobblerState = {
                board: Array.from({ length: 9 }, () => []),
                currentTurn: 'X',
                inventory: {
                    X: [
                        { id: (0, uuid_1.v4)(), side: 'X', size: 'SMALL' },
                        { id: (0, uuid_1.v4)(), side: 'X', size: 'SMALL' },
                        { id: (0, uuid_1.v4)(), side: 'X', size: 'MEDIUM' },
                        { id: (0, uuid_1.v4)(), side: 'X', size: 'MEDIUM' },
                        { id: (0, uuid_1.v4)(), side: 'X', size: 'LARGE' },
                        { id: (0, uuid_1.v4)(), side: 'X', size: 'LARGE' },
                    ],
                    O: [
                        { id: (0, uuid_1.v4)(), side: 'O', size: 'SMALL' },
                        { id: (0, uuid_1.v4)(), side: 'O', size: 'SMALL' },
                        { id: (0, uuid_1.v4)(), side: 'O', size: 'MEDIUM' },
                        { id: (0, uuid_1.v4)(), side: 'O', size: 'MEDIUM' },
                        { id: (0, uuid_1.v4)(), side: 'O', size: 'LARGE' },
                        { id: (0, uuid_1.v4)(), side: 'O', size: 'LARGE' },
                    ],
                },
                scores: { X: 0, O: 0 },
            };
        }
        else if (gameType === types_1.GameType.WHO_AM_I) {
            room.config.maxRounds = 3;
            room.config.wordMode = 'RANDOM';
        }
        else if (gameType === types_1.GameType.WHO_FIRST) {
            room.config.whoFirstPenalty = true;
            room.config.whoFirstHostPlays = false;
            room.config.maxRounds = 5;
            room.whoFirstState = {
                phase: 'LOBBY',
                presses: [],
                currentRound: 1,
                maxRounds: 5,
            };
        }
        else if (gameType === types_1.GameType.MUSIC_TRIVIA) {
            room.config.musicTriviaMode = 'TYPING';
            room.config.musicTriviaSource = 'ITUNES';
            room.config.musicTriviaRounds = 10;
            room.config.musicTriviaHostPlays = true;
            room.config.musicTriviaAnswerTimeoutMs = 15000;
        }
        else if (gameType === types_1.GameType.THE_MIND) {
        }
        this.rooms.set(code, room);
        return room;
    }
    joinRoom(code, user, reconnectToken) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const playerId = reconnectToken
            ? this.playerSessionService.consume(code, reconnectToken)
            : undefined;
        const existingPlayer = playerId
            ? room.players.find((player) => player.id === playerId && player.name === user.name)
            : undefined;
        const duplicateName = room.players.some((player) => player.name === user.name);
        if (!existingPlayer && duplicateName)
            return null;
        if (existingPlayer) {
            const oldSocketId = existingPlayer.socketId;
            existingPlayer.socketId = user.socketId;
            existingPlayer.connected = true;
            if (room.roomHostId === oldSocketId) {
                room.roomHostId = user.socketId;
            }
            if (room.votes) {
                if (room.votes[oldSocketId]) {
                    room.votes[user.socketId] = room.votes[oldSocketId];
                    delete room.votes[oldSocketId];
                }
                Object.entries(room.votes).forEach(([voterId, targetId]) => {
                    if (targetId === oldSocketId) {
                        room.votes[voterId] = user.socketId;
                    }
                });
            }
            if (room.ticTacToeState) {
                if (room.ticTacToeState.playerXId === oldSocketId)
                    room.ticTacToeState.playerXId = user.socketId;
                if (room.ticTacToeState.playerOId === oldSocketId)
                    room.ticTacToeState.playerOId = user.socketId;
            }
            if (room.rpsState) {
                const idx = room.rpsState.activePlayers.indexOf(oldSocketId);
                if (idx !== -1)
                    room.rpsState.activePlayers[idx] = user.socketId;
                const qIdx = room.rpsState.queue.indexOf(oldSocketId);
                if (qIdx !== -1)
                    room.rpsState.queue[qIdx] = user.socketId;
                if (room.rpsState.choices[oldSocketId]) {
                    room.rpsState.choices[user.socketId] = room.rpsState.choices[oldSocketId];
                    delete room.rpsState.choices[oldSocketId];
                }
                if (room.rpsState.scores[oldSocketId] !== undefined) {
                    room.rpsState.scores[user.socketId] = room.rpsState.scores[oldSocketId];
                    delete room.rpsState.scores[oldSocketId];
                }
                if (room.rpsState.gameWinner === oldSocketId)
                    room.rpsState.gameWinner = user.socketId;
                else if (Array.isArray(room.rpsState.gameWinner)) {
                    const wIdx = room.rpsState.gameWinner.indexOf(oldSocketId);
                    if (wIdx !== -1)
                        room.rpsState.gameWinner[wIdx] = user.socketId;
                }
                if (room.rpsState.roundWinner === oldSocketId)
                    room.rpsState.roundWinner = user.socketId;
                else if (Array.isArray(room.rpsState.roundWinner)) {
                    const wIdx = room.rpsState.roundWinner.indexOf(oldSocketId);
                    if (wIdx !== -1)
                        room.rpsState.roundWinner[wIdx] = user.socketId;
                }
            }
            if (room.gobblerState) {
                if (room.gobblerState.playerXId === oldSocketId)
                    room.gobblerState.playerXId = user.socketId;
                if (room.gobblerState.playerOId === oldSocketId)
                    room.gobblerState.playerOId = user.socketId;
            }
            if (room.soundsFishyState) {
                if (room.soundsFishyState.pickerId === oldSocketId)
                    room.soundsFishyState.pickerId = user.socketId;
                if (room.soundsFishyState.blueFishId === oldSocketId)
                    room.soundsFishyState.blueFishId = user.socketId;
                const rhIdx = room.soundsFishyState.redHerringIds.indexOf(oldSocketId);
                if (rhIdx !== -1)
                    room.soundsFishyState.redHerringIds[rhIdx] = user.socketId;
                const epIdx = room.soundsFishyState.eliminatedPlayers.indexOf(oldSocketId);
                if (epIdx !== -1)
                    room.soundsFishyState.eliminatedPlayers[epIdx] = user.socketId;
                if (room.soundsFishyState.playerAnswers[oldSocketId]) {
                    room.soundsFishyState.playerAnswers[user.socketId] =
                        room.soundsFishyState.playerAnswers[oldSocketId];
                    room.soundsFishyState.playerAnswers[user.socketId].playerId = user.socketId;
                    delete room.soundsFishyState.playerAnswers[oldSocketId];
                }
                if (room.soundsFishyState.roundPoints[oldSocketId] !== undefined) {
                    room.soundsFishyState.roundPoints[user.socketId] =
                        room.soundsFishyState.roundPoints[oldSocketId];
                    delete room.soundsFishyState.roundPoints[oldSocketId];
                }
                if (room.soundsFishyState.typingAnswers[oldSocketId]) {
                    room.soundsFishyState.typingAnswers[user.socketId] =
                        room.soundsFishyState.typingAnswers[oldSocketId];
                    delete room.soundsFishyState.typingAnswers[oldSocketId];
                }
            }
            if (room.detectiveClubState) {
                const dcState = room.detectiveClubState;
                if (dcState.players[oldSocketId]) {
                    dcState.players[user.socketId] = dcState.players[oldSocketId];
                    dcState.players[user.socketId].id = user.socketId;
                    delete dcState.players[oldSocketId];
                }
                if (dcState.informerId === oldSocketId)
                    dcState.informerId = user.socketId;
                if (dcState.conspiratorId === oldSocketId)
                    dcState.conspiratorId = user.socketId;
                if (dcState.activePlayerId === oldSocketId)
                    dcState.activePlayerId = user.socketId;
                if (dcState.round1StarterId === oldSocketId)
                    dcState.round1StarterId = user.socketId;
                dcState.playOrder = dcState.playOrder.map((id) => id === oldSocketId ? user.socketId : id);
                Object.values(dcState.players).forEach((p) => {
                    if (p.votedFor === oldSocketId)
                        p.votedFor = user.socketId;
                });
            }
            if (room.whoAmIState) {
                const waState = room.whoAmIState;
                if (waState.currentTurn === oldSocketId)
                    waState.currentTurn = user.socketId;
                if (waState.playerWords[oldSocketId]) {
                    waState.playerWords[user.socketId] = waState.playerWords[oldSocketId];
                    delete waState.playerWords[oldSocketId];
                }
                if (waState.votes[oldSocketId]) {
                    waState.votes[user.socketId] = waState.votes[oldSocketId];
                    delete waState.votes[oldSocketId];
                }
                if (waState.winner === oldSocketId)
                    waState.winner = user.socketId;
                const elimIdx = waState.eliminatedPlayers.indexOf(oldSocketId);
                if (elimIdx !== -1)
                    waState.eliminatedPlayers[elimIdx] = user.socketId;
                const fgIdx = waState.finalGuessUsed.indexOf(oldSocketId);
                if (fgIdx !== -1)
                    waState.finalGuessUsed[fgIdx] = user.socketId;
                if (waState.wordSubmissions?.[oldSocketId]) {
                    waState.wordSubmissions[user.socketId] = waState.wordSubmissions[oldSocketId];
                    delete waState.wordSubmissions[oldSocketId];
                }
            }
            if (room.whoFirstState) {
                room.whoFirstState.presses.forEach((p) => {
                    if (p.socketId === oldSocketId)
                        p.socketId = user.socketId;
                });
            }
            if (room.musicTriviaState) {
                this.musicTriviaService.remapSocketId(room.musicTriviaState, oldSocketId, user.socketId);
            }
            this.playerSessionService.issue(code, existingPlayer.id, user.socketId);
        }
        else {
            const usedColors = new Set(room.players.map((p) => p.color));
            const availableColors = types_1.PLAYER_COLORS.filter((c) => !usedColors.has(c));
            const color = availableColors.length > 0
                ? availableColors[Math.floor(Math.random() * availableColors.length)]
                : types_1.PLAYER_COLORS[Math.floor(Math.random() * types_1.PLAYER_COLORS.length)];
            const usedAvatars = new Set(room.players.map((p) => p.avatar));
            const availableAvatars = types_1.ANIMAL_EMOJIS.filter((a) => !usedAvatars.has(a));
            const avatar = availableAvatars.length > 0
                ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
                : types_1.ANIMAL_EMOJIS[Math.floor(Math.random() * types_1.ANIMAL_EMOJIS.length)];
            room.players.push({
                ...user,
                id: (0, uuid_1.v4)(),
                score: 0,
                roomId: room.id,
                connected: true,
                color,
                avatar,
            });
            const newPlayer = room.players[room.players.length - 1];
            this.playerSessionService.issue(code, newPlayer.id, user.socketId);
        }
        this.rooms.set(code, room);
        return room;
    }
    leaveRoom(clientId, explicitLeave = false) {
        for (const [code, room] of this.rooms.entries()) {
            const playerIndex = room.players.findIndex((p) => p.socketId === clientId);
            if (playerIndex !== -1) {
                if (room.roomHostId === clientId) {
                    if (explicitLeave || room.status === types_1.RoomStatus.LOBBY) {
                        this.deleteRoomData(code);
                        return { code: null };
                    }
                }
                if (explicitLeave || room.status === types_1.RoomStatus.LOBBY) {
                    this.playerSessionService.revokePlayer(code, room.players[playerIndex].id);
                    room.players.splice(playerIndex, 1);
                }
                else {
                    room.players[playerIndex].connected = false;
                }
                if (room.gameType === types_1.GameType.WHO_KNOW && room.status === types_1.RoomStatus.VOTING) {
                    this.whoKnowService.checkVoteResolution(room);
                }
                if (room.gameType === types_1.GameType.SOUNDS_FISHY && room.status === types_1.RoomStatus.QUESTIONING) {
                    this.soundsFishyService.checkAnswerResolution(room);
                }
                const activePlayers = room.players.filter((p) => p.connected !== false).length;
                if (activePlayers === 0) {
                    this.deleteRoomData(code);
                    return null;
                }
                this.rooms.set(code, room);
                return room;
            }
        }
        return null;
    }
    deleteRoomData(code) {
        this.rooms.delete(code);
        this.secretWords.delete(code);
        this.playerSessionService.clearRoom(code);
        this.musicTriviaService.deleteRoomData(code);
    }
    getAvailableRooms() {
        const availableRooms = [];
        for (const room of this.rooms.values()) {
            if (room.status === types_1.RoomStatus.LOBBY) {
                availableRooms.push({
                    code: room.code,
                    gameType: room.gameType,
                    hostName: room.players.find((p) => p.socketId === room.roomHostId)?.name || 'Unknown',
                    playerCount: room.players.length,
                });
            }
        }
        return availableRooms;
    }
    updateConfig(code, requesterId, config) {
        const room = this.rooms.get(code);
        if (!room || room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const safeConfig = this.sanitizeRoomConfig(config);
        room.config = { ...room.config, ...safeConfig };
        this.rooms.set(code, room);
        return room;
    }
    sanitizeRoomConfig(config) {
        const result = {};
        const isIntegerInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
        const copyEnum = (key, allowed) => {
            if (allowed.includes(config[key]))
                result[key] = config[key];
        };
        const copyBoolean = (key) => {
            if (typeof config[key] === 'boolean')
                result[key] = config[key];
        };
        const copyInteger = (key, min, max) => {
            if (isIntegerInRange(config[key], min, max)) {
                result[key] = config[key];
            }
        };
        copyEnum('hostSelection', ['ROUND_ROBIN', 'RANDOM', 'FIXED']);
        copyInteger('timerMin', 1, 60);
        copyInteger('rpsBestOf', 1, 9);
        copyEnum('rpsMode', ['1V1_ROUND_ROBIN', 'ALL_AT_ONCE']);
        copyEnum('language', ['en', 'th']);
        copyInteger('maxRounds', 1, 100);
        copyEnum('wordMode', ['HOST_INPUT', 'RANDOM', 'PLAYER_INPUT', 'AI_GENERATED']);
        if (typeof config.wordCategory === 'string' && config.wordCategory.length <= 100) {
            result.wordCategory = config.wordCategory;
        }
        copyBoolean('whoFirstPenalty');
        copyInteger('whoFirstCooldownMs', 100, 60_000);
        copyBoolean('whoFirstHostPlays');
        copyInteger('whoFirstMinCountdownMs', 100, 60_000);
        copyInteger('whoFirstMaxCountdownMs', 100, 60_000);
        copyBoolean('whoFirstInfiniteRounds');
        copyBoolean('whoFirstShowCounter');
        copyEnum('musicTriviaMode', ['TYPING', 'GAME_MASTER']);
        copyEnum('musicTriviaSource', ['ITUNES', 'SPOTIFY', 'YOUTUBE', 'DEEZER', 'SOUNDCLOUD']);
        if (typeof config.musicTriviaQuery === 'string' && config.musicTriviaQuery.length <= 200) {
            result.musicTriviaQuery = config.musicTriviaQuery;
        }
        if (typeof config.musicTriviaCountry === 'string' &&
            /^[A-Z]{2}$/.test(config.musicTriviaCountry)) {
            result.musicTriviaCountry = config.musicTriviaCountry;
        }
        if (typeof config.musicTriviaAttribute === 'string' &&
            config.musicTriviaAttribute.length <= 30) {
            result.musicTriviaAttribute = config.musicTriviaAttribute;
        }
        copyInteger('musicTriviaRounds', 1, 50);
        copyInteger('musicTriviaYearStart', 1900, new Date().getFullYear() + 1);
        copyInteger('musicTriviaYearEnd', 1900, new Date().getFullYear() + 1);
        copyBoolean('musicTriviaHostPlays');
        copyInteger('musicTriviaAnswerTimeoutMs', 1_000, 120_000);
        copyEnum('musicTriviaAudioPlayback', ['HOST_ONLY', 'EVERYONE']);
        copyEnum('musicTriviaAnswerCriteria', ['ANY', 'TITLE', 'ARTIST']);
        copyInteger('theMindStartingLives', 1, 10);
        copyInteger('theMindStartingShurikens', 0, 10);
        copyBoolean('theMindBlindMode');
        copyEnum('theMindMode', ['NORMAL', 'EXTREME']);
        copyBoolean('theMindTimeAttack');
        copyInteger('theMindMaxLevel', 1, 20);
        return result;
    }
    async assignRoles(code, requesterId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        if (room.gameType === types_1.GameType.SOUNDS_FISHY) {
            const result = await this.soundsFishyService.assignRoles(room, requesterId);
            if (result)
                this.rooms.set(code, result.room);
            return result;
        }
        if (room.gameType === types_1.GameType.RPS) {
            const result = this.rpsService.assignRoles(room, requesterId);
            if (result)
                this.rooms.set(code, result.room);
            return result;
        }
        if (room.gameType === types_1.GameType.DETECTIVE_CLUB) {
            const updatedRoom = this.detectiveClubService.startGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom ? { room: updatedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.WHO_AM_I) {
            let updatedRoom = null;
            if (room.config.wordMode === 'HOST_INPUT') {
                updatedRoom = this.whoAmIService.startGameAwaitHostInput(room, requesterId);
            }
            else if (room.config.wordMode === 'RANDOM') {
                updatedRoom = await this.whoAmIService.startGameRandom(room, requesterId);
            }
            else if (room.config.wordMode === 'AI_GENERATED') {
                updatedRoom = await this.whoAmIService.startGameAiGenerated(room, requesterId);
            }
            else if (room.config.wordMode === 'PLAYER_INPUT') {
                updatedRoom = this.whoAmIService.startGamePlayerInput(room, requesterId);
            }
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom ? { room: updatedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.WHO_FIRST) {
            const updatedRoom = this.whoFirstService.startGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom ? { room: updatedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.MUSIC_TRIVIA) {
            const updatedRoom = this.musicTriviaService.startGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom ? { room: updatedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.THE_MIND) {
            const updatedRoom = this.theMindService.startGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom ? { room: updatedRoom, roles: {} } : null;
        }
        const result = this.whoKnowService.assignRoles(room, requesterId);
        if (result)
            this.rooms.set(code, result.room);
        return result;
    }
    setWord(code, word, requesterId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoKnowService.setWord(room, word, requesterId, this.secretWords);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    stopTimer(code, requesterId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoKnowService.stopTimer(room, requesterId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    endQuestioning(code, requesterId, timeout = false) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoKnowService.endQuestioning(room, requesterId, timeout);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    submitVote(code, voterId, targetId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoKnowService.submitVote(room, voterId, targetId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    resetGame(code, requesterId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        if (room.gameType === types_1.GameType.WHO_AM_I) {
            const updatedRoom = this.whoAmIService.resetGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom;
        }
        if (room.gameType === types_1.GameType.WHO_FIRST) {
            const updatedRoom = this.whoFirstService.resetGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom;
        }
        if (room.gameType === types_1.GameType.MUSIC_TRIVIA) {
            const updatedRoom = this.musicTriviaService.resetGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom;
        }
        if (room.gameType === types_1.GameType.THE_MIND) {
            const updatedRoom = this.theMindService.resetGame(room, requesterId);
            if (updatedRoom)
                this.rooms.set(code, updatedRoom);
            return updatedRoom;
        }
        const updatedRoom = this.whoKnowService.resetGame(room, requesterId, this.secretWords);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    getSecretWord(code) {
        return this.secretWords.get(code);
    }
    tttJoinSide(code, clientId, side) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.ticTacToeService.joinSide(room, clientId, side);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    tttMakeMove(code, clientId, index) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.ticTacToeService.makeMove(room, clientId, index);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    tttReset(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.ticTacToeService.reset(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    rpsMakeChoice(code, clientId, choice) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.rpsService.makeChoice(room, clientId, choice);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    rpsNextRound(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.rpsService.nextRound(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    rpsReset(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.rpsService.reset(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    gobblerJoinSide(code, clientId, side) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.gobblerService.joinSide(room, clientId, side);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    gobblerPlacePiece(code, clientId, pieceId, toIndex) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.gobblerService.placePiece(room, clientId, pieceId, toIndex);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    gobblerMovePiece(code, clientId, fromIndex, toIndex) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.gobblerService.movePiece(room, clientId, fromIndex, toIndex);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    gobblerReset(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.gobblerService.reset(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishyTypeAnswer(code, clientId, answer) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.typeAnswer(room, clientId, answer);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishySubmitAnswer(code, clientId, answer) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.submitAnswer(room, clientId, answer);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishyRevealPlayer(code, clientId, targetId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.revealPlayer(room, clientId, targetId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishyEliminatePlayer(code, clientId, targetId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.eliminatePlayer(room, clientId, targetId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishyBankPoints(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.bankPoints(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishyNextRound(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.nextRound(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    soundsFishyReset(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.soundsFishyService.nextRound(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    detectiveClubSubmitWord(code, clientId, word) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.detectiveClubService.submitWord(room, clientId, word);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    detectiveClubPlayCard(code, clientId, cardIndex) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.detectiveClubService.playCard(room, clientId, cardIndex);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    detectiveClubNextPhase(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.detectiveClubService.nextPhase(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    detectiveClubVote(code, clientId, targetId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.detectiveClubService.submitVote(room, clientId, targetId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    detectiveClubNextRound(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.detectiveClubService.nextRound(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    detectiveClubReset(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.detectiveClubService.reset(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    whoAmISubmitPlayerWord(code, clientId, word) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const result = this.whoAmIService.submitPlayerWord(room, clientId, word);
        if (result && result.room)
            this.rooms.set(code, result.room);
        return result;
    }
    whoAmIGameAction(code, clientId, action) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoAmIService.handleGameAction(room, clientId, action);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    whoFirstGameAction(code, clientId, action) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoFirstService.handleGameAction(room, clientId, action);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    whoAmICategoriesList(lang) {
        return this.whoAmIService.getCategories(lang);
    }
    whoAmIStartHostInput(code, clientId, playerWords) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.whoAmIService.startGameHostInput(room, clientId, playerWords);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    async musicTriviaGameAction(code, clientId, action) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const result = await this.musicTriviaService.handleGameAction(room, clientId, action);
        if (result)
            this.rooms.set(code, result.room);
        return result;
    }
    musicTriviaFinalizeCountdown(code) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const result = this.musicTriviaService.finalizeCountdown(room);
        if (result)
            this.rooms.set(code, result.room);
        return result;
    }
    theMindReady(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const playerId = this.getPlayerId(room, clientId);
        if (!playerId)
            return null;
        const updatedRoom = this.theMindService.ready(room, playerId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    theMindPlayCard(code, clientId, card, pile) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const playerId = this.getPlayerId(room, clientId);
        if (!playerId)
            return null;
        const updatedRoom = this.theMindService.playCard(room, playerId, card, pile);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    theMindNextLevel(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = this.theMindService.nextLevel(room, clientId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    theMindProposeShuriken(code, clientId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const playerId = this.getPlayerId(room, clientId);
        if (!playerId)
            return null;
        const updatedRoom = this.theMindService.proposeShuriken(room, playerId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    theMindVoteShuriken(code, clientId, agree) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const playerId = this.getPlayerId(room, clientId);
        if (!playerId)
            return null;
        const updatedRoom = this.theMindService.voteShuriken(room, playerId, agree);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    theMindCancelShuriken(code, clientId) {
        const room = this.rooms.get(code);
        if (!room || room.gameType !== types_1.GameType.THE_MIND)
            return null;
        const playerId = this.getPlayerId(room, clientId);
        if (!playerId)
            return null;
        const updatedRoom = this.theMindService.cancelShurikenProposal(room, playerId);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    theMindServerTimeout(code) {
        const room = this.rooms.get(code);
        if (!room || room.gameType !== types_1.GameType.THE_MIND)
            return null;
        const updatedRoom = this.theMindService.handleTimeout(room);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    getPlayerId(room, socketId) {
        return room.players.find((player) => player.socketId === socketId)?.id ?? null;
    }
};
exports.GamesService = GamesService;
exports.GamesService = GamesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [who_know_service_1.WhoKnowService,
        tic_tac_toe_service_1.TicTacToeService,
        rps_service_1.RPSService,
        gobbler_service_1.GobblerService,
        sounds_fishy_service_1.SoundsFishyService,
        detective_club_service_1.DetectiveClubService,
        who_am_i_service_1.WhoAmIService,
        who_first_service_1.WhoFirstService,
        music_trivia_service_1.MusicTriviaService,
        the_mind_service_1.TheMindService,
        player_session_service_1.PlayerSessionService])
], GamesService);
//# sourceMappingURL=games.service.js.map