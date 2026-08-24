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
exports.SoundsFishyService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const database_1 = require("@repo/database");
const private_state_service_1 = require("../private-state.service");
const ROOM_KEY = '__room__';
const SF_ROLE = 'sfRole';
const SF_TRUE_ANSWER = 'sfTrueAnswer';
const SF_MY_ANSWER = 'sfMyAnswer';
const SF_ROOM_TRUE_ANSWER = 'sfRoomTrueAnswer';
const SF_ROOM_BLUE_FISH = 'sfRoomBlueFish';
const SF_ROOM_RED_HERRINGS = 'sfRoomRedHerrings';
const MAX_ANSWER_LENGTH = 200;
let SoundsFishyService = class SoundsFishyService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    isMember(room, socketId) {
        return room.players.some((p) => p.socketId === socketId);
    }
    getTrueAnswer(room) {
        return this.privateState.get(room.code, ROOM_KEY, SF_ROOM_TRUE_ANSWER) ?? '';
    }
    getBlueFishId(room) {
        return this.privateState.get(room.code, ROOM_KEY, SF_ROOM_BLUE_FISH) ?? null;
    }
    getRedHerringIds(room) {
        return this.privateState.get(room.code, ROOM_KEY, SF_ROOM_RED_HERRINGS) ?? [];
    }
    revealRoles(room) {
        const state = room.soundsFishyState;
        if (!state)
            return;
        state.blueFishId =
            this.privateState.get(room.code, ROOM_KEY, SF_ROOM_BLUE_FISH) ?? null;
        state.redHerringIds =
            this.privateState.get(room.code, ROOM_KEY, SF_ROOM_RED_HERRINGS) ?? [];
        if (state.question) {
            state.question.answer = this.getTrueAnswer(room);
        }
    }
    async assignRoles(room, requesterId) {
        const connectedPlayers = room.players.filter((p) => p.connected !== false);
        if (connectedPlayers.length < 3)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const lang = room.config.language || 'th';
        let questionRecord = null;
        try {
            const minQueryCountResult = await database_1.prisma.soundsFishyQuestion.aggregate({
                where: { lang },
                _min: { query_count: true },
            });
            if (minQueryCountResult._min.query_count === null)
                return null;
            const minQueryCount = minQueryCountResult._min.query_count;
            const questionsWithMinCount = await database_1.prisma.soundsFishyQuestion.findMany({
                where: { lang, query_count: minQueryCount },
                select: { id: true, question: true, answer: true, lang: true },
            });
            if (questionsWithMinCount.length === 0)
                return null;
            const randomIndex = Math.floor(Math.random() * questionsWithMinCount.length);
            questionRecord = questionsWithMinCount[randomIndex];
            if (questionRecord) {
                await database_1.prisma.soundsFishyQuestion.update({
                    where: { id: questionRecord.id },
                    data: { query_count: { increment: 1 } },
                });
            }
        }
        catch {
            return null;
        }
        if (!questionRecord)
            return null;
        const shuffledPlayers = this.shuffleArray(connectedPlayers);
        const picker = shuffledPlayers[0];
        const blueFish = shuffledPlayers[1];
        const redHerrings = shuffledPlayers.slice(2);
        for (const p of connectedPlayers) {
            const role = p.socketId === picker.socketId
                ? 'PICKER'
                : p.socketId === blueFish.socketId
                    ? 'BLUE_FISH'
                    : 'RED_HERRING';
            this.privateState.set(room.code, p.socketId, SF_ROLE, role);
            if (role !== 'PICKER') {
                this.privateState.set(room.code, p.socketId, SF_TRUE_ANSWER, questionRecord.answer);
            }
        }
        this.privateState.set(room.code, ROOM_KEY, SF_ROOM_TRUE_ANSWER, questionRecord.answer);
        this.privateState.set(room.code, ROOM_KEY, SF_ROOM_BLUE_FISH, blueFish.socketId);
        this.privateState.set(room.code, ROOM_KEY, SF_ROOM_RED_HERRINGS, redHerrings.map((p) => p.socketId));
        const questionData = {
            id: questionRecord.id,
            question: questionRecord.question,
            lang: questionRecord.lang,
        };
        const state = {
            currentPhase: types_1.SoundsFishyPhase.SETUP,
            pickerId: picker.socketId,
            blueFishId: null,
            redHerringIds: [],
            question: questionData,
            playerAnswers: {},
            answeredPlayerIds: [],
            eliminatedPlayers: [],
            roundScorePool: 0,
            roundPoints: {},
            typingAnswers: {},
        };
        room.status = types_1.RoomStatus.QUESTIONING;
        room.soundsFishyState = state;
        const roles = {};
        room.players.forEach((p) => {
            p.role = null;
            roles[p.socketId] = p.role;
        });
        return { room, roles };
    }
    typeAnswer(room, playerId, answer) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.SETUP)
            return null;
        const state = room.soundsFishyState;
        if (!this.isMember(room, playerId))
            return null;
        if (playerId === state.pickerId)
            return null;
        state.typingAnswers[playerId] = answer.slice(0, MAX_ANSWER_LENGTH);
        return room;
    }
    checkAnswerResolution(room) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.SETUP)
            return false;
        const state = room.soundsFishyState;
        const requiredAnswersCount = room.players.filter((p) => p.socketId !== state.pickerId && p.connected !== false).length;
        const answeredCount = this.privateState.getRoomData(room.code, SF_MY_ANSWER).size;
        if (answeredCount >= requiredAnswersCount && requiredAnswersCount > 0) {
            state.currentPhase = types_1.SoundsFishyPhase.THE_PITCH;
            return true;
        }
        return false;
    }
    submitAnswer(room, playerId, answer) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.SETUP)
            return null;
        const state = room.soundsFishyState;
        if (!this.isMember(room, playerId))
            return null;
        if (playerId === state.pickerId)
            return null;
        if (this.privateState.has(room.code, playerId, SF_MY_ANSWER))
            return null;
        const trimmed = answer.trim().slice(0, MAX_ANSWER_LENGTH);
        if (!trimmed)
            return null;
        const trueAnswer = this.getTrueAnswer(room).trim().toLowerCase();
        const normalized = trimmed.toLowerCase();
        if (playerId === this.getBlueFishId(room)) {
            if (normalized !== trueAnswer)
                return null;
        }
        else if (this.getRedHerringIds(room).includes(playerId)) {
            if (normalized === trueAnswer)
                return null;
        }
        if (state.typingAnswers)
            delete state.typingAnswers[playerId];
        this.privateState.set(room.code, playerId, SF_MY_ANSWER, { playerId, answer: trimmed });
        if (!state.answeredPlayerIds.includes(playerId)) {
            state.answeredPlayerIds.push(playerId);
        }
        this.checkAnswerResolution(room);
        return room;
    }
    revealPlayer(room, pickerId, targetId) {
        if (!room.soundsFishyState)
            return null;
        const state = room.soundsFishyState;
        if (state.currentPhase !== types_1.SoundsFishyPhase.THE_PITCH &&
            state.currentPhase !== types_1.SoundsFishyPhase.THE_HUNT)
            return null;
        if (pickerId !== state.pickerId)
            return null;
        if (!this.isMember(room, targetId))
            return null;
        if (state.eliminatedPlayers.includes(targetId))
            return null;
        if (state.playerAnswers[targetId])
            return null;
        const privateAnswer = this.privateState.get(room.code, targetId, SF_MY_ANSWER);
        if (!privateAnswer)
            return null;
        state.playerAnswers[targetId] = {
            playerId: targetId,
            answer: privateAnswer.answer,
            isRevealed: true,
        };
        state.currentPhase = types_1.SoundsFishyPhase.THE_HUNT;
        return room;
    }
    eliminatePlayer(room, pickerId, targetId) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.THE_HUNT)
            return null;
        const state = room.soundsFishyState;
        if (pickerId !== state.pickerId)
            return null;
        if (targetId === state.pickerId)
            return null;
        if (state.eliminatedPlayers.includes(targetId))
            return null;
        const nonPickerIds = room.players
            .filter((p) => p.connected !== false)
            .map((p) => p.socketId)
            .filter((id) => id !== state.pickerId);
        if (!nonPickerIds.includes(targetId))
            return null;
        const allRevealed = nonPickerIds.every((id) => state.playerAnswers[id]?.isRevealed);
        if (!allRevealed)
            return null;
        state.eliminatedPlayers.push(targetId);
        const blueFishId = this.getBlueFishId(room);
        const redHerringIds = this.getRedHerringIds(room);
        if (targetId === blueFishId) {
            state.roundScorePool = 0;
            const survivingRedHerrings = redHerringIds.filter((id) => !state.eliminatedPlayers.includes(id)).length;
            const blueFishPlayer = room.players.find((p) => p.socketId === blueFishId);
            if (blueFishPlayer) {
                blueFishPlayer.score += survivingRedHerrings;
                state.roundPoints[blueFishPlayer.socketId] = survivingRedHerrings;
            }
            redHerringIds.forEach((id) => {
                if (!state.eliminatedPlayers.includes(id)) {
                    const p = room.players.find((player) => player.socketId === id);
                    if (p) {
                        p.score += 1;
                        state.roundPoints[p.socketId] = 1;
                    }
                }
                else {
                    state.roundPoints[id] = 0;
                }
            });
            state.roundPoints[state.pickerId] = 0;
            state.currentPhase = types_1.SoundsFishyPhase.SCORING;
            room.status = types_1.RoomStatus.RESULT;
            this.revealRoles(room);
        }
        else if (redHerringIds.includes(targetId)) {
            state.roundScorePool += 1;
            const allRedHerringsEliminated = redHerringIds.every((id) => state.eliminatedPlayers.includes(id));
            if (allRedHerringsEliminated) {
                const pickerPlayer = room.players.find((p) => p.socketId === state.pickerId);
                if (pickerPlayer) {
                    pickerPlayer.score += state.roundScorePool;
                    state.roundPoints[pickerPlayer.socketId] = state.roundScorePool;
                }
                redHerringIds.forEach((id) => {
                    state.roundPoints[id] = 0;
                });
                if (blueFishId)
                    state.roundPoints[blueFishId] = 0;
                state.currentPhase = types_1.SoundsFishyPhase.SCORING;
                room.status = types_1.RoomStatus.RESULT;
                this.revealRoles(room);
            }
        }
        return room;
    }
    bankPoints(room, pickerId) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.THE_HUNT)
            return null;
        const state = room.soundsFishyState;
        if (pickerId !== state.pickerId)
            return null;
        if (state.roundScorePool === 0)
            return null;
        const pickerPlayer = room.players.find((p) => p.socketId === state.pickerId);
        if (pickerPlayer) {
            pickerPlayer.score += state.roundScorePool;
            state.roundPoints[pickerPlayer.socketId] = state.roundScorePool;
        }
        this.getRedHerringIds(room).forEach((id) => {
            state.roundPoints[id] = 0;
        });
        const blueFishId = this.getBlueFishId(room);
        if (blueFishId)
            state.roundPoints[blueFishId] = 0;
        state.currentPhase = types_1.SoundsFishyPhase.SCORING;
        room.status = types_1.RoomStatus.RESULT;
        this.revealRoles(room);
        return room;
    }
    nextRound(room, requesterId) {
        return this.backToLobby(room, requesterId);
    }
    reset(room, requesterId) {
        return this.backToLobby(room, requesterId);
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.pickerId === oldSocketId)
            state.pickerId = newSocketId;
        if (state.blueFishId === oldSocketId)
            state.blueFishId = newSocketId;
        state.redHerringIds = state.redHerringIds.map((id) => (id === oldSocketId ? newSocketId : id));
        state.answeredPlayerIds = state.answeredPlayerIds.map((id) => id === oldSocketId ? newSocketId : id);
        state.eliminatedPlayers = state.eliminatedPlayers.map((id) => id === oldSocketId ? newSocketId : id);
        if (state.playerAnswers[oldSocketId]) {
            state.playerAnswers[newSocketId] = {
                ...state.playerAnswers[oldSocketId],
                playerId: newSocketId,
            };
            delete state.playerAnswers[oldSocketId];
        }
        if (state.roundPoints[oldSocketId] !== undefined) {
            state.roundPoints[newSocketId] = state.roundPoints[oldSocketId];
            delete state.roundPoints[oldSocketId];
        }
        if (state.typingAnswers[oldSocketId] !== undefined) {
            state.typingAnswers[newSocketId] = state.typingAnswers[oldSocketId];
            delete state.typingAnswers[oldSocketId];
        }
    }
    backToLobby(room, requesterId) {
        if (room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        delete room.soundsFishyState;
        this.privateState.clearRoom(room.code);
        return room;
    }
};
exports.SoundsFishyService = SoundsFishyService;
exports.SoundsFishyService = SoundsFishyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], SoundsFishyService);
//# sourceMappingURL=sounds-fishy.service.js.map