"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoundsFishyService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const database_1 = require("@repo/database");
let SoundsFishyService = class SoundsFishyService {
    async assignRoles(room, requesterId) {
        if (room.players.length < 3)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const lang = room.config.language || 'th';
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
        const questionRecord = questionsWithMinCount[randomIndex];
        if (questionRecord) {
            await database_1.prisma.soundsFishyQuestion.update({
                where: { id: questionRecord.id },
                data: { query_count: { increment: 1 } },
            });
        }
        const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
        const picker = shuffledPlayers[0];
        const blueFish = shuffledPlayers[1];
        const redHerrings = shuffledPlayers.slice(2);
        const questionData = {
            id: questionRecord.id,
            question: questionRecord.question,
            answer: questionRecord.answer,
            lang: questionRecord.lang,
        };
        const state = {
            currentPhase: types_1.SoundsFishyPhase.SETUP,
            pickerId: picker.socketId,
            blueFishId: blueFish.socketId,
            redHerringIds: redHerrings.map((p) => p.socketId),
            question: questionData,
            playerAnswers: {},
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
        if (playerId === state.pickerId)
            return null;
        state.typingAnswers[playerId] = answer;
        return room;
    }
    checkAnswerResolution(room) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.SETUP)
            return false;
        const state = room.soundsFishyState;
        const requiredAnswersCount = room.players.filter((p) => p.socketId !== state.pickerId && p.connected !== false).length;
        if (Object.keys(state.playerAnswers).length >= requiredAnswersCount &&
            requiredAnswersCount > 0) {
            state.currentPhase = types_1.SoundsFishyPhase.THE_PITCH;
            return true;
        }
        return false;
    }
    submitAnswer(room, playerId, answer) {
        if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== types_1.SoundsFishyPhase.SETUP)
            return null;
        const state = room.soundsFishyState;
        if (playerId === state.pickerId)
            return null;
        if (state.redHerringIds.includes(playerId)) {
            if (answer.toLowerCase().trim() === state.question?.answer.toLowerCase().trim()) {
                return null;
            }
        }
        if (state.typingAnswers)
            delete state.typingAnswers[playerId];
        state.playerAnswers[playerId] = {
            playerId,
            answer,
            isRevealed: false,
        };
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
        if (!state.playerAnswers[targetId])
            return null;
        if (state.eliminatedPlayers.includes(targetId))
            return null;
        if (state.playerAnswers[targetId].isRevealed)
            return null;
        state.playerAnswers[targetId].isRevealed = true;
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
        const nonPickerIds = room.players.map((p) => p.socketId).filter((id) => id !== state.pickerId);
        if (!nonPickerIds.includes(targetId))
            return null;
        const allRevealed = nonPickerIds.every((id) => {
            const pData = state.playerAnswers[id];
            return pData && pData.isRevealed;
        });
        if (!allRevealed)
            return null;
        state.eliminatedPlayers.push(targetId);
        if (targetId === state.blueFishId) {
            state.roundScorePool = 0;
            const survivingRedHerrings = state.redHerringIds.filter((id) => !state.eliminatedPlayers.includes(id)).length;
            const blueFishPlayer = room.players.find((p) => p.socketId === state.blueFishId);
            if (blueFishPlayer) {
                blueFishPlayer.score += survivingRedHerrings;
                state.roundPoints[blueFishPlayer.socketId] = survivingRedHerrings;
            }
            state.redHerringIds.forEach((id) => {
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
        }
        else if (state.redHerringIds.includes(targetId)) {
            state.roundScorePool += 1;
            const allRedHerringsEliminated = state.redHerringIds.every((id) => state.eliminatedPlayers.includes(id));
            if (allRedHerringsEliminated) {
                const pickerPlayer = room.players.find((p) => p.socketId === state.pickerId);
                if (pickerPlayer) {
                    pickerPlayer.score += state.roundScorePool;
                    state.roundPoints[pickerPlayer.socketId] = state.roundScorePool;
                }
                state.redHerringIds.forEach((id) => {
                    state.roundPoints[id] = 0;
                });
                if (state.blueFishId)
                    state.roundPoints[state.blueFishId] = 0;
                state.currentPhase = types_1.SoundsFishyPhase.SCORING;
                room.status = types_1.RoomStatus.RESULT;
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
        state.redHerringIds.forEach((id) => {
            state.roundPoints[id] = 0;
        });
        if (state.blueFishId)
            state.roundPoints[state.blueFishId] = 0;
        state.currentPhase = types_1.SoundsFishyPhase.SCORING;
        room.status = types_1.RoomStatus.RESULT;
        return room;
    }
    nextRound(room, requesterId) {
        if (room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        delete room.soundsFishyState;
        return room;
    }
};
exports.SoundsFishyService = SoundsFishyService;
exports.SoundsFishyService = SoundsFishyService = __decorate([
    (0, common_1.Injectable)()
], SoundsFishyService);
//# sourceMappingURL=sounds-fishy.service.js.map