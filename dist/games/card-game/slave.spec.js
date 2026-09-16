"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const slave_runtime_1 = require("./slave.runtime");
const slave_preset_1 = require("./presets/slave.preset");
const card = (id, rank, suit) => ({
    id,
    rank,
    suit,
});
const pad = (count) => Array.from({ length: count }, (_, index) => card(`pad-${index}`, '5', 'CLUBS'));
const room = (ids = ['p1', 'p2']) => ({
    id: 'room-id',
    code: 'SLAVE1',
    gameType: types_1.GameType.CARD_GAME,
    status: types_1.RoomStatus.LOBBY,
    roomHostId: 'p1',
    createdAt: new Date(),
    config: { hostSelection: 'ROUND_ROBIN', timerMin: 5 },
    players: ids.map((socketId) => ({
        id: socketId,
        socketId,
        name: socketId,
        score: 0,
        roomId: 'room-id',
        connected: true,
    })),
});
describe('SlaveRuntime', () => {
    const runtimeFor = (popOrder) => new slave_runtime_1.SlaveRuntime(new private_state_service_1.PrivateStateService(), () => [...popOrder].reverse());
    const config = slave_preset_1.SLAVE_PRESET.defaultConfig;
    const singleCardConfig = {
        ...config,
        deal: { ...config.deal, cardsPerPlayer: 1 },
    };
    it('deals thirteen cards to each player and lets the 3C holder lead', () => {
        const target = room();
        const popOrder = [card('3-CLUBS', '3', 'CLUBS'), card('5-HEARTS', '5', 'HEARTS'), ...pad(24)];
        const runtime = runtimeFor(popOrder);
        const result = runtime.startRound(target, config, ['p1', 'p2']);
        const state = result.cardGameState;
        expect(state.phase).toBe('PLAYER_TURNS');
        expect(state.dealerId).toBe('p1');
        expect(state.activePlayerId).toBe('p1');
        expect(state.handCounts).toEqual({ p1: 13, p2: 13 });
        expect(state.decisions).toEqual({ p1: 'PENDING', p2: 'PENDING' });
        expect(state.trick).toBeUndefined();
        expect(target.status).toBe(types_1.RoomStatus.PLAYING);
        expect(target.cardGameChips).toEqual({ p1: 100, p2: 100 });
    });
    it('rejects an opening lead without the 3C', () => {
        const target = room();
        const popOrder = [card('3-CLUBS', '3', 'CLUBS'), card('5-HEARTS', '5', 'HEARTS'), ...pad(24)];
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'PLAY', cards: ['pad-0'] }, config);
        expect(result).toBeNull();
    });
    it('accepts an opening single that includes the 3C', () => {
        const target = room();
        const popOrder = [card('3-CLUBS', '3', 'CLUBS'), card('5-HEARTS', '5', 'HEARTS'), ...pad(24)];
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'PLAY', cards: ['3-CLUBS'] }, config);
        expect(result).not.toBeNull();
        const state = result.cardGameState;
        expect(state.trick).toEqual({
            leaderId: 'p1',
            playedById: 'p1',
            cards: [card('3-CLUBS', '3', 'CLUBS')],
            passIds: [],
        });
        expect(state.handCounts.p1).toBe(12);
        expect(state.decisions.p1).toBe('PLAYED');
        expect(state.activePlayerId).toBe('p2');
    });
    it('rejects a pass while the player holds the lead', () => {
        const target = room();
        const popOrder = [card('3-CLUBS', '3', 'CLUBS'), card('5-HEARTS', '5', 'HEARTS'), ...pad(24)];
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'PASS' }, config);
        expect(result).toBeNull();
    });
    it('rejects a follow that does not match the trick size', () => {
        const target = room();
        const popOrder = [
            card('3-CLUBS', '3', 'CLUBS'),
            card('5-HEARTS', '5', 'HEARTS'),
            card('3-DIAMONDS', '3', 'DIAMONDS'),
            card('6-HEARTS', '6', 'HEARTS'),
            ...pad(22),
        ];
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        const lead = runtime.handleAction(target, 'p1', { type: 'PLAY', cards: ['3-CLUBS', '3-DIAMONDS'] }, config);
        expect(lead).not.toBeNull();
        expect(lead.cardGameState.trick.cards).toHaveLength(2);
        const follow = runtime.handleAction(target, 'p2', { type: 'PLAY', cards: ['5-HEARTS'] }, config);
        expect(follow).toBeNull();
    });
    it('rejects an equal-rank follow and accepts a higher single', () => {
        const equalTarget = room();
        const equalOrder = [
            card('3-CLUBS', '3', 'CLUBS'),
            card('3-SPADES', '3', 'SPADES'),
            card('3-DIAMONDS', '3', 'DIAMONDS'),
            card('3-HEARTS', '3', 'HEARTS'),
            ...pad(22),
        ];
        const equalRuntime = runtimeFor(equalOrder);
        equalRuntime.startRound(equalTarget, config, ['p1', 'p2']);
        equalRuntime.handleAction(equalTarget, 'p1', { type: 'PLAY', cards: ['3-CLUBS', '3-DIAMONDS'] }, config);
        const equalFollow = equalRuntime.handleAction(equalTarget, 'p2', { type: 'PLAY', cards: ['3-SPADES', '3-HEARTS'] }, config);
        expect(equalFollow).toBeNull();
        const higherTarget = room();
        const higherOrder = [
            card('3-CLUBS', '3', 'CLUBS'),
            card('4-HEARTS', '4', 'HEARTS'),
            card('3-DIAMONDS', '3', 'DIAMONDS'),
            card('5-SPADES', '5', 'SPADES'),
            ...pad(22),
        ];
        const higherRuntime = runtimeFor(higherOrder);
        higherRuntime.startRound(higherTarget, config, ['p1', 'p2']);
        higherRuntime.handleAction(higherTarget, 'p1', { type: 'PLAY', cards: ['3-CLUBS'] }, config);
        const higherFollow = higherRuntime.handleAction(higherTarget, 'p2', { type: 'PLAY', cards: ['4-HEARTS'] }, config);
        expect(higherFollow).not.toBeNull();
        expect(higherFollow.cardGameState.trick.playedById).toBe('p2');
    });
    it('clears the trick when every other player passes', () => {
        const target = room();
        const popOrder = [card('3-CLUBS', '3', 'CLUBS'), card('5-HEARTS', '5', 'HEARTS'), ...pad(24)];
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        runtime.handleAction(target, 'p1', { type: 'PLAY', cards: ['3-CLUBS'] }, config);
        const result = runtime.handleAction(target, 'p2', { type: 'PASS' }, config);
        expect(result).not.toBeNull();
        const state = result.cardGameState;
        expect(state.trick).toEqual({ leaderId: 'p1', playedById: null, cards: [], passIds: [] });
        expect(state.dealerId).toBe('p1');
        expect(state.activePlayerId).toBe('p1');
        expect(state.decisions).toEqual({ p1: 'PENDING', p2: 'PENDING' });
    });
    it('ends the round when a player runs out of cards', () => {
        const target = room();
        const popOrder = [card('3-CLUBS', '3', 'CLUBS'), card('5-HEARTS', '5', 'HEARTS')];
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, singleCardConfig, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'PLAY', cards: ['3-CLUBS'] }, singleCardConfig);
        expect(result).not.toBeNull();
        const state = result.cardGameState;
        expect(state.phase).toBe('RESULT');
        expect(state.activePlayerId).toBeNull();
        expect(target.status).toBe(types_1.RoomStatus.RESULT);
        expect(target.cardGameChips).toEqual({ p1: 101, p2: 99 });
        expect(state.result.winnerIds).toEqual(['p1']);
        expect(state.result.placements).toEqual(['p1', 'p2']);
        expect(state.result.revealedHands.p1).toHaveLength(0);
        expect(state.result.revealedHands.p2).toHaveLength(1);
    });
});
//# sourceMappingURL=slave.spec.js.map