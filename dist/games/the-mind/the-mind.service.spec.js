"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@repo/types");
const the_mind_service_1 = require("./the-mind.service");
const private_state_service_1 = require("../private-state.service");
describe('TheMindService', () => {
    let service;
    let privateState;
    beforeEach(() => {
        privateState = new private_state_service_1.PrivateStateService();
        service = new the_mind_service_1.TheMindService(privateState);
    });
    function createRoom(config = {}, players = defaultPlayers(), state) {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: types_1.GameType.THE_MIND,
            status: types_1.RoomStatus.PLAYING,
            roomHostId: 'socket-1',
            createdAt: new Date(),
            config: { hostSelection: 'FIXED', timerMin: 1, ...config },
            players,
            theMindState: {
                phase: types_1.TheMindPhase.PLAYING,
                level: 1,
                maxLevel: 2,
                lives: 2,
                shuriken: 1,
                pileTop: 0,
                pileTopDOWN: config.theMindMode === 'EXTREME' ? 101 : null,
                pileTopPlayerId: null,
                playedCards: [],
                handSizes: {},
                readyPlayers: [],
                failedPlayerId: null,
                discardedCards: {},
                shurikenProposerId: null,
                shurikenVotes: {},
                result: null,
                ...state,
            },
        };
    }
    function defaultPlayers() {
        return [
            {
                id: 'player-1',
                socketId: 'socket-1',
                name: 'One',
                score: 0,
                roomId: 'room-id',
                connected: true,
            },
            {
                id: 'player-2',
                socketId: 'socket-2',
                name: 'Two',
                score: 0,
                roomId: 'room-id',
                connected: true,
            },
        ];
    }
    function seedHands(room, hands) {
        for (const [playerId, hand] of Object.entries(hands)) {
            const player = room.players.find((p) => p.id === playerId);
            privateState.set(room.code, player.socketId, 'theMindHand', hand);
        }
    }
    it('deals hands into private state, never into the broadcast state', () => {
        const room = createRoom({}, defaultPlayers());
        room.status = types_1.RoomStatus.LOBBY;
        room.theMindState = undefined;
        const result = service.startGame(room, 'socket-1');
        expect(result).not.toBeNull();
        expect(result.theMindState.phase).toBe(types_1.TheMindPhase.SETUP);
        expect(result.theMindState.handSizes['player-1']).toBe(1);
        expect(result.theMindState.handSizes['player-2']).toBe(1);
        expect(JSON.stringify(result)).not.toContain('theMindHand');
        expect(JSON.stringify(result)).not.toContain('theMindDeck');
        expect(privateState.get(room.code, 'socket-1', 'theMindHand')).toHaveLength(1);
        expect(privateState.get(room.code, 'socket-2', 'theMindHand')).toHaveLength(1);
    });
    it('accepts a backwards-by-10 play when revealing Extreme Blind Mode', () => {
        const room = createRoom({ theMindBlindMode: true, theMindMode: 'EXTREME' });
        seedHands(room, { 'player-1': [50], 'player-2': [40] });
        expect(service.playCard(room, 'player-1', 50, 'UP')).not.toBeNull();
        const result = service.playCard(room, 'player-2', 40, 'UP');
        expect(result?.theMindState?.phase).toBe(types_1.TheMindPhase.LEVEL_RESULT);
        expect(result?.theMindState?.result).toMatchObject({
            success: true,
            levelCleared: true,
            livesLost: 0,
        });
        expect(result?.theMindState?.lives).toBe(2);
    });
    it('redacts played cards during Blind Mode and reveals them at level end', () => {
        const room = createRoom({ theMindBlindMode: true, theMindMode: 'NORMAL' });
        seedHands(room, { 'player-1': [50], 'player-2': [60] });
        const afterFirst = service.playCard(room, 'player-1', 50, 'UP');
        expect(afterFirst.theMindState.playedCards[0]).toEqual({
            card: null,
            playerId: null,
            pile: 'UP',
        });
        const final = service.playCard(room, 'player-2', 60, 'UP');
        expect(final.theMindState.playedCards).toEqual([
            { card: 50, playerId: 'player-1', pile: 'UP' },
            { card: 60, playerId: 'player-2', pile: 'UP' },
        ]);
    });
    it('evaluates the UP and DOWN piles independently after a Blind Mode shuriken', () => {
        const room = createRoom({ theMindBlindMode: true, theMindMode: 'EXTREME' });
        seedHands(room, { 'player-1': [10], 'player-2': [20] });
        const state = room.theMindState;
        state.phase = types_1.TheMindPhase.SHURIKEN_VOTE;
        privateState.set(room.code, '__room__', 'theMindBlindPlayed', [
            { card: 90, playerId: 'player-1', pile: 'DOWN' },
            { card: 20, playerId: 'player-2', pile: 'UP' },
        ]);
        state.shurikenProposerId = 'player-1';
        state.shurikenVotes = { 'player-1': true };
        const result = service.voteShuriken(room, 'player-2', true);
        expect(result?.theMindState?.phase).toBe(types_1.TheMindPhase.LEVEL_RESULT);
        expect(result?.theMindState?.result).toMatchObject({
            success: true,
            levelCleared: true,
        });
        expect(result?.theMindState?.lives).toBe(2);
    });
    it('rejects the DOWN pile in Normal Mode', () => {
        const room = createRoom({}, defaultPlayers());
        seedHands(room, { 'player-1': [10], 'player-2': [20] });
        expect(service.playCard(room, 'player-1', 10, 'DOWN')).toBeNull();
        expect(privateState.get(room.code, 'socket-1', 'theMindHand')).toEqual([10]);
    });
    it('rejects a card that is not in the hand and rejects non-members', () => {
        const room = createRoom();
        seedHands(room, { 'player-1': [10], 'player-2': [20] });
        expect(service.playCard(room, 'player-1', 99, 'UP')).toBeNull();
        expect(service.playCard(room, 'stranger', 10, 'UP')).toBeNull();
    });
    it('does not treat a backwards-by-10 card as dead when another player advances the pile', () => {
        const room = createRoom();
        seedHands(room, { 'player-1': [40], 'player-2': [30] });
        const result = service.playCard(room, 'player-1', 40, 'UP');
        expect(result).not.toBeNull();
        expect(result.theMindState.phase).toBe(types_1.TheMindPhase.PLAYING);
        expect(result.theMindState.lives).toBe(2);
        expect(privateState.get(room.code, 'socket-2', 'theMindHand')).toEqual([30]);
    });
    it('does not allow ready() outside SETUP', () => {
        const room = createRoom({}, defaultPlayers(), {
            phase: types_1.TheMindPhase.LEVEL_RESULT,
            result: { success: true, discardedCards: {}, livesLost: 0, levelCleared: true },
        });
        const result = service.ready(room, 'player-1');
        expect(result).toBeNull();
        expect(room.theMindState.phase).toBe(types_1.TheMindPhase.LEVEL_RESULT);
    });
    it('resets levelEndTime when resuming a level after a timeout (no death loop)', () => {
        const room = createRoom({ theMindTimeAttack: true }, defaultPlayers(), {
            phase: types_1.TheMindPhase.LEVEL_RESULT,
            levelEndTime: Date.now() - 60_000,
            result: {
                success: false,
                discardedCards: {},
                livesLost: 1,
                levelCleared: false,
                isTimeOut: true,
            },
        });
        const result = service.nextLevel(room, 'socket-1');
        expect(result.theMindState.phase).toBe(types_1.TheMindPhase.PLAYING);
        expect(result.theMindState.levelEndTime).toBeGreaterThan(Date.now());
    });
    it('returns to PLAYING when a shuriken vote fails instead of soft-locking', () => {
        const room = createRoom();
        seedHands(room, { 'player-1': [10], 'player-2': [20] });
        const state = room.theMindState;
        state.phase = types_1.TheMindPhase.SHURIKEN_VOTE;
        state.shurikenProposerId = 'player-1';
        state.shurikenVotes = { 'player-1': true };
        const result = service.voteShuriken(room, 'player-2', false);
        expect(result.theMindState.phase).toBe(types_1.TheMindPhase.PLAYING);
        expect(result.theMindState.shurikenProposerId).toBeNull();
        expect(result.theMindState.shuriken).toBe(1);
    });
    it('marks timeouts and reveals remaining hands at game over', () => {
        const room = createRoom({}, defaultPlayers(), { lives: 1, levelEndTime: Date.now() - 1 });
        seedHands(room, { 'player-1': [10], 'player-2': [20] });
        const result = service.handleTimeout(room);
        expect(result.theMindState.phase).toBe(types_1.TheMindPhase.GAME_OVER);
        expect(result.theMindState.result.isTimeOut).toBe(true);
        expect(result.theMindState.remainingHands).toEqual({
            'player-1': [10],
            'player-2': [20],
        });
    });
    it('removes the winner score path only when max level is reached', () => {
        const room = createRoom({}, defaultPlayers(), { level: 2, maxLevel: 2 });
        seedHands(room, { 'player-1': [10], 'player-2': [20] });
        service.playCard(room, 'player-1', 10, 'UP');
        const result = service.playCard(room, 'player-2', 20, 'UP');
        expect(result.theMindState.phase).toBe(types_1.TheMindPhase.GAME_OVER);
        expect(room.status).toBe(types_1.RoomStatus.RESULT);
        expect(room.players[0].score).toBe(2);
    });
});
//# sourceMappingURL=the-mind.service.spec.js.map