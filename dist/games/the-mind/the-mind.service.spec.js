"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@repo/types");
const the_mind_service_1 = require("./the-mind.service");
describe('TheMindService', () => {
    let service;
    beforeEach(() => {
        service = new the_mind_service_1.TheMindService();
    });
    function createBlindRoom(playerHands, mode = 'EXTREME') {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: types_1.GameType.THE_MIND,
            status: types_1.RoomStatus.PLAYING,
            roomHostId: 'socket-1',
            createdAt: new Date(),
            config: {
                hostSelection: 'FIXED',
                timerMin: 1,
                theMindBlindMode: true,
                theMindMode: mode,
            },
            players: [
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
            ],
            theMindState: {
                phase: types_1.TheMindPhase.PLAYING,
                deck: [],
                level: 1,
                maxLevel: 2,
                lives: 2,
                shuriken: 1,
                pileTop: 0,
                pileTopDOWN: mode === 'EXTREME' ? 101 : null,
                pileTopPlayerId: null,
                playedCards: [],
                playerHands,
                readyPlayers: [],
                failedPlayerId: null,
                discardedCards: {},
                shurikenProposerId: null,
                shurikenVotes: {},
                result: null,
            },
        };
    }
    it('accepts a backwards-by-10 play when revealing Extreme Blind Mode', () => {
        const room = createBlindRoom({ 'player-1': [50], 'player-2': [40] });
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
    it('evaluates the UP and DOWN piles independently after a Blind Mode shuriken', () => {
        const room = createBlindRoom({ 'player-1': [10], 'player-2': [20] });
        const state = room.theMindState;
        state.phase = types_1.TheMindPhase.SHURIKEN_VOTE;
        state.playedCards = [
            { card: 90, playerId: 'player-1', pile: 'DOWN' },
            { card: 20, playerId: 'player-2', pile: 'UP' },
        ];
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
        const room = createBlindRoom({ 'player-1': [10], 'player-2': [20] }, 'NORMAL');
        expect(service.playCard(room, 'player-1', 10, 'DOWN')).toBeNull();
        expect(room.theMindState?.playerHands['player-1']).toEqual([10]);
    });
});
//# sourceMappingURL=the-mind.service.spec.js.map