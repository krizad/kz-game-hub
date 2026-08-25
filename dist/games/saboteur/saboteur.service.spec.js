"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const saboteur_service_1 = require("./saboteur.service");
const private_state_service_1 = require("../private-state.service");
const types_1 = require("@repo/types");
const ROOM_KEY = '__room__';
const SB_ROLE = 'sbRole';
const SB_HAND = 'sbHand';
const SB_ROOM_DECK = 'sbRoomDeck';
const SB_ROOM_GOALS = 'sbRoomGoals';
describe('SaboteurService', () => {
    let service;
    let privateState;
    beforeEach(async () => {
        privateState = new private_state_service_1.PrivateStateService();
        const module = await testing_1.Test.createTestingModule({
            providers: [saboteur_service_1.SaboteurService, { provide: private_state_service_1.PrivateStateService, useValue: privateState }],
        }).compile();
        service = module.get(saboteur_service_1.SaboteurService);
    });
    function createRoom(playerCount) {
        const players = Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            socketId: `p${i + 1}`,
            name: `P${i + 1}`,
            score: 0,
            roomId: 'room-id',
            connected: true,
        }));
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: 'SABOTEUR',
            status: types_1.RoomStatus.LOBBY,
            roomHostId: 'p1',
            createdAt: new Date(),
            config: { hostSelection: 'FIXED', timerMin: 1 },
            players,
        };
    }
    function startGame(room) {
        const result = service.startGame(room, 'p1');
        expect(result).not.toBeNull();
        return result;
    }
    function setRoles(room, roles) {
        for (const [id, role] of Object.entries(roles)) {
            privateState.set(room.code, id, SB_ROLE, role);
        }
    }
    function setHand(room, playerId, cardIds) {
        privateState.set(room.code, playerId, SB_HAND, cardIds.map((cardId) => ({ cardId })));
        const player = room.saboteurState.players[playerId];
        if (player)
            player.handSize = cardIds.length;
    }
    function addBoardTiles(room, tiles) {
        for (const t of tiles) {
            room.saboteurState.board[(0, types_1.saboteurCellKey)(t.x, t.y)] = {
                cardId: t.cardId,
                rotation: t.rotation ?? 0,
            };
        }
    }
    function setGoalContents(room, contents) {
        privateState.set(room.code, ROOM_KEY, SB_ROOM_GOALS, contents);
    }
    function seedHorizontalTunnel(room, endX) {
        const tiles = [];
        for (let x = 1; x <= endX; x++) {
            tiles.push({ x, y: 2, cardId: 'path-24c' });
        }
        addBoardTiles(room, tiles);
    }
    describe('deck composition', () => {
        it('should define 67 playing cards and 28 gold cards', () => {
            const total = types_1.SABOTEUR_DRAW_CARDS.reduce((sum, d) => sum + d.quantity, 0);
            const pathTotal = types_1.SABOTEUR_DRAW_CARDS.filter((d) => d.kind === 'PATH').reduce((s, d) => s + d.quantity, 0);
            const actionTotal = types_1.SABOTEUR_DRAW_CARDS.filter((d) => d.kind === 'ACTION').reduce((s, d) => s + d.quantity, 0);
            expect(total).toBe(67);
            expect(pathTotal).toBe(40);
            expect(actionTotal).toBe(27);
            expect(types_1.SABOTEUR_GOLD_DECK).toHaveLength(28);
            expect(types_1.SABOTEUR_GOLD_DECK.filter((v) => v === 3)).toHaveLength(4);
            expect(types_1.SABOTEUR_GOLD_DECK.filter((v) => v === 2)).toHaveLength(8);
            expect(types_1.SABOTEUR_GOLD_DECK.filter((v) => v === 1)).toHaveLength(16);
        });
    });
    describe('startGame', () => {
        it('should not start with fewer than 3 players', () => {
            expect(service.startGame(createRoom(2), 'p1')).toBeNull();
        });
        it('should not start with more than 10 players', () => {
            expect(service.startGame(createRoom(11), 'p1')).toBeNull();
        });
        it('should not start if requester is not host', () => {
            expect(service.startGame(createRoom(3), 'p2')).toBeNull();
        });
        it('should deal hands and stock according to tables', () => {
            for (const n of [3, 5, 6, 8]) {
                const room = startGame(createRoom(n));
                const state = room.saboteurState;
                const handSize = types_1.SABOTEUR_HAND_SIZE_TABLE[n];
                expect(Object.values(state.players).every((p) => p.handSize === handSize)).toBe(true);
                expect(state.stockCount).toBe(67 - n * handSize);
                expect(privateState.get(room.code, ROOM_KEY, SB_ROOM_DECK)).toHaveLength(67 - n * handSize);
                room.status = types_1.RoomStatus.LOBBY;
                room.saboteurState = undefined;
                privateState.clearRoom(room.code);
            }
        });
        it('should assign saboteur count per official role table', () => {
            for (let n = 3; n <= 10; n++) {
                const room = startGame(createRoom(n));
                let saboteurs = 0;
                for (const p of room.players) {
                    if (privateState.get(room.code, p.socketId, SB_ROLE) === types_1.SaboteurRole.SABOTEUR) {
                        saboteurs++;
                    }
                }
                expect(saboteurs).toBe(types_1.SABOTEUR_ROLE_TABLE[n]);
                room.status = types_1.RoomStatus.LOBBY;
                room.saboteurState = undefined;
                privateState.clearRoom(room.code);
            }
        });
    });
    describe('placePath', () => {
        let room;
        beforeEach(() => {
            room = startGame(createRoom(3));
            room.saboteurState.activePlayerId = 'p1';
        });
        it('should accept a valid straight extension from the start', () => {
            setHand(room, 'p1', ['path-24c']);
            expect(service.placePath(room, 'p1', 0, 1, 2, 0)).not.toBeNull();
            expect(room.saboteurState.board[(0, types_1.saboteurCellKey)(1, 2)].cardId).toBe('path-24c');
            expect(room.saboteurState.players['p1'].handSize).toBe(1);
            expect(room.saboteurState.activePlayerId).toBe('p2');
        });
        it('should reject a card whose closed side faces an open side', () => {
            setHand(room, 'p1', ['path-12c']);
            expect(service.placePath(room, 'p1', 0, 1, 2, 0)).toBeNull();
        });
        it('should require 180° rotation for some cards', () => {
            setHand(room, 'p1', ['path-12c']);
            expect(service.placePath(room, 'p1', 0, 1, 2, 0)).toBeNull();
            expect(service.placePath(room, 'p1', 0, 1, 2, 180)).not.toBeNull();
        });
        it('should reject placements not connected back to start', () => {
            setHand(room, 'p1', ['path-13c']);
            expect(service.placePath(room, 'p1', 0, 5, 0, 0)).toBeNull();
        });
        it('should reject out-of-bounds and occupied cells', () => {
            setHand(room, 'p1', ['path-24c']);
            expect(service.placePath(room, 'p1', 0, 9, 2, 0)).toBeNull();
            expect(service.placePath(room, 'p1', 0, 0, 2, 0)).toBeNull();
            expect(service.placePath(room, 'p1', 0, 8, 2, 0)).toBeNull();
        });
        it('should block path play while any tool is broken', () => {
            setHand(room, 'p1', ['path-24c']);
            room.saboteurState.players['p1'].brokenTools = [types_1.SaboteurTool.CART];
            expect(service.placePath(room, 'p1', 0, 1, 2, 0)).toBeNull();
        });
        it('should reject when it is not the player turn', () => {
            setHand(room, 'p2', ['path-24c']);
            expect(service.placePath(room, 'p2', 0, 1, 2, 0)).toBeNull();
        });
        it('pass-through stubs must not carry the network through', () => {
            setHand(room, 'p1', ['path-1234c']);
            expect(service.placePath(room, 'p1', 0, 1, 2, 0)).not.toBeNull();
            room.saboteurState.activePlayerId = 'p1';
            setHand(room, 'p1', ['path-13x']);
            expect(service.placePath(room, 'p1', 0, 1, 1, 0)).not.toBeNull();
            room.saboteurState.activePlayerId = 'p1';
            setHand(room, 'p1', ['path-13c']);
            expect(service.placePath(room, 'p1', 0, 1, 0, 0)).toBeNull();
        });
    });
    describe('win detection and gold pick', () => {
        let room;
        beforeEach(() => {
            room = startGame(createRoom(3));
            setRoles(room, { p1: types_1.SaboteurRole.MINER, p2: types_1.SaboteurRole.MINER, p3: types_1.SaboteurRole.MINER });
            room.saboteurState.activePlayerId = 'p1';
            setGoalContents(room, ['STONE', 'GOLD', 'STONE']);
            seedHorizontalTunnel(room, 6);
        });
        it('reveals a STONE goal and keeps playing', () => {
            setGoalContents(room, ['STONE', 'STONE', 'GOLD']);
            setHand(room, 'p1', ['path-24c']);
            const result = service.placePath(room, 'p1', 0, 7, 2, 0);
            expect(result).not.toBeNull();
            expect(room.saboteurState.currentPhase).toBe(types_1.SaboteurPhase.PLAYING);
            expect(room.saboteurState.revealedGoals[1]).toBe('STONE');
            expect(room.saboteurState.revealedGoals[0]).toBeNull();
            expect(room.saboteurState.activePlayerId).toBe('p2');
        });
        it('ends the round immediately when stone-ends-round is enabled and a STONE goal is revealed', () => {
            setRoles(room, { p1: types_1.SaboteurRole.MINER, p2: types_1.SaboteurRole.MINER, p3: types_1.SaboteurRole.SABOTEUR });
            room.config.saboteurStoneEndsRound = true;
            setGoalContents(room, ['STONE', 'STONE', 'GOLD']);
            setHand(room, 'p1', ['path-24c']);
            const result = service.placePath(room, 'p1', 0, 7, 2, 0);
            expect(result).not.toBeNull();
            const state = room.saboteurState;
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.ROUND_END);
            expect(state.revealedGoals[1]).toBe('STONE');
            expect(state.roundResult.winnerRole).toBe(types_1.SaboteurRole.SABOTEUR);
            expect(state.players['p3'].score).toBe(4);
            expect(state.activePlayerId).toBe('p1');
        });
        it('enters GOLD_PICK when miners connect the GOLD goal', () => {
            setHand(room, 'p1', ['path-24c']);
            const result = service.placePath(room, 'p1', 0, 7, 2, 0);
            expect(result).not.toBeNull();
            const state = room.saboteurState;
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.GOLD_PICK);
            expect(state.roundResult.winnerRole).toBe(types_1.SaboteurRole.MINER);
            expect(state.roundResult.revealedGoalIndex).toBe(1);
            expect(state.roundResult.goldPool).toHaveLength(3);
            expect(state.roundResult.currentPickerId).toBe('p1');
        });
        it('enforces pick order and completes the round', () => {
            setHand(room, 'p1', ['path-24c']);
            service.placePath(room, 'p1', 0, 7, 2, 0);
            const state = room.saboteurState;
            const result = state.roundResult;
            expect(result.pickOrder).toEqual(['p1', 'p3', 'p2']);
            const poolSum = result.goldPool.reduce((a, b) => a + b, 0);
            expect(service.pickGold(room, 'p3', 0)).toBeNull();
            const firstIdx = 0;
            expect(service.pickGold(room, 'p1', firstIdx)).not.toBeNull();
            expect(result.currentPickerId).toBe('p3');
            expect(service.pickGold(room, 'p1', firstIdx)).toBeNull();
            expect(service.pickGold(room, 'p3', 0)).toBeNull();
            expect(service.pickGold(room, 'p3', 1)).not.toBeNull();
            expect(result.currentPickerId).toBe('p2');
            expect(service.pickGold(room, 'p2', 2)).not.toBeNull();
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.ROUND_END);
            expect(Object.values(result.picks).reduce((a, b) => a + b, 0)).toBe(poolSum);
            expect(state.players['p1'].role).toBeDefined();
            expect(state.players['p2'].role).toBe(types_1.SaboteurRole.MINER);
            expect(state.players['p3'].role).toBe(types_1.SaboteurRole.MINER);
            const roomScoreSum = room.players.reduce((a, p) => a + p.score, 0);
            expect(roomScoreSum).toBe(poolSum);
        });
    });
    describe('action cards', () => {
        let room;
        beforeEach(() => {
            room = startGame(createRoom(3));
            room.saboteurState.activePlayerId = 'p1';
        });
        it('BREAK adds a broken tool and blocks stacking the same tool', () => {
            setHand(room, 'p1', ['action-break-lantern']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).not.toBeNull();
            expect(room.saboteurState.players['p2'].brokenTools).toContain(types_1.SaboteurTool.LANTERN);
            room.saboteurState.activePlayerId = 'p1';
            setHand(room, 'p1', ['action-break-lantern']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).toBeNull();
        });
        it('REPAIR fixes an eligible broken tool; dual-tool repairs choose automatically', () => {
            const p2 = room.saboteurState.players['p2'];
            p2.brokenTools = [types_1.SaboteurTool.CART, types_1.SaboteurTool.LANTERN];
            setHand(room, 'p1', ['action-repair-lantern-cart']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).not.toBeNull();
            expect(p2.brokenTools).toEqual([types_1.SaboteurTool.CART]);
            room.saboteurState.activePlayerId = 'p1';
            setHand(room, 'p1', ['action-repair-cart-pickaxe']);
            expect(service.playAction(room, 'p1', {
                cardIndex: 0,
                targetPlayerId: 'p2',
                repairTool: types_1.SaboteurTool.CART,
            })).not.toBeNull();
            expect(p2.brokenTools).toEqual([]);
        });
        it('REPAIR rejects targets without a relevant broken tool', () => {
            setHand(room, 'p1', ['action-repair-pickaxe']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).toBeNull();
        });
        it('MAP stores the peek privately and leaks nothing into public state', () => {
            setGoalContents(room, ['GOLD', 'STONE', 'STONE']);
            setHand(room, 'p1', ['action-map']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, goalIndex: 0 })).not.toBeNull();
            const peeked = privateState.get(room.code, 'p1', 'sbPeekedGoals');
            expect(peeked['0']).toBe('GOLD');
            const serialized = JSON.stringify(room.saboteurState);
            expect(serialized).not.toContain('"GOLD"');
            expect(serialized).not.toContain('"STONE"');
            expect(room.saboteurState.revealedGoals).toEqual([null, null, null]);
        });
        it('ROCKFALL removes placed path cards but never start or goals', () => {
            addBoardTiles(room, [{ x: 3, y: 1, cardId: 'path-24c' }]);
            setHand(room, 'p1', ['action-rockfall']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 0, targetY: 2 })).toBeNull();
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 8, targetY: 2 })).toBeNull();
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 4, targetY: 4 })).toBeNull();
            room.saboteurState.activePlayerId = 'p1';
            setHand(room, 'p1', ['action-rockfall']);
            expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 3, targetY: 1 })).not.toBeNull();
            expect(room.saboteurState.board[(0, types_1.saboteurCellKey)(3, 1)]).toBeUndefined();
        });
    });
    describe('discard and exhaustion', () => {
        it('skips empty-handed players once the stock runs dry (no soft-lock)', () => {
            const room = startGame(createRoom(3));
            const state = room.saboteurState;
            state.activePlayerId = 'p1';
            privateState.set(room.code, ROOM_KEY, SB_ROOM_DECK, []);
            state.stockCount = 0;
            setHand(room, 'p1', ['path-24c']);
            setHand(room, 'p2', ['path-24c']);
            setHand(room, 'p3', ['path-24c']);
            expect(service.discard(room, 'p1', 0)).not.toBeNull();
            const next = room.saboteurState.activePlayerId;
            expect(next).toBe('p2');
            expect(service.discard(room, 'p2', 0)).not.toBeNull();
            expect(room.saboteurState.activePlayerId).toBe('p3');
        });
        it('auto-pass skips the turn without drawing or discarding', () => {
            const room = startGame(createRoom(3));
            const state = room.saboteurState;
            const stockBefore = state.stockCount;
            const handBefore = state.players['p1'].handSize;
            expect(service.autoPass(room, 'p1')).not.toBeNull();
            expect(state.activePlayerId).toBe('p2');
            expect(state.stockCount).toBe(stockBefore);
            expect(state.players['p1'].handSize).toBe(handBefore);
            expect(service.autoPass(room, 'p2')).not.toBeNull();
            expect(state.activePlayerId).toBe('p3');
            expect(service.autoPass(room, 'p1')).toBeNull();
        });
        it('ends the round with a lone-saboteur bonus when all cards run out', () => {
            const room = startGame(createRoom(3));
            setRoles(room, { p1: types_1.SaboteurRole.MINER, p2: types_1.SaboteurRole.SABOTEUR, p3: types_1.SaboteurRole.MINER });
            const state = room.saboteurState;
            state.activePlayerId = 'p1';
            privateState.set(room.code, ROOM_KEY, SB_ROOM_DECK, []);
            state.stockCount = 0;
            for (const id of ['p1', 'p2', 'p3']) {
                privateState.delete(room.code, id, SB_HAND);
                state.players[id].handSize = 0;
            }
            setHand(room, 'p1', ['path-24c']);
            expect(service.discard(room, 'p1', 0)).not.toBeNull();
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.ROUND_END);
            expect(state.roundResult.winnerRole).toBe(types_1.SaboteurRole.SABOTEUR);
            expect(state.roundResult.saboteurBonus).toBe(4);
            expect(state.players['p2'].score).toBe(4);
            expect(state.players['p2'].role).toBe(types_1.SaboteurRole.SABOTEUR);
        });
    });
    describe('round flow', () => {
        it('nextRound preserves scores, resets the board and rotates the starter', () => {
            const room = startGame(createRoom(3));
            const state = room.saboteurState;
            state.currentPhase = types_1.SaboteurPhase.ROUND_END;
            state.players['p2'].score = 7;
            addBoardTiles(room, [{ x: 1, y: 2, cardId: 'path-24c' }]);
            expect(service.nextRound(room, 'p2')).toBeNull();
            expect(service.nextRound(room, 'p1')).not.toBeNull();
            const s2 = room.saboteurState;
            expect(s2.round).toBe(2);
            expect(s2.currentPhase).toBe(types_1.SaboteurPhase.PLAYING);
            expect(s2.players['p2'].score).toBe(7);
            expect(s2.board[(0, types_1.saboteurCellKey)(1, 2)]).toBeUndefined();
            expect(s2.activePlayerId).toBe(s2.turnOrder[1]);
            expect(s2.stockCount).toBeGreaterThan(0);
        });
        it('finishes with GAME_OVER after round 3', () => {
            const room = startGame(createRoom(3));
            const state = room.saboteurState;
            state.round = 3;
            state.currentPhase = types_1.SaboteurPhase.ROUND_END;
            state.players['p1'].score = 5;
            state.players['p2'].score = 9;
            state.players['p3'].score = 9;
            expect(service.nextRound(room, 'p1')).not.toBeNull();
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.GAME_OVER);
            expect(state.finalResults.scores['p2']).toBe(9);
            expect(state.finalResults.winnerIds.sort()).toEqual(['p2', 'p3']);
        });
    });
    describe('reconnection', () => {
        it('advances the turn when the active player disconnects', () => {
            const room = startGame(createRoom(3));
            room.saboteurState.activePlayerId = 'p1';
            service.handlePlayerDisconnect(room, 'p1');
            expect(room.saboteurState.activePlayerId).toBe('p2');
        });
        it('advances the gold picker when they disconnect and finalizes when done', () => {
            const room = startGame(createRoom(3));
            setRoles(room, { p1: types_1.SaboteurRole.MINER, p2: types_1.SaboteurRole.MINER, p3: types_1.SaboteurRole.MINER });
            room.saboteurState.activePlayerId = 'p1';
            setGoalContents(room, ['STONE', 'GOLD', 'STONE']);
            seedHorizontalTunnel(room, 6);
            setHand(room, 'p1', ['path-24c']);
            service.placePath(room, 'p1', 0, 7, 2, 0);
            const state = room.saboteurState;
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.GOLD_PICK);
            service.handlePlayerDisconnect(room, 'p1');
            expect(state.roundResult.currentPickerId).toBe('p3');
            service.handlePlayerDisconnect(room, 'p3');
            expect(state.roundResult.currentPickerId).toBe('p2');
            service.handlePlayerDisconnect(room, 'p2');
            expect(state.currentPhase).toBe(types_1.SaboteurPhase.ROUND_END);
        });
        it('remaps every socket id reference', () => {
            const room = startGame(createRoom(3));
            const state = room.saboteurState;
            state.activePlayerId = 'p2';
            state.turnOrder = ['p1', 'p2', 'p3'];
            service.remapSocketId(state, 'p2', 'p2-new');
            expect(state.players['p2']).toBeUndefined();
            expect(state.players['p2-new'].id).toBe('p2-new');
            expect(state.activePlayerId).toBe('p2-new');
            expect(state.turnOrder).toEqual(['p1', 'p2-new', 'p3']);
        });
    });
    describe('reset', () => {
        it('returns the room to lobby and clears scores', () => {
            const room = startGame(createRoom(3));
            room.saboteurState.players['p1'].score = 5;
            room.players[0].score = 5;
            expect(service.reset(room, 'p2')).toBeNull();
            expect(service.reset(room, 'p1')).not.toBeNull();
            expect(room.status).toBe(types_1.RoomStatus.LOBBY);
            expect(room.saboteurState).toBeUndefined();
            expect(room.players.every((p) => p.score === 0)).toBe(true);
        });
    });
});
//# sourceMappingURL=saboteur.service.spec.js.map