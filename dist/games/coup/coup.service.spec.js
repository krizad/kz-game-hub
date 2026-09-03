"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const coup_service_1 = require("./coup.service");
const private_state_service_1 = require("../private-state.service");
const room_timer_service_1 = require("../room-timer.service");
const types_1 = require("@repo/types");
describe('CoupService (01 scaffold)', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                coup_service_1.CoupService,
                private_state_service_1.PrivateStateService,
                { provide: room_timer_service_1.RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
            ],
        }).compile();
        service = module.get(coup_service_1.CoupService);
        privateState = module.get(private_state_service_1.PrivateStateService);
    });
    function makeRoom(overrides = {}) {
        const players = [
            { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true },
            { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true },
            { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true },
        ];
        return {
            id: 'r1',
            gameType: types_1.GameType.COUP,
            code: 'ABC123',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 's1',
            players,
            createdAt: new Date(),
            config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
            ...overrides,
        };
    }
    it('startGame deals 2 Influence and 2 Coin per player and enters PLAYING', () => {
        const room = makeRoom();
        const result = service.startGame(room, 's1');
        expect(result).not.toBeNull();
        expect(result.status).toBe(types_1.RoomStatus.PLAYING);
        expect(result.coupState).toBeDefined();
        expect(result.coupState.phase).toBe('PLAYING');
        expect(result.coupState.currentTurn).toBe('s1');
        expect(Object.keys(result.coupState.coins)).toHaveLength(3);
        for (const sid of ['s1', 's2', 's3']) {
            expect(result.coupState.coins[sid]).toBe(2);
            expect(result.coupState.influences[sid].count).toBe(2);
            expect(result.coupState.influences[sid].revealed).toEqual([]);
            const hand = privateState.get(room.code, sid, 'coupHand');
            expect(hand).toHaveLength(2);
        }
        expect(result.coupState.deck).toHaveLength(9);
        expect(result.coupState.deadPile).toEqual([]);
    });
    it('startGame fails if not host or not enough players or wrong status', () => {
        const room = makeRoom();
        expect(service.startGame(room, 's2')).toBeNull();
        const room2 = makeRoom({ players: makeRoom().players.slice(0, 2) });
        expect(service.startGame(room2, 's1')).toBeNull();
        const room3 = makeRoom({ status: types_1.RoomStatus.PLAYING });
        expect(service.startGame(room3, 's1')).toBeNull();
    });
    it('resetGame clears coupState and returns to LOBBY', () => {
        const room = makeRoom();
        service.startGame(room, 's1');
        expect(room.coupState).toBeDefined();
        const reset = service.resetGame(room, 's1');
        expect(reset).not.toBeNull();
        expect(reset.status).toBe(types_1.RoomStatus.LOBBY);
        expect(reset.coupState).toBeUndefined();
        for (const sid of ['s1', 's2', 's3']) {
            expect(privateState.get(room.code, sid, 'coupHand')).toBeUndefined();
        }
    });
    it('remapSocketId moves coins/influences/currentTurn', () => {
        const room = makeRoom();
        service.startGame(room, 's1');
        const state = room.coupState;
        const oldCoins = state.coins['s2'];
        service.remapSocketId(state, 's2', 's2-new');
        expect(state.coins['s2-new']).toBe(oldCoins);
        expect(state.coins['s2']).toBeUndefined();
        expect(state.influences['s2-new']).toBeDefined();
        expect(state.influences['s2']).toBeUndefined();
        state.currentTurn = 's2';
        service.remapSocketId(state, 's2', 's2-new2');
        const state2 = { ...state, currentTurn: 's2-new' };
        service.remapSocketId(state2, 's2-new', 's2-final');
        expect(state2.currentTurn).toBe('s2-final');
    });
});
describe('CoupService (02 core economy)', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                coup_service_1.CoupService,
                private_state_service_1.PrivateStateService,
                { provide: room_timer_service_1.RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
            ],
        }).compile();
        service = module.get(coup_service_1.CoupService);
        privateState = module.get(private_state_service_1.PrivateStateService);
    });
    function makeRoom(overrides = {}) {
        const players = [
            { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true },
            { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true },
            { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true },
        ];
        return {
            id: 'r1',
            gameType: types_1.GameType.COUP,
            code: 'ABC123',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 's1',
            players,
            createdAt: new Date(),
            config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
            ...overrides,
        };
    }
    function startRoom() {
        const room = makeRoom();
        service.startGame(room, 's1');
        return room;
    }
    it('Income gives +1 and advances turn', () => {
        const room = startRoom();
        const r = service.declareAction(room, 's1', types_1.CoupActionType.INCOME);
        expect(r).not.toBeNull();
        expect(r.coupState.coins['s1']).toBe(3);
        expect(r.coupState.currentTurn).toBe('s2');
    });
    it('Foreign Aid gives +2 after block window (no block)', () => {
        const room = startRoom();
        service.declareAction(room, 's1', types_1.CoupActionType.INCOME);
        const r2 = service.declareAction(room, 's2', types_1.CoupActionType.FOREIGN_AID);
        expect(r2).not.toBeNull();
        expect(r2.coupState.phase).toBe('AWAITING_BLOCK');
        const r3 = service.handleBlockTimeoutForRoom(room);
        expect(r3.coupState.coins['s2']).toBe(4);
        expect(r3.coupState.currentTurn).toBe('s3');
    });
    it('Tax opens challenge window and resolves to +3 after timeout', () => {
        const room = startRoom();
        const r = service.declareAction(room, 's1', types_1.CoupActionType.TAX);
        expect(r).not.toBeNull();
        expect(r.coupState.phase).toBe('AWAITING_CHALLENGE');
        expect(r.coupState.pendingAction?.type).toBe(types_1.CoupActionType.TAX);
        expect(r.coupState.challengeWindowDeadline).toBeDefined();
        expect(r.coupState.coins['s1']).toBe(2);
        const r2 = service.handleChallengeTimeoutForRoom(room);
        expect(r2).not.toBeNull();
        expect(r2.coupState.coins['s1']).toBe(5);
        expect(r2.coupState.phase).toBe('PLAYING');
        expect(r2.coupState.currentTurn).toBe('s2');
    });
    it('Coup pays 7 and makes target lose 1 influence with deadPile', () => {
        const room = startRoom();
        room.coupState.coins['s1'] = 7;
        const beforeDead = room.coupState.deadPile.length;
        const handBefore = [...(privateState.get(room.code, 's2', 'coupHand'))];
        const r = service.declareAction(room, 's1', types_1.CoupActionType.COUP, 's2');
        expect(r).not.toBeNull();
        expect(r.coupState.coins['s1']).toBe(0);
        expect(r.coupState.influences['s2'].count).toBe(1);
        expect(r.coupState.deadPile.length).toBe(beforeDead + 1);
        expect(r.coupState.influences['s2'].revealed.length).toBe(1);
        expect(privateState.get(room.code, 's2', 'coupHand').length).toBe(1);
        expect(r.coupState.currentTurn).toBe('s2');
    });
    it('Coup fails if not enough coins or not your turn', () => {
        const room = startRoom();
        expect(service.declareAction(room, 's2', types_1.CoupActionType.INCOME)).toBeNull();
        expect(service.declareAction(room, 's1', types_1.CoupActionType.COUP, 's2')).toBeNull();
        room.coupState.coins['s1'] = 7;
        expect(service.declareAction(room, 's1', types_1.CoupActionType.COUP, 's9')).toBeNull();
        expect(service.declareAction(room, 's1', types_1.CoupActionType.COUP)).toBeNull();
    });
    it('forces Coup when 10+ coins', () => {
        const room = startRoom();
        room.coupState.coins['s1'] = 10;
        expect(service.declareAction(room, 's1', types_1.CoupActionType.INCOME)).toBeNull();
        expect(service.declareAction(room, 's1', types_1.CoupActionType.TAX)).toBeNull();
        expect(service.declareAction(room, 's1', types_1.CoupActionType.FOREIGN_AID)).toBeNull();
        const r = service.declareAction(room, 's1', types_1.CoupActionType.COUP, 's2');
        expect(r).not.toBeNull();
    });
    it('advances turn skipping dead players and detects winner', () => {
        const room = startRoom();
        room.coupState.influences['s3'].count = 0;
        service.declareAction(room, 's1', types_1.CoupActionType.INCOME);
        const r2 = service.declareAction(room, 's2', types_1.CoupActionType.INCOME);
        expect(r2.coupState.currentTurn).toBe('s1');
        room.coupState.influences['s2'].count = 0;
        room.coupState.coins['s1'] = 7;
        const r3 = service.declareAction(room, 's1', types_1.CoupActionType.COUP, 's2');
        expect(r3).toBeNull();
        room.coupState.influences['s2'].count = 1;
        privateState.set(room.code, 's2', 'coupHand', [types_1.CoupRole.DUKE]);
        const r4 = service.declareAction(room, 's1', types_1.CoupActionType.COUP, 's2');
        expect(r4.coupState.influences['s2'].count).toBe(0);
        expect(r4.coupState.winnerId).toBe('s1');
        expect(r4.coupState.phase).toBe('RESULT');
        expect(r4.status).toBe(types_1.RoomStatus.RESULT);
    });
});
describe('CoupService (03 challenge)', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                coup_service_1.CoupService,
                private_state_service_1.PrivateStateService,
                { provide: room_timer_service_1.RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
            ],
        }).compile();
        service = module.get(coup_service_1.CoupService);
        privateState = module.get(private_state_service_1.PrivateStateService);
    });
    function makeRoom(overrides = {}) {
        const players = [
            { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true },
            { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true },
            { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true },
        ];
        return {
            id: 'r1',
            gameType: types_1.GameType.COUP,
            code: 'ABC123',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 's1',
            players,
            createdAt: new Date(),
            config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
            ...overrides,
        };
    }
    function startRoom() {
        const room = makeRoom();
        service.startGame(room, 's1');
        return room;
    }
    it('challenge fails when actor has role — challenger loses, actor shuffles and Tax succeeds', () => {
        const room = startRoom();
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.DUKE, types_1.CoupRole.CONTESSA]);
        privateState.set(room.code, 's2', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.ASSASSIN]);
        const deckLen = room.coupState.deck.length;
        const r = service.declareAction(room, 's1', types_1.CoupActionType.TAX);
        expect(r.coupState.phase).toBe('AWAITING_CHALLENGE');
        const challengerHandBefore = privateState.get(room.code, 's2', 'coupHand').length;
        const result = service.challenge(room, 's2');
        expect(result).not.toBeNull();
        expect(result.coupState.influences['s2'].count).toBe(1);
        expect(result.coupState.deadPile.length).toBe(1);
        expect(result.coupState.influences['s1'].count).toBe(2);
        expect(privateState.get(room.code, 's1', 'coupHand').length).toBe(2);
        expect(result.coupState.deck.length).toBe(deckLen);
        expect(result.coupState.coins['s1']).toBe(5);
        expect(result.coupState.phase).toBe('PLAYING');
        expect(result.coupState.currentTurn).toBe('s2');
    });
    it('challenge succeeds when actor bluffs — actor loses and Tax fails', () => {
        const room = startRoom();
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.ASSASSIN]);
        const r = service.declareAction(room, 's1', types_1.CoupActionType.TAX);
        expect(r.coupState.phase).toBe('AWAITING_CHALLENGE');
        const result = service.challenge(room, 's2');
        expect(result).not.toBeNull();
        expect(result.coupState.influences['s1'].count).toBe(1);
        expect(result.coupState.coins['s1']).toBe(2);
        expect(result.coupState.phase).toBe('PLAYING');
        expect(result.coupState.currentTurn).toBe('s2');
    });
    it('challenge not allowed from actor or when not awaiting', () => {
        const room = startRoom();
        expect(service.challenge(room, 's2')).toBeNull();
        service.declareAction(room, 's1', types_1.CoupActionType.TAX);
        expect(service.challenge(room, 's1')).toBeNull();
        expect(service.challenge(room, 's9')).toBeNull();
    });
});
describe('CoupService (04 block)', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                coup_service_1.CoupService,
                private_state_service_1.PrivateStateService,
                { provide: room_timer_service_1.RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
            ],
        }).compile();
        service = module.get(coup_service_1.CoupService);
        privateState = module.get(private_state_service_1.PrivateStateService);
    });
    function makeRoom(overrides = {}) {
        const players = [
            { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true },
            { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true },
            { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true },
        ];
        return {
            id: 'r1',
            gameType: types_1.GameType.COUP,
            code: 'ABC123',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 's1',
            players,
            createdAt: new Date(),
            config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
            ...overrides,
        };
    }
    function startRoom() {
        const room = makeRoom();
        service.startGame(room, 's1');
        return room;
    }
    it('Foreign Aid blocked by Duke — action fails', () => {
        const room = startRoom();
        service.declareAction(room, 's1', types_1.CoupActionType.FOREIGN_AID);
        expect(room.coupState.phase).toBe('AWAITING_BLOCK');
        const blocked = service.block(room, 's2');
        expect(blocked).not.toBeNull();
        expect(blocked.coupState.phase).toBe('AWAITING_CHALLENGE');
        expect(blocked.coupState.pendingBlock?.blockerId).toBe('s2');
        const after = service.handleBlockChallengeTimeoutForRoom(room);
        expect(after).not.toBeNull();
        expect(after.coupState.coins['s1']).toBe(2);
        expect(after.coupState.phase).toBe('PLAYING');
    });
    it('Foreign Aid block challenged — blocker has Duke, challenger loses and block stands', () => {
        const room = startRoom();
        privateState.set(room.code, 's2', 'coupHand', [types_1.CoupRole.DUKE, types_1.CoupRole.CAPTAIN]);
        service.declareAction(room, 's1', types_1.CoupActionType.FOREIGN_AID);
        service.block(room, 's2');
        const result = service.challenge(room, 's3');
        expect(result).not.toBeNull();
        expect(result.coupState.influences['s3'].count).toBe(1);
        expect(result.coupState.coins['s1']).toBe(2);
    });
    it('Foreign Aid block challenged — blocker bluffs, blocker loses and Foreign Aid succeeds', () => {
        const room = startRoom();
        privateState.set(room.code, 's2', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.ASSASSIN]);
        service.declareAction(room, 's1', types_1.CoupActionType.FOREIGN_AID);
        service.block(room, 's2');
        const result = service.challenge(room, 's3');
        expect(result).not.toBeNull();
        expect(result.coupState.influences['s2'].count).toBe(1);
        expect(result.coupState.coins['s1']).toBe(4);
    });
    it('Assassinate blocked by Contessa', () => {
        const room = startRoom();
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.ASSASSIN, types_1.CoupRole.DUKE]);
        room.coupState.coins['s1'] = 3;
        service.declareAction(room, 's1', types_1.CoupActionType.ASSASSINATE, 's2');
        expect(room.coupState.phase).toBe('AWAITING_CHALLENGE');
        service.handleChallengeTimeoutForRoom(room);
        expect(room.coupState.phase).toBe('AWAITING_BLOCK');
        const blocked = service.block(room, 's2');
        expect(blocked).not.toBeNull();
        const after = service.handleBlockChallengeTimeoutForRoom(room);
        expect(after.coupState.coins['s1']).toBe(0);
        expect(after.coupState.influences['s2'].count).toBe(2);
    });
    it('Assassinate not blocked — succeeds after block timeout', () => {
        const room = startRoom();
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.ASSASSIN, types_1.CoupRole.DUKE]);
        room.coupState.coins['s1'] = 3;
        service.declareAction(room, 's1', types_1.CoupActionType.ASSASSINATE, 's2');
        service.handleChallengeTimeoutForRoom(room);
        const after = service.handleBlockTimeoutForRoom(room);
        expect(after.coupState.influences['s2'].count).toBe(1);
        expect(after.coupState.coins['s1']).toBe(0);
    });
});
describe('CoupService (05 steal & exchange)', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                coup_service_1.CoupService,
                private_state_service_1.PrivateStateService,
                { provide: room_timer_service_1.RoomTimerService, useValue: { clearRoom: jest.fn(), schedule: jest.fn(), cancel: jest.fn() } },
            ],
        }).compile();
        service = module.get(coup_service_1.CoupService);
        privateState = module.get(private_state_service_1.PrivateStateService);
    });
    function makeRoom(overrides = {}) {
        const players = [
            { id: '1', name: 'A', socketId: 's1', score: 0, roomId: 'r1', connected: true },
            { id: '2', name: 'B', socketId: 's2', score: 0, roomId: 'r1', connected: true },
            { id: '3', name: 'C', socketId: 's3', score: 0, roomId: 'r1', connected: true },
        ];
        return {
            id: 'r1',
            gameType: types_1.GameType.COUP,
            code: 'ABC123',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 's1',
            players,
            createdAt: new Date(),
            config: { hostSelection: 'ROUND_ROBIN', timerMin: 5, language: 'th' },
            ...overrides,
        };
    }
    function startRoom() {
        const room = makeRoom();
        service.startGame(room, 's1');
        return room;
    }
    it('Steal 2 coins and blocked by Captain', () => {
        const room = startRoom();
        room.coupState.coins['s2'] = 5;
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.DUKE]);
        service.declareAction(room, 's1', types_1.CoupActionType.STEAL, 's2');
        expect(room.coupState.phase).toBe('AWAITING_CHALLENGE');
        service.handleChallengeTimeoutForRoom(room);
        expect(room.coupState.phase).toBe('AWAITING_BLOCK');
        privateState.set(room.code, 's2', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.CONTESSA]);
        const blocked = service.block(room, 's2');
        expect(blocked.coupState.phase).toBe('AWAITING_CHALLENGE');
        const after = service.handleBlockChallengeTimeoutForRoom(room);
        expect(after.coupState.coins['s1']).toBe(2);
        expect(after.coupState.coins['s2']).toBe(5);
    });
    it('Steal succeeds when not blocked', () => {
        const room = startRoom();
        room.coupState.coins['s2'] = 1;
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.DUKE]);
        service.declareAction(room, 's1', types_1.CoupActionType.STEAL, 's2');
        service.handleChallengeTimeoutForRoom(room);
        const after = service.handleBlockTimeoutForRoom(room);
        expect(after.coupState.coins['s1']).toBe(3);
        expect(after.coupState.coins['s2']).toBe(0);
    });
    it('Steal blocked and challenger succeeds — blocker loses and steal succeeds', () => {
        const room = startRoom();
        room.coupState.coins['s2'] = 4;
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.CAPTAIN, types_1.CoupRole.DUKE]);
        privateState.set(room.code, 's2', 'coupHand', [types_1.CoupRole.DUKE, types_1.CoupRole.CONTESSA]);
        service.declareAction(room, 's1', types_1.CoupActionType.STEAL, 's2');
        service.handleChallengeTimeoutForRoom(room);
        service.block(room, 's2');
        const result = service.challenge(room, 's1');
        expect(result.coupState.influences['s2'].count).toBe(1);
        expect(result.coupState.coins['s1']).toBe(4);
        expect(result.coupState.coins['s2']).toBe(2);
    });
    it('Exchange draws 2 and select', () => {
        const room = startRoom();
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.AMBASSADOR, types_1.CoupRole.DUKE]);
        const deckBefore = room.coupState.deck.length;
        service.declareAction(room, 's1', types_1.CoupActionType.EXCHANGE);
        expect(room.coupState.phase).toBe('AWAITING_CHALLENGE');
        service.handleChallengeTimeoutForRoom(room);
        expect(room.coupState.phase).toBe('AWAITING_EXCHANGE');
        const hand = privateState.get(room.code, 's1', 'coupHand');
        expect(hand.length).toBe(4);
        expect(room.coupState.deck.length).toBe(deckBefore - 2);
        const after = service.exchangeSelect(room, 's1', [0, 1]);
        expect(after).not.toBeNull();
        expect(privateState.get(room.code, 's1', 'coupHand').length).toBe(2);
        expect(after.coupState.phase).toBe('PLAYING');
        expect(after.coupState.currentTurn).toBe('s2');
    });
    it('Exchange challenge succeeds — actor loses and no draw', () => {
        const room = startRoom();
        privateState.set(room.code, 's1', 'coupHand', [types_1.CoupRole.DUKE, types_1.CoupRole.CAPTAIN]);
        const deckLen = room.coupState.deck.length;
        service.declareAction(room, 's1', types_1.CoupActionType.EXCHANGE);
        const result = service.challenge(room, 's2');
        expect(result.coupState.influences['s1'].count).toBe(1);
        expect(result.coupState.deck.length).toBe(deckLen);
        expect(result.coupState.phase).toBe('PLAYING');
    });
});
//# sourceMappingURL=coup.service.spec.js.map