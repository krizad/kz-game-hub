"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const sam_sip_runtime_1 = require("./sam-sip.runtime");
const sam_sip_preset_1 = require("./presets/sam-sip.preset");
const card = (id, rank, suit) => ({ id, rank, suit });
let padCounter = 0;
const pad = (count) => Array.from({ length: count }, () => card(`pad-${padCounter++}`, 'K', 'CLUBS'));
const room = (ids = ['p1', 'p2']) => ({
    id: 'room-id',
    code: 'SAM123',
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
const runtimeFor = (popOrder) => new sam_sip_runtime_1.SamSipRuntime(new private_state_service_1.PrivateStateService(), () => [...popOrder].reverse());
const config = sam_sip_preset_1.SAM_SIP_DEFAULT_CONFIG;
const singleCardConfig = { ...config, deal: { ...config.deal, cardsPerPlayer: 1 } };
describe('SamSipRuntime', () => {
    it('deals five cards each, flips a discard, and gives the first seat the turn', () => {
        const popOrder = [
            card('p1-a', '3', 'CLUBS'),
            card('p2-a', '5', 'HEARTS'),
            card('p1-b', '6', 'DIAMONDS'),
            card('p2-b', '7', 'SPADES'),
            card('p1-c', '8', 'CLUBS'),
            card('p2-c', '9', 'DIAMONDS'),
            card('p1-d', 'K', 'CLUBS'),
            card('p2-d', 'Q', 'DIAMONDS'),
            card('p1-e', 'J', 'SPADES'),
            card('p2-e', '10', 'HEARTS'),
            card('flip', '2', 'SPADES'),
            ...pad(3),
        ];
        const target = room();
        const runtime = runtimeFor(popOrder);
        expect(runtime.startRound(target, config, ['p1', 'p2'])).toBe(target);
        const state = target.cardGameState;
        expect(state.preset).toBe('SAM_SIP');
        expect(state.handCounts).toEqual({ p1: 5, p2: 5 });
        expect(state.activePlayerId).toBe('p1');
        expect(state.decisions).toEqual({ p1: 'PENDING', p2: 'PENDING' });
        expect(state.discardTop?.id).toBe('flip');
        expect(target.status).toBe(types_1.RoomStatus.PLAYING);
    });
    it('requires a discard after drawing and advances the turn', () => {
        const popOrder = [
            card('p1-a', 'K', 'CLUBS'),
            card('p2-a', 'K', 'HEARTS'),
            card('p1-b', 'K', 'DIAMONDS'),
            card('p2-b', 'K', 'SPADES'),
            card('p1-c', 'K', 'HEARTS'),
            card('p2-c', 'K', 'CLUBS'),
            card('p1-d', 'Q', 'CLUBS'),
            card('p2-d', 'Q', 'HEARTS'),
            card('p1-e', 'Q', 'DIAMONDS'),
            card('p2-e', 'Q', 'SPADES'),
            card('flip', 'K', 'DIAMONDS'),
            card('stock-1', 'Q', 'HEARTS'),
            ...pad(3),
        ];
        const target = room();
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        expect(runtime.handleAction(target, 'p1', { type: 'DISCARD', cardId: 'p1-a' }, config)).toBeNull();
        expect(runtime.handleAction(target, 'p1', { type: 'DRAW' }, config)).not.toBeNull();
        const state = target.cardGameState;
        expect(state.handCounts.p1).toBe(6);
        expect(state.decisions.p1).toBe('DRAWN');
        expect(runtime.handleAction(target, 'p1', { type: 'CLAIM' }, config)).toBeNull();
        expect(runtime.handleAction(target, 'p1', { type: 'DISCARD', cardId: 'p1-a' }, config)).not.toBeNull();
        expect(state.handCounts.p1).toBe(5);
        expect(state.decisions.p1).toBe('DISCARDED');
        expect(state.activePlayerId).toBe('p2');
        expect(state.decisions.p2).toBe('PENDING');
        expect(state.discardTop?.id).toBe('p1-a');
    });
    it('lets the active player claim a discard that completes a sum-to-ten pair', () => {
        const popOrder = [
            card('p1-a', '4', 'CLUBS'),
            card('p2-a', 'K', 'HEARTS'),
            card('p1-b', 'K', 'DIAMONDS'),
            card('p2-b', 'K', 'SPADES'),
            card('p1-c', 'K', 'HEARTS'),
            card('p2-c', 'K', 'CLUBS'),
            card('p1-d', 'K', 'DIAMONDS'),
            card('p2-d', 'Q', 'HEARTS'),
            card('p1-e', 'Q', 'DIAMONDS'),
            card('p2-e', 'Q', 'SPADES'),
            card('flip', '6', 'DIAMONDS'),
            ...pad(2),
        ];
        const target = room();
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        expect(runtime.handleAction(target, 'p1', { type: 'CLAIM' }, config)).not.toBeNull();
        const state = target.cardGameState;
        expect(state.decisions.p1).toBe('CLAIMED');
        expect(state.handCounts.p1).toBe(4);
    });
    it('rejects a claim when the top discard cannot pair', () => {
        const popOrder = [
            card('p1-a', 'K', 'CLUBS'),
            card('p2-a', 'K', 'HEARTS'),
            card('p1-b', 'K', 'DIAMONDS'),
            card('p2-b', 'K', 'SPADES'),
            card('p1-c', 'K', 'HEARTS'),
            card('p2-c', 'K', 'CLUBS'),
            card('p1-d', 'Q', 'CLUBS'),
            card('p2-d', 'Q', 'HEARTS'),
            card('p1-e', 'Q', 'DIAMONDS'),
            card('p2-e', 'Q', 'SPADES'),
            card('flip', '6', 'DIAMONDS'),
            ...pad(2),
        ];
        const target = room();
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        expect(runtime.handleAction(target, 'p1', { type: 'CLAIM' }, config)).toBeNull();
    });
    it('removes a five-five pair automatically after drawing', () => {
        const popOrder = [
            card('p1-a', '5', 'CLUBS'),
            card('p2-a', 'K', 'HEARTS'),
            card('p1-b', '5', 'DIAMONDS'),
            card('p2-b', 'K', 'SPADES'),
            card('p1-c', 'K', 'HEARTS'),
            card('p2-c', 'K', 'CLUBS'),
            card('p1-d', 'K', 'DIAMONDS'),
            card('p2-d', 'Q', 'HEARTS'),
            card('p1-e', 'Q', 'DIAMONDS'),
            card('p2-e', 'Q', 'SPADES'),
            card('flip', 'K', 'DIAMONDS'),
            card('stock-1', '5', 'HEARTS'),
            ...pad(2),
        ];
        const target = room();
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        expect(runtime.handleAction(target, 'p1', { type: 'DRAW' }, config)).not.toBeNull();
        const state = target.cardGameState;
        expect(state.handCounts.p1).toBe(4);
        expect(state.decisions.p1).toBe('DRAWN');
    });
    it('ends the round with the winner when the hand empties', () => {
        const target = room();
        const runtime = runtimeFor([
            card('p1-a', '4', 'CLUBS'),
            card('p2-a', 'K', 'HEARTS'),
            card('flip', '2', 'SPADES'),
            card('stock-1', '6', 'DIAMONDS'),
        ]);
        runtime.startRound(target, singleCardConfig, ['p1', 'p2']);
        expect(runtime.handleAction(target, 'p1', { type: 'DRAW' }, singleCardConfig)).not.toBeNull();
        const state = target.cardGameState;
        expect(state.phase).toBe('RESULT');
        expect(state.activePlayerId).toBeNull();
        expect(target.status).toBe(types_1.RoomStatus.RESULT);
        expect(target.cardGameChips).toEqual({ p1: 101, p2: 99 });
        expect(state.result?.winnerIds).toEqual(['p1']);
        expect(state.result?.placements).toEqual(['p1', 'p2']);
    });
    it('ends the round without a transfer when the stock runs out in a tie', () => {
        const popOrder = [
            card('p1-a', 'K', 'CLUBS'),
            card('p2-a', 'K', 'HEARTS'),
            card('p1-b', 'Q', 'DIAMONDS'),
            card('p2-b', 'Q', 'SPADES'),
            card('p1-c', 'J', 'HEARTS'),
            card('p2-c', 'J', 'CLUBS'),
            card('p1-d', '10', 'DIAMONDS'),
            card('p2-d', '9', 'HEARTS'),
            card('p1-e', '8', 'DIAMONDS'),
            card('p2-e', '7', 'SPADES'),
            card('flip', '6', 'CLUBS'),
        ];
        const target = room();
        const runtime = runtimeFor(popOrder);
        runtime.startRound(target, config, ['p1', 'p2']);
        expect(runtime.handleAction(target, 'p1', { type: 'DRAW' }, config)).not.toBeNull();
        const state = target.cardGameState;
        expect(state.phase).toBe('RESULT');
        expect(state.result?.winnerIds).toEqual([]);
        expect(target.cardGameChips).toEqual({ p1: 100, p2: 100 });
        expect(target.status).toBe(types_1.RoomStatus.RESULT);
    });
});
//# sourceMappingURL=sam-sip.spec.js.map