"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const old_maid_runtime_1 = require("./old-maid.runtime");
const old_maid_preset_1 = require("./presets/old-maid.preset");
const card = (id, rank, suit) => ({
    id,
    rank,
    suit,
});
const room = (ids = ['p1', 'p2']) => ({
    id: 'room-id',
    code: 'OLD123',
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
const runtimeFor = (deck) => new old_maid_runtime_1.OldMaidRuntime(new private_state_service_1.PrivateStateService(), () => [...deck]);
const FOUR_CARDS = [
    card('2C', '2', 'CLUBS'),
    card('4D', '4', 'DIAMONDS'),
    card('6H', '6', 'HEARTS'),
    card('8S', '8', 'SPADES'),
];
describe('OldMaidRuntime', () => {
    it('deals every card round-robin and lets the first holder lead', () => {
        const target = room();
        const runtime = runtimeFor(FOUR_CARDS);
        expect(runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2'])).toBe(target);
        expect(target.status).toBe(types_1.RoomStatus.PLAYING);
        expect(target.cardGameState?.activePlayerId).toBe('p1');
        expect(target.cardGameState?.handCounts).toEqual({ p1: 2, p2: 2 });
    });
    it('rejects a take from a player who is not in turn', () => {
        const target = room();
        const runtime = runtimeFor(FOUR_CARDS);
        runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p2', { type: 'TAKE_CARD', index: 0 }, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG);
        expect(result).toBeNull();
    });
    it('rejects an out-of-range pick', () => {
        const target = room();
        const runtime = runtimeFor(FOUR_CARDS);
        runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'TAKE_CARD', index: 2 }, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG);
        expect(result).toBeNull();
    });
    it('rejects actions other than take-card', () => {
        const target = room();
        const runtime = runtimeFor(FOUR_CARDS);
        runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'DRAW' }, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG);
        expect(result).toBeNull();
    });
    it('ends the round when only one player still holds cards', () => {
        const target = room();
        const runtime = runtimeFor([
            card('QC', 'Q', 'CLUBS'),
            card('QD', 'Q', 'DIAMONDS'),
            card('QH', 'Q', 'HEARTS'),
        ]);
        runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
        expect(target.status).toBe(types_1.RoomStatus.RESULT);
        expect(target.cardGameState?.phase).toBe('RESULT');
        expect(target.cardGameState?.result?.winnerIds).toEqual(['p1']);
        expect(target.cardGameState?.result?.placements).toEqual(['p1', 'p2']);
        expect(target.cardGameChips).toEqual({ p1: 101, p2: 99 });
    });
    it('removes matching pairs after a take and hands the turn on', () => {
        const target = room();
        const runtime = runtimeFor([
            card('2C', '2', 'CLUBS'),
            card('3D', '3', 'DIAMONDS'),
            card('4H', '4', 'HEARTS'),
            card('2S', '2', 'SPADES'),
        ]);
        runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'TAKE_CARD', index: 1 }, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG);
        expect(result).toBe(target);
        expect(target.cardGameState?.handCounts).toEqual({ p1: 1, p2: 1 });
        expect(target.cardGameState?.decisions.p1).toBe('TOOK');
        expect(target.cardGameState?.activePlayerId).toBe('p2');
    });
    it('makes the last holder pay when another player sheds every card', () => {
        const target = room();
        const runtime = runtimeFor([
            card('2C', '2', 'CLUBS'),
            card('4D', '4', 'DIAMONDS'),
            card('6H', '6', 'HEARTS'),
        ]);
        runtime.startRound(target, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG, ['p1', 'p2']);
        const result = runtime.handleAction(target, 'p1', { type: 'TAKE_CARD', index: 0 }, old_maid_preset_1.OLD_MAID_DEFAULT_CONFIG);
        expect(result).toBe(target);
        expect(target.status).toBe(types_1.RoomStatus.RESULT);
        expect(target.cardGameChips).toEqual({ p1: 99, p2: 101 });
        expect(target.cardGameState?.result?.winnerIds).toEqual(['p2']);
        expect(target.cardGameState?.result?.placements).toEqual(['p2', 'p1']);
        expect(target.cardGameState?.handCounts.p1).toBe(3);
    });
});
//# sourceMappingURL=old-maid.spec.js.map