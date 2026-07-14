import { Injectable } from '@nestjs/common';
import {
  MusicTriviaAction,
  MusicTriviaRound,
  MusicTriviaRoundHistory,
  MusicTriviaState,
  MusicTriviaSyncPlayPayload,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { ITunesAdapter } from './adapters/itunes.adapter';
import { SpotifyAdapter } from './adapters/spotify.adapter';
import { YouTubeAdapter } from './adapters/youtube.adapter';
import { DeezerAdapter } from './adapters/deezer.adapter';
import { SoundcloudAdapter } from './adapters/soundcloud.adapter';
import { MusicSourceFactory, TrackResult } from './music-source-adapter';
interface TrackAnswer {
  id: string;
  title: string;
  artist: string;
  trackViewUrl?: string;
  album?: string;
  releaseYear?: string;
}

/**
 * Return type for actions that need the gateway to emit extra private/broadcast events.
 */
export interface MusicTriviaActionResult {
  room: RoomState;
  /** If set, gateway should emit MUSIC_TRIVIA_SYNC_PLAY to the room. */
  syncPlay?: MusicTriviaSyncPlayPayload;
  /** If set, gateway should emit MUSIC_TRIVIA_TRACK_ANSWER privately to this socketId (Typing mode only). */
  trackAnswerTo?: {
    socketId: string;
    roundNumber: number;
  };
  hostAnswerTo?: {
    socketId: string;
    title: string;
    artist: string;
    artworkUrl?: string;
    trackViewUrl?: string;
  };
}

@Injectable()
export class MusicTriviaService {
  /** Secret track answers per room — never broadcast. */
  private trackAnswers = new Map<string, TrackAnswer[]>();

  private sourceFactory: MusicSourceFactory;

  constructor() {
    this.sourceFactory = new MusicSourceFactory();
    this.sourceFactory.register(new ITunesAdapter());
    this.sourceFactory.register(new SpotifyAdapter());
    this.sourceFactory.register(new YouTubeAdapter());
    this.sourceFactory.register(new DeezerAdapter());
    this.sourceFactory.register(new SoundcloudAdapter());
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;
    if (room.players.length < 2) return null;

    const config = room.config;
    room.musicTriviaState = {
      phase: 'SETUP',
      mode: config.musicTriviaMode || 'TYPING',
      sourceType: config.musicTriviaSource || 'ITUNES',
      totalRounds: config.musicTriviaRounds || 10,
      currentRound: null,
      roundHistory: [],
      readyPlayerIds: [],
      scores: {},
      hostPlays: config.musicTriviaHostPlays ?? true,
      answerTimeoutMs: config.musicTriviaAnswerTimeoutMs || 15000,
    };

    // Initialise scores for all players
    for (const p of room.players) {
      room.musicTriviaState.scores[p.socketId] = 0;
    }

    room.status = RoomStatus.PLAYING;
    return room;
  }

  async handleGameAction(
    room: RoomState,
    clientId: string,
    action: MusicTriviaAction,
  ): Promise<MusicTriviaActionResult | null> {
    const state = room.musicTriviaState;
    if (!state) return null;

    switch (action.type) {
      case 'CONFIGURE_SOURCE':
        return this.configureSource(room, clientId, action);
      case 'START_ROUND':
        return this.startRound(room, clientId);
      case 'PRESS_BUZZER':
        return this.pressBuzzer(room, clientId);
      case 'GIVE_UP':
        return this.giveUp(room, clientId);
      case 'SUBMIT_ANSWER':
        return this.submitAnswer(room, clientId, action.answer || '');
      case 'HOST_JUDGE':
        return this.hostJudge(room, clientId, action.correct ?? false);
      case 'REVEAL_ANSWER':
        return this.revealAnswer(room, clientId);
      case 'NEXT_ROUND':
        return this.nextRound(room, clientId);
      case 'PLAYER_READY':
        return this.playerReady(room, clientId);
      case 'START_COUNTDOWN':
        return this.startCountdown(room, clientId);
      case 'END_GAME':
        return this.endGame(room, clientId);
      default:
        return null;
    }
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;

    this.trackAnswers.delete(room.code);
    this.fullTracks.delete(room.code);
    room.musicTriviaState = undefined;
    room.status = RoomStatus.LOBBY;

    // Reset player scores
    for (const p of room.players) {
      p.score = 0;
    }

    return room;
  }

  /**
   * Remap socketIds on reconnection.
   */
  remapSocketId(state: MusicTriviaState, oldId: string, newId: string): void {
    // Remap scores
    if (state.scores[oldId] !== undefined) {
      state.scores[newId] = state.scores[oldId];
      delete state.scores[oldId];
    }

    // Remap current round
    if (state.currentRound) {
      if (state.currentRound.currentBuzzerId === oldId) {
        state.currentRound.currentBuzzerId = newId;
      }
      if (state.currentRound.winnerId === oldId) {
        state.currentRound.winnerId = newId;
      }
      state.currentRound.struckOutIds = state.currentRound.struckOutIds.map((id) =>
        id === oldId ? newId : id,
      );
      for (const press of state.currentRound.buzzerPresses) {
        if (press.playerId === oldId) {
          press.playerId = newId;
        }
      }
    }

    if (state.readyPlayerIds) {
      state.readyPlayerIds = state.readyPlayerIds.map((id) => (id === oldId ? newId : id));
    }

    // Remap round history
    for (const h of state.roundHistory) {
      if (h.winnerId === oldId) h.winnerId = newId;
    }
  }

  // ------------------------------------------------------------------
  // Action Handlers
  // ------------------------------------------------------------------

  private playerReady(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (state.phase !== 'GET_READY') return null;

    if (!state.readyPlayerIds.includes(clientId)) {
      state.readyPlayerIds.push(clientId);
    }
    return { room };
  }

  private startCountdown(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (room.roomHostId !== clientId) return null;
    if (state.phase !== 'GET_READY') return null;

    state.phase = 'COUNTDOWN';
    state.countdownEndsAt = Date.now() + 3000;
    return { room };
  }

  public finalizeCountdown(room: RoomState): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (state.phase !== 'COUNTDOWN') return null;

    // Jump to playing
    state.phase = 'PLAYING';
    state.playStartTime = Date.now();
    state.countdownEndsAt = undefined;

    const round = state.currentRound;
    if (!round) return null;

    return {
      room,
      syncPlay: {
        roundNumber: round.roundNumber,
        playStartTime: state.playStartTime,
        previewUrl: round.track.previewUrl,
        sourceType: round.track.sourceType,
        durationMs: round.track.durationMs,
        artworkUrl: round.track.artworkUrl,
      },
    };
  }

  private async configureSource(
    room: RoomState,
    clientId: string,
    action: MusicTriviaAction,
  ): Promise<MusicTriviaActionResult | null> {
    const state = room.musicTriviaState!;
    if (room.roomHostId !== clientId) return null;
    if (state.phase !== 'SETUP') return null;

    const query = action.query;
    if (!query || query.trim().length === 0) return null;

    const sourceType = action.sourceType || state.sourceType;

    state.phase = 'LOADING';
    state.sourceType = sourceType;

    try {
      const adapter = this.sourceFactory.get(sourceType);

      // Fetch more tracks than needed to allow for shuffling and filtering duplicates
      const fetchLimit = Math.max(state.totalRounds * 3, 50);
      const rawTracks = await adapter.search(query.trim(), fetchLimit, action.searchOptions);

      if (rawTracks.length === 0) {
        state.phase = 'SETUP'; // Reset back — no results
        state.errorMessage = 'No songs found for this search. Try a different artist or genre.';
        return { room };
      }

      // Filter duplicates by title and artist
      const uniqueTracks: typeof rawTracks = [];
      const seen = new Set<string>();

      for (const t of rawTracks) {
        // Create a normalized key to detect duplicates
        const key = `${t.title.toLowerCase().trim()}::${t.artist.toLowerCase().trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTracks.push(t);
        }
      }

      // Shuffle tracks randomly (Fisher-Yates shuffle)
      for (let i = uniqueTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
      }

      // Adjust total rounds to available tracks, then slice
      state.totalRounds = Math.min(state.totalRounds, uniqueTracks.length);
      const selectedTracks = uniqueTracks.slice(0, state.totalRounds);

      // Store secret answers server-side
      this.trackAnswers.set(
        room.code,
        selectedTracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          trackViewUrl: t.trackViewUrl,
          album: t.album,
          releaseYear: t.releaseYear,
        })),
      );

      // Store full tracks for later rounds
      this.fullTracks.set(room.code, selectedTracks);

      // Start first round automatically in GET_READY phase
      const firstTrack = selectedTracks[0];
      state.currentRound = this.createRound(1, firstTrack);
      state.phase = 'GET_READY';
      state.readyPlayerIds = [];

      return { room };
    } catch (error) {
      console.error('[MusicTriviaService] configureSource error:', error);
      state.phase = 'SETUP'; // Reset back on error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred while configuring source';
      state.errorMessage = errorMessage;
      return { room };
    }
  }

  private startRound(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (room.roomHostId !== clientId) return null;

    // START_ROUND is used after REVEAL or when resuming
    if (state.phase !== 'ROUND_RESULT' && state.phase !== 'REVEAL') return null;

    return this.advanceToNextRound(room);
  }

  private pressBuzzer(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (state.phase !== 'PLAYING') return null;

    const round = state.currentRound;
    if (!round) return null;

    const isPlayer = room.players.some((p) => p.socketId === clientId);
    if (!isPlayer) return null;

    const isHost = room.roomHostId === clientId;
    if (isHost && !state.hostPlays) return null;

    // Already struck out this round
    if (round.struckOutIds.includes(clientId)) return null;

    // Already buzzed this round
    if (round.buzzerPresses.some((p) => p.playerId === clientId)) return null;

    const now = Date.now();
    const reactionTimeMs = state.playStartTime ? now - state.playStartTime : 0;

    round.buzzerPresses.push({
      playerId: clientId,
      timestamp: now,
      reactionTimeMs,
    });

    round.currentBuzzerId = clientId;
    state.phase = 'BUZZED';
    state.pausedAtMs = now;

    // For typing mode, immediately transition to ANSWERING
    if (state.mode === 'TYPING') {
      state.phase = 'ANSWERING';
    }

    const result: MusicTriviaActionResult = { room };

    // The trackAnswerTo is intentionally NOT set for typing mode

    return result;
  }

  private giveUp(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (state.phase !== 'PLAYING') return null;

    const round = state.currentRound;
    if (!round) return null;

    const isPlayer = room.players.some((p) => p.socketId === clientId);
    if (!isPlayer) return null;

    const isHost = room.roomHostId === clientId;
    if (isHost && !state.hostPlays) return null;

    // Already struck out this round
    if (round.struckOutIds.includes(clientId)) return null;

    // Strike out immediately
    round.struckOutIds.push(clientId);

    if (this.allPlayersStruckOut(room)) {
      state.phase = 'REVEAL';
      const answers = this.trackAnswers.get(room.code);
      const trackAnswer = answers ? answers[round.roundNumber - 1] : null;

      if (trackAnswer) {
        state.revealedAnswer = {
          title: trackAnswer.title,
          artist: trackAnswer.artist,
          artworkUrl: round.track.artworkUrl,
          album: trackAnswer.album,
          releaseYear: trackAnswer.releaseYear,
        };
      }
    }

    return { room };
  }

  private submitAnswer(
    room: RoomState,
    clientId: string,
    answer: string,
  ): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (state.mode !== 'TYPING') return null;
    if (state.phase !== 'ANSWERING') return null;

    const round = state.currentRound;
    if (!round || round.currentBuzzerId !== clientId) return null;

    const answers = this.trackAnswers.get(room.code);
    if (!answers) return null;

    const trackAnswer = answers[round.roundNumber - 1];
    if (!trackAnswer) return null;

    const criteria = room.config.musicTriviaAnswerCriteria || 'ANY';
    const matchTitle = this.fuzzyMatch(answer, trackAnswer.title);
    const matchArtist = this.fuzzyMatch(answer, trackAnswer.artist);

    let isCorrect = false;
    if (criteria === 'TITLE') {
      isCorrect = matchTitle;
    } else if (criteria === 'ARTIST') {
      isCorrect = matchArtist;
    } else {
      isCorrect = matchTitle || matchArtist;
    }

    if (isCorrect) {
      round.answeredCorrectly = true;
      round.winnerId = clientId;
      state.scores[clientId] = (state.scores[clientId] || 0) + 1;

      // Update player score on RoomState
      const player = room.players.find((p) => p.socketId === clientId);
      if (player) player.score = state.scores[clientId];

      state.phase = 'ANSWER_RESULT';
      state.revealedAnswer = {
        title: trackAnswer.title,
        artist: trackAnswer.artist,
        artworkUrl: round.track.artworkUrl,
        album: trackAnswer.album,
        releaseYear: trackAnswer.releaseYear,
        successfulAnswerText: answer.trim(),
      };
    } else {
      // Strike out — wrong answer
      round.struckOutIds.push(clientId);
      round.currentBuzzerId = null;

      // Check if all eligible players are struck out
      if (this.allPlayersStruckOut(room)) {
        state.phase = 'REVEAL';
        state.revealedAnswer = {
          title: trackAnswer.title,
          artist: trackAnswer.artist,
          artworkUrl: round.track.artworkUrl,
          album: trackAnswer.album,
          releaseYear: trackAnswer.releaseYear,
        };
      } else {
        // Resume music — others can buzz
        state.phase = 'PLAYING';
        if (state.playStartTime && state.pausedAtMs) {
          const pauseDuration = Date.now() - state.pausedAtMs;
          state.playStartTime += pauseDuration;
        } else {
          state.playStartTime = Date.now();
        }
        state.pausedAtMs = undefined;

        const result: MusicTriviaActionResult = {
          room,
          syncPlay: {
            roundNumber: round.roundNumber,
            playStartTime: state.playStartTime,
            previewUrl: round.track.previewUrl,
            sourceType: round.track.sourceType,
            durationMs: round.track.durationMs,
            artworkUrl: round.track.artworkUrl,
          },
        };
        return result;
      }
    }

    return { room };
  }

  private hostJudge(
    room: RoomState,
    clientId: string,
    correct: boolean,
  ): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (state.mode !== 'GAME_MASTER') return null;
    if (room.roomHostId !== clientId) return null;
    if (state.phase !== 'BUZZED') return null;

    const round = state.currentRound;
    if (!round || !round.currentBuzzerId) return null;

    const buzzerId = round.currentBuzzerId;
    const answers = this.trackAnswers.get(room.code);
    const trackAnswer = answers ? answers[round.roundNumber - 1] : null;

    if (correct) {
      round.answeredCorrectly = true;
      round.winnerId = buzzerId;
      state.scores[buzzerId] = (state.scores[buzzerId] || 0) + 1;

      const player = room.players.find((p) => p.socketId === buzzerId);
      if (player) player.score = state.scores[buzzerId];

      state.phase = 'ANSWER_RESULT';
      if (trackAnswer) {
        state.revealedAnswer = {
          title: trackAnswer.title,
          artist: trackAnswer.artist,
          artworkUrl: round.track.artworkUrl,
          album: trackAnswer.album,
          releaseYear: trackAnswer.releaseYear,
        };
      }
    } else {
      // Strike out
      round.struckOutIds.push(buzzerId);
      round.currentBuzzerId = null;

      if (this.allPlayersStruckOut(room)) {
        state.phase = 'REVEAL';
        if (trackAnswer) {
          state.revealedAnswer = {
            title: trackAnswer.title,
            artist: trackAnswer.artist,
            artworkUrl: round.track.artworkUrl,
            album: trackAnswer.album,
            releaseYear: trackAnswer.releaseYear,
          };
        }
      } else {
        // Resume music
        state.phase = 'PLAYING';
        if (state.playStartTime && state.pausedAtMs) {
          const pauseDuration = Date.now() - state.pausedAtMs;
          state.playStartTime += pauseDuration;
        } else {
          state.playStartTime = Date.now();
        }
        state.pausedAtMs = undefined;

        return {
          room,
          syncPlay: {
            roundNumber: round.roundNumber,
            playStartTime: state.playStartTime,
            previewUrl: round.track.previewUrl,
            sourceType: round.track.sourceType,
            durationMs: round.track.durationMs,
            artworkUrl: round.track.artworkUrl,
          },
        };
      }
    }

    return { room };
  }

  private revealAnswer(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (room.roomHostId !== clientId) return null;
    if (state.phase !== 'PLAYING' && state.phase !== 'BUZZED' && state.phase !== 'ANSWERING')
      return null;

    const round = state.currentRound;
    if (!round) return null;

    const answers = this.trackAnswers.get(room.code);
    const trackAnswer = answers ? answers[round.roundNumber - 1] : null;

    state.phase = 'REVEAL';
    if (trackAnswer) {
      state.revealedAnswer = {
        title: trackAnswer.title,
        artist: trackAnswer.artist,
        artworkUrl: round.track.artworkUrl,
        album: trackAnswer.album,
        releaseYear: trackAnswer.releaseYear,
      };
    }

    return { room };
  }

  private nextRound(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (room.roomHostId !== clientId) return null;
    if (
      state.phase !== 'ANSWER_RESULT' &&
      state.phase !== 'REVEAL' &&
      state.phase !== 'ROUND_RESULT'
    )
      return null;

    return this.advanceToNextRound(room);
  }

  private endGame(room: RoomState, clientId: string): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    if (room.roomHostId !== clientId) return null;

    state.phase = 'FINISHED';
    room.status = RoomStatus.RESULT;

    // Sync final scores to player objects
    for (const p of room.players) {
      p.score = state.scores[p.socketId] || 0;
    }
    return { room };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private advanceToNextRound(room: RoomState): MusicTriviaActionResult | null {
    const state = room.musicTriviaState!;
    const round = state.currentRound;

    // Save current round to history
    if (round) {
      const answers = this.trackAnswers.get(room.code);
      const trackAnswer = answers ? answers[round.roundNumber - 1] : null;

      const historyEntry: MusicTriviaRoundHistory = {
        roundNumber: round.roundNumber,
        winnerId: round.winnerId,
        trackTitle: trackAnswer?.title || 'Unknown',
        artistName: trackAnswer?.artist || 'Unknown',
        artworkUrl: round.track.artworkUrl,
        trackViewUrl: trackAnswer?.trackViewUrl,
        album: trackAnswer?.album,
        releaseYear: trackAnswer?.releaseYear,
        successfulAnswerText: state.revealedAnswer?.successfulAnswerText,
      };
      state.roundHistory.push(historyEntry);
    }

    const nextRoundNumber = (round?.roundNumber || 0) + 1;

    // Check if game is over
    if (nextRoundNumber > state.totalRounds) {
      state.phase = 'FINISHED';
      state.currentRound = null;
      room.status = RoomStatus.RESULT;

      for (const p of room.players) {
        p.score = state.scores[p.socketId] || 0;
      }

      return { room };
    }

    // Load next track
    const answers = this.trackAnswers.get(room.code);
    if (!answers || !answers[nextRoundNumber - 1]) {
      // No more tracks available
      state.phase = 'FINISHED';
      room.status = RoomStatus.RESULT;
      return { room };
    }

    // We need the full TrackResult but we only stored the answer part.
    // The track info is on the current round's track. We need to reconstruct.
    // Actually we need to store the full track list. Let's check if currentRound has it.
    // We'll store full tracks in a separate map.
    const fullTracks = this.getFullTracks(room.code);
    if (!fullTracks || !fullTracks[nextRoundNumber - 1]) {
      state.phase = 'FINISHED';
      room.status = RoomStatus.RESULT;
      return { room };
    }

    const nextTrack = fullTracks[nextRoundNumber - 1];
    state.currentRound = this.createRound(nextRoundNumber, nextTrack);
    state.phase = 'COUNTDOWN';
    state.countdownEndsAt = Date.now() + 3000;
    state.revealedAnswer = undefined;

    const trackAnswer = answers[nextRoundNumber - 1];
    const result: MusicTriviaActionResult = {
      room,
    };

    if (state.mode === 'GAME_MASTER' && !state.hostPlays) {
      const hostPlayer = room.players.find((p) => p.socketId === room.roomHostId);
      if (hostPlayer) {
        result.hostAnswerTo = {
          socketId: hostPlayer.socketId,
          title: trackAnswer.title,
          artist: trackAnswer.artist,
          artworkUrl: nextTrack.artworkUrl,
          trackViewUrl: trackAnswer.trackViewUrl,
        };
      }
    }

    return result;
  }

  private createRound(roundNumber: number, track: TrackResult): MusicTriviaRound {
    return {
      roundNumber,
      track: {
        id: track.id,
        previewUrl: track.previewUrl,
        sourceType: track.sourceType,
        durationMs: track.durationMs,
        artworkUrl: track.artworkUrl,
      },
      buzzerPresses: [],
      currentBuzzerId: null,
      struckOutIds: [],
      answeredCorrectly: false,
      winnerId: null,
    };
  }

  /**
   * Check if all eligible players are struck out (no one left to buzz).
   */
  private allPlayersStruckOut(room: RoomState): boolean {
    const state = room.musicTriviaState!;
    const round = state.currentRound!;

    const eligiblePlayers = room.players.filter((p) => {
      if (p.connected === false) return false;
      if (!state.hostPlays && p.socketId === room.roomHostId) return false;
      return true;
    });

    return eligiblePlayers.every((p) => round.struckOutIds.includes(p.socketId));
  }

  // ------------------------------------------------------------------
  // Full track storage (separate from answers for clean separation)
  // ------------------------------------------------------------------

  private fullTracks = new Map<string, TrackResult[]>();

  private getFullTracks(roomCode: string): TrackResult[] | undefined {
    return this.fullTracks.get(roomCode);
  }
  // ------------------------------------------------------------------
  // Fuzzy matching (Levenshtein distance)
  // ------------------------------------------------------------------

  /** Levenshtein distance between two strings. */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[m][n];
  }

  /**
   * Fuzzy match: Strict matching to avoid accidental wins.
   * Removes parentheticals from target (e.g. "Song (feat. Artist)" -> "Song").
   */
  fuzzyMatch(input: string, target: string): boolean {
    const a = input.toLowerCase().trim().replace(/\s+/g, ' ');
    if (a.length === 0) return false;

    const variations = new Set<string>();

    // 1. Original without parentheticals
    variations.add(target.replace(/\s*\(.*?\)\s*/g, ''));

    // 2. Content inside parentheticals
    const parenMatches = target.match(/\((.*?)\)/g);
    if (parenMatches) {
      parenMatches.forEach((m) => variations.add(m.replace(/[()]/g, '')));
    }

    // 3. Content split by common separators
    const separators = /\||-|\/|:/;
    target.split(separators).forEach((part) => {
      variations.add(part.replace(/\s*\(.*?\)\s*/g, ''));
    });

    for (const v of variations) {
      const cleanTarget = v.toLowerCase().trim().replace(/\s+/g, ' ');
      if (cleanTarget.length === 0) continue;

      if (a === cleanTarget) return true;

      // Check Levenshtein distance
      const distance = this.levenshteinDistance(a, cleanTarget);
      const maxLen = Math.max(a.length, cleanTarget.length);
      const similarity = 1 - distance / maxLen;

      if (similarity >= 0.85) return true;

      // Allow partial match if input is included in target and is at least 70% of it
      if (cleanTarget.includes(a) && a.length >= cleanTarget.length * 0.7 && a.length >= 3)
        return true;
    }

    return false;
  }
}
