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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GamesGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const games_service_1 = require("./games.service");
const leaderboard_service_1 = require("./leaderboard/leaderboard.service");
const room_timer_service_1 = require("./room-timer.service");
const private_state_service_1 = require("./private-state.service");
const ws_exception_filter_1 = require("./ws-exception.filter");
const types_1 = require("@repo/types");
let GamesGateway = GamesGateway_1 = class GamesGateway {
    constructor(gamesService, leaderboardService, roomTimerService, privateStateService) {
        this.gamesService = gamesService;
        this.leaderboardService = leaderboardService;
        this.roomTimerService = roomTimerService;
        this.privateStateService = privateStateService;
        this.logger = new common_1.Logger(GamesGateway_1.name);
        this.recordedResults = new Set();
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        client.use(([event, payload], next) => {
            if (this.isValidPayload(event, payload))
                return next();
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
            next(new Error('Invalid request payload'));
        });
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const result = this.gamesService.leaveRoom(client.id, false);
        this.handleLeaveResult(client, result);
    }
    handleLeaveRoom(client) {
        const result = this.gamesService.leaveRoom(client.id, true);
        this.handleLeaveResult(client, result);
        const roomCode = 'room' in result ? result.room.code : 'code' in result ? result.code : undefined;
        if (roomCode) {
            client.leave(roomCode);
        }
        client.data.spectatingRoomCode = undefined;
    }
    handleLeaveResult(client, result) {
        switch (result.outcome) {
            case 'ROOM_CLOSED':
                this.server.to(result.code).emit(types_1.SOCKET_EVENTS.ROOM_DELETED);
                this.forgetRecordedResult(result.code);
                break;
            case 'ROOM_EMPTIED':
                this.forgetRecordedResult(result.code);
                break;
            case 'PLAYER_LEFT':
                this.broadcastRoomState(result.room);
                break;
            case 'NOT_IN_ROOM':
                break;
        }
        this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    }
    forgetRecordedResult(code) {
        this.recordedResults.delete(code);
    }
    handleGetAvailableRooms(client) {
        client.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    }
    handleCreateRoom(data, client) {
        const room = this.gamesService.createRoom(client.id, data.gameType);
        const updatedRoom = this.gamesService.joinRoom(room.code, {
            id: client.id,
            name: data.name.trim(),
            socketId: client.id,
        });
        if (updatedRoom) {
            client.join(updatedRoom.code);
            this.emitSessionToken(client, updatedRoom.code);
            client.emit(types_1.SOCKET_EVENTS.ROOM_STATE_UPDATED, updatedRoom);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
    }
    handleJoinRoom(data, client) {
        const room = this.gamesService.joinRoom(data.code.toUpperCase(), {
            id: client.id,
            name: data.name.trim(),
            socketId: client.id,
        }, data.reconnectToken);
        if (room) {
            client.join(room.code);
            this.emitSessionToken(client, room.code);
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
            const player = room.players.find((p) => p.socketId === client.id);
            const playerRole = this.gamesService.getPlayerRole(room.code, client.id);
            if (player && playerRole) {
                if (room.status === types_1.RoomStatus.WORD_SETTING) {
                    if (playerRole === types_1.Role.Host) {
                        client.emit(types_1.SOCKET_EVENTS.ROLE_ASSIGNED, { role: playerRole });
                    }
                }
                else if (room.status !== types_1.RoomStatus.LOBBY) {
                    client.emit(types_1.SOCKET_EVENTS.ROLE_ASSIGNED, { role: playerRole });
                    const secretWord = this.gamesService.getSecretWord(room.code);
                    if (secretWord && (playerRole === types_1.Role.Host || playerRole === types_1.Role.Know)) {
                        client.emit(types_1.SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: secretWord });
                    }
                }
            }
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, {
                message: 'Room not found or player name is already in use',
            });
        }
    }
    async handleStartGame(data, client) {
        const result = await this.gamesService.assignRoles(data.code, client.id);
        if (result) {
            this.broadcastRoomState(result.room);
            this.syncTheMindTimer(result.room);
            this.syncWhoFirstTimer(result.room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
            const host = Object.entries(result.roles).find(([, role]) => role === types_1.Role.Host);
            if (host) {
                this.server.to(host[0]).emit(types_1.SOCKET_EVENTS.ROLE_ASSIGNED, { role: types_1.Role.Host });
            }
        }
        else {
            const roomInfo = this.gamesService.getRoom(data.code);
            const gameType = roomInfo?.gameType;
            let msg = 'Cannot start game.';
            if (gameType === types_1.GameType.WHO_KNOW) {
                msg = 'Cannot start game. Need at least 4 players (1 Host + 3 Players).';
            }
            else if (gameType === types_1.GameType.SOUNDS_FISHY) {
                msg = 'Cannot start game. Need at least 3 players.';
            }
            else if (gameType === types_1.GameType.MUSIC_TRIVIA) {
                msg = 'Cannot start game. Need at least 2 players and a music query.';
            }
            else if (gameType === types_1.GameType.DETECTIVE_CLUB) {
                msg = 'Cannot start game. Need at least 3 players.';
            }
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: msg });
        }
    }
    handleSetWord(data, client) {
        const room = this.gamesService.setWord(data.code, data.word, client.id);
        if (room) {
            const insider = room.players.find((p) => this.gamesService.getPlayerRole(room.code, p.socketId) === types_1.Role.Know);
            const gameHost = room.players.find((p) => this.gamesService.getPlayerRole(room.code, p.socketId) === types_1.Role.Host);
            if (insider)
                this.server
                    .to(insider.socketId)
                    .emit(types_1.SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: data.word });
            if (gameHost)
                this.server
                    .to(gameHost.socketId)
                    .emit(types_1.SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: data.word });
            room.players.forEach((player) => {
                const role = this.gamesService.getPlayerRole(room.code, player.socketId);
                if (role && role !== types_1.Role.Host) {
                    this.server.to(player.socketId).emit(types_1.SOCKET_EVENTS.ROLE_ASSIGNED, { role });
                }
            });
            this.broadcastRoomState(room);
            this.syncWhoKnowTimer(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, {
                message: 'Not authorized to set word or invalid room state.',
            });
        }
    }
    handleStopTimer(data, client) {
        const room = this.gamesService.stopTimer(data.code, client.id);
        if (room) {
            this.roomTimerService.cancel(room.code, 'who-know');
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, {
                message: 'Not authorized or invalid game state to stop timer.',
            });
        }
    }
    handleEndQuestioning(data, client) {
        const room = this.gamesService.endQuestioning(data.code, client.id, data.timeout);
        if (room) {
            this.roomTimerService.cancel(room.code, 'who-know');
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, {
                message: 'Not authorized or invalid game state to end questioning.',
            });
        }
    }
    handleSubmitVote(data, client) {
        const room = this.gamesService.submitVote(data.code, client.id, data.targetId);
        if (room) {
            this.broadcastRoomState(room);
            this.maybeRecordGameResult(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Failed to submit vote.' });
        }
    }
    handleResetGame(data, client) {
        const room = this.gamesService.resetGame(data.code, client.id);
        if (room) {
            this.roomTimerService.cancel(room.code, 'who-know');
            this.roomTimerService.cancel(room.code, 'the-mind');
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, {
                message: 'Not authorized to reset game or invalid state.',
            });
        }
    }
    handleUpdateConfig(data, client) {
        const room = this.gamesService.updateConfig(data.code, client.id, data.config);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, {
                message: 'Not authorized to update config or invalid state.',
            });
        }
    }
    handleTTTJoinSide(data, client) {
        const room = this.gamesService.tttJoinSide(data.code, client.id, data.side);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
        }
    }
    handleTTTMakeMove(data, client) {
        const room = this.gamesService.tttMakeMove(data.code, client.id, data.index);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
        }
    }
    handleTTTReset(data, client) {
        const room = this.gamesService.tttReset(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
        }
    }
    handleRPSNextRound(data, client) {
        const room = this.gamesService.rpsNextRound(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.maybeRecordGameResult(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
        }
    }
    handleRPSMakeChoice(data, client) {
        const room = this.gamesService.rpsMakeChoice(data.code, client.id, data.choice);
        if (room) {
            this.broadcastRoomState(room);
            this.maybeRecordGameResult(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid choice or not your turn.' });
        }
    }
    handleRPSReset(data, client) {
        const room = this.gamesService.rpsReset(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
        }
    }
    handleGobblerJoinSide(data, client) {
        const room = this.gamesService.gobblerJoinSide(data.code, client.id, data.side);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
        }
    }
    handleGobblerPlace(data, client) {
        const room = this.gamesService.gobblerPlacePiece(data.code, client.id, data.pieceId, data.toIndex);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid move or not your turn.' });
        }
    }
    handleGobblerMove(data, client) {
        const room = this.gamesService.gobblerMovePiece(data.code, client.id, data.fromIndex, data.toIndex);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid move or not your turn.' });
        }
    }
    handleGobblerReset(data, client) {
        const room = this.gamesService.gobblerReset(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
        }
    }
    handleSoundsFishyTypeAnswer(data, client) {
        const room = this.gamesService.soundsFishyTypeAnswer(data.code, client.id, data.answer);
        if (room) {
            this.broadcastRoomState(room);
        }
    }
    handleSoundsFishySubmitAnswer(data, client) {
        const room = this.gamesService.soundsFishySubmitAnswer(data.code, client.id, data.answer);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid answer or not in submission phase.' });
        }
    }
    handleSoundsFishyRevealAnswer(data, client) {
        const room = this.gamesService.soundsFishyRevealPlayer(data.code, client.id, data.targetId);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot reveal player.' });
        }
    }
    handleSoundsFishyEliminatePlayer(data, client) {
        const room = this.gamesService.soundsFishyEliminatePlayer(data.code, client.id, data.targetId);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot eliminate player.' });
        }
    }
    handleSoundsFishyBankPoints(data, client) {
        const room = this.gamesService.soundsFishyBankPoints(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot bank points.' });
        }
    }
    handleSoundsFishyNextRound(data, client) {
        const room = this.gamesService.soundsFishyNextRound(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot go to next round.' });
        }
    }
    handleSoundsFishyReset(data, client) {
        const room = this.gamesService.soundsFishyReset(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
        }
    }
    handleDetectiveClubSubmitWord(data, client) {
        const room = this.gamesService.detectiveClubSubmitWord(data.code, client.id, data.word);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot submit word' });
        }
    }
    handleDetectiveClubPlayCard(data, client) {
        const room = this.gamesService.detectiveClubPlayCard(data.code, client.id, data.cardIndex);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid card play' });
        }
    }
    handleDetectiveClubNextPhase(data, client) {
        const room = this.gamesService.detectiveClubNextPhase(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot move to next phase' });
        }
    }
    handleDetectiveClubVote(data, client) {
        const room = this.gamesService.detectiveClubVote(data.code, client.id, data.targetId);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid vote' });
        }
    }
    handleDetectiveClubNextRound(data, client) {
        const room = this.gamesService.detectiveClubNextRound(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized to move to next round' });
        }
    }
    handleDetectiveClubReset(data, client) {
        const room = this.gamesService.detectiveClubReset(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game' });
        }
    }
    handleWhoAmISubmitWords(data, client) {
        const room = this.gamesService.whoAmIStartHostInput(data.code, client.id, data.playerWords);
        if (room) {
            this.broadcastRoomState(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot start Host Input mode' });
        }
    }
    handleWhoAmISubmitPlayerWord(data, client) {
        const result = this.gamesService.whoAmISubmitPlayerWord(data.code, client.id, data.word);
        if (result && result.room) {
            if (result.error) {
                client.emit(types_1.SOCKET_EVENTS.ERROR, { message: result.error });
            }
            this.broadcastRoomState(result.room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot submit word' });
        }
    }
    async handleWhoAmIGetCategories(data, client) {
        const categories = await this.gamesService.whoAmICategoriesList(data?.lang);
        client.emit(types_1.SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, categories);
    }
    async handleGameAction(data, client) {
        if (!data?.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
            return;
        }
        const roomInfo = this.gamesService.getRoom(data.code);
        if (roomInfo && roomInfo.gameType === types_1.GameType.WHO_AM_I) {
            const room = this.gamesService.whoAmIGameAction(data.code, client.id, data.action);
            if (room) {
                this.broadcastRoomState(room);
                this.maybeRecordGameResult(room);
            }
            else {
                client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
            }
        }
        else if (roomInfo && roomInfo.gameType === types_1.GameType.WHO_FIRST) {
            const room = this.gamesService.whoFirstGameAction(data.code, client.id, data.action);
            if (room) {
                this.broadcastRoomState(room);
                this.syncWhoFirstTimer(room);
                this.maybeRecordGameResult(room);
            }
            else {
                client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
            }
        }
        else if (roomInfo && roomInfo.gameType === types_1.GameType.MUSIC_TRIVIA) {
            const result = await this.gamesService.musicTriviaGameAction(data.code, client.id, data.action);
            if (result) {
                this.broadcastRoomState(result.room);
                if (result.syncPlay) {
                    this.server
                        .to(result.room.code)
                        .emit(types_1.SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, result.syncPlay);
                }
                if (result.trackAnswerTo) {
                    this.server
                        .to(result.trackAnswerTo.socketId)
                        .emit(types_1.SOCKET_EVENTS.MUSIC_TRIVIA_TRACK_ANSWER, {
                        roundNumber: result.trackAnswerTo.roundNumber,
                    });
                }
                if (result.hostAnswerTo) {
                    this.server
                        .to(result.hostAnswerTo.socketId)
                        .emit(types_1.SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, {
                        title: result.hostAnswerTo.title,
                        artist: result.hostAnswerTo.artist,
                        artworkUrl: result.hostAnswerTo.artworkUrl,
                    });
                }
                this.applyMusicTriviaTimers(data.code, result.timerCommands);
                this.maybeRecordGameResult(result.room);
            }
            else {
                client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid action' });
            }
        }
        else if (!roomInfo) {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Room not found' });
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Game action not supported for this game type' });
        }
    }
    handleTheMindReady(data, client) {
        const room = this.gamesService.theMindReady(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.syncTheMindTimer(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot ready for game.' });
        }
    }
    handleTheMindPlayCard(data, client) {
        const room = this.gamesService.theMindPlayCard(data.code, client.id, data.card, data.pile);
        if (room) {
            this.broadcastRoomState(room);
            this.syncTheMindTimer(room);
            this.maybeRecordGameResult(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot play card right now.' });
        }
    }
    handleTheMindNextLevel(data, client) {
        const room = this.gamesService.theMindNextLevel(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.syncTheMindTimer(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot advance to next level.' });
        }
    }
    handleTheMindProposeShuriken(data, client) {
        const room = this.gamesService.theMindProposeShuriken(data.code, client.id);
        if (room) {
            this.broadcastRoomState(room);
            this.syncTheMindTimer(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot propose shuriken.' });
        }
    }
    handleTheMindVoteShuriken(data, client) {
        const room = this.gamesService.theMindVoteShuriken(data.code, client.id, data.agree);
        if (room) {
            this.broadcastRoomState(room);
            this.syncTheMindTimer(room);
            this.maybeRecordGameResult(room);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot vote on shuriken.' });
        }
    }
    handleTheMindCancelShuriken(data, client) {
        const updatedRoom = this.gamesService.theMindCancelShuriken(data.code, client.id);
        if (updatedRoom) {
            this.broadcastRoomState(updatedRoom);
            this.syncTheMindTimer(updatedRoom);
        }
        else {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Cannot cancel shuriken proposal.' });
        }
    }
    async handleLeaderboardGet(data, client) {
        const leaderboard = await this.leaderboardService.getLeaderboard(data?.gameType);
        client.emit(types_1.SOCKET_EVENTS.LEADERBOARD_DATA, leaderboard);
    }
    handleSpectateJoin(data, client) {
        const room = this.gamesService.getRoom(data.code.toUpperCase());
        if (!room) {
            client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Room not found' });
            return;
        }
        client.join(room.code);
        client.data.spectatingRoomCode = room.code;
        client.emit(types_1.SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    }
    broadcastRoomState(room) {
        this.server.to(room.code).emit(types_1.SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
        this.emitPrivateStates(room);
    }
    emitPrivateStates(room) {
        for (const player of room.players) {
            const data = this.privateStateService.getSocketData(room.code, player.socketId);
            this.server.to(player.socketId).emit(types_1.SOCKET_EVENTS.PRIVATE_STATE_UPDATED, { data });
        }
    }
    emitSessionToken(client, code) {
        const reconnectToken = this.gamesService.getReconnectToken(code, client.id);
        const playerId = this.gamesService
            .getRoom(code)
            ?.players.find((player) => player.socketId === client.id)?.id;
        if (reconnectToken && playerId) {
            client.emit(types_1.SOCKET_EVENTS.SESSION_ASSIGNED, { code, reconnectToken, playerId });
        }
    }
    applyMusicTriviaTimers(code, commands) {
        for (const command of commands ?? []) {
            if (command.kind === 'CANCEL') {
                this.roomTimerService.cancel(code, command.name);
                continue;
            }
            this.roomTimerService.schedule(code, command.name, command.deadline, () => {
                const result = command.name === 'music-trivia-countdown'
                    ? this.gamesService.musicTriviaFinalizeCountdown(code)
                    : this.gamesService.musicTriviaFinalizeAnswerTimeout(code);
                if (result) {
                    this.broadcastRoomState(result.room);
                    if (result.syncPlay) {
                        this.server
                            .to(result.room.code)
                            .emit(types_1.SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, result.syncPlay);
                    }
                }
            });
        }
    }
    syncWhoFirstTimer(room) {
        const deadline = room.whoFirstState?.countdownEndTime;
        if (room.whoFirstState?.phase !== 'COUNTDOWN' || !deadline) {
            this.roomTimerService.cancel(room.code, 'who-first');
            return;
        }
        this.roomTimerService.schedule(room.code, 'who-first', deadline, () => {
            const currentRoom = this.gamesService.getRoom(room.code);
            if (currentRoom?.whoFirstState?.phase !== 'COUNTDOWN' ||
                currentRoom.whoFirstState.countdownEndTime !== deadline) {
                return;
            }
            const updatedRoom = this.gamesService.whoFirstSetActive(room.code);
            if (updatedRoom) {
                this.broadcastRoomState(updatedRoom);
                this.syncWhoFirstTimer(updatedRoom);
            }
        });
    }
    syncWhoKnowTimer(room) {
        const deadline = room.endTime;
        if (room.status !== types_1.RoomStatus.QUESTIONING || !deadline) {
            this.roomTimerService.cancel(room.code, 'who-know');
            return;
        }
        this.roomTimerService.schedule(room.code, 'who-know', deadline, () => {
            const currentRoom = this.gamesService.getRoom(room.code);
            if (currentRoom?.status !== types_1.RoomStatus.QUESTIONING || currentRoom.endTime !== deadline) {
                return;
            }
            const updatedRoom = this.gamesService.whoKnowServerTimeout(room.code);
            if (updatedRoom) {
                this.broadcastRoomState(updatedRoom);
                this.maybeRecordGameResult(updatedRoom);
            }
        });
    }
    syncTheMindTimer(room) {
        const deadline = room.theMindState?.levelEndTime;
        if (room.theMindState?.phase !== 'PLAYING' || !deadline) {
            this.roomTimerService.cancel(room.code, 'the-mind');
            return;
        }
        this.roomTimerService.schedule(room.code, 'the-mind', deadline, () => {
            const currentRoom = this.gamesService.getRoom(room.code);
            if (currentRoom?.theMindState?.phase !== 'PLAYING' ||
                currentRoom.theMindState.levelEndTime !== deadline) {
                return;
            }
            const updatedRoom = this.gamesService.theMindServerTimeout(room.code);
            if (updatedRoom) {
                this.broadcastRoomState(updatedRoom);
                this.maybeRecordGameResult(updatedRoom);
            }
        });
    }
    isValidPayload(event, payload) {
        if (event === types_1.SOCKET_EVENTS.LEAVE_ROOM || event === types_1.SOCKET_EVENTS.GET_AVAILABLE_ROOMS)
            return true;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
            return false;
        const data = payload;
        if (!this.hasSafeValues(data))
            return false;
        if (event === types_1.SOCKET_EVENTS.CREATE_ROOM) {
            return (this.isValidName(data.name) &&
                (data.gameType === undefined || Object.values(types_1.GameType).includes(data.gameType)));
        }
        if (event === types_1.SOCKET_EVENTS.LEADERBOARD_GET) {
            return data.gameType === undefined || typeof data.gameType === 'string';
        }
        if (typeof data.code !== 'string' || !/^[a-z0-9]{6}$/i.test(data.code))
            return false;
        if (event === types_1.SOCKET_EVENTS.JOIN_ROOM || event === types_1.SOCKET_EVENTS.SPECTATE_JOIN) {
            return (this.isValidName(data.name) &&
                (data.reconnectToken === undefined ||
                    (typeof data.reconnectToken === 'string' && data.reconnectToken.length <= 100)));
        }
        if (event === types_1.SOCKET_EVENTS.UPDATE_CONFIG) {
            return !!data.config && typeof data.config === 'object' && !Array.isArray(data.config);
        }
        if (event === types_1.SOCKET_EVENTS.GAME_ACTION) {
            return !!data.action && typeof data.action === 'object' && !Array.isArray(data.action);
        }
        return true;
    }
    isValidName(value) {
        return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40;
    }
    hasSafeValues(value, depth = 0) {
        if (depth > 4)
            return false;
        if (typeof value === 'string')
            return value.length <= 500;
        if (typeof value === 'number')
            return Number.isFinite(value);
        if (typeof value === 'boolean' || value === null || value === undefined)
            return true;
        if (Array.isArray(value)) {
            return value.length <= 100 && value.every((item) => this.hasSafeValues(item, depth + 1));
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value);
            return (entries.length <= 50 &&
                entries.every(([key, item]) => key.length <= 100 && this.hasSafeValues(item, depth + 1)));
        }
        return false;
    }
    maybeRecordGameResult(room) {
        if (room.status !== types_1.RoomStatus.RESULT) {
            this.recordedResults.delete(room.code);
            return;
        }
        if (this.recordedResults.has(room.code))
            return;
        this.recordedResults.add(room.code);
        const results = [...room.players]
            .filter((p) => p.name)
            .sort((a, b) => b.score - a.score)
            .map((p, idx) => ({
            playerName: p.name,
            score: p.score,
            rank: idx + 1,
        }));
        this.leaderboardService.recordGameResult(room.gameType, room.code, results);
    }
};
exports.GamesGateway = GamesGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GamesGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.LEAVE_ROOM),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.GET_AVAILABLE_ROOMS),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleGetAvailableRooms", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.CREATE_ROOM),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.JOIN_ROOM),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.START_GAME),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GamesGateway.prototype, "handleStartGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SET_WORD),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSetWord", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.STOP_TIMER),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleStopTimer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.END_QUESTIONING),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleEndQuestioning", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SUBMIT_VOTE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSubmitVote", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.RESET_GAME),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleResetGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.UPDATE_CONFIG),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleUpdateConfig", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.TTT_JOIN_SIDE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTTTJoinSide", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.TTT_MAKE_MOVE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTTTMakeMove", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.TTT_RESET),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTTTReset", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.RPS_NEXT_ROUND),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleRPSNextRound", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.RPS_MAKE_CHOICE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleRPSMakeChoice", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.RPS_RESET),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleRPSReset", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.GOBBLER_JOIN_SIDE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleGobblerJoinSide", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.GOBBLER_PLACE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleGobblerPlace", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.GOBBLER_MOVE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleGobblerMove", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.GOBBLER_RESET),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleGobblerReset", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_TYPE_ANSWER),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishyTypeAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_SUBMIT_ANSWER),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishySubmitAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_REVEAL_ANSWER),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishyRevealAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_ELIMINATE_PLAYER),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishyEliminatePlayer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_BANK_POINTS),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishyBankPoints", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_NEXT_ROUND),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishyNextRound", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SOUNDS_FISHY_RESET),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSoundsFishyReset", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.DETECTIVE_CLUB_SUBMIT_WORD),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleDetectiveClubSubmitWord", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.DETECTIVE_CLUB_PLAY_CARD),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleDetectiveClubPlayCard", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_PHASE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleDetectiveClubNextPhase", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.DETECTIVE_CLUB_VOTE),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleDetectiveClubVote", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_ROUND),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleDetectiveClubNextRound", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.DETECTIVE_CLUB_RESET),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleDetectiveClubReset", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.WHO_AM_I_SUBMIT_WORDS),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleWhoAmISubmitWords", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.WHO_AM_I_SUBMIT_PLAYER_WORD),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleWhoAmISubmitPlayerWord", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GamesGateway.prototype, "handleWhoAmIGetCategories", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.GAME_ACTION),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GamesGateway.prototype, "handleGameAction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.THE_MIND_READY),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTheMindReady", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.THE_MIND_PLAY_CARD),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTheMindPlayCard", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.THE_MIND_NEXT_LEVEL),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTheMindNextLevel", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.THE_MIND_PROPOSE_SHURIKEN),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTheMindProposeShuriken", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.THE_MIND_VOTE_SHURIKEN),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTheMindVoteShuriken", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.THE_MIND_CANCEL_SHURIKEN),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleTheMindCancelShuriken", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.LEADERBOARD_GET),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GamesGateway.prototype, "handleLeaderboardGet", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(types_1.SOCKET_EVENTS.SPECTATE_JOIN),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GamesGateway.prototype, "handleSpectateJoin", null);
exports.GamesGateway = GamesGateway = GamesGateway_1 = __decorate([
    (0, common_1.UseFilters)(ws_exception_filter_1.WsExceptionFilter),
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*',
        },
    }),
    __metadata("design:paramtypes", [games_service_1.GamesService,
        leaderboard_service_1.LeaderboardService,
        room_timer_service_1.RoomTimerService,
        private_state_service_1.PrivateStateService])
], GamesGateway);
//# sourceMappingURL=games.gateway.js.map