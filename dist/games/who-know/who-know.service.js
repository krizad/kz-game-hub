"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhoKnowService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
let WhoKnowService = class WhoKnowService {
    assignRoles(room, requesterId) {
        if (room.players.length < 4)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.WORD_SETTING;
        let hostPlayer;
        if (room.config.hostSelection === 'FIXED') {
            hostPlayer = room.players.find((p) => p.socketId === room.roomHostId) || room.players[0];
        }
        else if (room.config.hostSelection === 'RANDOM') {
            const hostIndex = Math.floor(Math.random() * room.players.length);
            hostPlayer = room.players[hostIndex];
        }
        else {
            let eligibleHosts = room.players.filter((p) => !p.hasBeenHost);
            if (eligibleHosts.length === 0) {
                room.players.forEach((p) => (p.hasBeenHost = false));
                eligibleHosts = room.players;
            }
            const hostIndex = Math.floor(Math.random() * eligibleHosts.length);
            hostPlayer = eligibleHosts[hostIndex];
        }
        hostPlayer.hasBeenHost = true;
        const remainingPlayers = room.players.filter((p) => p.socketId !== hostPlayer.socketId);
        const knowIndex = Math.floor(Math.random() * remainingPlayers.length);
        const knowPlayer = remainingPlayers[knowIndex];
        const roles = {};
        room.players.forEach((p) => {
            let role = types_1.Role.Unknow;
            if (p.socketId === hostPlayer.socketId)
                role = types_1.Role.Host;
            else if (p.socketId === knowPlayer.socketId)
                role = types_1.Role.Know;
            p.role = role;
            roles[p.socketId] = role;
        });
        return { room, roles };
    }
    setWord(room, word, requesterId, secretWords) {
        if (room.status !== types_1.RoomStatus.WORD_SETTING)
            return null;
        const player = room.players.find((p) => p.socketId === requesterId);
        if (!player || player.role !== types_1.Role.Host)
            return null;
        room.status = types_1.RoomStatus.QUESTIONING;
        const timeMs = (room.config.timerMin || 5) * 60 * 1000;
        room.endTime = Date.now() + timeMs;
        secretWords.set(room.code, word);
        return room;
    }
    stopTimer(room, requesterId) {
        if (room.status !== types_1.RoomStatus.QUESTIONING)
            return null;
        const player = room.players.find((p) => p.socketId === requesterId);
        if (!player || player.role !== types_1.Role.Host)
            return null;
        room.endTime = undefined;
        return room;
    }
    endQuestioning(room, requesterId, timeout = false) {
        if (room.status !== types_1.RoomStatus.QUESTIONING)
            return null;
        const player = room.players.find((p) => p.socketId === requesterId);
        if (!player || player.role !== types_1.Role.Host)
            return null;
        if (timeout) {
            room.status = types_1.RoomStatus.RESULT;
            room.winner = 'TIMEOUT';
        }
        else {
            room.status = types_1.RoomStatus.VOTING;
            room.votes = {};
        }
        room.endTime = undefined;
        return room;
    }
    checkVoteResolution(room) {
        if (room.status !== types_1.RoomStatus.VOTING || !room.votes)
            return false;
        const playingCount = room.players.filter((p) => p.role !== types_1.Role.Host && p.connected !== false).length;
        const votesCast = Object.keys(room.votes).length;
        if (playingCount === 0 || (votesCast >= playingCount && playingCount > 0)) {
            room.status = types_1.RoomStatus.RESULT;
            const voteCounts = Object.values(room.votes).reduce((acc, votedForId) => {
                acc[votedForId] = (acc[votedForId] || 0) + 1;
                return acc;
            }, {});
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
            const insider = room.players.find((p) => p.role === types_1.Role.Know);
            const isInsiderCaught = insider && suspectedIds.includes(insider.socketId);
            if (isInsiderCaught) {
                room.winner = 'COMMONERS';
                room.players.forEach((p) => {
                    if (p.role !== types_1.Role.Know && p.role !== types_1.Role.Host)
                        p.score += 1;
                });
            }
            else {
                room.winner = 'INSIDER';
                if (insider)
                    insider.score += 2;
            }
            return true;
        }
        return false;
    }
    submitVote(room, voterId, targetId) {
        if (room.status !== types_1.RoomStatus.VOTING)
            return null;
        const voter = room.players.find((p) => p.socketId === voterId);
        if (!voter || voter.role === types_1.Role.Host)
            return null;
        if (!room.votes)
            room.votes = {};
        if (room.votes[voterId] !== undefined)
            return null;
        room.votes[voterId] = targetId;
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
        room.players.forEach((p) => {
            p.role = null;
        });
        secretWords.delete(room.code);
        return room;
    }
};
exports.WhoKnowService = WhoKnowService;
exports.WhoKnowService = WhoKnowService = __decorate([
    (0, common_1.Injectable)()
], WhoKnowService);
//# sourceMappingURL=who-know.service.js.map