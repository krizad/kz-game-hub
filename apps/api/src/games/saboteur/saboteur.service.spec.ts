import { Test, TestingModule } from '@nestjs/testing';
import { SaboteurService } from './saboteur.service';
import { PrivateStateService } from '../private-state.service';
import {
  RoomState,
  RoomStatus,
  SaboteurPhase,
  SaboteurRole,
  SaboteurTool,
  SABOTEUR_DRAW_CARDS,
  SABOTEUR_GOLD_DECK,
  SABOTEUR_ROLE_TABLE,
  SABOTEUR_HAND_SIZE_TABLE,
  saboteurCellKey,
} from '@repo/types';

const ROOM_KEY = '__room__';
const SB_ROLE = 'sbRole';
const SB_HAND = 'sbHand';
const SB_ROOM_DECK = 'sbRoomDeck';
const SB_ROOM_GOALS = 'sbRoomGoals';

describe('SaboteurService', () => {
  let service: SaboteurService;
  let privateState: PrivateStateService;

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SaboteurService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();

    service = module.get<SaboteurService>(SaboteurService);
  });

  function createRoom(playerCount: number): RoomState {
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
      status: RoomStatus.LOBBY,
      roomHostId: 'p1',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1 },
      players,
    } as unknown as RoomState;
  }

  function startGame(room: RoomState): RoomState {
    const result = service.startGame(room, 'p1');
    expect(result).not.toBeNull();
    return result!;
  }

  function setRoles(room: RoomState, roles: Record<string, SaboteurRole>): void {
    for (const [id, role] of Object.entries(roles)) {
      privateState.set(room.code, id, SB_ROLE, role);
    }
  }

  function setHand(room: RoomState, playerId: string, cardIds: string[]): void {
    privateState.set(
      room.code,
      playerId,
      SB_HAND,
      cardIds.map((cardId) => ({ cardId })),
    );
    const player = room.saboteurState!.players[playerId];
    if (player) player.handSize = cardIds.length;
  }

  function addBoardTiles(
    room: RoomState,
    tiles: Array<{ x: number; y: number; cardId: string; rotation?: 0 | 180 }>,
  ): void {
    for (const t of tiles) {
      room.saboteurState!.board[saboteurCellKey(t.x, t.y)] = {
        cardId: t.cardId,
        rotation: t.rotation ?? 0,
      };
    }
  }

  function setGoalContents(room: RoomState, contents: Array<'GOLD' | 'STONE'>): void {
    privateState.set(room.code, ROOM_KEY, SB_ROOM_GOALS, contents);
  }

  /** Horizontal tunnel from start along y=2 up to (endX,2). */
  function seedHorizontalTunnel(room: RoomState, endX: number): void {
    const tiles = [];
    for (let x = 1; x <= endX; x++) {
      tiles.push({ x, y: 2, cardId: 'path-24c' });
    }
    addBoardTiles(room, tiles);
  }

  describe('deck composition', () => {
    it('should define 67 playing cards and 28 gold cards', () => {
      const total = SABOTEUR_DRAW_CARDS.reduce((sum, d) => sum + d.quantity, 0);
      const pathTotal = SABOTEUR_DRAW_CARDS.filter((d) => d.kind === 'PATH').reduce(
        (s, d) => s + d.quantity,
        0,
      );
      const actionTotal = SABOTEUR_DRAW_CARDS.filter((d) => d.kind === 'ACTION').reduce(
        (s, d) => s + d.quantity,
        0,
      );
      expect(total).toBe(67);
      expect(pathTotal).toBe(40);
      expect(actionTotal).toBe(27);
      expect(SABOTEUR_GOLD_DECK).toHaveLength(28);
      expect(SABOTEUR_GOLD_DECK.filter((v) => v === 3)).toHaveLength(4);
      expect(SABOTEUR_GOLD_DECK.filter((v) => v === 2)).toHaveLength(8);
      expect(SABOTEUR_GOLD_DECK.filter((v) => v === 1)).toHaveLength(16);
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
        const state = room.saboteurState!;
        const handSize = SABOTEUR_HAND_SIZE_TABLE[n];
        expect(Object.values(state.players).every((p) => p.handSize === handSize)).toBe(true);
        expect(state.stockCount).toBe(67 - n * handSize);
        expect(privateState.get<string[]>(room.code, ROOM_KEY, SB_ROOM_DECK)).toHaveLength(
          67 - n * handSize,
        );
        room.status = RoomStatus.LOBBY;
        room.saboteurState = undefined;
        privateState.clearRoom(room.code);
      }
    });

    it('should assign saboteur count per official role table', () => {
      for (let n = 3; n <= 10; n++) {
        const room = startGame(createRoom(n));
        let saboteurs = 0;
        for (const p of room.players) {
          if (
            privateState.get<SaboteurRole>(room.code, p.socketId, SB_ROLE) === SaboteurRole.SABOTEUR
          ) {
            saboteurs++;
          }
        }
        expect(saboteurs).toBe(SABOTEUR_ROLE_TABLE[n]);
        room.status = RoomStatus.LOBBY;
        room.saboteurState = undefined;
        privateState.clearRoom(room.code);
      }
    });
  });

  describe('placePath', () => {
    let room: RoomState;

    beforeEach(() => {
      room = startGame(createRoom(3));
      room.saboteurState!.activePlayerId = 'p1';
    });

    it('should accept a valid straight extension from the start', () => {
      setHand(room, 'p1', ['path-24c']);
      expect(service.placePath(room, 'p1', 0, 1, 2, 0)).not.toBeNull();
      expect(room.saboteurState!.board[saboteurCellKey(1, 2)].cardId).toBe('path-24c');
      // drew a replacement card
      expect(room.saboteurState!.players['p1'].handSize).toBe(1);
      expect(room.saboteurState!.activePlayerId).toBe('p2');
    });

    it('should reject a card whose closed side faces an open side', () => {
      setHand(room, 'p1', ['path-12c']); // openings N+E, W closed
      expect(service.placePath(room, 'p1', 0, 1, 2, 0)).toBeNull();
    });

    it('should require 180° rotation for some cards', () => {
      setHand(room, 'p1', ['path-12c']); // openings N+E, W closed
      expect(service.placePath(room, 'p1', 0, 1, 2, 0)).toBeNull(); // W closed vs start E open
      expect(service.placePath(room, 'p1', 0, 1, 2, 180)).not.toBeNull(); // rotated -> S+W
    });

    it('should reject placements not connected back to start', () => {
      setHand(room, 'p1', ['path-13c']);
      expect(service.placePath(room, 'p1', 0, 5, 0, 0)).toBeNull(); // isolated cell
    });

    it('should reject out-of-bounds and occupied cells', () => {
      setHand(room, 'p1', ['path-24c']);
      expect(service.placePath(room, 'p1', 0, 9, 2, 0)).toBeNull(); // out of bounds
      expect(service.placePath(room, 'p1', 0, 0, 2, 0)).toBeNull(); // start occupies
      expect(service.placePath(room, 'p1', 0, 8, 2, 0)).toBeNull(); // goal occupies
    });

    it('should block path play while any tool is broken', () => {
      setHand(room, 'p1', ['path-24c']);
      room.saboteurState!.players['p1'].brokenTools = [SaboteurTool.CART];
      expect(service.placePath(room, 'p1', 0, 1, 2, 0)).toBeNull();
    });

    it('should reject when it is not the player turn', () => {
      setHand(room, 'p2', ['path-24c']);
      expect(service.placePath(room, 'p2', 0, 1, 2, 0)).toBeNull();
    });

    it('pass-through stubs must not carry the network through', () => {
      // Cross at (1,2) extends the start in every direction.
      setHand(room, 'p1', ['path-1234c']);
      expect(service.placePath(room, 'p1', 0, 1, 2, 0)).not.toBeNull();
      room.saboteurState!.activePlayerId = 'p1';
      // path-13x has isolated N/S stubs; its S opening meets the cross' N opening.
      setHand(room, 'p1', ['path-13x']);
      expect(service.placePath(room, 'p1', 0, 1, 1, 0)).not.toBeNull();
      room.saboteurState!.activePlayerId = 'p1';
      // A tile north of the stub cannot join the network: the stub terminates it.
      setHand(room, 'p1', ['path-13c']); // N+S openings
      expect(service.placePath(room, 'p1', 0, 1, 0, 0)).toBeNull();
    });
  });

  describe('win detection and gold pick', () => {
    let room: RoomState;

    beforeEach(() => {
      room = startGame(createRoom(3));
      setRoles(room, { p1: SaboteurRole.MINER, p2: SaboteurRole.MINER, p3: SaboteurRole.MINER });
      room.saboteurState!.activePlayerId = 'p1';
      setGoalContents(room, ['STONE', 'GOLD', 'STONE']);
      seedHorizontalTunnel(room, 6);
    });

    it('reveals a STONE goal and keeps playing', () => {
      setGoalContents(room, ['STONE', 'STONE', 'GOLD']);
      setHand(room, 'p1', ['path-24c']);
      const result = service.placePath(room, 'p1', 0, 7, 2, 0);
      expect(result).not.toBeNull();
      expect(room.saboteurState!.currentPhase).toBe(SaboteurPhase.PLAYING);
      expect(room.saboteurState!.revealedGoals[1]).toBe('STONE');
      expect(room.saboteurState!.revealedGoals[0]).toBeNull();
      expect(room.saboteurState!.activePlayerId).toBe('p2');
    });

    it('ends the round immediately when stone-ends-round is enabled and a STONE goal is revealed', () => {
      setRoles(room, { p1: SaboteurRole.MINER, p2: SaboteurRole.MINER, p3: SaboteurRole.SABOTEUR });
      room.config.saboteurStoneEndsRound = true;
      setGoalContents(room, ['STONE', 'STONE', 'GOLD']);
      setHand(room, 'p1', ['path-24c']);

      const result = service.placePath(room, 'p1', 0, 7, 2, 0);
      expect(result).not.toBeNull();
      const state = room.saboteurState!;
      expect(state.currentPhase).toBe(SaboteurPhase.ROUND_END);
      expect(state.revealedGoals[1]).toBe('STONE');
      expect(state.roundResult!.winnerRole).toBe(SaboteurRole.SABOTEUR);
      // lone saboteur bonus
      expect(state.players['p3'].score).toBe(4);
      // turn did NOT advance: round is over
      expect(state.activePlayerId).toBe('p1');
    });

    it('enters GOLD_PICK when miners connect the GOLD goal', () => {
      setHand(room, 'p1', ['path-24c']);
      const result = service.placePath(room, 'p1', 0, 7, 2, 0);
      expect(result).not.toBeNull();
      const state = room.saboteurState!;
      expect(state.currentPhase).toBe(SaboteurPhase.GOLD_PICK);
      expect(state.roundResult!.winnerRole).toBe(SaboteurRole.MINER);
      expect(state.roundResult!.revealedGoalIndex).toBe(1);
      expect(state.roundResult!.goldPool).toHaveLength(3);
      expect(state.roundResult!.currentPickerId).toBe('p1'); // finder picks first
    });

    it('enforces pick order and completes the round', () => {
      setHand(room, 'p1', ['path-24c']);
      service.placePath(room, 'p1', 0, 7, 2, 0);
      const state = room.saboteurState!;
      const result = state.roundResult!;
      // Counter-clockwise from finder p1 over turnOrder [p1,p2,p3] -> [p1,p3,p2]
      expect(result.pickOrder).toEqual(['p1', 'p3', 'p2']);

      const poolSum = result.goldPool!.reduce((a, b) => a + b, 0);

      expect(service.pickGold(room, 'p3', 0)).toBeNull(); // wrong picker
      const firstIdx = 0;
      expect(service.pickGold(room, 'p1', firstIdx)).not.toBeNull();
      expect(result.currentPickerId).toBe('p3');
      expect(service.pickGold(room, 'p1', firstIdx)).toBeNull(); // taken slot
      expect(service.pickGold(room, 'p3', 0)).toBeNull(); // taken value
      expect(service.pickGold(room, 'p3', 1)).not.toBeNull();
      expect(result.currentPickerId).toBe('p2');
      expect(service.pickGold(room, 'p2', 2)).not.toBeNull();

      expect(state.currentPhase).toBe(SaboteurPhase.ROUND_END);
      expect(Object.values(result.picks!).reduce((a, b) => a + b, 0)).toBe(poolSum);
      expect(state.players['p1'].role).toBeDefined();
      expect(state.players['p2'].role).toBe(SaboteurRole.MINER);
      expect(state.players['p3'].role).toBe(SaboteurRole.MINER);
      // Scores synced into RoomState players
      const roomScoreSum = room.players.reduce((a, p) => a + p.score, 0);
      expect(roomScoreSum).toBe(poolSum);
    });
  });

  describe('action cards', () => {
    let room: RoomState;

    beforeEach(() => {
      room = startGame(createRoom(3));
      room.saboteurState!.activePlayerId = 'p1';
    });

    it('BREAK adds a broken tool and blocks stacking the same tool', () => {
      setHand(room, 'p1', ['action-break-lantern']);
      expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).not.toBeNull();
      expect(room.saboteurState!.players['p2'].brokenTools).toContain(SaboteurTool.LANTERN);

      room.saboteurState!.activePlayerId = 'p1';
      setHand(room, 'p1', ['action-break-lantern']);
      expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).toBeNull();
    });

    it('REPAIR fixes an eligible broken tool; dual-tool repairs choose automatically', () => {
      const p2 = room.saboteurState!.players['p2'];
      p2.brokenTools = [SaboteurTool.CART, SaboteurTool.LANTERN];

      setHand(room, 'p1', ['action-repair-lantern-cart']);
      expect(service.playAction(room, 'p1', { cardIndex: 0, targetPlayerId: 'p2' })).not.toBeNull();
      expect(p2.brokenTools).toEqual([SaboteurTool.CART]); // lantern fixed (first eligible)

      room.saboteurState!.activePlayerId = 'p1';
      setHand(room, 'p1', ['action-repair-cart-pickaxe']);
      expect(
        service.playAction(room, 'p1', {
          cardIndex: 0,
          targetPlayerId: 'p2',
          repairTool: SaboteurTool.CART,
        }),
      ).not.toBeNull();
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

      const peeked = privateState.get<Record<string, string>>(room.code, 'p1', 'sbPeekedGoals');
      expect(peeked['0']).toBe('GOLD');

      const serialized = JSON.stringify(room.saboteurState);
      expect(serialized).not.toContain('"GOLD"');
      expect(serialized).not.toContain('"STONE"');
      expect(room.saboteurState!.revealedGoals).toEqual([null, null, null]);
    });

    it('ROCKFALL removes placed path cards but never start or goals', () => {
      addBoardTiles(room, [{ x: 3, y: 1, cardId: 'path-24c' }]);
      setHand(room, 'p1', ['action-rockfall']);

      expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 0, targetY: 2 })).toBeNull();
      expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 8, targetY: 2 })).toBeNull();
      expect(service.playAction(room, 'p1', { cardIndex: 0, targetX: 4, targetY: 4 })).toBeNull();

      room.saboteurState!.activePlayerId = 'p1';
      setHand(room, 'p1', ['action-rockfall']);
      expect(
        service.playAction(room, 'p1', { cardIndex: 0, targetX: 3, targetY: 1 }),
      ).not.toBeNull();
      expect(room.saboteurState!.board[saboteurCellKey(3, 1)]).toBeUndefined();
    });
  });

  describe('discard and exhaustion', () => {
    it('skips empty-handed players once the stock runs dry (no soft-lock)', () => {
      const room = startGame(createRoom(3));
      const state = room.saboteurState!;
      state.activePlayerId = 'p1';

      privateState.set(room.code, ROOM_KEY, SB_ROOM_DECK, []);
      state.stockCount = 0;
      setHand(room, 'p1', ['path-24c']);
      setHand(room, 'p2', ['path-24c']);
      setHand(room, 'p3', ['path-24c']);

      // p1 discards their last card -> turn must jump to a player who can act
      expect(service.discard(room, 'p1', 0)).not.toBeNull();
      const next = room.saboteurState!.activePlayerId;
      expect(next).toBe('p2');
      // p2 also empties -> only p3 can act afterwards
      expect(service.discard(room, 'p2', 0)).not.toBeNull();
      expect(room.saboteurState!.activePlayerId).toBe('p3');
    });

    it('auto-pass skips the turn without drawing or discarding', () => {
      const room = startGame(createRoom(3));
      const state = room.saboteurState!;
      const stockBefore = state.stockCount;
      const handBefore = state.players['p1'].handSize;

      expect(service.autoPass(room, 'p1')).not.toBeNull();
      expect(state.activePlayerId).toBe('p2');
      expect(state.stockCount).toBe(stockBefore);
      expect(state.players['p1'].handSize).toBe(handBefore);
      expect(service.autoPass(room, 'p2')).not.toBeNull(); // now p2's turn
      expect(state.activePlayerId).toBe('p3');
      expect(service.autoPass(room, 'p1')).toBeNull(); // not p1's turn anymore
    });

    it('ends the round with a lone-saboteur bonus when all cards run out', () => {
      const room = startGame(createRoom(3));
      setRoles(room, { p1: SaboteurRole.MINER, p2: SaboteurRole.SABOTEUR, p3: SaboteurRole.MINER });
      const state = room.saboteurState!;
      state.activePlayerId = 'p1';

      privateState.set(room.code, ROOM_KEY, SB_ROOM_DECK, []);
      state.stockCount = 0;
      for (const id of ['p1', 'p2', 'p3']) {
        privateState.delete(room.code, id, SB_HAND);
        state.players[id].handSize = 0;
      }
      setHand(room, 'p1', ['path-24c']);

      expect(service.discard(room, 'p1', 0)).not.toBeNull();
      expect(state.currentPhase).toBe(SaboteurPhase.ROUND_END);
      expect(state.roundResult!.winnerRole).toBe(SaboteurRole.SABOTEUR);
      expect(state.roundResult!.saboteurBonus).toBe(4);
      expect(state.players['p2'].score).toBe(4);
      expect(state.players['p2'].role).toBe(SaboteurRole.SABOTEUR);
    });
  });

  describe('round flow', () => {
    it('nextRound preserves scores, resets the board and rotates the starter', () => {
      const room = startGame(createRoom(3));
      const state = room.saboteurState!;
      state.currentPhase = SaboteurPhase.ROUND_END;
      state.players['p2'].score = 7;
      addBoardTiles(room, [{ x: 1, y: 2, cardId: 'path-24c' }]);

      expect(service.nextRound(room, 'p2')).toBeNull(); // host only
      expect(service.nextRound(room, 'p1')).not.toBeNull();

      const s2 = room.saboteurState!;
      expect(s2.round).toBe(2);
      expect(s2.currentPhase).toBe(SaboteurPhase.PLAYING);
      expect(s2.players['p2'].score).toBe(7);
      expect(s2.board[saboteurCellKey(1, 2)]).toBeUndefined();
      expect(s2.activePlayerId).toBe(s2.turnOrder[1]);
      expect(s2.stockCount).toBeGreaterThan(0);
    });

    it('finishes with GAME_OVER after round 3', () => {
      const room = startGame(createRoom(3));
      const state = room.saboteurState!;
      state.round = 3;
      state.currentPhase = SaboteurPhase.ROUND_END;
      state.players['p1'].score = 5;
      state.players['p2'].score = 9;
      state.players['p3'].score = 9;

      expect(service.nextRound(room, 'p1')).not.toBeNull();
      expect(state.currentPhase).toBe(SaboteurPhase.GAME_OVER);
      expect(state.finalResults!.scores['p2']).toBe(9);
      expect(state.finalResults!.winnerIds.sort()).toEqual(['p2', 'p3']);
    });
  });

  describe('reconnection', () => {
    it('advances the turn when the active player disconnects', () => {
      const room = startGame(createRoom(3));
      room.saboteurState!.activePlayerId = 'p1';
      service.handlePlayerDisconnect(room, 'p1');
      expect(room.saboteurState!.activePlayerId).toBe('p2');
    });

    it('advances the gold picker when they disconnect and finalizes when done', () => {
      const room = startGame(createRoom(3));
      setRoles(room, { p1: SaboteurRole.MINER, p2: SaboteurRole.MINER, p3: SaboteurRole.MINER });
      room.saboteurState!.activePlayerId = 'p1';
      setGoalContents(room, ['STONE', 'GOLD', 'STONE']);
      seedHorizontalTunnel(room, 6);
      setHand(room, 'p1', ['path-24c']);
      service.placePath(room, 'p1', 0, 7, 2, 0);

      const state = room.saboteurState!;
      expect(state.currentPhase).toBe(SaboteurPhase.GOLD_PICK);
      service.handlePlayerDisconnect(room, 'p1'); // finder leaves before picking
      expect(state.roundResult!.currentPickerId).toBe('p3');

      service.handlePlayerDisconnect(room, 'p3');
      expect(state.roundResult!.currentPickerId).toBe('p2');
      service.handlePlayerDisconnect(room, 'p2'); // nobody left to pick
      expect(state.currentPhase).toBe(SaboteurPhase.ROUND_END);
    });

    it('remaps every socket id reference', () => {
      const room = startGame(createRoom(3));
      const state = room.saboteurState!;
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
      room.saboteurState!.players['p1'].score = 5;
      room.players[0].score = 5;

      expect(service.reset(room, 'p2')).toBeNull();
      expect(service.reset(room, 'p1')).not.toBeNull();
      expect(room.status).toBe(RoomStatus.LOBBY);
      expect(room.saboteurState).toBeUndefined();
      expect(room.players.every((p) => p.score === 0)).toBe(true);
    });
  });
});
