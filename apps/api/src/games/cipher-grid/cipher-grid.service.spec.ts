import { Test, TestingModule } from '@nestjs/testing';
import {
  RoomState,
  RoomStatus,
  GameType,
  CipherCardType,
  CipherTeam,
  CIPHER_GRID_PRIVATE_STATE_KEY,
  CIPHER_GRID_PICTURES,
} from '@repo/types';
import { CipherGridService } from './cipher-grid.service';
import { PrivateStateService } from '../private-state.service';
import { CIPHER_GRID_WORDS_EN, CIPHER_GRID_WORDS_TH } from './cipher-grid-words';

const ROOM_KEY = '__room__';
const ROOM_KEYCARD = 'cgRoomKeycard';

describe('CipherGridService', () => {
  let service: CipherGridService;
  let privateState: PrivateStateService;
  let room: RoomState;

  // s-lead / s-track = Solar, l-lead / l-track = Lunar
  const IDS = ['s-lead', 's-track', 'l-lead', 'l-track'];

  beforeEach(async () => {
    privateState = new PrivateStateService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CipherGridService, { provide: PrivateStateService, useValue: privateState }],
    }).compile();
    service = module.get(CipherGridService);
    room = createRoom(IDS);
  });

  afterEach(() => jest.restoreAllMocks());

  function createRoom(ids: string[]): RoomState {
    return {
      id: 'room-id',
      code: 'ABC123',
      gameType: GameType.CIPHER_GRID,
      status: RoomStatus.LOBBY,
      roomHostId: ids[0],
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1, language: 'en' },
      players: ids.map((id, i) => ({
        id,
        socketId: id,
        name: `P${i + 1}`,
        score: 0,
        roomId: 'room-id',
        connected: true,
      })),
    } as RoomState;
  }

  function seatTeams(): void {
    service.assignTeam(room, 's-lead', 'SOLAR', 'CIPHER_LEAD');
    service.assignTeam(room, 's-track', 'SOLAR');
    service.assignTeam(room, 'l-lead', 'LUNAR', 'CIPHER_LEAD');
    service.assignTeam(room, 'l-track', 'LUNAR');
  }

  /** Start a match with SOLAR going first and a deterministic keycard. */
  function startMatch(keycard?: CipherCardType[]): void {
    expect(service.startGame(room, 's-lead')).not.toBeNull();
    seatTeams();
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // SOLAR starts
    const outcome = service.startMatch(room, 's-lead');
    jest.spyOn(Math, 'random').mockRestore();
    expect(outcome.error).toBeUndefined();
    if (keycard) {
      privateState.set(room.code, ROOM_KEY, ROOM_KEYCARD, keycard);
      room.cipherGridState!.board.forEach((card, i) => {
        if (card.kind === 'WORD') card.word = `W${i}`;
      });
    }
  }

  /** 0-8 SOLAR, 9-16 LUNAR, 17-23 DECOY, 24 VIRUS. */
  const FIXED_KEY: CipherCardType[] = [
    ...Array<CipherCardType>(9).fill('SOLAR'),
    ...Array<CipherCardType>(8).fill('LUNAR'),
    ...Array<CipherCardType>(7).fill('DECOY'),
    'VIRUS',
  ];

  const state = () => room.cipherGridState!;

  describe('word pools', () => {
    it('ships 400+ unique words across TH and EN', () => {
      const en = new Set(CIPHER_GRID_WORDS_EN);
      const th = new Set(CIPHER_GRID_WORDS_TH);
      expect(en.size).toBe(CIPHER_GRID_WORDS_EN.length);
      expect(th.size).toBe(CIPHER_GRID_WORDS_TH.length);
      expect(en.size + th.size).toBeGreaterThanOrEqual(400);
      expect([...en, ...th].every((w) => !/\s/.test(w))).toBe(true);
    });
  });

  describe('setup', () => {
    it('needs 4 players and the host to open team setup', () => {
      const small = createRoom(IDS.slice(0, 3));
      expect(service.startGame(small, 's-lead')).toBeNull();
      expect(service.startGame(room, 's-track')).toBeNull();
      expect(service.startGame(room, 's-lead')?.cipherGridState?.phase).toBe('TEAM_SETUP');
      expect(room.status).toBe(RoomStatus.PLAYING);
    });

    it('lets a player claim a lead seat and demotes the previous lead', () => {
      service.startGame(room, 's-lead');
      service.assignTeam(room, 's-lead', 'SOLAR', 'CIPHER_LEAD');
      service.assignTeam(room, 's-track', 'SOLAR', 'CIPHER_LEAD');
      expect(state().cipherLeads.SOLAR).toBe('s-track');
      expect(state().teams['s-lead']).toBe('SOLAR');
    });

    it('only lets the host move other players', () => {
      service.startGame(room, 's-lead');
      expect(service.assignTeam(room, 's-track', 'LUNAR', 'TRACKER', 'l-lead').error).toBe(
        'HOST_ONLY',
      );
      expect(
        service.assignTeam(room, 's-lead', 'LUNAR', 'TRACKER', 'l-lead').error,
      ).toBeUndefined();
      expect(state().teams['l-lead']).toBe('LUNAR');
    });

    it('randomizes into two teams with one lead each and rejects non-host', () => {
      service.startGame(room, 's-lead');
      expect(service.randomizeTeams(room, 's-track').error).toBe('HOST_ONLY');
      service.randomizeTeams(room, 's-lead');
      const teams = Object.values(state().teams);
      expect(teams.filter((t) => t === 'SOLAR')).toHaveLength(2);
      expect(teams.filter((t) => t === 'LUNAR')).toHaveLength(2);
      expect(state().cipherLeads.SOLAR).toBeDefined();
      expect(state().cipherLeads.LUNAR).toBeDefined();
    });

    it('refuses to start without a lead and tracker on each team or when called by non-host', () => {
      service.startGame(room, 's-lead');
      service.assignTeam(room, 's-lead', 'SOLAR', 'CIPHER_LEAD');
      service.assignTeam(room, 's-track', 'SOLAR');
      service.assignTeam(room, 'l-lead', 'LUNAR', 'CIPHER_LEAD');
      expect(service.startMatch(room, 's-track').error).toBe('HOST_ONLY');
      expect(service.startMatch(room, 's-lead').error).toBe('TEAM_NEEDS_TRACKER');

      // After host rotation, the new roomHostId can start the match
      service.assignTeam(room, 'l-track', 'LUNAR');
      room.roomHostId = 's-track';
      expect(service.startMatch(room, 's-lead').error).toBe('HOST_ONLY');
      expect(service.startMatch(room, 's-track').error).toBeUndefined();
    });

    it('deals 25 words and a 9-8-7-1 key to the starting team', () => {
      startMatch();
      expect(state().board).toHaveLength(25);
      expect(
        new Set(state().board.map((c) => (c.kind === 'WORD' ? c.word : c.pictureId))).size,
      ).toBe(25);
      const key = privateState.get<CipherCardType[]>(room.code, ROOM_KEY, ROOM_KEYCARD)!;
      const count = (t: CipherCardType) => key.filter((k) => k === t).length;
      expect(count('SOLAR')).toBe(9);
      expect(count('LUNAR')).toBe(8);
      expect(count('DECOY')).toBe(7);
      expect(count('VIRUS')).toBe(1);
      expect(state().currentTeam).toBe('SOLAR');
      expect(state().remaining).toEqual({ SOLAR: 9, LUNAR: 8 });
      expect(state().phase).toBe('CLUE_GIVING');
    });

    it('keeps the key out of public state and away from trackers', () => {
      startMatch();
      expect(JSON.stringify(state())).not.toMatch(/"type"/);
      expect(privateState.get(room.code, 's-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toHaveLength(25);
      expect(privateState.get(room.code, 'l-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toHaveLength(25);
      expect(privateState.get(room.code, 's-track', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
      expect(privateState.get(room.code, 'l-track', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
    });
  });

  describe('clues', () => {
    beforeEach(() => startMatch(FIXED_KEY));

    it('only accepts a clue from the active Cipher Lead', () => {
      expect(service.giveClue(room, 'l-lead', 'ocean', 2).error).toBe('NOT_YOUR_TURN');
      expect(service.giveClue(room, 's-track', 'ocean', 2).error).toBe('NOT_YOUR_TURN');
      expect(service.giveClue(room, 's-lead', 'ocean', 2).error).toBeUndefined();
      expect(state().phase).toBe('DECODING');
      expect(state().currentClue).toMatchObject({ word: 'ocean', count: 2, team: 'SOLAR' });
    });

    it('blocks multi-word clues and unrevealed board words without losing the turn', () => {
      expect(service.giveClue(room, 's-lead', 'deep sea', 1).error).toBe('CLUE_MULTIPLE_WORDS');
      expect(service.giveClue(room, 's-lead', 'w3', 1).error).toBe('CLUE_ON_BOARD');
      expect(state().phase).toBe('CLUE_GIVING');
      expect(state().currentTeam).toBe('SOLAR');
    });

    it('allows a board word once that card is revealed', () => {
      state().board[3].revealed = true;
      expect(service.giveClue(room, 's-lead', 'W3', 1).error).toBeUndefined();
    });

    it('validates the count', () => {
      expect(service.giveClue(room, 's-lead', 'x', 10).error).toBe('CLUE_COUNT_INVALID');
      expect(service.giveClue(room, 's-lead', 'x', -1).error).toBe('CLUE_COUNT_INVALID');
      expect(service.giveClue(room, 's-lead', 'x', 1.5).error).toBe('CLUE_COUNT_INVALID');
      expect(service.giveClue(room, 's-lead', 'x', 'UNLIMITED').error).toBeUndefined();
    });
  });

  describe('decoding', () => {
    beforeEach(() => startMatch(FIXED_KEY));

    it('only lets trackers on the active team reveal', () => {
      service.giveClue(room, 's-lead', 'clue', 2);
      expect(service.revealCard(room, 's-lead', 0).error).toBe('NOT_YOUR_TURN');
      expect(service.revealCard(room, 'l-track', 0).error).toBe('NOT_YOUR_TURN');
      expect(service.revealCard(room, 's-track', 0).error).toBeUndefined();
      expect(service.revealCard(room, 's-track', 0).error).toBe('CARD_REVEALED');
    });

    it('allows count + 1 own-team reveals then passes the turn', () => {
      service.giveClue(room, 's-lead', 'clue', 1);
      service.revealCard(room, 's-track', 0);
      expect(state().currentTeam).toBe('SOLAR');
      service.revealCard(room, 's-track', 1);
      expect(state().currentTeam).toBe('LUNAR');
      expect(state().phase).toBe('CLUE_GIVING');
      expect(state().remaining.SOLAR).toBe(7);
    });

    it('keeps the turn open for count 0 and UNLIMITED', () => {
      service.giveClue(room, 's-lead', 'clue', 0);
      for (let i = 0; i < 4; i++) service.revealCard(room, 's-track', i);
      expect(state().currentTeam).toBe('SOLAR');
    });

    it('ends the turn on a decoy', () => {
      service.giveClue(room, 's-lead', 'clue', 3);
      service.revealCard(room, 's-track', 17);
      expect(state().board[17].type).toBe('DECOY');
      expect(state().currentTeam).toBe('LUNAR');
    });

    it('ends the turn and credits the rival on a rival card', () => {
      service.giveClue(room, 's-lead', 'clue', 3);
      service.revealCard(room, 's-track', 9);
      expect(state().remaining.LUNAR).toBe(7);
      expect(state().currentTeam).toBe('LUNAR');
    });

    it('loses immediately on the virus and reveals the whole key', () => {
      service.giveClue(room, 's-lead', 'clue', 3);
      service.revealCard(room, 's-track', 24);
      expect(state().phase).toBe('ROUND_END');
      expect(state().winner).toBe('LUNAR');
      expect(state().winReason).toBe('VIRUS');
      expect(state().board.every((c) => c.type)).toBe(true);
      expect(room.status).toBe(RoomStatus.RESULT);
      expect(room.players.find((p) => p.socketId === 'l-track')!.score).toBe(1);
      expect(privateState.get(room.code, 's-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
    });

    it('wins when a team finds all its cards', () => {
      service.giveClue(room, 's-lead', 'clue', 'UNLIMITED');
      for (let i = 0; i < 9; i++) service.revealCard(room, 's-track', i);
      expect(state().winner).toBe('SOLAR');
      expect(state().winReason).toBe('ALL_FOUND');
      expect(state().scores.SOLAR).toBe(1);
    });

    it('awards the rival the win when its last card is revealed by mistake', () => {
      for (let i = 9; i < 16; i++) state().board[i].revealed = true;
      state().remaining.LUNAR = 1;
      service.giveClue(room, 's-lead', 'clue', 1);
      service.revealCard(room, 's-track', 16);
      expect(state().winner).toBe('LUNAR');
    });

    it('requires one reveal before ending the turn', () => {
      service.giveClue(room, 's-lead', 'clue', 2);
      expect(service.endTurn(room, 's-track').error).toBe('MUST_GUESS_FIRST');
      service.revealCard(room, 's-track', 0);
      expect(service.endTurn(room, 'l-track').error).toBe('NOT_YOUR_TURN');
      expect(service.endTurn(room, 's-track').error).toBeUndefined();
      expect(state().currentTeam).toBe('LUNAR');
    });

    it('toggles a tracker ping and clears pings when the card is revealed', () => {
      service.giveClue(room, 's-lead', 'clue', 2);
      service.pingCard(room, 's-track', 4);
      expect(state().pings['s-track']).toBe(4);
      service.pingCard(room, 's-track', 4);
      expect(state().pings['s-track']).toBeUndefined();
      service.pingCard(room, 's-track', 4);
      service.revealCard(room, 's-track', 4);
      expect(state().pings['s-track']).toBeUndefined();
    });
  });

  describe('challenge clue', () => {
    beforeEach(() => startMatch(FIXED_KEY));

    it('only lets the opposing team challenge during decoding', () => {
      expect(service.challengeClue(room, 'l-track').error).toBe('NOT_DECODING');
      service.giveClue(room, 's-lead', 'clue', 2);
      expect(service.challengeClue(room, 's-track').error).toBe('NOT_OPPONENT');
    });

    it('only applies the penalty after the clue giver accepts the challenge', () => {
      service.giveClue(room, 's-lead', 'clue', 2);
      expect(service.challengeClue(room, 'l-track').error).toBeUndefined();
      expect(state().remaining.LUNAR).toBe(8);
      expect(state().phase).toBe('DECODING');
      expect(state().currentTeam).toBe('SOLAR');
      expect(
        service.respondChallenge(room, 's-lead', state().currentClue!.id, true).error,
      ).toBeUndefined();
      expect(state().currentTeam).toBe('LUNAR');
      expect(state().phase).toBe('CLUE_GIVING');
      expect(state().remaining.LUNAR).toBe(7);
      const penalty = state().board.filter((c) => c.revealed);
      expect(penalty).toHaveLength(1);
      expect(penalty[0]).toMatchObject({ type: 'LUNAR', revealedBy: null });
      expect(state().history.map((h) => h.kind)).toEqual([
        'CLUE',
        'CHALLENGE',
        'CHALLENGE_ACCEPTED',
        'PENALTY_REVEAL',
      ]);
    });

    it('never reveals the challenger’s last card', () => {
      for (let i = 9; i < 16; i++) state().board[i].revealed = true;
      state().remaining.LUNAR = 1;
      service.giveClue(room, 's-lead', 'clue', 2);
      service.challengeClue(room, 'l-lead');
      service.respondChallenge(room, 's-lead', state().currentClue!.id, true);
      expect(state().board[16].revealed).toBe(false);
      expect(state().remaining.LUNAR).toBe(1);
      expect(state().phase).toBe('CLUE_GIVING');
      expect(state().currentTeam).toBe('LUNAR');
    });
  });

  describe('timer', () => {
    it('passes the turn on a matching deadline and ignores stale ones', () => {
      room.config.cipherGridTurnSeconds = 60;
      startMatch(FIXED_KEY);
      const deadline = state().turnEndsAt!;
      expect(deadline).toBeGreaterThan(Date.now());
      expect(service.handleTurnTimeout(room, deadline - 1)).toBeNull();
      expect(service.handleTurnTimeout(room, deadline)?.cipherGridState?.currentTeam).toBe('LUNAR');
    });
  });

  describe('Pictures', () => {
    const pictureKey: CipherCardType[] = [
      ...Array<CipherCardType>(8).fill('SOLAR'),
      ...Array<CipherCardType>(7).fill('LUNAR'),
      ...Array<CipherCardType>(4).fill('DECOY'),
      'VIRUS',
    ];

    it.each([
      ['SOLAR', 0.1],
      ['LUNAR', 0.9],
    ] as const)('deals a private 8/7/4/1 key with %s starting', (team, random) => {
      room.config.cipherGridMode = 'PICTURES';
      service.startGame(room, 's-lead');
      seatTeams();
      jest.spyOn(Math, 'random').mockReturnValue(random);
      expect(service.startMatch(room, 's-lead').error).toBeUndefined();
      expect(state().mode).toBe('PICTURES');
      expect(state().board).toHaveLength(20);
      const pictureIds = state().board.map((card) =>
        card.kind === 'PICTURE' ? card.pictureId : 'INVALID',
      );
      expect(new Set(pictureIds).size).toBe(20);
      expect(
        pictureIds.every((id) => CIPHER_GRID_PICTURES.some((picture) => picture.id === id)),
      ).toBe(true);
      const key = privateState.get<CipherCardType[]>(room.code, ROOM_KEY, ROOM_KEYCARD)!;
      expect(key).toHaveLength(20);
      expect(key.filter((type) => type === team)).toHaveLength(8);
      expect(key.filter((type) => type === (team === 'SOLAR' ? 'LUNAR' : 'SOLAR'))).toHaveLength(7);
      expect(key.filter((type) => type === 'DECOY')).toHaveLength(4);
      expect(key.filter((type) => type === 'VIRUS')).toHaveLength(1);
      expect(state().remaining[team]).toBe(8);
      expect(state().board.every((card) => card.type === undefined)).toBe(true);
      expect(privateState.get(room.code, 's-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toEqual(key);
      expect(privateState.get(room.code, 'l-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toEqual(key);
      expect(privateState.get(room.code, 's-track', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
      expect(privateState.get(room.code, 'l-track', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
    });

    function startPictures() {
      room.config.cipherGridMode = 'PICTURES';
      startMatch();
      privateState.set(room.code, ROOM_KEY, ROOM_KEYCARD, pictureKey);
    }

    it('accepts descriptions and enforces picture board bounds', () => {
      startPictures();
      expect(service.giveClue(room, 's-lead', 'circle', 0).error).toBeUndefined();
      expect(service.revealCard(room, 's-track', 20).error).toBe('BAD_CARD');
      expect(service.revealCard(room, 's-track', -1).error).toBe('BAD_CARD');
      expect(service.revealCard(room, 's-track', 19).error).toBeUndefined();
      expect(state().winner).toBe('LUNAR');
      expect(state().board.every((card) => card.type !== undefined)).toBe(true);
      expect(privateState.get(room.code, 's-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
    });

    it.each(['SOLAR', 'LUNAR'] as const)(
      'awards ALL_FOUND to %s and preserves mode on next round/reset',
      (team) => {
        startPictures();
        state().currentTeam = team;
        const lead = team === 'SOLAR' ? 's-lead' : 'l-lead';
        const tracker = team === 'SOLAR' ? 's-track' : 'l-track';
        service.giveClue(room, lead, 'shape', 'UNLIMITED');
        for (const [index, type] of pictureKey.entries()) {
          if (type === team) service.revealCard(room, tracker, index);
        }
        expect(state().winner).toBe(team);
        expect(state().winReason).toBe('ALL_FOUND');
        expect(state().scores[team]).toBe(1);
        expect(service.revealCard(room, tracker, 19).error).toBe('NOT_DECODING');
        expect(state().scores[team]).toBe(1);
        service.nextRound(room, 's-lead');
        expect(state().mode).toBe('PICTURES');
        expect(state().board).toEqual([]);
        expect(privateState.get(room.code, ROOM_KEY, ROOM_KEYCARD)).toBeUndefined();
        service.resetGame(room, 's-lead');
        expect(state().mode).toBe('PICTURES');
        expect(room.status).toBe(RoomStatus.LOBBY);
      },
    );

    it('defaults to minimal picture pack and preserves pack selection on reset', () => {
      room.config.cipherGridMode = 'PICTURES';
      startMatch();
      expect(state().mode).toBe('PICTURES');
      expect(state().picturePack).toBe('MINIMAL');
      expect(state().board).toHaveLength(20);
      service.resetGame(room, 's-lead');
      expect(state().picturePack).toBe('MINIMAL');

      room.config.cipherGridPicturePack = 'CLASSIC';
      startMatch();
      expect(state().picturePack).toBe('CLASSIC');
      expect(state().board).toHaveLength(20);
    });
  });

  describe('challenge resolution safety', () => {
    beforeEach(() => startMatch(FIXED_KEY));

    it('rejects repeated challenges and only lets the giver resolve the current clue', () => {
      service.giveClue(room, 's-lead', 'ocean', 2);
      const clueId = state().currentClue!.id;
      const deadline = state().turnEndsAt;
      service.challengeClue(room, 'l-track');
      expect(service.challengeClue(room, 'l-lead').error).toBe('ALREADY_CHALLENGED');
      expect(state().board.every((card) => !card.revealed)).toBe(true);
      expect(state().turnEndsAt).toBe(deadline);
      expect(service.respondChallenge(room, 'l-lead', clueId, true).error).toBe('NOT_CLUE_GIVER');
      expect(service.respondChallenge(room, 's-lead', 'old-clue', true).error).toBe(
        'CHALLENGE_EXPIRED',
      );
      expect(service.respondChallenge(room, 's-lead', clueId, false).error).toBeUndefined();
      expect(state().currentTeam).toBe('SOLAR');
      expect(state().currentClue?.challenge?.status).toBe('REJECTED');
      expect(service.challengeClue(room, 'l-track').error).toBe('ALREADY_CHALLENGED');
      expect(service.respondChallenge(room, 's-lead', clueId, true).error).toBe(
        'CHALLENGE_EXPIRED',
      );
    });

    it('ignores responses after a reveal switches turns', () => {
      service.giveClue(room, 's-lead', 'ocean', 2);
      const clueId = state().currentClue!.id;
      service.challengeClue(room, 'l-track');
      service.revealCard(room, 's-track', 17);
      service.giveClue(room, 'l-lead', 'sky', 2);
      expect(service.respondChallenge(room, 's-lead', clueId, true).error).toBe(
        'CHALLENGE_EXPIRED',
      );
      expect(state().currentClue?.word).toBe('sky');
      expect(state().remaining.LUNAR).toBe(8);
    });
  });

  describe('host round cancellation', () => {
    it.each(['WORDS', 'PICTURES'] as const)(
      'cancels a %s board without points and ignores old timer/requests',
      (mode) => {
        room.config.cipherGridMode = mode;
        room.config.cipherGridTurnSeconds = 60;
        startMatch();
        const round = state().round;
        const deadline = state().turnEndsAt!;
        state().scores = { SOLAR: 2, LUNAR: 1 };
        const teams = { ...state().teams };
        const leads = { ...state().cipherLeads };
        const playerScores = room.players.map((player) => player.score);
        service.giveClue(room, 's-lead', 'shape', 2);
        service.pingCard(room, 's-track', 0);
        service.challengeClue(room, 'l-track');
        const clueId = state().currentClue!.id;
        const live = JSON.stringify(state());
        expect(service.cancelRound(room, 's-track', round).error).toBe('HOST_ONLY');
        expect(service.cancelRound(room, 's-lead', round - 1).error).toBe('NOT_LIVE_ROUND');
        expect(JSON.stringify(state())).toBe(live);
        expect(service.cancelRound(room, 's-lead', round).error).toBeUndefined();
        expect(state()).toMatchObject({
          mode,
          phase: 'TEAM_SETUP',
          round,
          scores: { SOLAR: 2, LUNAR: 1 },
          teams,
          cipherLeads: leads,
          board: [],
          currentClue: null,
          currentTeam: null,
          pings: {},
          history: [],
          turnEndsAt: null,
        });
        expect(room.players.map((player) => player.score)).toEqual(playerScores);
        for (const id of ['s-lead', 'l-lead', 's-track', 'l-track']) {
          expect(privateState.get(room.code, id, CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
        }
        expect(privateState.get(room.code, ROOM_KEY, ROOM_KEYCARD)).toBeUndefined();
        expect(service.handleTurnTimeout(room, deadline)).toBeNull();
        expect(service.respondChallenge(room, 's-lead', clueId, true).error).toBe(
          'CHALLENGE_EXPIRED',
        );
        expect(service.cancelRound(room, 's-lead', round).error).toBe('NOT_LIVE_ROUND');
        service.startMatch(room, 's-lead');
        expect(state().round).toBe(round + 1);
        expect(service.cancelRound(room, 's-lead', round).error).toBe('NOT_LIVE_ROUND');
        expect(state().phase).toBe('CLUE_GIVING');
        expect(service.cancelRound(room, 's-lead', state().round).error).toBeUndefined();
      },
    );

    it('rejects cancellation of a completed round without changing its result', () => {
      startMatch(FIXED_KEY);
      service.giveClue(room, 's-lead', 'ocean', 1);
      service.revealCard(room, 's-track', 24);
      const result = JSON.stringify(state());
      expect(service.cancelRound(room, 's-lead', state().round).error).toBe('NOT_LIVE_ROUND');
      expect(JSON.stringify(state())).toBe(result);
    });
  });

  describe('player removal', () => {
    beforeEach(() => startMatch(FIXED_KEY));

    it('retains a temporarily disconnected Lead and key', () => {
      room.players[0].connected = false;
      service.handlePlayerRemoved(room, 's-lead');
      expect(state().cipherLeads.SOLAR).toBe('s-lead');
      expect(state().phase).toBe('CLUE_GIVING');
      expect(privateState.get(room.code, 's-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeDefined();
    });

    it.each(['s-lead', 's-track'])(
      'cancels without points when required seat %s leaves permanently',
      (id) => {
        service.giveClue(room, 's-lead', 'ocean', 2);
        service.challengeClue(room, 'l-track');
        room.players = room.players.filter((player) => player.socketId !== id);
        service.handlePlayerRemoved(room, id);
        expect(state().phase).toBe('TEAM_SETUP');
        expect(state().board).toEqual([]);
        expect(state().teams[id]).toBeUndefined();
        expect(state().currentClue).toBeNull();
        expect(state().turnEndsAt).toBeNull();
        expect(state().scores).toEqual({ SOLAR: 0, LUNAR: 0 });
        expect(privateState.get(room.code, ROOM_KEY, ROOM_KEYCARD)).toBeUndefined();
        expect(privateState.get(room.code, 'l-lead', CIPHER_GRID_PRIVATE_STATE_KEY)).toBeUndefined();
      },
    );

    it('keeps playing when another Tracker remains and ignores an unseated departure', () => {
      state().teams['extra'] = 'SOLAR';
      room.players = room.players.filter((player) => player.socketId !== 's-track');
      service.handlePlayerRemoved(room, 's-track');
      expect(state().phase).toBe('CLUE_GIVING');
      expect(state().teams['s-track']).toBeUndefined();
      service.handlePlayerRemoved(room, 'viewer');
      expect(state().phase).toBe('CLUE_GIVING');
    });

    it('does not start a new board with a disconnected required role', () => {
      service.resetGame(room, 's-lead');
      service.startGame(room, 's-lead');
      room.players[2].connected = false;
      expect(service.startMatch(room, 's-lead').error).toBe('TEAM_DISCONNECTED');
      expect(state().board).toEqual([]);
    });
  });

  describe('round flow & reconnect', () => {
    it('returns to team setup with teams kept, then resets to lobby', () => {
      startMatch(FIXED_KEY);
      service.giveClue(room, 's-lead', 'clue', 1);
      service.revealCard(room, 's-track', 24);
      expect(service.nextRound(room, 's-track').error).toBe('HOST_ONLY');
      service.nextRound(room, 's-lead');
      expect(state().phase).toBe('TEAM_SETUP');
      expect(state().cipherLeads.SOLAR).toBe('s-lead');
      expect(state().scores.LUNAR).toBe(1);
      service.resetGame(room, 's-lead');
      expect(room.status).toBe(RoomStatus.LOBBY);
    });

    it('remaps every socket-id field', () => {
      startMatch(FIXED_KEY);
      service.giveClue(room, 's-lead', 'clue', 2);
      service.pingCard(room, 's-track', 2);
      service.remapSocketId(state(), 's-lead', 's-lead-2');
      service.remapSocketId(state(), 's-track', 's-track-2');
      expect(state().cipherLeads.SOLAR).toBe('s-lead-2');
      expect(state().teams['s-track-2']).toBe('SOLAR' as CipherTeam);
      expect(state().teams['s-track']).toBeUndefined();
      expect(state().pings['s-track-2']).toBe(2);
      expect(state().currentClue?.giverId).toBe('s-lead-2');
      expect(state().history[0].playerId).toBe('s-lead-2');
    });
  });
});
