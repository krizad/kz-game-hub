"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const detective_club_service_1 = require("./detective-club.service");
const private_state_service_1 = require("../private-state.service");
const types_1 = require("@repo/types");
describe('DetectiveClubService', () => {
    let service;
    let privateState;
    let cardsDir;
    beforeAll(() => {
        cardsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-cards-'));
        for (let i = 1; i <= 12; i++) {
            fs.writeFileSync(path.join(cardsDir, `card${i}.jpg`), '');
        }
    });
    afterAll(() => {
        fs.rmSync(cardsDir, { recursive: true, force: true });
        delete process.env.DETECTIVE_CLUB_CARDS_DIR;
    });
    beforeEach(async () => {
        process.env.DETECTIVE_CLUB_CARDS_DIR = cardsDir;
        privateState = new private_state_service_1.PrivateStateService();
        const module = await testing_1.Test.createTestingModule({
            providers: [detective_club_service_1.DetectiveClubService, { provide: private_state_service_1.PrivateStateService, useValue: privateState }],
        }).compile();
        service = module.get(detective_club_service_1.DetectiveClubService);
    });
    function createRoom(players, status = types_1.RoomStatus.LOBBY) {
        return {
            id: 'room-id',
            code: 'ABC123',
            gameType: 'DETECTIVE_CLUB',
            status,
            roomHostId: 'p1',
            createdAt: new Date(),
            config: { hostSelection: 'FIXED', timerMin: 1 },
            players: players.map((p, i) => ({
                id: p.socketId,
                socketId: p.socketId,
                name: `P${i}`,
                score: 0,
                roomId: 'room-id',
                connected: p.connected !== false,
            })),
        };
    }
    const threePlayers = () => [{ socketId: 'p1' }, { socketId: 'p2' }, { socketId: 'p3' }];
    function startGame(room) {
        const result = service.startGame(room, 'p1');
        expect(result).not.toBeNull();
        return result;
    }
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('startGame', () => {
        it('should not start game if players < 3', () => {
            const room = createRoom([{ socketId: 'p1' }, { socketId: 'p2' }]);
            expect(service.startGame(room, 'p1')).toBeNull();
        });
        it('should not start game if requester is not host', () => {
            const room = createRoom(threePlayers());
            expect(service.startGame(room, 'p2')).toBeNull();
        });
        it('should not start game unless the room is in LOBBY', () => {
            const room = createRoom(threePlayers(), types_1.RoomStatus.PLAYING);
            expect(service.startGame(room, 'p1')).toBeNull();
        });
        it('should start game with hands and roles kept out of public state', () => {
            const room = startGame(createRoom(threePlayers()));
            expect(room.status).toBe(types_1.RoomStatus.PLAYING);
            const state = room.detectiveClubState;
            expect(state.currentPhase).toBe(types_1.DetectiveClubPhase.SETUP);
            expect(state.informerId).toBeDefined();
            expect(state.conspiratorId).toBeNull();
            expect(state.word).toBeNull();
            const serialized = JSON.stringify(room);
            expect(serialized).not.toContain('dcHand');
            expect(serialized).not.toContain('/images/detective-club/card');
            for (const p of room.players) {
                expect(privateState.get(room.code, p.socketId, 'dcHand')).toHaveLength(5);
                expect(privateState.get(room.code, p.socketId, 'dcRole')).toBeDefined();
            }
            expect(JSON.stringify(state.players)).not.toContain('"role"');
        });
    });
    describe('submitWord', () => {
        it('should not submit word if not informer', () => {
            const room = startGame(createRoom(threePlayers()));
            const informerId = room.detectiveClubState.informerId;
            const nonInformer = room.players.find((p) => p.socketId !== informerId);
            expect(service.submitWord(room, nonInformer.socketId, 'apple')).toBeNull();
        });
        it('should reject empty or oversized words', () => {
            const room = startGame(createRoom(threePlayers()));
            expect(service.submitWord(room, room.detectiveClubState.informerId, '   ')).toBeNull();
            expect(service.submitWord(room, room.detectiveClubState.informerId, 'a'.repeat(31))).toBeNull();
        });
        it('should deliver the word privately to everyone except the conspirator', () => {
            const room = startGame(createRoom(threePlayers()));
            const state = room.detectiveClubState;
            const informerId = state.informerId;
            const conspiratorId = privateState.get(room.code, '__room__', 'dcRoomConspirator');
            const result = service.submitWord(room, informerId, 'apple');
            expect(result.detectiveClubState.currentPhase).toBe(types_1.DetectiveClubPhase.PLAYING_ROUND_1);
            expect(result.detectiveClubState.activePlayerId).toBe(informerId);
            expect(result.detectiveClubState.playOrder).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
            expect(result.detectiveClubState.word).toBeNull();
            expect(JSON.stringify(result)).not.toContain('apple');
            for (const p of room.players) {
                if (p.socketId === conspiratorId) {
                    expect(privateState.get(room.code, p.socketId, 'dcWord')).toBeUndefined();
                }
                else {
                    expect(privateState.get(room.code, p.socketId, 'dcWord')).toBe('apple');
                }
            }
        });
    });
    describe('playCard', () => {
        function startAndSubmit(room) {
            startGame(room);
            service.submitWord(room, room.detectiveClubState.informerId, 'apple');
            return room;
        }
        it('rejects plays by non-active players and out-of-range indexes', () => {
            const room = startAndSubmit(createRoom(threePlayers()));
            const state = room.detectiveClubState;
            const others = room.players.filter((p) => p.socketId !== state.activePlayerId);
            expect(service.playCard(room, others[0].socketId, 0)).toBeNull();
            expect(service.playCard(room, state.activePlayerId, -1)).toBeNull();
            expect(service.playCard(room, state.activePlayerId, 99)).toBeNull();
            expect(service.playCard(room, state.activePlayerId, 1.5)).toBeNull();
        });
        it('advances to DISCUSSION after two rounds and reveals the word', () => {
            const room = startAndSubmit(createRoom(threePlayers()));
            for (let i = 0; i < 6; i++) {
                const state = room.detectiveClubState;
                if (state.currentPhase === types_1.DetectiveClubPhase.DISCUSSION)
                    break;
                const result = service.playCard(room, state.activePlayerId, 0);
                expect(result).not.toBeNull();
            }
            const state = room.detectiveClubState;
            expect(state.currentPhase).toBe(types_1.DetectiveClubPhase.DISCUSSION);
            expect(state.word).toBe('apple');
            expect(JSON.stringify(room)).not.toContain('dcWord');
        });
    });
    describe('submitVote', () => {
        function setupVoting(room, connected = {}) {
            startGame(room);
            service.submitWord(room, room.detectiveClubState.informerId, 'apple');
            for (let i = 0; i < 6; i++) {
                const state = room.detectiveClubState;
                if (state.currentPhase === types_1.DetectiveClubPhase.DISCUSSION)
                    break;
                service.playCard(room, state.activePlayerId, 0);
            }
            service.nextPhase(room, 'p1');
            Object.entries(connected).forEach(([socketId, isConnected]) => {
                const p = room.players.find((player) => player.socketId === socketId);
                p.connected = isConnected;
            });
            return room;
        }
        it('rejects self votes, informer votes, informer targets, and re-votes', () => {
            const room = setupVoting(createRoom(threePlayers()));
            const state = room.detectiveClubState;
            const informerId = state.informerId;
            const voters = room.players.filter((p) => p.socketId !== informerId);
            const conspiratorId = privateState.get(room.code, '__room__', 'dcRoomConspirator');
            expect(service.submitVote(room, informerId, conspiratorId)).toBeNull();
            expect(service.submitVote(room, voters[0].socketId, voters[0].socketId)).toBeNull();
            expect(service.submitVote(room, voters[0].socketId, informerId)).toBeNull();
            expect(service.submitVote(room, voters[0].socketId, 'stranger')).toBeNull();
            const target = voters[1].socketId;
            expect(service.submitVote(room, voters[0].socketId, target)).not.toBeNull();
            expect(service.submitVote(room, voters[0].socketId, conspiratorId)).toBeNull();
        });
        it('resolves scoring even when a player is disconnected', () => {
            const room = setupVoting(createRoom(threePlayers()));
            const state = room.detectiveClubState;
            const informerId = state.informerId;
            const conspiratorId = privateState.get(room.code, '__room__', 'dcRoomConspirator');
            const voters = room.players.filter((p) => p.socketId !== informerId);
            const remainingVoter = voters.find((p) => p.socketId !== conspiratorId);
            const conspiratorPlayer = room.players.find((p) => p.socketId === conspiratorId);
            conspiratorPlayer.connected = false;
            const result = service.submitVote(room, remainingVoter.socketId, conspiratorId);
            expect(result.detectiveClubState.currentPhase).toBe(types_1.DetectiveClubPhase.SCORING);
            expect(result.detectiveClubState.conspiratorId).toBe(conspiratorId);
            expect(result.detectiveClubState.players[conspiratorId].role).toBe(types_1.DetectiveClubRole.CONSPIRATOR);
        });
    });
    describe('nextPhase', () => {
        it('should move from discussion to voting only for the host', () => {
            const room = createRoom(threePlayers());
            room.detectiveClubState = {
                currentPhase: types_1.DetectiveClubPhase.DISCUSSION,
            };
            expect(service.nextPhase(room, 'p2')).toBeNull();
            expect(service.nextPhase(room, 'p1').detectiveClubState.currentPhase).toBe(types_1.DetectiveClubPhase.VOTING);
        });
        it('should not move when not in DISCUSSION', () => {
            const room = createRoom(threePlayers());
            room.detectiveClubState = {
                currentPhase: types_1.DetectiveClubPhase.VOTING,
            };
            expect(service.nextPhase(room, 'p1')).toBeNull();
        });
    });
    describe('nextRound', () => {
        it('rotates the informer among connected players only and keeps cards in discard', () => {
            const room = createRoom([
                { socketId: 'p1' },
                { socketId: 'p2' },
                { socketId: 'p3' },
                { socketId: 'p4', connected: false },
            ]);
            startGame(room);
            const state = room.detectiveClubState;
            const informerId = state.informerId;
            service.submitWord(room, informerId, 'apple');
            const dcPlayer = state.players[informerId];
            dcPlayer.playedCards.push('/images/detective-club/card1.jpg');
            room.detectiveClubState.currentPhase = types_1.DetectiveClubPhase.SCORING;
            const result = service.nextRound(room, 'p1');
            expect(result).not.toBeNull();
            const next = result.detectiveClubState;
            expect(next.currentPhase).toBe(types_1.DetectiveClubPhase.SETUP);
            expect(next.informerId).not.toBe('p4');
            expect(next.informerId).not.toBe(informerId);
            expect(next.word).toBeNull();
            expect(JSON.stringify(next)).not.toContain('/images/detective-club/card1.jpg');
        });
        it('should not advance if not in SCORING or not host', () => {
            const room = startGame(createRoom(threePlayers()));
            expect(service.nextRound(room, 'p2')).toBeNull();
            expect(service.nextRound(room, 'p1')).toBeNull();
        });
    });
    describe('handlePlayerDisconnect', () => {
        it('reassigns the informer when the informer disconnects during SETUP', () => {
            const room = startGame(createRoom(threePlayers()));
            const informerId = room.detectiveClubState.informerId;
            service.handlePlayerDisconnect(room, informerId);
            const state = room.detectiveClubState;
            expect(state.informerId).not.toBe(informerId);
            expect(privateState.get(room.code, state.informerId, 'dcRole')).toBe(types_1.DetectiveClubRole.INFORMER);
        });
        it('advances the turn when the active player disconnects', () => {
            const room = startGame(createRoom(threePlayers()));
            service.submitWord(room, room.detectiveClubState.informerId, 'apple');
            const activeId = room.detectiveClubState.activePlayerId;
            const activePlayer = room.players.find((p) => p.socketId === activeId);
            activePlayer.connected = false;
            service.handlePlayerDisconnect(room, activeId);
            expect(room.detectiveClubState.activePlayerId).not.toBe(activeId);
        });
    });
});
//# sourceMappingURL=detective-club.service.spec.js.map