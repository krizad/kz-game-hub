"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BattleshipService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleshipService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
let BattleshipService = BattleshipService_1 = class BattleshipService {
    constructor(privateState) {
        this.privateState = privateState;
        this.logger = new common_1.Logger(BattleshipService_1.name);
        this.pendingShots = new Map();
    }
    getFleetConfig(preset) {
        return preset === 'CLASSIC_10x10' ? types_1.CLASSIC_10x10_FLEET : types_1.QUICK_8x8_FLEET;
    }
    getGridSize(preset) {
        return preset === 'CLASSIC_10x10' ? 10 : 8;
    }
    initLobby(room) {
        room.config.battleshipMode ??= 'FREE_FOR_ALL';
        room.config.battleshipTeamFleetMode ??= 'SHARED_BOARD';
        room.config.battleshipGridPreset ??= 'CLASSIC_10x10';
        room.config.battleshipHitStreak ??= true;
        room.config.battleshipTurnSeconds ??= types_1.BATTLESHIP_DEFAULT_TURN_SECONDS;
    }
    createInitialState(players, config) {
        const mode = config?.battleshipMode ?? 'FREE_FOR_ALL';
        const teamFleetMode = config?.battleshipTeamFleetMode ?? 'SHARED_BOARD';
        const gridPreset = config?.battleshipGridPreset ?? 'CLASSIC_10x10';
        const gridSize = this.getGridSize(gridPreset);
        const hitStreakEnabled = mode === 'FREE_FOR_ALL' ? false : (config?.battleshipHitStreak ?? true);
        const activePlayers = players.filter((p) => !p.isViewer && p.connected !== false);
        const alivePlayerIds = activePlayers.map((p) => p.socketId);
        const teams = {};
        if (mode === 'TEAM_VS_TEAM') {
            activePlayers.forEach((p, idx) => {
                teams[p.socketId] = idx % 2 === 0 ? 'RED' : 'BLUE';
            });
        }
        const targetGrids = {};
        const shipsRemaining = {};
        const sunkShips = {};
        const placementReady = {};
        const battleStats = {};
        const fleetCount = this.getFleetConfig(gridPreset).length;
        if (mode === 'TEAM_VS_TEAM' && teamFleetMode === 'SHARED_BOARD') {
            ['RED', 'BLUE'].forEach((teamKey) => {
                targetGrids[teamKey] = {};
                shipsRemaining[teamKey] = fleetCount;
                sunkShips[teamKey] = [];
                placementReady[teamKey] = false;
            });
        }
        else {
            alivePlayerIds.forEach((socketId) => {
                targetGrids[socketId] = {};
                shipsRemaining[socketId] = fleetCount;
                sunkShips[socketId] = [];
                placementReady[socketId] = false;
            });
        }
        alivePlayerIds.forEach((socketId) => {
            battleStats[socketId] = {
                shotsFired: 0,
                hits: 0,
                misses: 0,
                shipsSunk: 0,
                collisions: 0,
                accuracy: 0,
            };
        });
        return {
            mode,
            teamFleetMode,
            gridPreset,
            gridSize,
            phase: 'PLACEMENT',
            round: 1,
            teams,
            turnPlayerId: null,
            currentTurnTeam: null,
            turnDeadline: Date.now() + types_1.BATTLESHIP_PLACEMENT_SECONDS * 1000,
            hitStreakEnabled,
            consecutiveHits: 0,
            targetGrids,
            shipsRemaining,
            sunkShips,
            alivePlayerIds,
            placementReady,
            pings: { RED: [], BLUE: [] },
            lastVolleyResults: [],
            winner: null,
            battleStats,
        };
    }
    generateRandomShipPlacement(gridSize, preset) {
        const fleet = this.getFleetConfig(preset);
        const placements = [];
        const occupied = new Set();
        for (const ship of fleet) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 200) {
                attempts++;
                const orientation = Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL';
                const maxX = orientation === 'HORIZONTAL' ? gridSize - ship.length : gridSize - 1;
                const maxY = orientation === 'VERTICAL' ? gridSize - ship.length : gridSize - 1;
                const startX = Math.floor(Math.random() * (maxX + 1));
                const startY = Math.floor(Math.random() * (maxY + 1));
                const coords = [];
                let collision = false;
                for (let i = 0; i < ship.length; i++) {
                    const cx = orientation === 'HORIZONTAL' ? startX + i : startX;
                    const cy = orientation === 'VERTICAL' ? startY + i : startY;
                    if (occupied.has(`${cx},${cy}`)) {
                        collision = true;
                        break;
                    }
                    coords.push({ x: cx, y: cy });
                }
                if (!collision) {
                    coords.forEach((c) => occupied.add(`${c.x},${c.y}`));
                    placements.push({
                        id: (0, node_crypto_1.randomUUID)(),
                        type: ship.type,
                        x: startX,
                        y: startY,
                        orientation,
                        length: ship.length,
                        hits: 0,
                        sunk: false,
                    });
                    placed = true;
                }
            }
            if (!placed) {
                for (let y = 0; y < gridSize && !placed; y++) {
                    for (let x = 0; x <= gridSize - ship.length && !placed; x++) {
                        let coll = false;
                        for (let i = 0; i < ship.length; i++) {
                            if (occupied.has(`${x + i},${y}`)) {
                                coll = true;
                                break;
                            }
                        }
                        if (!coll) {
                            for (let i = 0; i < ship.length; i++)
                                occupied.add(`${x + i},${y}`);
                            placements.push({
                                id: (0, node_crypto_1.randomUUID)(),
                                type: ship.type,
                                x,
                                y,
                                orientation: 'HORIZONTAL',
                                length: ship.length,
                                hits: 0,
                                sunk: false,
                            });
                            placed = true;
                        }
                    }
                }
            }
        }
        return placements;
    }
    startGame(room, requesterId) {
        if (room.roomHostId !== requesterId && room.hostPlayerId !== requesterId) {
            return null;
        }
        const activePlayers = room.players.filter((p) => !p.isViewer && p.connected !== false);
        if (activePlayers.length < types_1.BATTLESHIP_MIN_PLAYERS) {
            return null;
        }
        this.pendingShots.delete(room.code);
        this.privateState.clearRoom(room.code);
        room.status = types_1.RoomStatus.PLAYING;
        room.battleshipState = this.createInitialState(room.players, room.config);
        return room;
    }
    placeShips(room, socketId, payload) {
        const state = room.battleshipState;
        if (!state || state.phase !== 'PLACEMENT') {
            return { error: 'Game is not in placement phase' };
        }
        const targetId = this.resolveTargetId(state, socketId);
        if (!targetId) {
            return { error: 'Player does not have a placement target' };
        }
        const validation = this.validatePlacements(payload.ships, state.gridSize, state.gridPreset);
        if (!validation.valid) {
            return { error: validation.error || 'Invalid ship placement' };
        }
        this.saveOceanGrid(room.code, state, targetId, payload.ships);
        state.placementReady[targetId] = true;
        const allReady = Object.keys(state.targetGrids).every((tid) => state.placementReady[tid]);
        if (allReady) {
            this.transitionToPlaying(room);
        }
        return { room };
    }
    validatePlacements(ships, gridSize, preset) {
        const expectedFleet = this.getFleetConfig(preset);
        if (ships.length !== expectedFleet.length) {
            return { valid: false, error: `Expected ${expectedFleet.length} ships, got ${ships.length}` };
        }
        const occupied = new Set();
        for (const ship of ships) {
            const match = expectedFleet.find((f) => f.type === ship.type && f.length === ship.length);
            if (!match) {
                return { valid: false, error: `Invalid ship type or length: ${ship.type}` };
            }
            for (let i = 0; i < ship.length; i++) {
                const x = ship.orientation === 'HORIZONTAL' ? ship.x + i : ship.x;
                const y = ship.orientation === 'VERTICAL' ? ship.y + i : ship.y;
                if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
                    return { valid: false, error: `Ship ${ship.type} is out of bounds at (${x},${y})` };
                }
                const key = `${x},${y}`;
                if (occupied.has(key)) {
                    return { valid: false, error: `Ships overlap at coordinate (${x},${y})` };
                }
                occupied.add(key);
            }
        }
        return { valid: true };
    }
    saveOceanGrid(roomCode, state, targetId, ships) {
        if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
            const teamPlayers = Object.entries(state.teams)
                .filter(([, t]) => t === targetId)
                .map(([sid]) => sid);
            teamPlayers.forEach((sid) => {
                this.privateState.set(roomCode, sid, types_1.BATTLESHIP_PRIVATE_OCEAN_KEY, {
                    targetId,
                    ships,
                    gridSize: state.gridSize,
                });
            });
            this.privateState.set(roomCode, `__team_${targetId}__`, types_1.BATTLESHIP_PRIVATE_OCEAN_KEY, {
                targetId,
                ships,
                gridSize: state.gridSize,
            });
        }
        else {
            this.privateState.set(roomCode, targetId, types_1.BATTLESHIP_PRIVATE_OCEAN_KEY, {
                targetId,
                ships,
                gridSize: state.gridSize,
            });
        }
    }
    getOceanGrid(roomCode, state, targetId) {
        if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
            const stored = this.privateState.get(roomCode, `__team_${targetId}__`, types_1.BATTLESHIP_PRIVATE_OCEAN_KEY);
            return stored?.ships;
        }
        const stored = this.privateState.get(roomCode, targetId, types_1.BATTLESHIP_PRIVATE_OCEAN_KEY);
        return stored?.ships;
    }
    transitionToPlaying(room) {
        const state = room.battleshipState;
        state.phase = 'PLAYING';
        state.round = 1;
        const turnSeconds = room.config.battleshipTurnSeconds || types_1.BATTLESHIP_DEFAULT_TURN_SECONDS;
        state.turnDeadline = Date.now() + turnSeconds * 1000;
        if (state.mode === 'FREE_FOR_ALL') {
            state.turnPlayerId = null;
            state.currentTurnTeam = null;
        }
        else {
            const redPlayers = Object.entries(state.teams)
                .filter(([, t]) => t === 'RED')
                .map(([sid]) => sid)
                .filter((sid) => state.alivePlayerIds.includes(sid));
            state.currentTurnTeam = 'RED';
            state.turnPlayerId = redPlayers[0] || state.alivePlayerIds[0];
        }
    }
    fireShot(room, socketId, payload) {
        const state = room.battleshipState;
        if (!state || state.phase !== 'PLAYING') {
            return { error: 'Game is not in playing phase' };
        }
        if (!state.alivePlayerIds.includes(socketId)) {
            return { error: 'Eliminated players cannot fire' };
        }
        const { x, y, targetId } = payload;
        if (x < 0 || x >= state.gridSize || y < 0 || y >= state.gridSize) {
            return { error: 'Target coordinate out of bounds' };
        }
        const shooterTeam = state.teams[socketId];
        if (state.mode === 'TEAM_VS_TEAM') {
            if (state.teamFleetMode === 'SHARED_BOARD') {
                const opposingTeam = shooterTeam === 'RED' ? 'BLUE' : 'RED';
                if (targetId !== opposingTeam) {
                    return { error: 'Must target opposing team in shared board mode' };
                }
            }
            else {
                const targetTeam = state.teams[targetId];
                if (targetTeam === shooterTeam) {
                    return { error: 'Cannot fire at teammates' };
                }
                if (!state.alivePlayerIds.includes(targetId)) {
                    return { error: 'Target player is already eliminated' };
                }
            }
        }
        else {
            if (targetId === socketId) {
                return { error: 'Cannot fire at yourself' };
            }
            if (!state.alivePlayerIds.includes(targetId)) {
                return { error: 'Target player is already eliminated' };
            }
        }
        const coordKey = `${x},${y}`;
        const targetBoard = state.targetGrids[targetId];
        if (targetBoard && targetBoard[coordKey]) {
            return { error: 'Coordinate has already been fired upon' };
        }
        const shooter = room.players.find((p) => p.socketId === socketId);
        const shooterName = shooter?.name || 'Unknown';
        if (state.mode === 'FREE_FOR_ALL') {
            let roomPending = this.pendingShots.get(room.code);
            if (!roomPending) {
                roomPending = new Map();
                this.pendingShots.set(room.code, roomPending);
            }
            roomPending.set(socketId, {
                shooterId: socketId,
                shooterName,
                targetId,
                x,
                y,
            });
            if (roomPending.size >= state.alivePlayerIds.length) {
                this.resolveSimultaneousVolley(room);
            }
            return { room };
        }
        if (state.turnPlayerId !== socketId) {
            return { error: 'Not your turn to fire' };
        }
        const targetShips = this.getOceanGrid(room.code, state, targetId);
        if (!targetShips) {
            return { error: 'Target ocean grid not found' };
        }
        const hitShip = this.checkHit(targetShips, x, y);
        const targetName = this.resolveTargetName(room, state, targetId);
        const stats = state.battleStats[socketId];
        if (stats)
            stats.shotsFired++;
        if (hitShip) {
            hitShip.hits++;
            state.consecutiveHits++;
            if (stats)
                stats.hits++;
            let result = 'HIT';
            let sunkShipType;
            if (hitShip.hits >= hitShip.length) {
                hitShip.sunk = true;
                result = 'SUNK';
                sunkShipType = hitShip.type;
                state.shipsRemaining[targetId]--;
                state.sunkShips[targetId].push(hitShip.type);
                if (stats)
                    stats.shipsSunk++;
                for (let i = 0; i < hitShip.length; i++) {
                    const sx = hitShip.orientation === 'HORIZONTAL' ? hitShip.x + i : hitShip.x;
                    const sy = hitShip.orientation === 'VERTICAL' ? hitShip.y + i : hitShip.y;
                    targetBoard[`${sx},${sy}`] = 'SUNK';
                }
            }
            else {
                targetBoard[coordKey] = 'HIT';
            }
            state.lastVolleyResults = [
                {
                    shooterId: socketId,
                    shooterName,
                    targetId,
                    targetName,
                    x,
                    y,
                    result,
                    sunkShipType,
                },
            ];
            if (this.checkWinCondition(room, targetId)) {
                return { room };
            }
            if (state.hitStreakEnabled) {
                const turnSec = room.config.battleshipTurnSeconds || types_1.BATTLESHIP_DEFAULT_TURN_SECONDS;
                state.turnDeadline = Date.now() + turnSec * 1000;
                return { room };
            }
        }
        else {
            targetBoard[coordKey] = 'MISS';
            state.consecutiveHits = 0;
            if (stats)
                stats.misses++;
            state.lastVolleyResults = [
                {
                    shooterId: socketId,
                    shooterName,
                    targetId,
                    targetName,
                    x,
                    y,
                    result: 'MISS',
                },
            ];
        }
        if (stats && stats.shotsFired > 0) {
            stats.accuracy = Math.round((stats.hits / stats.shotsFired) * 100);
        }
        this.advanceSequentialTurn(room);
        return { room };
    }
    resolveSimultaneousVolley(room) {
        const state = room.battleshipState;
        const roomPending = this.pendingShots.get(room.code) ?? new Map();
        this.pendingShots.delete(room.code);
        const shots = Array.from(roomPending.values());
        const volleyResults = [];
        const shotsByTargetCell = new Map();
        for (const shot of shots) {
            const key = `${shot.targetId}:${shot.x},${shot.y}`;
            const list = shotsByTargetCell.get(key) || [];
            list.push(shot);
            shotsByTargetCell.set(key, list);
        }
        for (const [key, group] of shotsByTargetCell.entries()) {
            const [targetId, coordStr] = key.split(':');
            const [xStr, yStr] = coordStr.split(',');
            const x = Number(xStr);
            const y = Number(yStr);
            const targetBoard = state.targetGrids[targetId] || {};
            const targetName = this.resolveTargetName(room, state, targetId);
            if (group.length > 1) {
                targetBoard[`${x},${y}`] = 'COLLISION';
                for (const shot of group) {
                    const stats = state.battleStats[shot.shooterId];
                    if (stats) {
                        stats.shotsFired++;
                        stats.collisions++;
                        stats.misses++;
                        if (stats.shotsFired > 0) {
                            stats.accuracy = Math.round((stats.hits / stats.shotsFired) * 100);
                        }
                    }
                    volleyResults.push({
                        shooterId: shot.shooterId,
                        shooterName: shot.shooterName,
                        targetId,
                        targetName,
                        x,
                        y,
                        result: 'COLLISION',
                    });
                }
            }
            else {
                const shot = group[0];
                const stats = state.battleStats[shot.shooterId];
                if (stats)
                    stats.shotsFired++;
                const targetShips = this.getOceanGrid(room.code, state, targetId);
                const hitShip = targetShips ? this.checkHit(targetShips, x, y) : undefined;
                if (hitShip) {
                    hitShip.hits++;
                    if (stats)
                        stats.hits++;
                    let result = 'HIT';
                    let sunkShipType;
                    if (hitShip.hits >= hitShip.length) {
                        hitShip.sunk = true;
                        result = 'SUNK';
                        sunkShipType = hitShip.type;
                        state.shipsRemaining[targetId]--;
                        state.sunkShips[targetId].push(hitShip.type);
                        if (stats)
                            stats.shipsSunk++;
                        for (let i = 0; i < hitShip.length; i++) {
                            const sx = hitShip.orientation === 'HORIZONTAL' ? hitShip.x + i : hitShip.x;
                            const sy = hitShip.orientation === 'VERTICAL' ? hitShip.y + i : hitShip.y;
                            targetBoard[`${sx},${sy}`] = 'SUNK';
                        }
                    }
                    else {
                        targetBoard[`${x},${y}`] = 'HIT';
                    }
                    volleyResults.push({
                        shooterId: shot.shooterId,
                        shooterName: shot.shooterName,
                        targetId,
                        targetName,
                        x,
                        y,
                        result,
                        sunkShipType,
                    });
                }
                else {
                    targetBoard[`${x},${y}`] = 'MISS';
                    if (stats)
                        stats.misses++;
                    volleyResults.push({
                        shooterId: shot.shooterId,
                        shooterName: shot.shooterName,
                        targetId,
                        targetName,
                        x,
                        y,
                        result: 'MISS',
                    });
                }
                if (stats && stats.shotsFired > 0) {
                    stats.accuracy = Math.round((stats.hits / stats.shotsFired) * 100);
                }
            }
        }
        state.lastVolleyResults = volleyResults;
        for (const pid of [...state.alivePlayerIds]) {
            if (state.shipsRemaining[pid] <= 0) {
                state.alivePlayerIds = state.alivePlayerIds.filter((id) => id !== pid);
            }
        }
        if (state.alivePlayerIds.length <= 1) {
            const winnerId = state.alivePlayerIds[0];
            const winnerPlayer = room.players.find((p) => p.socketId === winnerId);
            this.finishGame(room, {
                mode: 'FREE_FOR_ALL',
                playerId: winnerId,
                playerName: winnerPlayer?.name || 'Champion',
            });
            return;
        }
        state.round++;
        const turnSeconds = room.config.battleshipTurnSeconds || types_1.BATTLESHIP_DEFAULT_TURN_SECONDS;
        state.turnDeadline = Date.now() + turnSeconds * 1000;
    }
    checkHit(ships, x, y) {
        return ships.find((ship) => {
            for (let i = 0; i < ship.length; i++) {
                const sx = ship.orientation === 'HORIZONTAL' ? ship.x + i : ship.x;
                const sy = ship.orientation === 'VERTICAL' ? ship.y + i : ship.y;
                if (sx === x && sy === y)
                    return true;
            }
            return false;
        });
    }
    advanceSequentialTurn(room) {
        const state = room.battleshipState;
        state.consecutiveHits = 0;
        if (state.mode === 'TEAM_VS_TEAM') {
            const nextTeam = state.currentTurnTeam === 'RED' ? 'BLUE' : 'RED';
            state.currentTurnTeam = nextTeam;
            const teamPlayers = Object.entries(state.teams)
                .filter(([, t]) => t === nextTeam)
                .map(([sid]) => sid)
                .filter((sid) => state.alivePlayerIds.includes(sid));
            if (teamPlayers.length === 0) {
                this.checkWinCondition(room, nextTeam);
                return;
            }
            const prevShooter = state.turnPlayerId;
            const prevIdx = prevShooter ? teamPlayers.indexOf(prevShooter) : -1;
            const nextShooter = teamPlayers[(prevIdx + 1) % teamPlayers.length];
            state.turnPlayerId = nextShooter;
        }
        else {
            const living = state.alivePlayerIds;
            const currentIdx = living.indexOf(state.turnPlayerId || '');
            state.turnPlayerId = living[(currentIdx + 1) % living.length];
        }
        state.round++;
        const turnSeconds = room.config.battleshipTurnSeconds || types_1.BATTLESHIP_DEFAULT_TURN_SECONDS;
        state.turnDeadline = Date.now() + turnSeconds * 1000;
    }
    checkWinCondition(room, defeatedTargetId) {
        const state = room.battleshipState;
        if (state.mode === 'TEAM_VS_TEAM') {
            if (state.teamFleetMode === 'SHARED_BOARD') {
                if (state.shipsRemaining[defeatedTargetId] <= 0) {
                    const winningTeam = defeatedTargetId === 'RED' ? 'BLUE' : 'RED';
                    this.finishGame(room, {
                        mode: 'TEAM_VS_TEAM',
                        team: winningTeam,
                    });
                    return true;
                }
            }
            else {
                if (state.shipsRemaining[defeatedTargetId] <= 0) {
                    state.alivePlayerIds = state.alivePlayerIds.filter((id) => id !== defeatedTargetId);
                }
                const redAlive = state.alivePlayerIds.filter((id) => state.teams[id] === 'RED');
                const blueAlive = state.alivePlayerIds.filter((id) => state.teams[id] === 'BLUE');
                if (redAlive.length === 0) {
                    this.finishGame(room, { mode: 'TEAM_VS_TEAM', team: 'BLUE' });
                    return true;
                }
                if (blueAlive.length === 0) {
                    this.finishGame(room, { mode: 'TEAM_VS_TEAM', team: 'RED' });
                    return true;
                }
            }
        }
        else {
            if (state.shipsRemaining[defeatedTargetId] <= 0) {
                state.alivePlayerIds = state.alivePlayerIds.filter((id) => id !== defeatedTargetId);
            }
            if (state.alivePlayerIds.length <= 1) {
                const winnerId = state.alivePlayerIds[0];
                const winnerPlayer = room.players.find((p) => p.socketId === winnerId);
                this.finishGame(room, {
                    mode: 'FREE_FOR_ALL',
                    playerId: winnerId,
                    playerName: winnerPlayer?.name || 'Champion',
                });
                return true;
            }
        }
        return false;
    }
    finishGame(room, winner) {
        const state = room.battleshipState;
        state.phase = 'RESULT';
        state.winner = winner;
        state.turnDeadline = null;
        room.status = types_1.RoomStatus.RESULT;
        const revealed = {};
        Object.keys(state.targetGrids).forEach((tid) => {
            const ships = this.getOceanGrid(room.code, state, tid);
            if (ships)
                revealed[tid] = ships;
        });
        state.revealedOceanGrids = revealed;
        if (winner.team) {
            room.players.forEach((p) => {
                if (state.teams[p.socketId] === winner.team) {
                    p.score = (p.score || 0) + 1;
                }
            });
        }
        else if (winner.playerId) {
            const winnerPlayer = room.players.find((p) => p.socketId === winner.playerId);
            if (winnerPlayer) {
                winnerPlayer.score = (winnerPlayer.score || 0) + 1;
            }
        }
    }
    pingCoordinate(room, socketId, payload) {
        const state = room.battleshipState;
        if (!state || state.phase !== 'PLAYING') {
            return { error: 'Game is not playing' };
        }
        const team = state.teams[socketId];
        if (!team) {
            return { error: 'Pings are only available in team mode' };
        }
        const player = room.players.find((p) => p.socketId === socketId);
        const newPing = {
            id: (0, node_crypto_1.randomUUID)(),
            playerId: socketId,
            playerName: player?.name || 'Teammate',
            x: payload.x,
            y: payload.y,
            createdAt: Date.now(),
        };
        const now = Date.now();
        const teamPings = (state.pings[team] || []).filter((p) => now - p.createdAt < 10000);
        teamPings.push(newPing);
        state.pings[team] = teamPings;
        return { room };
    }
    handleTimeout(room, deadline) {
        const state = room.battleshipState;
        if (!state || state.turnDeadline !== deadline) {
            return null;
        }
        if (state.phase === 'PLACEMENT') {
            for (const targetId of Object.keys(state.targetGrids)) {
                if (!state.placementReady[targetId]) {
                    const autoShips = this.generateRandomShipPlacement(state.gridSize, state.gridPreset);
                    this.saveOceanGrid(room.code, state, targetId, autoShips);
                    state.placementReady[targetId] = true;
                }
            }
            this.transitionToPlaying(room);
            return room;
        }
        if (state.phase === 'PLAYING') {
            if (state.mode === 'FREE_FOR_ALL') {
                const roomPending = this.pendingShots.get(room.code) ?? new Map();
                for (const pid of state.alivePlayerIds) {
                    if (!roomPending.has(pid)) {
                        const autoTarget = this.pickRandomTargetAndCoordinate(state, pid);
                        if (autoTarget) {
                            const player = room.players.find((p) => p.socketId === pid);
                            roomPending.set(pid, {
                                shooterId: pid,
                                shooterName: player?.name || 'AFK Player',
                                targetId: autoTarget.targetId,
                                x: autoTarget.x,
                                y: autoTarget.y,
                            });
                        }
                    }
                }
                this.pendingShots.set(room.code, roomPending);
                this.resolveSimultaneousVolley(room);
                return room;
            }
            if (state.turnPlayerId) {
                const autoTarget = this.pickRandomTargetAndCoordinate(state, state.turnPlayerId);
                if (autoTarget) {
                    this.fireShot(room, state.turnPlayerId, {
                        targetId: autoTarget.targetId,
                        x: autoTarget.x,
                        y: autoTarget.y,
                    });
                    return room;
                }
                this.advanceSequentialTurn(room);
                return room;
            }
        }
        return null;
    }
    pickRandomTargetAndCoordinate(state, shooterId) {
        let validTargets = [];
        if (state.mode === 'TEAM_VS_TEAM') {
            const myTeam = state.teams[shooterId];
            const opposingTeam = myTeam === 'RED' ? 'BLUE' : 'RED';
            if (state.teamFleetMode === 'SHARED_BOARD') {
                validTargets = [opposingTeam];
            }
            else {
                validTargets = state.alivePlayerIds.filter((id) => state.teams[id] === opposingTeam);
            }
        }
        else {
            validTargets = state.alivePlayerIds.filter((id) => id !== shooterId);
        }
        if (validTargets.length === 0)
            return null;
        const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
        const targetBoard = state.targetGrids[targetId] || {};
        const availableCoords = [];
        for (let y = 0; y < state.gridSize; y++) {
            for (let x = 0; x < state.gridSize; x++) {
                if (!targetBoard[`${x},${y}`]) {
                    availableCoords.push({ x, y });
                }
            }
        }
        if (availableCoords.length === 0)
            return null;
        const choice = availableCoords[Math.floor(Math.random() * availableCoords.length)];
        return { targetId, x: choice.x, y: choice.y };
    }
    handlePlayerDisconnect(room, socketId) {
        const state = room.battleshipState;
        if (!state || state.phase !== 'PLAYING')
            return;
        if (state.turnPlayerId === socketId && state.mode === 'TEAM_VS_TEAM') {
            this.advanceSequentialTurn(room);
        }
    }
    handleReconnect(room, playerId) {
        const state = room.battleshipState;
        if (!state)
            return;
        const player = room.players.find((p) => p.id === playerId);
        if (!player)
            return;
        const targetId = this.resolveTargetId(state, player.socketId);
        if (targetId) {
            const ships = this.getOceanGrid(room.code, state, targetId);
            if (ships) {
                this.privateState.set(room.code, player.socketId, types_1.BATTLESHIP_PRIVATE_OCEAN_KEY, {
                    targetId,
                    ships,
                    gridSize: state.gridSize,
                });
            }
        }
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.teams[oldSocketId]) {
            state.teams[newSocketId] = state.teams[oldSocketId];
            delete state.teams[oldSocketId];
        }
        const aliveIdx = state.alivePlayerIds.indexOf(oldSocketId);
        if (aliveIdx !== -1) {
            state.alivePlayerIds[aliveIdx] = newSocketId;
        }
        if (state.turnPlayerId === oldSocketId) {
            state.turnPlayerId = newSocketId;
        }
        if (state.battleStats[oldSocketId]) {
            state.battleStats[newSocketId] = state.battleStats[oldSocketId];
            delete state.battleStats[oldSocketId];
        }
        if (state.targetGrids[oldSocketId]) {
            state.targetGrids[newSocketId] = state.targetGrids[oldSocketId];
            delete state.targetGrids[oldSocketId];
        }
        if (state.placementReady[oldSocketId] !== undefined) {
            state.placementReady[newSocketId] = state.placementReady[oldSocketId];
            delete state.placementReady[oldSocketId];
        }
    }
    reset(room, requesterId) {
        if (room.roomHostId !== requesterId && room.hostPlayerId !== requesterId) {
            return null;
        }
        this.pendingShots.delete(room.code);
        this.privateState.clearRoom(room.code);
        room.status = types_1.RoomStatus.LOBBY;
        room.battleshipState = undefined;
        return room;
    }
    resolveTargetId(state, socketId) {
        if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
            return state.teams[socketId] || null;
        }
        return socketId;
    }
    resolveTargetName(room, state, targetId) {
        if (targetId === 'RED')
            return 'ทีมแดง (Red Team)';
        if (targetId === 'BLUE')
            return 'ทีมน้ำเงิน (Blue Team)';
        const player = room.players.find((p) => p.socketId === targetId);
        return player?.name || targetId;
    }
};
exports.BattleshipService = BattleshipService;
exports.BattleshipService = BattleshipService = BattleshipService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], BattleshipService);
//# sourceMappingURL=battleship.service.js.map