"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const types_1 = require("@repo/types");
const card_game_service_1 = require("./card-game.service");
const pok_deng_preset_1 = require("./presets/pok-deng.preset");
const private_state_service_1 = require("../private-state.service");
const card = (id, rank, suit) => ({
    id,
    rank,
    suit,
});
const deckFor = (popOrder) => [
    ...Array.from({ length: 52 - popOrder.length }, (_, index) => card(`filler-${index}`, '2', 'CLUBS')),
    ...[...popOrder].reverse(),
];
const DEAL_P1_BEATS_P2 = [
    card('p1-a', 'A', 'CLUBS'),
    card('p2-a', '3', 'HEARTS'),
    card('p1-b', '2', 'DIAMONDS'),
    card('p2-b', '4', 'SPADES'),
    card('draw-1', '5', 'CLUBS'),
];
const DEAL_P2_POK_9 = [
    card('p1-a', 'A', 'CLUBS'),
    card('p2-a', '9', 'HEARTS'),
    card('p1-b', '4', 'DIAMONDS'),
    card('p2-b', 'K', 'SPADES'),
];
describe('CardGameService', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        privateState = new private_state_service_1.PrivateStateService();
        const module = await testing_1.Test.createTestingModule({
            providers: [card_game_service_1.CardGameService, { provide: private_state_service_1.PrivateStateService, useValue: privateState }],
        }).compile();
        service = module.get(card_game_service_1.CardGameService);
    });
    const room = () => ({
        id: 'room-id',
        code: 'POK123',
        gameType: types_1.GameType.CARD_GAME,
        status: types_1.RoomStatus.LOBBY,
        roomHostId: 'p1',
        createdAt: new Date(),
        config: { hostSelection: 'ROUND_ROBIN', timerMin: 5 },
        players: ['p1', 'p2'].map((socketId) => ({
            id: socketId,
            socketId,
            name: socketId,
            score: 0,
            roomId: 'room-id',
            connected: true,
        })),
    });
    const fixedDeal = (popOrder = DEAL_P1_BEATS_P2) => {
        service.createDeck = jest.fn(() => deckFor(popOrder));
        service.shuffle = jest.fn((deck) => deck);
    };
    const startRound = (target, popOrder) => {
        fixedDeal(popOrder);
        return service.startPokDeng(target, target.roomHostId);
    };
    const finishRound = (target) => {
        const active = target.cardGameState.activePlayerId;
        expect(service.handleAction(target, active, { type: 'STAND' })).not.toBeNull();
    };
    it('deals hidden hands without leaking them into public room state', () => {
        const result = startRound(room());
        expect(result.status).toBe(types_1.RoomStatus.PLAYING);
        expect(result.cardGameState?.phase).toBe('PLAYER_TURNS');
        expect(result.cardGameState?.activePlayerId).toBe('p2');
        expect(result.cardGameState?.handCounts).toEqual({ p1: 2, p2: 2 });
        expect(JSON.stringify(result)).not.toContain('CLUBS');
        expect(privateState.get(result.code, 'p1', 'cardGame')).toBeDefined();
        expect(privateState.get(result.code, 'p2', 'cardGame')).toBeDefined();
    });
    it('rejects actions from a player who does not own the active turn', () => {
        const result = startRound(room());
        const active = result.cardGameState.activePlayerId;
        const other = active === 'p1' ? 'p2' : 'p1';
        expect(service.handleAction(result, other, { type: 'STAND' })).toBeNull();
    });
    it('refuses to start a round while a card round is already in progress', () => {
        const target = startRound(room());
        expect(target.status).toBe(types_1.RoomStatus.PLAYING);
        expect(service.startCardRound(target, target.roomHostId)).toBeNull();
        finishRound(target);
        expect(target.status).toBe(types_1.RoomStatus.RESULT);
        expect(service.startCardRound(target, target.roomHostId)).not.toBeNull();
    });
    it('rejects malformed actions without throwing', () => {
        const target = startRound(room());
        expect(service.handleAction(target, 'p1', null)).toBeNull();
        expect(service.handleAction(target, 'p1', {})).toBeNull();
    });
    it('stamps a turn deadline when the action policy has a timeout', () => {
        const target = room();
        target.cardGameConfig = {
            ...pok_deng_preset_1.POK_DENG_PRESET.defaultConfig,
            actions: { allowed: ['DRAW', 'STAND'], timeoutSeconds: 20, autoAction: 'STAND' },
        };
        startRound(target);
        expect(target.cardGameState?.activePlayerId).toBe('p2');
        expect(typeof target.cardGameState?.turnDeadline).toBe('number');
        finishRound(target);
        expect(target.cardGameState?.turnDeadline ?? null).toBeNull();
    });
    it('deals the first round to the first seated player and rotates the dealer', () => {
        const result = startRound(room());
        expect(result.cardGameState?.dealerId).toBe('p1');
        finishRound(result);
        const second = service.handleAction(result, 'p1', { type: 'NEXT_ROUND' });
        expect(second.cardGameState?.dealerId).toBe('p2');
    });
    it('keeps chip balances across rounds for the whole match', () => {
        const result = startRound(room());
        finishRound(result);
        expect(result.status).toBe(types_1.RoomStatus.RESULT);
        expect(result.cardGameState?.phase).toBe('RESULT');
        expect(result.cardGameState?.handCounts.p1).toBe(3);
        expect(result.cardGameChips).toEqual({ p1: 101, p2: 99 });
        expect(result.cardGameState?.chips).toEqual({ p1: 101, p2: 99 });
        const second = service.handleAction(result, 'p1', { type: 'NEXT_ROUND' });
        expect(second.cardGameChips).toEqual({ p1: 101, p2: 99 });
        expect(second.cardGameState?.chips).toEqual({ p1: 101, p2: 99 });
    });
    it('settles a natural Pok 9 with the preset multiplier', () => {
        const result = startRound(room(), DEAL_P2_POK_9);
        expect(result.cardGameState?.phase).toBe('RESULT');
        expect(result.cardGameState?.result?.outcomeTags.p2).toBe('POK_9');
        expect(result.cardGameState?.result?.winnerIds).toEqual(['p2']);
        expect(result.cardGameState?.result?.dealerScore).toBe(5);
        expect(result.cardGameChips).toEqual({ p1: 98, p2: 102 });
    });
    it('accepts NEXT_ROUND only from the host and only after a result', () => {
        const result = startRound(room());
        expect(service.handleAction(result, 'p1', { type: 'NEXT_ROUND' })).toBeNull();
        finishRound(result);
        expect(service.handleAction(result, 'p2', { type: 'NEXT_ROUND' })).toBeNull();
        expect(service.handleAction(result, 'p1', { type: 'NEXT_ROUND' })).not.toBeNull();
    });
    it('allows balances to go negative instead of clamping them', () => {
        const target = room();
        target.cardGameChips = { p1: 0, p2: 0 };
        startRound(target);
        finishRound(target);
        expect(target.cardGameChips).toEqual({ p1: 1, p2: -1 });
    });
    it('cancels the round, clears private hands, and keeps balances', () => {
        const result = startRound(room());
        const balances = { ...result.cardGameChips };
        service.cancelRound(result);
        expect(result.cardGameState).toBeUndefined();
        expect(result.status).toBe(types_1.RoomStatus.LOBBY);
        expect(result.cardGameChips).toEqual(balances);
        expect(privateState.get(result.code, 'p1', 'cardGame')).toBeUndefined();
        expect(privateState.get(result.code, 'p2', 'cardGame')).toBeUndefined();
        expect(privateState.get(result.code, '__card-game-engine__', 'piles')).toBeUndefined();
    });
    it('remaps every public state reference on reconnect', () => {
        const result = startRound(room());
        finishRound(result);
        result.cardGameChips.p1 = 37;
        result.cardGameState.chips.p1 = 37;
        service.remapSocketId(result.cardGameState, 'p1', 'p1-new');
        expect(result.cardGameState.playerOrder).toContain('p1-new');
        expect(result.cardGameState.chips['p1-new']).toBe(37);
        expect(result.cardGameState.chips['p2']).toBe(99);
        expect(result.cardGameState.result.outcomeTags['p1-new']).toBeDefined();
        expect(result.cardGameState.result.outcomeTags['p1']).toBeUndefined();
    });
});
//# sourceMappingURL=card-game.service.spec.js.map