"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const types_1 = require("@repo/types");
const card_game_service_1 = require("./card-game.service");
const card_engine_service_1 = require("./card-engine.service");
const pok_deng_preset_1 = require("./presets/pok-deng.preset");
const private_state_service_1 = require("../private-state.service");
const card = (id, rank, suit) => ({ id, rank, suit });
const deckFor = (popOrder) => [
    ...Array.from({ length: 52 - popOrder.length }, (_, index) => card(`filler-${index}`, '2', 'CLUBS')),
    ...[...popOrder].reverse(),
];
describe('Pok Deng preset flow', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        privateState = new private_state_service_1.PrivateStateService();
        const module = await testing_1.Test.createTestingModule({
            providers: [card_game_service_1.CardGameService, { provide: private_state_service_1.PrivateStateService, useValue: privateState }],
        }).compile();
        service = module.get(card_game_service_1.CardGameService);
    });
    const room = (ids = ['p1', 'p2']) => ({
        id: 'room-id',
        code: 'POK123',
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
    const fixedDeal = (popOrder) => {
        service.createDeck = jest.fn(() => deckFor(popOrder));
        service.shuffle = jest.fn((deck) => deck);
    };
    const startRound = (target, popOrder) => {
        fixedDeal(popOrder);
        return service.startPokDeng(target, target.roomHostId);
    };
    const withConfig = (target, partial) => {
        const validated = (0, card_engine_service_1.validateConfig)({ preset: 'POK_DENG', ...partial }, pok_deng_preset_1.POK_DENG_PRESET);
        expect(validated.ok).toBe(true);
        expect(validated.errors).toBeUndefined();
        target.cardGameConfig = validated.config;
        return target;
    };
    it('lets the active player draw a third card before the dealer resolves', () => {
        const result = startRound(room(), [
            card('p1-a', 'A', 'CLUBS'),
            card('p2-a', '2', 'HEARTS'),
            card('p1-b', '4', 'DIAMONDS'),
            card('p2-b', '3', 'SPADES'),
            card('draw-1', '8', 'CLUBS'),
        ]);
        expect(result.cardGameState?.activePlayerId).toBe('p2');
        expect(service.handleAction(result, 'p2', { type: 'DRAW' })).not.toBeNull();
        expect(result.cardGameState?.phase).toBe('RESULT');
        expect(result.cardGameState?.decisions.p2).toBe('DRAWN');
        expect(result.cardGameState?.handCounts.p2).toBe(3);
        expect(result.cardGameState?.handCounts.p1).toBe(2);
        expect(result.cardGameState?.result?.dealerScore).toBe(5);
        expect(result.cardGameChips).toEqual({ p1: 101, p2: 99 });
    });
    it('keeps the dealer on two cards once the dealer has five or more', () => {
        const result = startRound(room(), [
            card('p1-a', 'A', 'CLUBS'),
            card('p2-a', '2', 'HEARTS'),
            card('p1-b', '4', 'DIAMONDS'),
            card('p2-b', '3', 'SPADES'),
        ]);
        expect(service.handleAction(result, 'p2', { type: 'STAND' })).not.toBeNull();
        expect(result.cardGameState?.result?.dealerScore).toBe(5);
        expect(result.cardGameState?.handCounts.p1).toBe(2);
        expect(result.cardGameState?.decisions.p2).toBe('STAND');
        expect(result.cardGameState?.result?.winnerIds).toEqual([]);
        expect(result.cardGameChips).toEqual({ p1: 101, p2: 99 });
    });
    it('ends the round immediately when the stock cannot supply a draw', () => {
        const result = startRound(room(), [
            card('p1-a', 'A', 'CLUBS'),
            card('p2-a', '3', 'HEARTS'),
            card('p1-b', '2', 'DIAMONDS'),
            card('p2-b', '4', 'SPADES'),
            card('draw-1', '5', 'CLUBS'),
        ]);
        privateState.set(result.code, '__card-game-engine__', 'piles', {
            stock: [],
            discards: [],
            reserve: [],
        });
        expect(service.handleAction(result, 'p2', { type: 'DRAW' })).not.toBeNull();
        expect(result.cardGameState?.phase).toBe('RESULT');
        expect(result.cardGameState?.handCounts.p2).toBe(2);
        expect(result.cardGameState?.result?.dealerScore).toBe(3);
        expect(result.cardGameChips).toEqual({ p1: 99, p2: 101 });
    });
    it('settles a three-player round with the outcome multiplier per seat', () => {
        const result = startRound(room(['p1', 'p2', 'p3']), [
            card('p1-a', 'A', 'CLUBS'),
            card('p2-a', '2', 'HEARTS'),
            card('p3-a', '3', 'DIAMONDS'),
            card('p1-b', '4', 'SPADES'),
            card('p2-b', '5', 'CLUBS'),
            card('p3-b', '6', 'HEARTS'),
        ]);
        expect(result.cardGameState?.decisions.p3).toBe('NATURAL');
        expect(result.cardGameState?.activePlayerId).toBe('p2');
        expect(service.handleAction(result, 'p2', { type: 'STAND' })).not.toBeNull();
        expect(result.cardGameState?.result?.dealerScore).toBe(5);
        expect(result.cardGameState?.result?.winnerIds).toEqual(['p2', 'p3']);
        expect(result.cardGameState?.result?.outcomeTags.p3).toBe('POK_9');
        expect(result.cardGameChips).toEqual({ p1: 97, p2: 101, p3: 102 });
    });
    it('falls back to the first seat when the starter policy needs a host pick', () => {
        const target = withConfig(room(), {
            deal: { ...pok_deng_preset_1.POK_DENG_PRESET.defaultConfig.deal, starterPolicy: 'HOST_SELECT' },
        });
        const result = startRound(target, [
            card('p1-a', 'A', 'CLUBS'),
            card('p2-a', '2', 'HEARTS'),
            card('p1-b', '4', 'DIAMONDS'),
            card('p2-b', '3', 'SPADES'),
        ]);
        expect(result.cardGameState?.dealerId).toBe('p1');
    });
    it('pushes chips back when the hands tie and the preset chooses PUSH', () => {
        const target = withConfig(room(), {
            scoring: { ...pok_deng_preset_1.POK_DENG_PRESET.defaultConfig.scoring, tiePolicy: 'PUSH' },
        });
        const result = startRound(target, [
            card('p1-a', 'A', 'CLUBS'),
            card('p2-a', '2', 'HEARTS'),
            card('p1-b', '4', 'DIAMONDS'),
            card('p2-b', '3', 'SPADES'),
        ]);
        expect(service.handleAction(result, 'p2', { type: 'STAND' })).not.toBeNull();
        expect(result.cardGameState?.result?.dealerScore).toBe(5);
        expect(result.cardGameState?.result?.winnerIds).toEqual([]);
        expect(result.cardGameChips).toEqual({ p1: 100, p2: 100 });
    });
});
//# sourceMappingURL=pok-deng.spec.js.map