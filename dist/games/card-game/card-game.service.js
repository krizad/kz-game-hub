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
exports.CardGameService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const card_engine_service_1 = require("./card-engine.service");
const pok_deng_preset_1 = require("./presets/pok-deng.preset");
const presets_1 = require("./presets");
const slave_runtime_1 = require("./slave.runtime");
const PRIVATE_KEY = 'cardGame';
const ENGINE_SOCKET_ID = '__card-game-engine__';
const PILES_KEY = 'piles';
let CardGameService = class CardGameService {
    constructor(privateStateService) {
        this.privateStateService = privateStateService;
        this.cardRuntimes = {
            SLAVE: new slave_runtime_1.SlaveRuntime(privateStateService),
        };
    }
    startCardRound(room, requesterId) {
        if (room.gameType !== types_1.GameType.CARD_GAME || room.roomHostId !== requesterId)
            return null;
        if (room.status !== types_1.RoomStatus.LOBBY && room.status !== types_1.RoomStatus.RESULT)
            return null;
        const presetId = room.cardGameConfig?.preset ?? 'POK_DENG';
        const runtime = this.cardRuntimes[presetId];
        if (runtime) {
            const preset = presets_1.CARD_GAME_PRESETS[presetId];
            const players = room.players.filter((player) => !player.isViewer && player.connected !== false);
            if (players.length < preset.minPlayers || players.length > preset.maxPlayers)
                return null;
            const started = runtime.startRound(room, this.configFor(room), players.map((player) => player.socketId));
            if (started) {
                room.cardGameLog = [];
                this.refreshTurnDeadline(room);
            }
            return started;
        }
        const startedPokDeng = this.startPokDeng(room, requesterId);
        if (startedPokDeng)
            room.cardGameLog = [];
        return startedPokDeng;
    }
    startPokDeng(room, requesterId) {
        if (room.gameType !== types_1.GameType.CARD_GAME || room.roomHostId !== requesterId)
            return null;
        const players = room.players.filter((player) => !player.isViewer && player.connected !== false);
        if (players.length < pok_deng_preset_1.POK_DENG_PRESET.minPlayers || players.length > pok_deng_preset_1.POK_DENG_PRESET.maxPlayers)
            return null;
        const config = this.configFor(room);
        const playerOrder = players.map((player) => player.socketId);
        const dealerId = (0, card_engine_service_1.resolveStarter)(config.deal.starterPolicy, {
            playerOrder,
            previousStarterId: room.cardGameState?.dealerId,
            previousWinnerId: room.cardGameState?.result?.winnerIds[0],
        }) ?? playerOrder[0];
        const dealt = (0, card_engine_service_1.dealRound)(this.shuffle(this.createDeck(config.deck)), playerOrder, config.deal, config.piles.reserveSize);
        if (!dealt.ok || !dealt.hands)
            return null;
        const hands = dealt.hands;
        this.setPiles(room.code, {
            stock: dealt.stock ?? [],
            discards: [],
            reserve: dealt.reserve ?? [],
        });
        const chipBalances = room.cardGameChips ?? {};
        room.cardGameChips = chipBalances;
        for (const id of playerOrder) {
            chipBalances[id] = chipBalances[id] ?? config.scoring.startingChips;
        }
        const decisions = {};
        for (const id of playerOrder) {
            const natural = (0, card_engine_service_1.mod10Score)(hands[id]) >= 8;
            decisions[id] = id === dealerId || natural ? 'NATURAL' : 'PENDING';
            this.setHand(room.code, id, hands[id]);
        }
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: pok_deng_preset_1.POK_DENG_PRESET.id,
            phase: 'PLAYER_TURNS',
            dealerId,
            activePlayerId: null,
            playerOrder,
            hands,
            chips: Object.fromEntries(playerOrder.map((id) => [id, chipBalances[id]])),
            decisions,
        }, config.visibility);
        room.status = types_1.RoomStatus.PLAYING;
        if ((0, card_engine_service_1.mod10Score)(hands[dealerId]) >= 8) {
            this.resolve(room, config);
            return room;
        }
        this.advance(room);
        return room;
    }
    handleAction(room, socketId, action) {
        const state = room.cardGameState;
        if (!state || room.gameType !== types_1.GameType.CARD_GAME)
            return null;
        if (!action || typeof action !== 'object' || typeof action.type !== 'string')
            return null;
        const presetId = room.cardGameConfig?.preset ?? 'POK_DENG';
        const runtime = this.cardRuntimes[presetId];
        if (runtime) {
            if (action.type === 'NEXT_ROUND') {
                if (state.phase !== 'RESULT' || socketId !== room.roomHostId)
                    return null;
                return this.startCardRound(room, room.roomHostId);
            }
            const handled = runtime.handleAction(room, socketId, action, this.configFor(room));
            if (handled) {
                const exhaustedDraw = action.type === 'DRAW' && room.cardGameState?.decisions[socketId] === 'PENDING';
                if (!exhaustedDraw)
                    this.appendLog(room, socketId, action);
                this.refreshTurnDeadline(room);
            }
            return handled;
        }
        if (action.type === 'NEXT_ROUND') {
            if (state.phase !== 'RESULT' || socketId !== room.roomHostId)
                return null;
            return this.startPokDeng(room, room.roomHostId);
        }
        if (room.status !== types_1.RoomStatus.PLAYING)
            return null;
        if (state.phase !== 'PLAYER_TURNS' || state.activePlayerId !== socketId)
            return null;
        const config = this.configFor(room);
        if (!config.actions.allowed.includes(action.type))
            return null;
        const hand = this.getHand(room.code, socketId);
        if (!hand)
            return null;
        if (action.type === 'DRAW') {
            const drawn = (0, card_engine_service_1.drawFromStacks)(this.pilesFor(room.code), config.piles);
            if (!drawn.ok || !drawn.card) {
                this.resolve(room, config);
                return room;
            }
            this.setPiles(room.code, drawn.stacks);
            hand.push(drawn.card);
            this.setHand(room.code, socketId, hand);
            state.handCounts[socketId] = hand.length;
            state.decisions[socketId] = 'DRAWN';
        }
        else {
            state.decisions[socketId] = 'STAND';
        }
        this.appendLog(room, socketId, action);
        this.advance(room);
        return room;
    }
    cancelRound(room) {
        const state = room.cardGameState;
        if (!state || room.gameType !== types_1.GameType.CARD_GAME)
            return;
        for (const socketId of state.playerOrder) {
            this.privateStateService.delete(room.code, socketId, PRIVATE_KEY);
        }
        this.privateStateService.delete(room.code, ENGINE_SOCKET_ID, PILES_KEY);
        room.cardGameState = undefined;
        room.status = types_1.RoomStatus.LOBBY;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.dealerId === oldSocketId)
            state.dealerId = newSocketId;
        if (state.activePlayerId === oldSocketId)
            state.activePlayerId = newSocketId;
        state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
        state.handCounts = this.remapRecord(state.handCounts, oldSocketId, newSocketId);
        state.chips = this.remapRecord(state.chips, oldSocketId, newSocketId);
        state.decisions = this.remapRecord(state.decisions, oldSocketId, newSocketId);
        if (state.trick) {
            if (state.trick.leaderId === oldSocketId)
                state.trick.leaderId = newSocketId;
            if (state.trick.playedById === oldSocketId)
                state.trick.playedById = newSocketId;
            state.trick.passIds = state.trick.passIds.map((id) => id === oldSocketId ? newSocketId : id);
        }
        if (state.result) {
            state.result.playerScores = this.remapRecord(state.result.playerScores, oldSocketId, newSocketId);
            state.result.outcomeTags = this.remapRecord(state.result.outcomeTags, oldSocketId, newSocketId);
            state.result.winnerIds = state.result.winnerIds.map((id) => id === oldSocketId ? newSocketId : id);
            state.result.revealedHands = this.remapRecord(state.result.revealedHands, oldSocketId, newSocketId);
            if (state.result.placements) {
                state.result.placements = state.result.placements.map((id) => id === oldSocketId ? newSocketId : id);
            }
        }
    }
    appendLog(room, socketId, action) {
        const kinds = {
            DRAW: 'DREW',
            STAND: 'STOOD',
            PLAY: 'PLAYED',
            PASS: 'PASSED',
            CLAIM: 'CLAIMED',
            DISCARD: 'DISCARDED',
            TAKE_CARD: 'TOOK',
        };
        const kind = kinds[action.type];
        if (!kind)
            return;
        const log = room.cardGameLog ?? [];
        const entry = { actorId: socketId, kind };
        if (action.type === 'PLAY')
            entry.count = action.cards.length;
        log.push(entry);
        if (log.length > 40)
            log.splice(0, log.length - 40);
        room.cardGameLog = log;
    }
    configFor(room) {
        const preset = (0, presets_1.presetForConfig)(room.cardGameConfig);
        const validated = (0, card_engine_service_1.validateConfig)(room.cardGameConfig, preset);
        return validated.config ?? preset.defaultConfig;
    }
    refreshTurnDeadline(room) {
        const state = room.cardGameState;
        if (!state)
            return;
        if (state.phase !== 'PLAYER_TURNS' || !state.activePlayerId) {
            state.turnDeadline = null;
            return;
        }
        const { timeoutSeconds } = this.configFor(room).actions;
        state.turnDeadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : null;
    }
    resolveAutoAction(room) {
        const state = room.cardGameState;
        if (!state || state.phase !== 'PLAYER_TURNS' || !state.activePlayerId)
            return null;
        const config = this.configFor(room);
        const runtime = this.cardRuntimes[state.preset];
        const action = runtime
            ? runtime.autoAction(room, state.activePlayerId, config)
            : (0, card_engine_service_1.autoActionFor)(config.actions);
        return action ? { playerId: state.activePlayerId, action } : null;
    }
    advance(room) {
        const state = room.cardGameState;
        const config = this.configFor(room);
        const next = state.playerOrder.find((id) => id !== state.dealerId && state.decisions[id] === 'PENDING');
        if (next) {
            state.activePlayerId = next;
            this.refreshTurnDeadline(room);
            return;
        }
        const dealerHand = this.getHand(room.code, state.dealerId) ?? [];
        if ((0, card_engine_service_1.mod10Score)(dealerHand) < 5) {
            const drawn = (0, card_engine_service_1.drawFromStacks)(this.pilesFor(room.code), config.piles);
            if (drawn.ok && drawn.card) {
                dealerHand.push(drawn.card);
                this.setHand(room.code, state.dealerId, dealerHand);
                this.setPiles(room.code, drawn.stacks);
                state.handCounts[state.dealerId] = dealerHand.length;
            }
        }
        this.resolve(room, config);
    }
    resolve(room, config) {
        const state = room.cardGameState;
        const hands = {};
        for (const id of state.playerOrder)
            hands[id] = this.getHand(room.code, id) ?? [];
        const outcome = (0, card_engine_service_1.settleMod10Showdown)({
            playerOrder: state.playerOrder,
            dealerId: state.dealerId,
            hands,
            tiePolicy: config.scoring.tiePolicy,
            baseStake: config.scoring.baseStake,
            multipliers: config.scoring.multipliers,
        });
        const chips = { ...state.chips };
        for (const id of state.playerOrder) {
            chips[id] = (chips[id] ?? 0) + (outcome.deltas[id] ?? 0);
        }
        room.cardGameChips = { ...room.cardGameChips, ...chips };
        room.cardGameState = (0, card_engine_service_1.toPublicState)({
            preset: pok_deng_preset_1.POK_DENG_PRESET.id,
            phase: 'RESULT',
            dealerId: state.dealerId,
            activePlayerId: null,
            playerOrder: state.playerOrder,
            hands,
            chips,
            decisions: state.decisions,
            result: {
                dealerScore: outcome.dealerScore,
                playerScores: outcome.scores,
                outcomeTags: outcome.outcomeTags,
                winnerIds: outcome.winnerIds,
                revealedHands: outcome.revealedHands,
            },
        }, config.visibility);
        room.status = types_1.RoomStatus.RESULT;
    }
    createDeck(policy) {
        return (0, card_engine_service_1.createDeck)(policy);
    }
    shuffle(deck) {
        return (0, card_engine_service_1.shuffleDeck)(deck);
    }
    setHand(roomCode, socketId, hand) {
        this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
            preset: 'POK_DENG',
            hand,
        });
    }
    getHand(roomCode, socketId) {
        return this.privateStateService.get(roomCode, socketId, PRIVATE_KEY)
            ?.hand;
    }
    setPiles(roomCode, piles) {
        this.privateStateService.set(roomCode, ENGINE_SOCKET_ID, PILES_KEY, piles);
    }
    pilesFor(roomCode) {
        return (this.privateStateService.get(roomCode, ENGINE_SOCKET_ID, PILES_KEY) ?? {
            stock: [],
            discards: [],
            reserve: [],
        });
    }
    remapRecord(record, oldKey, newKey) {
        if (!(oldKey in record))
            return record;
        const { [oldKey]: value, ...remaining } = record;
        return { ...remaining, [newKey]: value };
    }
};
exports.CardGameService = CardGameService;
exports.CardGameService = CardGameService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], CardGameService);
//# sourceMappingURL=card-game.service.js.map