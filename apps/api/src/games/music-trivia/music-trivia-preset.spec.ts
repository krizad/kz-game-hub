import { Test, TestingModule } from '@nestjs/testing';
import { MusicTriviaService } from './music-trivia.service';
import { PrivateStateService } from '../private-state.service';
import { ArtistPresetService, ArtistCatalog } from '../artist-preset.service';
import { GameType, RoomState, RoomStatus } from '@repo/types';
import { TrackResult } from './music-source-adapter';

const makeCatalog = (tracks: Partial<ArtistCatalog['tracks'][number]>[]): ArtistCatalog => ({
  id: 'artist-1',
  name: 'Test Artist',
  tracks: tracks.map((t, i) => ({
    videoId: t.videoId ?? `vid-${i}`,
    title: t.title ?? `Song ${i}`,
    viewCount: t.viewCount ?? 1_000_000,
    releaseYear: t.releaseYear ?? null,
    durationMs: t.durationMs ?? 30_000,
    thumbnailUrl: t.thumbnailUrl ?? null,
  })),
});

const makeRoom = (config: Partial<RoomState['config']> = {}): RoomState => ({
  id: 'room-1',
  gameType: GameType.MUSIC_TRIVIA,
  code: 'ABCD12',
  status: RoomStatus.LOBBY,
  roomHostId: 'host-1',
  players: [
    { id: '1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1', connected: true },
    { id: '2', socketId: 'p2', name: 'P2', score: 0, roomId: 'room-1', connected: true },
  ],
  createdAt: new Date(),
  config: {
    hostSelection: 'FIXED',
    timerMin: 5,
    musicTriviaMode: 'TYPING',
    musicTriviaRounds: 10,
    musicTriviaHostPlays: true,
    musicTriviaAnswerTimeoutMs: 15000,
    musicTriviaArtistPresetId: 'artist-1',
    ...config,
  },
});

describe('MusicTriviaService — artist preset mode', () => {
  let service: MusicTriviaService;
  let privateState: PrivateStateService;
  let getCatalog: jest.Mock;

  const configure = async (room: RoomState) => {
    service.startGame(room, 'host-1');
    return service.handleGameAction(room, 'host-1', {
      type: 'CONFIGURE_SOURCE',
      query: 'ignored',
    });
  };

  beforeEach(async () => {
    getCatalog = jest.fn(async () => makeCatalog([]));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicTriviaService,
        PrivateStateService,
        { provide: ArtistPresetService, useValue: { getCatalog } },
      ],
    }).compile();

    service = module.get<MusicTriviaService>(MusicTriviaService);
    privateState = module.get<PrivateStateService>(PrivateStateService);
  });

  describe('selectPresetTracks', () => {
    const trackOf = (id: string): TrackResult =>
      ({
        id,
        title: id,
        artist: 'Test Artist',
        previewUrl: id,
        durationMs: 30_000,
        sourceType: 'YOUTUBE',
      }) as TrackResult;

    const candidates = (viewCounts: Record<string, number>) =>
      Object.entries(viewCounts).map(([id, viewCount]) => ({ track: trackOf(id), viewCount }));

    it('buckets by fixed view thresholds (50M / 5M)', () => {
      const picked = service.selectPresetTracks(
        candidates({ easy1: 60_000_000, med1: 10_000_000, hard1: 100_000 }),
        'EASY',
        1,
      );
      expect(picked.map((t) => t.id)).toEqual(['easy1']);
    });

    it('plays native-level tracks first and borrows nearest levels after', () => {
      const picked = service.selectPresetTracks(
        candidates({
          med1: 20_000_000,
          med2: 6_000_000,
          hard1: 1_000,
          hard2: 2_000,
          hard3: 3_000,
        }),
        'MEDIUM',
        5,
      );
      expect(
        picked
          .map((t) => t.id)
          .slice(0, 2)
          .sort(),
      ).toEqual(['med1', 'med2']);
      expect(
        picked
          .map((t) => t.id)
          .slice(2)
          .sort(),
      ).toEqual(['hard1', 'hard2', 'hard3']);
    });

    it('slices to the round count when the native level alone is enough', () => {
      const picked = service.selectPresetTracks(
        candidates({
          e1: 51_000_000,
          e2: 52_000_000,
          e3: 53_000_000,
          e4: 54_000_000,
        }),
        'EASY',
        2,
      );
      expect(picked).toHaveLength(2);
      expect(picked.every((t) => ['e1', 'e2', 'e3', 'e4'].includes(t.id))).toBe(true);
    });

    it('returns everything available when the whole catalog is smaller than the rounds', () => {
      const picked = service.selectPresetTracks(candidates({ h1: 10_000, h2: 20_000 }), 'HARD', 10);
      expect(picked.map((t) => t.id).sort()).toEqual(['h1', 'h2']);
    });
  });

  describe('configureSource in preset mode', () => {
    it('loads the catalog and opens round 1 with YouTube as the source', async () => {
      getCatalog.mockResolvedValue(
        makeCatalog([
          { videoId: 'v1', title: 'Hit', viewCount: 60_000_000, releaseYear: 2020 },
          { videoId: 'v2', title: 'Mid', viewCount: 10_000_000 },
        ]),
      );
      const room = makeRoom({ musicTriviaLevel: 'EASY', musicTriviaRounds: 2 });
      const result = await configure(room);

      expect(getCatalog).toHaveBeenCalledWith('artist-1');
      expect(room.musicTriviaState?.sourceType).toBe('YOUTUBE');
      expect(room.musicTriviaState?.level).toBe('EASY');
      expect(room.musicTriviaState?.artistPresetName).toBe('Test Artist');
      expect(room.musicTriviaState?.phase).toBe('GET_READY');
      expect(room.musicTriviaState?.currentRound?.track.id).toBe('v1');
      expect(room.musicTriviaState?.currentRound?.track.sourceType).toBe('YOUTUBE');
      expect(room.musicTriviaState?.totalRounds).toBe(2);
      expect(result?.syncPlay).toBeUndefined();

      const answers = privateState.get<{ id: string; releaseYear?: string }[]>(
        'ABCD12',
        '__ROOM__',
        'mtTrackAnswers',
      );
      expect(answers?.map((a) => a.id)).toEqual(['v1', 'v2']);
      expect(answers?.[0].releaseYear).toBe('2020');
    });

    it('caps rounds when the level has fewer songs than requested', async () => {
      getCatalog.mockResolvedValue(makeCatalog([{ videoId: 'v1', viewCount: 60_000_000 }]));
      const room = makeRoom({ musicTriviaLevel: 'EASY', musicTriviaRounds: 10 });
      await configure(room);

      expect(room.musicTriviaState?.totalRounds).toBe(1);
    });

    it('borrows from neighbouring levels when the chosen level is short', async () => {
      getCatalog.mockResolvedValue(
        makeCatalog([
          { videoId: 'hit1', viewCount: 60_000_000 },
          { videoId: 'hit2', viewCount: 70_000_000 },
          { videoId: 'deep1', viewCount: 5_000 },
          { videoId: 'deep2', viewCount: 4_000 },
          { videoId: 'deep3', viewCount: 3_000 },
        ]),
      );
      const room = makeRoom({ musicTriviaLevel: 'EASY', musicTriviaRounds: 5 });
      await configure(room);

      const answers = privateState.get<{ id: string }[]>('ABCD12', '__ROOM__', 'mtTrackAnswers');
      expect(answers).toHaveLength(5);
      expect(
        answers
          ?.slice(0, 2)
          .map((a) => a.id)
          .sort(),
      ).toEqual(['hit1', 'hit2']);
      expect(
        answers
          ?.slice(2)
          .map((a) => a.id)
          .sort(),
      ).toEqual(['deep1', 'deep2', 'deep3']);
    });

    it('resets to SETUP with an error when the preset is missing or disabled', async () => {
      getCatalog.mockResolvedValue(null);
      const room = makeRoom();
      await configure(room);

      expect(room.musicTriviaState?.phase).toBe('SETUP');
      expect(room.musicTriviaState?.errorMessage).toBeTruthy();
    });

    it('resets to SETUP with an error when the catalog is empty', async () => {
      getCatalog.mockResolvedValue(makeCatalog([]));
      const room = makeRoom();
      await configure(room);

      expect(room.musicTriviaState?.phase).toBe('SETUP');
      expect(room.musicTriviaState?.errorMessage).toBeTruthy();
    });
  });

  describe('startGame in preset mode', () => {
    it('forces YOUTUBE as the source and records the chosen level', () => {
      const room = makeRoom({
        musicTriviaSource: 'ITUNES',
        musicTriviaLevel: 'HARD',
      });
      const result = service.startGame(room, 'host-1');

      expect(result?.musicTriviaState?.sourceType).toBe('YOUTUBE');
      expect(result?.musicTriviaState?.level).toBe('HARD');
    });

    it('ignores preset fields in free-search mode', () => {
      const room = makeRoom();
      delete room.config.musicTriviaArtistPresetId;
      const result = service.startGame(room, 'host-1');

      expect(result?.musicTriviaState?.sourceType).toBe('ITUNES');
      expect(result?.musicTriviaState?.level).toBeUndefined();
      expect(result?.musicTriviaState?.artistPresetName).toBeUndefined();
    });
  });
});
