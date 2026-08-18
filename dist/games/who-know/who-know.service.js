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
exports.WhoKnowService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const WK_ROLE = 'wkRole';
const WK_VOTE = 'wkVote';
const MAX_WORD_LENGTH = 60;
let WhoKnowService = class WhoKnowService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    getRole(room, socketId) {
        return this.privateState.get(room.code, socketId, WK_ROLE);
    }
    setRole(room, socketId, role) {
        this.privateState.set(room.code, socketId, WK_ROLE, role);
    }
    clearRoles(room) {
        for (const p of room.players) {
            this.privateState.delete(room.code, p.socketId, WK_ROLE);
        }
    }
    revealRoles(room) {
        for (const p of room.players) {
            const role = this.getRole(room, p.socketId);
            if (role)
                p.role = role;
        }
    }
    assignRoles(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY && room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const connectedPlayers = room.players.filter((p) => p.connected !== false);
        if (connectedPlayers.length < 4)
            return null;
        room.status = types_1.RoomStatus.WORD_SETTING;
        let hostPlayer;
        if (room.config.hostSelection === 'FIXED') {
            hostPlayer =
                connectedPlayers.find((p) => p.socketId === room.roomHostId) || connectedPlayers[0];
        }
        else if (room.config.hostSelection === 'RANDOM') {
            const hostIndex = Math.floor(Math.random() * connectedPlayers.length);
            hostPlayer = connectedPlayers[hostIndex];
        }
        else {
            let eligibleHosts = connectedPlayers.filter((p) => !p.hasBeenHost);
            if (eligibleHosts.length === 0) {
                connectedPlayers.forEach((p) => (p.hasBeenHost = false));
                eligibleHosts = connectedPlayers;
            }
            const hostIndex = Math.floor(Math.random() * eligibleHosts.length);
            hostPlayer = eligibleHosts[hostIndex];
        }
        hostPlayer.hasBeenHost = true;
        const remainingPlayers = connectedPlayers.filter((p) => p.socketId !== hostPlayer.socketId);
        const knowIndex = Math.floor(Math.random() * remainingPlayers.length);
        const knowPlayer = remainingPlayers[knowIndex];
        const roles = {};
        room.players.forEach((p) => {
            let role = types_1.Role.Unknow;
            if (p.socketId === hostPlayer.socketId)
                role = types_1.Role.Host;
            else if (p.socketId === knowPlayer.socketId)
                role = types_1.Role.Know;
            this.setRole(room, p.socketId, role);
            roles[p.socketId] = role;
            delete p.role;
        });
        room.hostPlayerId = hostPlayer.socketId;
        return { room, roles };
    }
    setWord(room, word, requesterId, secretWords) {
        if (room.status !== types_1.RoomStatus.WORD_SETTING)
            return null;
        if (this.getRole(room, requesterId) !== types_1.Role.Host)
            return null;
        const trimmed = word.trim();
        if (!trimmed || trimmed.length > MAX_WORD_LENGTH)
            return null;
        room.status = types_1.RoomStatus.QUESTIONING;
        const timeMs = (room.config.timerMin || 5) * 60 * 1000;
        room.endTime = Date.now() + timeMs;
        secretWords.set(room.code, trimmed);
        return room;
    }
    stopTimer(room, requesterId) {
        if (room.status !== types_1.RoomStatus.QUESTIONING)
            return null;
        if (this.getRole(room, requesterId) !== types_1.Role.Host)
            return null;
        room.endTime = undefined;
        return room;
    }
    endQuestioning(room, requesterId, timeout = false) {
        if (room.status !== types_1.RoomStatus.QUESTIONING)
            return null;
        if (this.getRole(room, requesterId) !== types_1.Role.Host)
            return null;
        if (timeout) {
            room.status = types_1.RoomStatus.RESULT;
            room.winner = 'TIMEOUT';
            this.revealRoles(room);
        }
        else {
            room.status = types_1.RoomStatus.VOTING;
            room.votes = {};
        }
        room.endTime = undefined;
        return room;
    }
    handleQuestioningTimeout(room) {
        if (room.status !== types_1.RoomStatus.QUESTIONING)
            return null;
        room.status = types_1.RoomStatus.RESULT;
        room.winner = 'TIMEOUT';
        room.endTime = undefined;
        this.revealRoles(room);
        return room;
    }
    checkVoteResolution(room) {
        if (room.status !== types_1.RoomStatus.VOTING)
            return false;
        const votes = this.privateState.getRoomData(room.code, WK_VOTE);
        const playingCount = room.players.filter((p) => this.getRole(room, p.socketId) !== types_1.Role.Host && p.connected !== false).length;
        const votesCast = votes.size;
        if (playingCount === 0 || (votesCast >= playingCount && playingCount > 0)) {
            room.status = types_1.RoomStatus.RESULT;
            const voteCounts = {};
            for (const targetId of votes.values()) {
                voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
            }
            let maxVotes = 0;
            let suspectedIds = [];
            Object.entries(voteCounts).forEach(([id, count]) => {
                if (count > maxVotes) {
                    maxVotes = count;
                    suspectedIds = [id];
                }
                else if (count === maxVotes) {
                    suspectedIds.push(id);
                }
            });
            const insider = room.players.find((p) => this.getRole(room, p.socketId) === types_1.Role.Know);
            const isInsiderCaught = insider && suspectedIds.includes(insider.socketId);
            if (isInsiderCaught) {
                room.winner = 'COMMONERS';
                room.players.forEach((p) => {
                    const role = this.getRole(room, p.socketId);
                    if (role !== types_1.Role.Know && role !== types_1.Role.Host)
                        p.score += 1;
                });
            }
            else {
                room.winner = 'INSIDER';
                if (insider)
                    insider.score += 2;
            }
            room.votes = {};
            for (const [voterId, targetId] of votes.entries()) {
                room.votes[voterId] = targetId;
            }
            this.revealRoles(room);
            return true;
        }
        return false;
    }
    submitVote(room, voterId, targetId) {
        if (room.status !== types_1.RoomStatus.VOTING)
            return null;
        const voter = room.players.find((p) => p.socketId === voterId);
        if (!voter || voter.connected === false)
            return null;
        if (this.getRole(room, voterId) === types_1.Role.Host)
            return null;
        if (this.privateState.has(room.code, voterId, WK_VOTE))
            return null;
        const target = room.players.find((p) => p.socketId === targetId);
        if (!target || target.connected === false)
            return null;
        if (targetId === voterId)
            return null;
        if (this.getRole(room, targetId) === types_1.Role.Host)
            return null;
        this.privateState.set(room.code, voterId, WK_VOTE, targetId);
        this.checkVoteResolution(room);
        return room;
    }
    resetGame(room, requesterId, secretWords) {
        if (room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.votes = undefined;
        room.endTime = undefined;
        room.winner = undefined;
        room.hostPlayerId = undefined;
        this.clearRoles(room);
        room.players.forEach((p) => {
            delete p.role;
            this.privateState.delete(room.code, p.socketId, WK_VOTE);
        });
        secretWords.delete(room.code);
        return room;
    }
};
exports.WhoKnowService = WhoKnowService;
exports.WhoKnowService = WhoKnowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], WhoKnowService);
//# sourceMappingURL=who-know.service.js.map