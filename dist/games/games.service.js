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
const saboteur_service_1 = require("./saboteur/saboteur.service");
const player_session_service_1 = require("./player-session.service");
const private_state_service_1 = require("./private-state.service");
const room_timer_service_1 = require("./room-timer.service");
let GamesService = class GamesService {
    constructor(whoKnowService, ticTacToeService, rpsService, gobblerService, soundsFishyService, detectiveClubService, whoAmIService, whoFirstService, musicTriviaService, theMindService, saboteurService, playerSessionService, privateStateService, roomTimerService) {
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
        this.saboteurService = saboteurService;
        this.playerSessionService = playerSessionService;
        this.privateStateService = privateStateService;
        this.roomTimerService = roomTimerService;
        this.rooms = new Map();
        this.secretWords = new Map();
    }
    isRoomMember(code, socketId) {
        const room = this.rooms.get(code);
        return !!room?.players.some((p) => p.socketId === socketId);
    }
    getPrivateSocketData(code, socketId) {
        return this.privateStateService.getSocketData(code, socketId);
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
                choicesMade: [],
                scores: {},
            };
        }
        else if (gameType === types_1.GameType.GOBBLER_TIC_TAC_TOE) {
            room.gobblerState = {
                board: Array.from({ length: 9 }, () => []),
                currentTurn: 'X',
                inventory: {
                    X: this.gobblerService.createInitialInventory('X'),
                    O: this.gobblerService.createInitialInventory('O'),
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
            room.config.whoFirstMaxRounds = 5;
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
        else if (gameType === types_1.GameType.SABOTEUR) {
            room.config.saboteurTurnTimerEnabled = false;
            room.config.saboteurTurnTimerSeconds = 60;
            room.config.saboteurStoneEndsRound = false;
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
            if (room.votes)
                this.whoKnowService.remapVotes(room.votes, oldSocketId, user.socketId);
            if (room.ticTacToeState) {
                this.ticTacToeService.remapSocketId(room.ticTacToeState, oldSocketId, user.socketId);
            }
            if (room.rpsState) {
                this.rpsService.remapSocketId(room.rpsState, oldSocketId, user.socketId);
            }
            if (room.gobblerState) {
                this.gobblerService.remapSocketId(room.gobblerState, oldSocketId, user.socketId);
            }
            if (room.soundsFishyState) {
                this.soundsFishyService.remapSocketId(room.soundsFishyState, oldSocketId, user.socketId);
            }
            if (room.detectiveClubState) {
                this.detectiveClubService.remapSocketId(room.detectiveClubState, oldSocketId, user.socketId);
            }
            if (room.whoAmIState) {
                this.whoAmIService.remapSocketId(room.whoAmIState, oldSocketId, user.socketId);
            }
            if (room.whoFirstState) {
                this.whoFirstService.remapSocketId(room.whoFirstState, oldSocketId, user.socketId);
            }
            if (room.musicTriviaState) {
                this.musicTriviaService.remapSocketId(room.musicTriviaState, oldSocketId, user.socketId);
            }
            if (room.saboteurState) {
                this.saboteurService.remapSocketId(room.saboteurState, oldSocketId, user.socketId);
            }
            this.privateStateService.remapSocketId(code, oldSocketId, user.socketId);
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
            if (playerIndex === -1)
                continue;
            const isHost = room.roomHostId === clientId;
            if (isHost && explicitLeave) {
                this.deleteRoomData(code);
                return { outcome: 'ROOM_CLOSED', code };
            }
            if (explicitLeave || room.status === types_1.RoomStatus.LOBBY) {
                this.playerSessionService.revokePlayer(code, room.players[playerIndex].id);
                room.players.splice(playerIndex, 1);
                this.privateStateService.clearSocket(code, clientId);
                if (room.ticTacToeState) {
                    if (room.ticTacToeState.playerXId === clientId)
                        room.ticTacToeState.playerXId = undefined;
                    if (room.ticTacToeState.playerOId === clientId)
                        room.ticTacToeState.playerOId = undefined;
                }
                if (room.gobblerState) {
                    if (room.gobblerState.playerXId === clientId)
                        room.gobblerState.playerXId = undefined;
                    if (room.gobblerState.playerOId === clientId)
                        room.gobblerState.playerOId = undefined;
                }
            }
            else {
                room.players[playerIndex].connected = false;
                this.privateStateService.clearSocket(code, clientId);
            }
            if (isHost && !explicitLeave) {
                this.transferHost(room, clientId);
            }
            if (room.gameType === types_1.GameType.WHO_KNOW && room.status === types_1.RoomStatus.VOTING) {
                this.whoKnowService.checkVoteResolution(room);
            }
            if (room.gameType === types_1.GameType.SOUNDS_FISHY && room.status === types_1.RoomStatus.QUESTIONING) {
                this.soundsFishyService.checkAnswerResolution(room);
            }
            if (room.gameType === types_1.GameType.DETECTIVE_CLUB && room.detectiveClubState) {
                this.detectiveClubService.handlePlayerDisconnect(room, clientId);
            }
            if (room.gameType === types_1.GameType.SABOTEUR && room.saboteurState) {
                this.saboteurService.handlePlayerDisconnect(room, clientId);
            }
            const activePlayers = room.players.filter((p) => p.connected !== false).length;
            if (activePlayers === 0) {
                this.deleteRoomData(code);
                return { outcome: 'ROOM_EMPTIED', code };
            }
            this.rooms.set(code, room);
            return { outcome: 'PLAYER_LEFT', room };
        }
        return { outcome: 'NOT_IN_ROOM' };
    }
    transferHost(room, formerHostSocketId) {
        const nextHost = room.players.find((p) => p.connected !== false && p.socketId !== formerHostSocketId);
        if (!nextHost)
            return;
        room.roomHostId = nextHost.socketId;
    }
    deleteRoomData(code) {
        this.rooms.delete(code);
        this.secretWords.delete(code);
        this.roomTimerService.clearRoom(code);
        this.playerSessionService.clearRoom(code);
        this.musicTriviaService.deleteRoomData(code);
        this.privateStateService.clearRoom(code);
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
        copyBoolean('whoFirstHostPlays');
        copyInteger('whoFirstMinCountdownMs', 100, 60_000);
        copyInteger('whoFirstMaxCountdownMs', 100, 60_000);
        copyBoolean('whoFirstInfiniteRounds');
        copyBoolean('whoFirstShowCounter');
        copyInteger('whoFirstMaxRounds', 1, 100);
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
        copyBoolean('saboteurTurnTimerEnabled');
        copyInteger('saboteurTurnTimerSeconds', 5, 300);
        copyBoolean('saboteurStoneEndsRound');
        return result;
    }
    withRoom(code, mutate) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = mutate(room);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    withRoomResult(code, action) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const result = action(room);
        if (result)
            this.rooms.set(code, result.room);
        return result;
    }
    async withRoomResultAsync(code, action) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const result = await action(room);
        if (result)
            this.rooms.set(code, result.room);
        return result;
    }
    async assignRoles(code, requesterId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        if (room.gameType === types_1.GameType.SOUNDS_FISHY) {
            return this.withRoomResultAsync(code, (r) => this.soundsFishyService.assignRoles(r, requesterId));
        }
        if (room.gameType === types_1.GameType.RPS) {
            return this.withRoomResult(code, (r) => this.rpsService.assignRoles(r, requesterId));
        }
        if (room.gameType === types_1.GameType.DETECTIVE_CLUB) {
            const startedRoom = this.withRoom(code, (r) => this.detectiveClubService.startGame(r, requesterId));
            return startedRoom ? { room: startedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.WHO_AM_I) {
            const startedRoom = await this.withRoomAsync(code, (r) => this.startWhoAmI(r, requesterId));
            return startedRoom ? { room: startedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.WHO_FIRST) {
            const startedRoom = this.withRoom(code, (r) => this.whoFirstService.startGame(r, requesterId));
            return startedRoom ? { room: startedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.MUSIC_TRIVIA) {
            const startedRoom = this.withRoom(code, (r) => this.musicTriviaService.startGame(r, requesterId));
            return startedRoom ? { room: startedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.THE_MIND) {
            const startedRoom = this.withRoom(code, (r) => this.theMindService.startGame(r, requesterId));
            return startedRoom ? { room: startedRoom, roles: {} } : null;
        }
        if (room.gameType === types_1.GameType.SABOTEUR) {
            const startedRoom = this.withRoom(code, (r) => this.saboteurService.startGame(r, requesterId));
            return startedRoom ? { room: startedRoom, roles: {} } : null;
        }
        return this.withRoomResult(code, (r) => this.whoKnowService.assignRoles(r, requesterId));
    }
    async startWhoAmI(room, requesterId) {
        switch (room.config.wordMode) {
            case 'HOST_INPUT':
                return this.whoAmIService.startGameAwaitHostInput(room, requesterId);
            case 'RANDOM':
                return this.whoAmIService.startGameRandom(room, requesterId);
            case 'AI_GENERATED':
                return this.whoAmIService.startGameAiGenerated(room, requesterId);
            case 'PLAYER_INPUT':
                return this.whoAmIService.startGamePlayerInput(room, requesterId);
            default:
                return null;
        }
    }
    async withRoomAsync(code, action) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const updatedRoom = await action(room);
        if (updatedRoom)
            this.rooms.set(code, updatedRoom);
        return updatedRoom;
    }
    setWord(code, word, requesterId) {
        return this.withRoom(code, (room) => this.whoKnowService.setWord(room, word, requesterId, this.secretWords));
    }
    stopTimer(code, requesterId) {
        return this.withRoom(code, (room) => this.whoKnowService.stopTimer(room, requesterId));
    }
    endQuestioning(code, requesterId, timeout = false) {
        return this.withRoom(code, (room) => this.whoKnowService.endQuestioning(room, requesterId, timeout));
    }
    submitVote(code, voterId, targetId) {
        return this.withRoom(code, (room) => this.whoKnowService.submitVote(room, voterId, targetId));
    }
    resetGame(code, requesterId) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        switch (room.gameType) {
            case types_1.GameType.WHO_AM_I:
                return this.withRoom(code, (r) => this.whoAmIService.resetGame(r, requesterId));
            case types_1.GameType.WHO_FIRST:
                return this.withRoom(code, (r) => this.whoFirstService.resetGame(r, requesterId));
            case types_1.GameType.MUSIC_TRIVIA:
                return this.withRoom(code, (r) => this.musicTriviaService.resetGame(r, requesterId));
            case types_1.GameType.THE_MIND:
                return this.withRoom(code, (r) => this.theMindService.resetGame(r, requesterId));
            default:
                return this.withRoom(code, (r) => this.whoKnowService.resetGame(r, requesterId, this.secretWords));
        }
    }
    getSecretWord(code) {
        return this.secretWords.get(code);
    }
    getPlayerRole(code, socketId) {
        const data = this.privateStateService.getSocketData(code, socketId);
        return data['wkRole'] ?? data['sfRole'];
    }
    whoKnowServerTimeout(code) {
        return this.withRoom(code, (room) => this.whoKnowService.handleQuestioningTimeout(room));
    }
    tttJoinSide(code, clientId, side) {
        return this.withRoom(code, (room) => this.ticTacToeService.joinSide(room, clientId, side));
    }
    tttMakeMove(code, clientId, index) {
        return this.withRoom(code, (room) => this.ticTacToeService.makeMove(room, clientId, index));
    }
    tttReset(code, clientId) {
        return this.withRoom(code, (room) => this.ticTacToeService.reset(room, clientId));
    }
    rpsMakeChoice(code, clientId, choice) {
        return this.withRoom(code, (room) => this.rpsService.makeChoice(room, clientId, choice));
    }
    rpsNextRound(code, clientId) {
        return this.withRoom(code, (room) => this.rpsService.nextRound(room, clientId));
    }
    rpsReset(code, clientId) {
        return this.withRoom(code, (room) => this.rpsService.reset(room, clientId));
    }
    gobblerJoinSide(code, clientId, side) {
        return this.withRoom(code, (room) => this.gobblerService.joinSide(room, clientId, side));
    }
    gobblerPlacePiece(code, clientId, pieceId, toIndex) {
        return this.withRoom(code, (room) => this.gobblerService.placePiece(room, clientId, pieceId, toIndex));
    }
    gobblerMovePiece(code, clientId, fromIndex, toIndex) {
        return this.withRoom(code, (room) => this.gobblerService.movePiece(room, clientId, fromIndex, toIndex));
    }
    gobblerReset(code, clientId) {
        return this.withRoom(code, (room) => this.gobblerService.reset(room, clientId));
    }
    soundsFishyTypeAnswer(code, clientId, answer) {
        return this.withRoom(code, (room) => this.soundsFishyService.typeAnswer(room, clientId, answer));
    }
    soundsFishySubmitAnswer(code, clientId, answer) {
        return this.withRoom(code, (room) => this.soundsFishyService.submitAnswer(room, clientId, answer));
    }
    soundsFishyRevealPlayer(code, clientId, targetId) {
        return this.withRoom(code, (room) => this.soundsFishyService.revealPlayer(room, clientId, targetId));
    }
    soundsFishyEliminatePlayer(code, clientId, targetId) {
        return this.withRoom(code, (room) => this.soundsFishyService.eliminatePlayer(room, clientId, targetId));
    }
    soundsFishyBankPoints(code, clientId) {
        return this.withRoom(code, (room) => this.soundsFishyService.bankPoints(room, clientId));
    }
    soundsFishyNextRound(code, clientId) {
        return this.withRoom(code, (room) => this.soundsFishyService.nextRound(room, clientId));
    }
    soundsFishyReset(code, clientId) {
        return this.withRoom(code, (room) => this.soundsFishyService.reset(room, clientId));
    }
    detectiveClubSubmitWord(code, clientId, word) {
        return this.withRoom(code, (room) => this.detectiveClubService.submitWord(room, clientId, word));
    }
    detectiveClubPlayCard(code, clientId, cardIndex) {
        return this.withRoom(code, (room) => this.detectiveClubService.playCard(room, clientId, cardIndex));
    }
    detectiveClubNextPhase(code, clientId) {
        return this.withRoom(code, (room) => this.detectiveClubService.nextPhase(room, clientId));
    }
    detectiveClubVote(code, clientId, targetId) {
        return this.withRoom(code, (room) => this.detectiveClubService.submitVote(room, clientId, targetId));
    }
    detectiveClubNextRound(code, clientId) {
        return this.withRoom(code, (room) => this.detectiveClubService.nextRound(room, clientId));
    }
    detectiveClubReset(code, clientId) {
        return this.withRoom(code, (room) => this.detectiveClubService.reset(room, clientId));
    }
    saboteurPlacePath(code, clientId, cardIndex, x, y, rotation) {
        return this.withRoom(code, (room) => this.saboteurService.placePath(room, clientId, cardIndex, x, y, rotation));
    }
    saboteurPlayAction(code, clientId, payload) {
        return this.withRoom(code, (room) => this.saboteurService.playAction(room, clientId, payload));
    }
    saboteurDiscard(code, clientId, cardIndex) {
        return this.withRoom(code, (room) => this.saboteurService.discard(room, clientId, cardIndex));
    }
    saboteurPickGold(code, clientId, poolIndex) {
        return this.withRoom(code, (room) => this.saboteurService.pickGold(room, clientId, poolIndex));
    }
    saboteurNextRound(code, clientId) {
        return this.withRoom(code, (room) => this.saboteurService.nextRound(room, clientId));
    }
    saboteurReset(code, clientId) {
        return this.withRoom(code, (room) => this.saboteurService.reset(room, clientId));
    }
    saboteurAutoPass(code, clientId) {
        return this.withRoom(code, (room) => this.saboteurService.autoPass(room, clientId));
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
        return this.withRoom(code, (room) => this.whoAmIService.handleGameAction(room, clientId, action));
    }
    whoFirstGameAction(code, clientId, action) {
        return this.withRoom(code, (room) => this.whoFirstService.handleGameAction(room, clientId, action));
    }
    whoFirstSetActive(code) {
        return this.withRoom(code, (room) => this.whoFirstService.setActive(room));
    }
    whoAmICategoriesList(lang) {
        return this.whoAmIService.getCategories(lang);
    }
    whoAmIStartHostInput(code, clientId, playerWords) {
        return this.withRoom(code, (room) => this.whoAmIService.startGameHostInput(room, clientId, playerWords));
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
    musicTriviaFinalizeAnswerTimeout(code) {
        const room = this.rooms.get(code);
        if (!room)
            return null;
        const result = this.musicTriviaService.answerTimeout(room);
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
        return this.withRoom(code, (room) => {
            const playerId = this.getPlayerId(room, clientId);
            return playerId ? this.theMindService.ready(room, playerId) : null;
        });
    }
    theMindPlayCard(code, clientId, card, pile) {
        return this.withRoom(code, (room) => {
            const playerId = this.getPlayerId(room, clientId);
            return playerId ? this.theMindService.playCard(room, playerId, card, pile) : null;
        });
    }
    theMindNextLevel(code, clientId) {
        return this.withRoom(code, (room) => this.theMindService.nextLevel(room, clientId));
    }
    theMindProposeShuriken(code, clientId) {
        return this.withRoom(code, (room) => {
            const playerId = this.getPlayerId(room, clientId);
            return playerId ? this.theMindService.proposeShuriken(room, playerId) : null;
        });
    }
    theMindVoteShuriken(code, clientId, agree) {
        return this.withRoom(code, (room) => {
            const playerId = this.getPlayerId(room, clientId);
            return playerId ? this.theMindService.voteShuriken(room, playerId, agree) : null;
        });
    }
    theMindCancelShuriken(code, clientId) {
        return this.withRoom(code, (room) => {
            if (room.gameType !== types_1.GameType.THE_MIND)
                return null;
            const playerId = this.getPlayerId(room, clientId);
            return playerId ? this.theMindService.cancelShurikenProposal(room, playerId) : null;
        });
    }
    theMindServerTimeout(code) {
        return this.withRoom(code, (room) => {
            if (room.gameType !== types_1.GameType.THE_MIND)
                return null;
            return this.theMindService.handleTimeout(room);
        });
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
        saboteur_service_1.SaboteurService,
        player_session_service_1.PlayerSessionService,
        private_state_service_1.PrivateStateService,
        room_timer_service_1.RoomTimerService])
], GamesService);
//# sourceMappingURL=games.service.js.map