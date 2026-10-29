import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  RoomState,
  RoomStatus,
  CipherCardType,
  CipherClueCount,
  CipherGridState,
  CipherGridMode,
  CipherRole,
  CipherTeam,
  CIPHER_GRID_BOARD_SIZE,
  CIPHER_GRID_MAX_CLUE_COUNT,
  CIPHER_GRID_MIN_PLAYERS,
  CIPHER_GRID_PRIVATE_STATE_KEY,
  CIPHER_GRID_MODE_PRESETS,
  CIPHER_GRID_MAX_CLUE_LENGTH,
  CIPHER_GRID_PICTURES,
  CIPHER_GRID_PICTURES_CLASSIC,
  CIPHER_GRID_PICTURES_MINIMAL,
  CIPHER_GRID_PICTURE_PACKS,
  CipherGridPicture,
  CipherGridPicturePack,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { cipherGridWordPool } from './cipher-grid-words';

/** Room-level private record holding the full Cipher Key. */
const ROOM_KEY = '__room__';
const ROOM_KEYCARD = 'cgRoomKeycard';

/** Either the mutated room or a reason the action was rejected (state untouched). */
export type CipherOutcome =
  | { room: RoomState; error?: undefined }
  | { room?: undefined; error: string };

const other = (team: CipherTeam): CipherTeam => (team === 'SOLAR' ? 'LUNAR' : 'SOLAR');
const normalize = (word: string): string => word.trim().toLocaleLowerCase();

@Injectable()
export class CipherGridService {
  constructor(private readonly privateState: PrivateStateService) {}

  // --- Lifecycle ---

  createInitialState(
    mode: CipherGridMode = 'WORDS',
    picturePack: CipherGridPicturePack = 'MINIMAL',
  ): CipherGridState {
    return {
      mode,
      picturePack,
      phase: 'TEAM_SETUP',
      round: 0,
      teams: {},
      cipherLeads: {},
      board: [],
      startingTeam: null,
      currentTeam: null,
      currentClue: null,
      guessesThisTurn: 0,
      pings: {},
      remaining: { SOLAR: 0, LUNAR: 0 },
      winner: null,
      winReason: null,
      history: [],
      scores: { SOLAR: 0, LUNAR: 0 },
      turnEndsAt: null,
    };
  }

  /** Generic START_GAME: leave the lobby and open team setup. */
  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId || room.status !== RoomStatus.LOBBY) return null;
    if (this.participants(room).length < CIPHER_GRID_MIN_PLAYERS) return null;
    const previous = room.cipherGridState;
    room.cipherGridState = this.createInitialState(
      room.config.cipherGridMode ?? 'WORDS',
      room.config.cipherGridPicturePack ?? 'MINIMAL',
    );
    if (previous) {
      // Keep team picks across rematches so the table doesn't re-sort every game.
      room.cipherGridState.teams = { ...previous.teams };
      room.cipherGridState.cipherLeads = { ...previous.cipherLeads };
      this.pruneTeams(room);
    }
    room.status = RoomStatus.PLAYING;
    this.clearKeycards(room);
    return room;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;
    room.status = RoomStatus.LOBBY;
    if (room.cipherGridState) {
      const { teams, cipherLeads } = room.cipherGridState;
      room.cipherGridState = {
        ...this.createInitialState(
          room.config.cipherGridMode ?? 'WORDS',
          room.config.cipherGridPicturePack ?? 'MINIMAL',
        ),
        teams,
        cipherLeads,
      };
    }
    this.clearKeycards(room);
    return room;
  }

  // --- Team setup ---

  cancelRound(room: RoomState, requesterId: string, round: number): CipherOutcome {
    const state = room.cipherGridState;
    if (room.roomHostId !== requesterId) return { error: 'HOST_ONLY' };
    if (
      !state ||
      state.round !== round ||
      (state.phase !== 'CLUE_GIVING' && state.phase !== 'DECODING')
    ) {
      return { error: 'NOT_LIVE_ROUND' };
    }
    this.clearRound(room);
    return { room };
  }

  assignTeam(
    room: RoomState,
    requesterId: string,
    team: CipherTeam | null,
    role: CipherRole = 'TRACKER',
    targetId?: string,
  ): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'TEAM_SETUP') return { error: 'NOT_TEAM_SETUP' };
    const subjectId = targetId ?? requesterId;
    if (subjectId !== requesterId && room.roomHostId !== requesterId) {
      return { error: 'HOST_ONLY' };
    }
    if (team !== null && team !== 'SOLAR' && team !== 'LUNAR') return { error: 'TEAM_INVALID' };
    if (role !== 'TRACKER' && role !== 'CIPHER_LEAD') return { error: 'ROLE_INVALID' };
    if (!this.participants(room).includes(subjectId)) return { error: 'NOT_A_PLAYER' };

    this.removeFromTeams(state, subjectId);
    if (team) {
      state.teams[subjectId] = team;
      // Claiming the lead seat demotes the previous lead to Tracker.
      if (role === 'CIPHER_LEAD') state.cipherLeads[team] = subjectId;
    }
    return { room };
  }

  randomizeTeams(room: RoomState, requesterId: string): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'TEAM_SETUP') return { error: 'NOT_TEAM_SETUP' };
    if (room.roomHostId !== requesterId) return { error: 'HOST_ONLY' };
    const ids = this.shuffle(this.participants(room));
    state.teams = {};
    state.cipherLeads = {};
    ids.forEach((id, i) => {
      const team: CipherTeam = i % 2 === 0 ? 'SOLAR' : 'LUNAR';
      state.teams[id] = team;
      if (!state.cipherLeads[team]) state.cipherLeads[team] = id;
    });
    return { room };
  }

  startMatch(room: RoomState, requesterId: string): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'TEAM_SETUP') return { error: 'NOT_TEAM_SETUP' };
    if (room.roomHostId !== requesterId) return { error: 'HOST_ONLY' };
    this.pruneTeams(room);
    for (const team of ['SOLAR', 'LUNAR'] as const) {
      if (!state.cipherLeads[team]) return { error: 'TEAM_NEEDS_LEAD' };
      if (this.trackers(state, team).length < 1) return { error: 'TEAM_NEEDS_TRACKER' };
      const connected = new Set(this.participants(room));
      if (
        !connected.has(state.cipherLeads[team]!) ||
        !this.trackers(state, team).some((id) => connected.has(id))
      ) {
        return { error: 'TEAM_DISCONNECTED' };
      }
    }

    const startingTeam: CipherTeam = Math.random() < 0.5 ? 'SOLAR' : 'LUNAR';
    const preset = CIPHER_GRID_MODE_PRESETS[state.mode];
    const keycard = this.buildKeycard(startingTeam, state.mode);

    if (state.mode === 'PICTURES') {
      state.picturePack = room.config.cipherGridPicturePack ?? state.picturePack ?? 'MINIMAL';
    }

    const pictureCatalog: readonly CipherGridPicture[] =
      CIPHER_GRID_PICTURE_PACKS[state.picturePack ?? 'MINIMAL'] ?? CIPHER_GRID_PICTURES_MINIMAL;

    state.board =
      state.mode === 'PICTURES'
        ? this.shuffle(pictureCatalog)
            .slice(0, preset.boardSize)
            .map((picture) => ({ kind: 'PICTURE', pictureId: picture.id, revealed: false }))
        : this.pickWords(room.config.language).map((word) => ({
            kind: 'WORD',
            word,
            revealed: false,
          }));
    state.startingTeam = startingTeam;
    state.currentTeam = startingTeam;
    state.currentClue = null;
    state.guessesThisTurn = 0;
    state.pings = {};
    state.remaining = {
      SOLAR: startingTeam === 'SOLAR' ? preset.first : preset.second,
      LUNAR: startingTeam === 'LUNAR' ? preset.first : preset.second,
    };
    state.winner = null;
    state.winReason = null;
    state.history = [];
    state.round += 1;
    state.phase = 'CLUE_GIVING';
    room.status = RoomStatus.PLAYING;

    this.privateState.set(room.code, ROOM_KEY, ROOM_KEYCARD, keycard);
    this.syncKeycards(room);
    this.armTurnTimer(room);
    return { room };
  }

  /** From ROUND_END back to TEAM_SETUP (teams kept so leads can rotate). */
  nextRound(room: RoomState, requesterId: string): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'ROUND_END') return { error: 'NOT_ROUND_END' };
    if (room.roomHostId !== requesterId) return { error: 'HOST_ONLY' };
    state.phase = 'TEAM_SETUP';
    state.board = [];
    state.currentTeam = null;
    state.currentClue = null;
    state.guessesThisTurn = 0;
    state.pings = {};
    state.winner = null;
    state.winReason = null;
    state.history = [];
    state.turnEndsAt = null;
    room.status = RoomStatus.PLAYING;
    this.clearKeycards(room);
    return { room };
  }

  // --- Turn actions ---

  giveClue(
    room: RoomState,
    requesterId: string,
    rawWord: string,
    count: CipherClueCount,
  ): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'CLUE_GIVING' || !state.currentTeam) {
      return { error: 'NOT_CLUE_PHASE' };
    }
    if (state.cipherLeads[state.currentTeam] !== requesterId) return { error: 'NOT_YOUR_TURN' };

    const word = typeof rawWord === 'string' ? rawWord.trim() : '';
    if (!word || word.length > CIPHER_GRID_MAX_CLUE_LENGTH) return { error: 'CLUE_INVALID' };
    if (/\s/.test(word)) return { error: 'CLUE_MULTIPLE_WORDS' };
    if (!this.isValidCount(count)) return { error: 'CLUE_COUNT_INVALID' };
    const key = normalize(word);
    if (
      state.board.some(
        (card) => card.kind === 'WORD' && !card.revealed && normalize(card.word) === key,
      )
    ) {
      return { error: 'CLUE_ON_BOARD' };
    }

    state.currentClue = {
      id: randomUUID(),
      team: state.currentTeam,
      word,
      count,
      giverId: requesterId,
    };
    state.guessesThisTurn = 0;
    state.pings = {};
    state.phase = 'DECODING';
    state.history.push({
      kind: 'CLUE',
      team: state.currentTeam,
      playerId: requesterId,
      word,
      count,
    });
    return { room };
  }

  pingCard(room: RoomState, requesterId: string, cardIndex: number): CipherOutcome {
    const state = room.cipherGridState;
    const guard = this.guardTracker(state, requesterId, cardIndex);
    if (guard) return { error: guard };
    if (state!.pings[requesterId] === cardIndex) {
      delete state!.pings[requesterId];
    } else {
      state!.pings[requesterId] = cardIndex;
    }
    return { room };
  }

  revealCard(room: RoomState, requesterId: string, cardIndex: number): CipherOutcome {
    const state = room.cipherGridState;
    const guard = this.guardTracker(state, requesterId, cardIndex);
    if (guard) return { error: guard };
    const keycard = this.keycard(room);
    if (!keycard) return { error: 'NO_BOARD' };

    const team = state!.currentTeam!;
    const type = keycard[cardIndex];
    this.markRevealed(state!, cardIndex, type, team);
    state!.guessesThisTurn += 1;
    state!.history.push({ kind: 'REVEAL', team, playerId: requesterId, cardIndex, cardType: type });

    if (type === 'VIRUS') {
      this.finishRound(room, other(team), 'VIRUS');
      return { room };
    }
    if (type === 'SOLAR' || type === 'LUNAR') {
      if (state!.remaining[type] === 0) {
        this.finishRound(room, type, 'ALL_FOUND');
        return { room };
      }
    }
    if (type !== team) {
      this.switchTurn(room);
      return { room };
    }
    const limit = this.guessLimit(state!.currentClue!.count);
    if (limit !== null && state!.guessesThisTurn >= limit) {
      this.switchTurn(room);
    }
    return { room };
  }

  endTurn(room: RoomState, requesterId: string): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'DECODING' || !state.currentTeam) {
      return { error: 'NOT_DECODING' };
    }
    if (!this.trackers(state, state.currentTeam).includes(requesterId)) {
      return { error: 'NOT_YOUR_TURN' };
    }
    if (state.guessesThisTurn < 1) return { error: 'MUST_GUESS_FIRST' };
    state.history.push({ kind: 'END_TURN', team: state.currentTeam, playerId: requesterId });
    this.switchTurn(room);
    return { room };
  }

  /** A challenge has no penalty until the clue giver accepts it. */
  challengeClue(room: RoomState, requesterId: string): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'DECODING' || !state.currentTeam || !state.currentClue) {
      return { error: 'NOT_DECODING' };
    }
    const challengerTeam = state.teams[requesterId];
    if (!challengerTeam || challengerTeam === state.currentTeam) return { error: 'NOT_OPPONENT' };
    if (state.currentClue.challenged) return { error: 'ALREADY_CHALLENGED' };

    state.currentClue.challenged = true;
    state.currentClue.challenge = { team: challengerTeam, status: 'PENDING' };
    state.history.push({
      kind: 'CHALLENGE',
      team: challengerTeam,
      playerId: requesterId,
      word: state.currentClue.word,
    });

    return { room };
  }

  respondChallenge(
    room: RoomState,
    requesterId: string,
    clueId: string,
    accept: boolean,
  ): CipherOutcome {
    const state = room.cipherGridState;
    const clue = state?.currentClue;
    if (
      !state ||
      state.phase !== 'DECODING' ||
      !clue ||
      clue.id !== clueId ||
      clue.challenge?.status !== 'PENDING'
    ) {
      return { error: 'CHALLENGE_EXPIRED' };
    }
    if (clue.giverId !== requesterId) return { error: 'NOT_CLUE_GIVER' };
    if (typeof accept !== 'boolean') return { error: 'INVALID_RESPONSE' };
    const challengerTeam = clue.challenge.team;
    clue.challenge.status = accept ? 'ACCEPTED' : 'REJECTED';
    state.history.push({
      kind: accept ? 'CHALLENGE_ACCEPTED' : 'CHALLENGE_REJECTED',
      team: clue.team,
      playerId: requesterId,
      word: clue.word,
    });
    if (!accept) return { room };

    const keycard = this.keycard(room);
    if (keycard && state.remaining[challengerTeam] > 1) {
      const candidates = state.board
        .map((card, index) => ({ card, index }))
        .filter(({ card, index }) => !card.revealed && keycard[index] === challengerTeam);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (pick) {
        this.markRevealed(state, pick.index, challengerTeam, null);
        state.history.push({
          kind: 'PENALTY_REVEAL',
          team: challengerTeam,
          cardIndex: pick.index,
          cardType: challengerTeam,
        });
      }
    }
    this.switchTurn(room);
    return { room };
  }

  /** Turn timer expiry: pass the turn without penalties. Stale deadlines are ignored. */
  handleTurnTimeout(room: RoomState, deadline: number): RoomState | null {
    const state = room.cipherGridState;
    if (!state || state.turnEndsAt !== deadline) return null;
    if (state.phase !== 'CLUE_GIVING' && state.phase !== 'DECODING') return null;
    if (state.currentTeam) {
      state.history.push({ kind: 'END_TURN', team: state.currentTeam });
    }
    this.switchTurn(room);
    return room;
  }

  // --- Reconnect / disconnect ---

  remapSocketId(state: CipherGridState, oldSocketId: string, newSocketId: string): void {
    if (oldSocketId in state.teams) {
      state.teams[newSocketId] = state.teams[oldSocketId];
      delete state.teams[oldSocketId];
    }
    for (const team of ['SOLAR', 'LUNAR'] as const) {
      if (state.cipherLeads[team] === oldSocketId) state.cipherLeads[team] = newSocketId;
    }
    if (oldSocketId in state.pings) {
      state.pings[newSocketId] = state.pings[oldSocketId];
      delete state.pings[oldSocketId];
    }
    if (state.currentClue?.giverId === oldSocketId) state.currentClue.giverId = newSocketId;
    for (const entry of state.history) {
      if (entry.playerId === oldSocketId) entry.playerId = newSocketId;
    }
  }

  /** A removed player loses their seat; pings are cleaned up. */
  handlePlayerRemoved(room: RoomState, socketId: string): void {
    const state = room.cipherGridState;
    if (!state) return;
    delete state.pings[socketId];
    // The shared hook also runs on a temporary disconnect: retain that seat.
    if (room.players.some((player) => player.socketId === socketId)) return;
    const wasSeated = !!state.teams[socketId];
    this.removeFromTeams(state, socketId);
    if (!wasSeated || (state.phase !== 'CLUE_GIVING' && state.phase !== 'DECODING')) return;
    const missingRole = (['SOLAR', 'LUNAR'] as const).some(
      (team) => !state.cipherLeads[team] || this.trackers(state, team).length === 0,
    );
    if (missingRole) {
      this.clearRound(room);
    }
  }

  // --- Helpers ---

  private clearRound(room: RoomState): void {
    const { mode, picturePack, teams, cipherLeads, round, scores } = room.cipherGridState!;
    room.cipherGridState = {
      ...this.createInitialState(mode, picturePack),
      teams,
      cipherLeads,
      round,
      scores,
    };
    room.status = RoomStatus.PLAYING;
    this.clearKeycards(room);
  }

  private participants(room: RoomState): string[] {
    return room.players.filter((p) => p.connected !== false && !p.isViewer).map((p) => p.socketId);
  }

  private trackers(state: CipherGridState, team: CipherTeam): string[] {
    return Object.entries(state.teams)
      .filter(([id, t]) => t === team && state.cipherLeads[team] !== id)
      .map(([id]) => id);
  }

  private removeFromTeams(state: CipherGridState, socketId: string): void {
    delete state.teams[socketId];
    for (const team of ['SOLAR', 'LUNAR'] as const) {
      if (state.cipherLeads[team] === socketId) delete state.cipherLeads[team];
    }
  }

  /** Drop seats belonging to players who left or became viewers. */
  private pruneTeams(room: RoomState): void {
    const state = room.cipherGridState!;
    const present = new Set(room.players.filter((p) => !p.isViewer).map((p) => p.socketId));
    for (const id of Object.keys(state.teams)) {
      if (!present.has(id)) this.removeFromTeams(state, id);
    }
    for (const team of ['SOLAR', 'LUNAR'] as const) {
      const lead = state.cipherLeads[team];
      if (lead && state.teams[lead] !== team) delete state.cipherLeads[team];
    }
  }

  private guardTracker(
    state: CipherGridState | undefined,
    requesterId: string,
    cardIndex: number,
  ): string | null {
    if (!state || state.phase !== 'DECODING' || !state.currentTeam) return 'NOT_DECODING';
    if (!this.trackers(state, state.currentTeam).includes(requesterId)) return 'NOT_YOUR_TURN';
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= state.board.length) {
      return 'BAD_CARD';
    }
    if (state.board[cardIndex].revealed) return 'CARD_REVEALED';
    return null;
  }

  private isValidCount(count: unknown): count is CipherClueCount {
    if (count === 'UNLIMITED') return true;
    return (
      typeof count === 'number' &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= CIPHER_GRID_MAX_CLUE_COUNT
    );
  }

  /** count + 1 guesses; 0 and UNLIMITED leave the turn open-ended. */
  private guessLimit(count: CipherClueCount): number | null {
    if (count === 'UNLIMITED' || count === 0) return null;
    return count + 1;
  }

  private markRevealed(
    state: CipherGridState,
    index: number,
    type: CipherCardType,
    by: CipherTeam | null,
  ): void {
    const card = state.board[index];
    card.revealed = true;
    card.type = type;
    card.revealedBy = by;
    if (type === 'SOLAR' || type === 'LUNAR') state.remaining[type] -= 1;
    for (const [id, pinged] of Object.entries(state.pings)) {
      if (pinged === index) delete state.pings[id];
    }
  }

  private switchTurn(room: RoomState): void {
    const state = room.cipherGridState!;
    state.currentTeam = state.currentTeam ? other(state.currentTeam) : state.startingTeam;
    state.currentClue = null;
    state.guessesThisTurn = 0;
    state.pings = {};
    state.phase = 'CLUE_GIVING';
    this.armTurnTimer(room);
  }

  private finishRound(room: RoomState, winner: CipherTeam, reason: 'ALL_FOUND' | 'VIRUS'): void {
    const state = room.cipherGridState!;
    const keycard = this.keycard(room);
    if (keycard) {
      state.board.forEach((card, index) => {
        card.type = keycard[index];
      });
    }
    state.winner = winner;
    state.winReason = reason;
    state.scores[winner] += 1;
    state.phase = 'ROUND_END';
    state.currentClue = null;
    state.pings = {};
    state.turnEndsAt = null;
    for (const player of room.players) {
      if (state.teams[player.socketId] === winner) player.score += 1;
    }
    room.status = RoomStatus.RESULT;
    this.clearKeycards(room);
  }

  private armTurnTimer(room: RoomState): void {
    const seconds = room.config.cipherGridTurnSeconds ?? 0;
    room.cipherGridState!.turnEndsAt = seconds > 0 ? Date.now() + seconds * 1000 : null;
  }

  private keycard(room: RoomState): CipherCardType[] | undefined {
    return this.privateState.get<CipherCardType[]>(room.code, ROOM_KEY, ROOM_KEYCARD);
  }

  /** Give each current Cipher Lead the key; strip it from everyone else. */
  private syncKeycards(room: RoomState): void {
    const state = room.cipherGridState;
    const keycard = this.keycard(room);
    const leads = new Set(Object.values(state?.cipherLeads ?? {}));
    for (const player of room.players) {
      if (keycard && leads.has(player.socketId)) {
        this.privateState.set(room.code, player.socketId, CIPHER_GRID_PRIVATE_STATE_KEY, [...keycard]);
      } else {
        this.privateState.delete(room.code, player.socketId, CIPHER_GRID_PRIVATE_STATE_KEY);
      }
    }
  }

  private clearKeycards(room: RoomState): void {
    this.privateState.delete(room.code, ROOM_KEY, ROOM_KEYCARD);
    for (const player of room.players) {
      this.privateState.delete(room.code, player.socketId, CIPHER_GRID_PRIVATE_STATE_KEY);
    }
  }

  private pickWords(language: 'th' | 'en' | undefined): string[] {
    const unique = Array.from(new Set(cipherGridWordPool(language)));
    return this.shuffle(unique).slice(0, CIPHER_GRID_BOARD_SIZE);
  }

  private buildKeycard(startingTeam: CipherTeam, mode: CipherGridMode): CipherCardType[] {
    const preset = CIPHER_GRID_MODE_PRESETS[mode];
    const cards: CipherCardType[] = [
      ...Array<CipherCardType>(preset.first).fill(startingTeam),
      ...Array<CipherCardType>(preset.second).fill(other(startingTeam)),
      ...Array<CipherCardType>(preset.decoys).fill('DECOY'),
      'VIRUS',
    ];
    return this.shuffle(cards);
  }

  private shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
