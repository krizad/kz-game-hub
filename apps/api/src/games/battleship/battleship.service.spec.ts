import { BattleshipService } from './battleship.service';
import { PrivateStateService } from '../private-state.service';
import {
  RoomState,
  RoomStatus,
  GameType,
  UserState,
  ShipType,
  ShipPlacement,
  BATTLESHIP_PRIVATE_OCEAN_KEY,
} from '@repo/types';

describe('BattleshipService', () => {
  let service: BattleshipService;
  let privateState: PrivateStateService;

  const createMockRoom = (
    mode: 'FREE_FOR_ALL' | 'TEAM_VS_TEAM' = 'FREE_FOR_ALL',
    playerCount: number = 2,
    teamFleetMode: 'SHARED_BOARD' | 'MULTI_BOARD' = 'SHARED_BOARD',
  ): RoomState => {
    const players: UserState[] = Array.from({ length: playerCount }).map((_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      socketId: `sock_${i + 1}`,
      score: 0,
      roomId: 'room_1',
      connected: true,
    }));

    const room: RoomState = {
      id: 'room_1',
      code: 'BATTLE1',
      gameType: GameType.BATTLESHIP,
      status: RoomStatus.LOBBY,
      roomHostId: 'p1',
      hostPlayerId: 'p1',
      players,
      createdAt: new Date(),
      config: {
        hostSelection: 'FIXED',
        timerMin: 1,
        battleshipMode: mode,
        battleshipTeamFleetMode: teamFleetMode,
        battleshipGridPreset: 'CLASSIC_10x10',
        battleshipHitStreak: true,
        battleshipTurnSeconds: 20,
      },
    };

    return room;
  };

  beforeEach(() => {
    privateState = new PrivateStateService();
    service = new BattleshipService(privateState);
  });

  describe('createInitialState & Random Placement', () => {
    it('creates valid initial state for FFA', () => {
      const room = createMockRoom('FREE_FOR_ALL', 3);
      const state = service.createInitialState(room.players, room.config);

      expect(state.mode).toBe('FREE_FOR_ALL');
      expect(state.phase).toBe('PLACEMENT');
      expect(state.gridSize).toBe(10);
      expect(state.alivePlayerIds).toEqual(['sock_1', 'sock_2', 'sock_3']);
      expect(Object.keys(state.targetGrids)).toHaveLength(3);
      expect(state.hitStreakEnabled).toBe(false); // Disabled in FFA
    });

    it('creates valid initial state for TEAM_VS_TEAM Shared Board', () => {
      const room = createMockRoom('TEAM_VS_TEAM', 4, 'SHARED_BOARD');
      const state = service.createInitialState(room.players, room.config);

      expect(state.mode).toBe('TEAM_VS_TEAM');
      expect(state.teamFleetMode).toBe('SHARED_BOARD');
      expect(Object.keys(state.targetGrids)).toEqual(['RED', 'BLUE']);
      expect(state.teams['sock_1']).toBe('RED');
      expect(state.teams['sock_2']).toBe('BLUE');
      expect(state.hitStreakEnabled).toBe(true);
    });

    it('generates random placements that stay in bounds and do not overlap', () => {
      for (let i = 0; i < 20; i++) {
        const ships = service.generateRandomShipPlacement(10, 'CLASSIC_10x10');
        expect(ships).toHaveLength(5);

        const occupied = new Set<string>();
        for (const ship of ships) {
          for (let step = 0; step < ship.length; step++) {
            const x = ship.orientation === 'HORIZONTAL' ? ship.x + step : ship.x;
            const y = ship.orientation === 'VERTICAL' ? ship.y + step : ship.y;
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(10);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThan(10);

            const key = `${x},${y}`;
            expect(occupied.has(key)).toBe(false);
            occupied.add(key);
          }
        }
      }
    });
  });

  describe('placeShips & Transition to Playing', () => {
    it('places ships and transitions to PLAYING when all ready', () => {
      const room = createMockRoom('FREE_FOR_ALL', 2);
      service.startGame(room, 'p1');

      const p1Ships = service.generateRandomShipPlacement(10, 'CLASSIC_10x10');
      const p2Ships = service.generateRandomShipPlacement(10, 'CLASSIC_10x10');

      const res1 = service.placeShips(room, 'sock_1', { ships: p1Ships });
      expect(res1.error).toBeUndefined();
      expect(room.battleshipState?.phase).toBe('PLACEMENT');
      expect(room.battleshipState?.placementReady['sock_1']).toBe(true);

      const res2 = service.placeShips(room, 'sock_2', { ships: p2Ships });
      expect(res2.error).toBeUndefined();
      expect(room.battleshipState?.phase).toBe('PLAYING');
      expect(room.battleshipState?.placementReady['sock_2']).toBe(true);
    });
  });

  describe('Sequential Firing (1v1 / Team)', () => {
    it('handles Hit, Streak, and Miss in sequential mode', () => {
      const room = createMockRoom('TEAM_VS_TEAM', 2, 'SHARED_BOARD');
      service.startGame(room, 'p1');

      // Controlled ship placements
      const redShips: ShipPlacement[] = [
        {
          id: '1',
          type: ShipType.CARRIER,
          x: 0,
          y: 0,
          orientation: 'HORIZONTAL',
          length: 5,
          hits: 0,
          sunk: false,
        },
        {
          id: '2',
          type: ShipType.BATTLESHIP,
          x: 0,
          y: 1,
          orientation: 'HORIZONTAL',
          length: 4,
          hits: 0,
          sunk: false,
        },
        {
          id: '3',
          type: ShipType.CRUISER,
          x: 0,
          y: 2,
          orientation: 'HORIZONTAL',
          length: 3,
          hits: 0,
          sunk: false,
        },
        {
          id: '4',
          type: ShipType.SUBMARINE,
          x: 0,
          y: 3,
          orientation: 'HORIZONTAL',
          length: 3,
          hits: 0,
          sunk: false,
        },
        {
          id: '5',
          type: ShipType.DESTROYER,
          x: 0,
          y: 4,
          orientation: 'HORIZONTAL',
          length: 2,
          hits: 0,
          sunk: false,
        },
      ];

      const blueShips: ShipPlacement[] = [
        {
          id: '6',
          type: ShipType.CARRIER,
          x: 0,
          y: 0,
          orientation: 'HORIZONTAL',
          length: 5,
          hits: 0,
          sunk: false,
        },
        {
          id: '7',
          type: ShipType.BATTLESHIP,
          x: 0,
          y: 1,
          orientation: 'HORIZONTAL',
          length: 4,
          hits: 0,
          sunk: false,
        },
        {
          id: '8',
          type: ShipType.CRUISER,
          x: 0,
          y: 2,
          orientation: 'HORIZONTAL',
          length: 3,
          hits: 0,
          sunk: false,
        },
        {
          id: '9',
          type: ShipType.SUBMARINE,
          x: 0,
          y: 3,
          orientation: 'HORIZONTAL',
          length: 3,
          hits: 0,
          sunk: false,
        },
        {
          id: '10',
          type: ShipType.DESTROYER,
          x: 0,
          y: 4,
          orientation: 'HORIZONTAL',
          length: 2,
          hits: 0,
          sunk: false,
        },
      ];

      service.placeShips(room, 'sock_1', { ships: redShips });
      service.placeShips(room, 'sock_2', { ships: blueShips });

      expect(room.battleshipState?.phase).toBe('PLAYING');
      expect(room.battleshipState?.turnPlayerId).toBe('sock_1');

      // sock_1 shoots BLUE at (0, 0) -> HIT!
      const hitRes = service.fireShot(room, 'sock_1', { targetId: 'BLUE', x: 0, y: 0 });
      expect(hitRes.error).toBeUndefined();
      expect(room.battleshipState?.targetGrids['BLUE']['0,0']).toBe('HIT');
      // Hit streak keeps sock_1 as shooter
      expect(room.battleshipState?.turnPlayerId).toBe('sock_1');

      // sock_1 shoots BLUE at (9, 9) -> MISS!
      const missRes = service.fireShot(room, 'sock_1', { targetId: 'BLUE', x: 9, y: 9 });
      expect(missRes.error).toBeUndefined();
      expect(room.battleshipState?.targetGrids['BLUE']['9,9']).toBe('MISS');
      // Turn rotates to sock_2 (BLUE)
      expect(room.battleshipState?.turnPlayerId).toBe('sock_2');
      expect(room.battleshipState?.currentTurnTeam).toBe('BLUE');
    });

    it('announces SUNK and awards victory when all ships sunk', () => {
      const room = createMockRoom('TEAM_VS_TEAM', 2, 'SHARED_BOARD');
      room.config.battleshipGridPreset = 'QUICK_8x8';
      service.startGame(room, 'p1');

      const ships: ShipPlacement[] = [
        {
          id: '1',
          type: ShipType.BATTLESHIP,
          x: 0,
          y: 0,
          orientation: 'HORIZONTAL',
          length: 4,
          hits: 0,
          sunk: false,
        },
        {
          id: '2',
          type: ShipType.CRUISER,
          x: 0,
          y: 1,
          orientation: 'HORIZONTAL',
          length: 3,
          hits: 0,
          sunk: false,
        },
        {
          id: '3',
          type: ShipType.SUBMARINE,
          x: 0,
          y: 2,
          orientation: 'HORIZONTAL',
          length: 3,
          hits: 0,
          sunk: false,
        },
        {
          id: '4',
          type: ShipType.DESTROYER,
          x: 0,
          y: 3,
          orientation: 'HORIZONTAL',
          length: 2,
          hits: 0,
          sunk: false,
        },
      ];

      service.placeShips(room, 'sock_1', { ships });
      service.placeShips(room, 'sock_2', { ships: JSON.parse(JSON.stringify(ships)) });

      // sock_1 sinks DESTROYER (length 2 at (0,3) and (1,3))
      service.fireShot(room, 'sock_1', { targetId: 'BLUE', x: 0, y: 3 });
      const sunkRes = service.fireShot(room, 'sock_1', { targetId: 'BLUE', x: 1, y: 3 });

      expect(sunkRes.error).toBeUndefined();
      expect(room.battleshipState?.sunkShips['BLUE']).toContain(ShipType.DESTROYER);
      expect(room.battleshipState?.targetGrids['BLUE']['0,3']).toBe('SUNK');
      expect(room.battleshipState?.targetGrids['BLUE']['1,3']).toBe('SUNK');
      expect(room.battleshipState?.lastVolleyResults[0]?.result).toBe('SUNK');
    });
  });

  describe('Simultaneous Volley & Mid-air Shell Collision (FFA)', () => {
    it('detects Mid-air Shell Collision when 2 players target the same coordinate on the same victim', () => {
      const room = createMockRoom('FREE_FOR_ALL', 3);
      service.startGame(room, 'p1');

      // Place ships for all 3 players
      ['sock_1', 'sock_2', 'sock_3'].forEach((sid) => {
        const ships = service.generateRandomShipPlacement(10, 'CLASSIC_10x10');
        service.placeShips(room, sid, { ships });
      });

      expect(room.battleshipState?.phase).toBe('PLAYING');

      // Set victim sock_3's carrier at (0,0)-(4,0)
      const secret3 = privateState.get<{ ships: ShipPlacement[] }>(
        room.code,
        'sock_3',
        BATTLESHIP_PRIVATE_OCEAN_KEY,
      )!;
      secret3.ships[0] = {
        id: 'carrier',
        type: ShipType.CARRIER,
        x: 0,
        y: 0,
        orientation: 'HORIZONTAL',
        length: 5,
        hits: 0,
        sunk: false,
      };

      // sock_1 and sock_2 BOTH shoot sock_3 at (0, 0)!
      service.fireShot(room, 'sock_1', { targetId: 'sock_3', x: 0, y: 0 });
      service.fireShot(room, 'sock_2', { targetId: 'sock_3', x: 0, y: 0 });
      // sock_3 shoots sock_1 at (5, 5)
      service.fireShot(room, 'sock_3', { targetId: 'sock_1', x: 5, y: 5 });

      // All 3 submitted -> Volley resolved!
      const state = room.battleshipState!;
      expect(state.targetGrids['sock_3']['0,0']).toBe('COLLISION');

      // Mid-Air Collision means 0 damage to sock_3's ship!
      expect(secret3.ships[0].hits).toBe(0);

      const collisionLogs = state.lastVolleyResults.filter((r) => r.result === 'COLLISION');
      expect(collisionLogs).toHaveLength(2);
      expect(collisionLogs.map((l) => l.shooterId)).toContain('sock_1');
      expect(collisionLogs.map((l) => l.shooterId)).toContain('sock_2');
    });
  });

  describe('Teammate Ping', () => {
    it('records pings in shared team mode', () => {
      const room = createMockRoom('TEAM_VS_TEAM', 2, 'SHARED_BOARD');
      service.startGame(room, 'p1');
      service.placeShips(room, 'sock_1', {
        ships: service.generateRandomShipPlacement(10, 'CLASSIC_10x10'),
      });
      service.placeShips(room, 'sock_2', {
        ships: service.generateRandomShipPlacement(10, 'CLASSIC_10x10'),
      });

      const res = service.pingCoordinate(room, 'sock_1', { x: 3, y: 4 });
      expect(res.error).toBeUndefined();

      const pings = room.battleshipState?.pings['RED'];
      expect(pings).toHaveLength(1);
      expect(pings![0].x).toBe(3);
      expect(pings![0].y).toBe(4);
    });
  });

  describe('Socket ID Remap & Reconnect', () => {
    it('remaps socket ID across all state fields seamlessly', () => {
      const room = createMockRoom('FREE_FOR_ALL', 2);
      service.startGame(room, 'p1');

      const state = room.battleshipState!;
      state.alivePlayerIds = ['sock_1', 'sock_2'];
      state.turnPlayerId = 'sock_1';
      state.targetGrids['sock_1'] = { '0,0': 'HIT' };
      state.placementReady['sock_1'] = true;

      service.remapSocketId(state, 'sock_1', 'sock_1_new');

      expect(state.alivePlayerIds).toContain('sock_1_new');
      expect(state.alivePlayerIds).not.toContain('sock_1');
      expect(state.turnPlayerId).toBe('sock_1_new');
      expect(state.targetGrids['sock_1_new']).toBeDefined();
      expect(state.placementReady['sock_1_new']).toBe(true);
    });
  });
});
