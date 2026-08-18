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
exports.RPSService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const RPS_CHOICE_KEY = 'rpsChoice';
const VALID_CHOICES = ['ROCK', 'PAPER', 'SCISSORS'];
let RPSService = class RPSService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    assignRoles(room, requesterId) {
        if (room.gameType !== types_1.GameType.RPS)
            return null;
        if (room.status !== types_1.RoomStatus.LOBBY && room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (!room.rpsState)
            return null;
        const connectedIds = room.players.filter((p) => p.connected !== false).map((p) => p.socketId);
        if (connectedIds.length < 2)
            return null;
        room.status = types_1.RoomStatus.PLAYING;
        if (room.config.rpsMode === 'ALL_AT_ONCE') {
            room.rpsState.activePlayers = [...connectedIds];
            room.rpsState.queue = [];
        }
        else {
            room.rpsState.activePlayers = connectedIds.slice(0, 2);
            room.rpsState.queue = connectedIds.slice(2);
        }
        room.rpsState.choices = {};
        room.rpsState.choicesMade = [];
        room.rpsState.scores = {};
        connectedIds.forEach((id) => (room.rpsState.scores[id] = 0));
        room.rpsState.gameWinner = undefined;
        room.rpsState.roundWinner = undefined;
        for (const id of connectedIds) {
            this.privateState.delete(room.code, id, RPS_CHOICE_KEY);
        }
        return { room, roles: {} };
    }
    makeChoice(room, clientId, choice) {
        if (room.gameType !== types_1.GameType.RPS || room.status !== types_1.RoomStatus.PLAYING)
            return null;
        const rps = room.rpsState;
        if (!rps || rps.gameWinner)
            return null;
        if (!VALID_CHOICES.includes(choice))
            return null;
        if (!rps.activePlayers.includes(clientId))
            return null;
        if (this.privateState.has(room.code, clientId, RPS_CHOICE_KEY))
            return null;
        this.privateState.set(room.code, clientId, RPS_CHOICE_KEY, choice);
        if (!rps.choicesMade.includes(clientId)) {
            rps.choicesMade.push(clientId);
        }
        const activeAndConnectedIds = rps.activePlayers.filter((id) => room.players.find((p) => p.socketId === id && p.connected !== false));
        const allChosen = activeAndConnectedIds.every((id) => this.privateState.has(room.code, id, RPS_CHOICE_KEY));
        if (allChosen && activeAndConnectedIds.length > 0) {
            const revealed = this.revealChoices(room);
            if (room.config.rpsMode === 'ALL_AT_ONCE') {
                this.resolveAllAtOnceRound(room, revealed);
            }
            else {
                this.resolve1v1Round(room, revealed);
            }
            const bestOf = room.config.rpsBestOf || 3;
            const targetScore = Math.floor(bestOf / 2) + 1;
            const gameWinners = Object.entries(rps.scores)
                .filter(([, score]) => score >= targetScore)
                .map(([id]) => id);
            if (gameWinners.length > 0) {
                rps.gameWinner = gameWinners.length === 1 ? gameWinners[0] : gameWinners;
            }
            room.status = types_1.RoomStatus.RESULT;
        }
        else if (activeAndConnectedIds.length === 0) {
            rps.roundWinner = 'DRAW';
            room.status = types_1.RoomStatus.RESULT;
        }
        return room;
    }
    revealChoices(room) {
        const taken = this.privateState.takeRoomData(room.code, RPS_CHOICE_KEY);
        const revealed = {};
        for (const [socketId, choice] of taken.entries()) {
            revealed[socketId] = choice;
        }
        room.rpsState.choices = revealed;
        return revealed;
    }
    addScore(room, socketId, amount) {
        const rps = room.rpsState;
        rps.scores[socketId] = (rps.scores[socketId] || 0) + amount;
        const player = room.players.find((p) => p.socketId === socketId);
        if (player)
            player.score += amount;
    }
    resolve1v1Round(room, revealed) {
        const rps = room.rpsState;
        const [p1, p2] = rps.activePlayers;
        const c1 = revealed[p1];
        const c2 = revealed[p2];
        if (!c1 || !c2) {
            rps.roundWinner = c1 ? p1 : c2 ? p2 : 'DRAW';
            if (c1 && !c2) {
                this.addScore(room, p1, 1);
                if (rps.queue.length > 0) {
                    rps.queue.push(p2);
                    rps.activePlayers[1] = rps.queue.shift();
                }
            }
            else if (c2 && !c1) {
                this.addScore(room, p2, 1);
                if (rps.queue.length > 0) {
                    rps.queue.push(p1);
                    rps.activePlayers[0] = rps.queue.shift();
                }
            }
        }
        else if (c1 === c2) {
            rps.roundWinner = 'DRAW';
        }
        else if ((c1 === 'ROCK' && c2 === 'SCISSORS') ||
            (c1 === 'PAPER' && c2 === 'ROCK') ||
            (c1 === 'SCISSORS' && c2 === 'PAPER')) {
            rps.roundWinner = p1;
            this.addScore(room, p1, 1);
            if (rps.queue.length > 0) {
                rps.queue.push(p2);
                rps.activePlayers[1] = rps.queue.shift();
            }
        }
        else {
            rps.roundWinner = p2;
            this.addScore(room, p2, 1);
            if (rps.queue.length > 0) {
                rps.queue.push(p1);
                rps.activePlayers[0] = rps.queue.shift();
            }
        }
    }
    resolveAllAtOnceRound(room, revealed) {
        const rps = room.rpsState;
        const choicesList = Object.values(revealed);
        const hasRock = choicesList.includes('ROCK');
        const hasPaper = choicesList.includes('PAPER');
        const hasScissors = choicesList.includes('SCISSORS');
        if ((hasRock && hasPaper && hasScissors) ||
            (!hasRock && !hasPaper) ||
            (!hasRock && !hasScissors) ||
            (!hasPaper && !hasScissors)) {
            rps.roundWinner = 'DRAW';
            return;
        }
        let winningSymbol;
        if (hasRock && hasScissors)
            winningSymbol = 'ROCK';
        else if (hasScissors && hasPaper)
            winningSymbol = 'SCISSORS';
        else
            winningSymbol = 'PAPER';
        const winners = [];
        Object.entries(revealed).forEach(([id, choice]) => {
            if (choice === winningSymbol) {
                winners.push(id);
                this.addScore(room, id, 1);
            }
        });
        rps.roundWinner = winners;
    }
    nextRound(room, clientId) {
        if (room.gameType !== types_1.GameType.RPS || room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (!room.rpsState)
            return null;
        if (room.roomHostId !== clientId) {
            return null;
        }
        if (room.rpsState.gameWinner) {
            return this.reset(room, clientId);
        }
        room.rpsState.choices = {};
        room.rpsState.choicesMade = [];
        for (const id of room.rpsState.activePlayers) {
            this.privateState.delete(room.code, id, RPS_CHOICE_KEY);
        }
        room.status = types_1.RoomStatus.PLAYING;
        return room;
    }
    reset(room, clientId) {
        if (room.gameType !== types_1.GameType.RPS || room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== clientId) {
            return null;
        }
        room.status = types_1.RoomStatus.LOBBY;
        room.rpsState = {
            activePlayers: [],
            queue: [],
            choices: {},
            choicesMade: [],
            scores: {},
            gameWinner: undefined,
            roundWinner: undefined,
        };
        for (const p of room.players) {
            this.privateState.delete(room.code, p.socketId, RPS_CHOICE_KEY);
        }
        room.players.forEach((p) => (p.score = 0));
        return room;
    }
};
exports.RPSService = RPSService;
exports.RPSService = RPSService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], RPSService);
//# sourceMappingURL=rps.service.js.map