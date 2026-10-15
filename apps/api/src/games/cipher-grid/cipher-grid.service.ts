import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  CipherCardType,
  CipherClueCount,
  CipherGridState,
  CipherRole,
  CipherTeam,
  CIPHER_GRID_BOARD_SIZE,
  CIPHER_GRID_MAX_CLUE_COUNT,
  CIPHER_GRID_MIN_PLAYERS,
  CIPHER_GRID_PRIVATE_KEY,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';
import { cipherGridWordPool } from './cipher-grid-words';

/** Room-level private record holding the full Cipher Key. */
const ROOM_KEY = '__room__';
const ROOM_KEYCARD = 'cgRoomKeycard';

const STARTING_TEAM_CARDS = 9;
const SECOND_TEAM_CARDS = 8;
const DECOY_CARDS = 7;
const MAX_CLUE_LENGTH = 30;

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

  createInitialState(): CipherGridState {
    return {
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
    room.cipherGridState = this.createInitialState();
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
      room.cipherGridState = { ...this.createInitialState(), teams, cipherLeads };
    }
    this.clearKeycards(room);
    return room;
  }

  // --- Team setup ---

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
    }

    const startingTeam: CipherTeam = Math.random() < 0.5 ? 'SOLAR' : 'LUNAR';
    const words = this.pickWords(room.config.language);
    const keycard = this.buildKeycard(startingTeam);

    state.board = words.map((word) => ({ word, revealed: false }));
    state.startingTeam = startingTeam;
    state.currentTeam = startingTeam;
    state.currentClue = null;
    state.guessesThisTurn = 0;
    state.pings = {};
    state.remaining = {
      SOLAR: startingTeam === 'SOLAR' ? STARTING_TEAM_CARDS : SECOND_TEAM_CARDS,
      LUNAR: startingTeam === 'LUNAR' ? STARTING_TEAM_CARDS : SECOND_TEAM_CARDS,
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
    if (!word || word.length > MAX_CLUE_LENGTH) return { error: 'CLUE_INVALID' };
    if (/\s/.test(word)) return { error: 'CLUE_MULTIPLE_WORDS' };
    if (!this.isValidCount(count)) return { error: 'CLUE_COUNT_INVALID' };
    const key = normalize(word);
    if (state.board.some((card) => !card.revealed && normalize(card.word) === key)) {
      return { error: 'CLUE_ON_BOARD' };
    }

    state.currentClue = { team: state.currentTeam, word, count, giverId: requesterId };
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

  /**
   * Opposing team flags the live clue as illegal. The offending turn ends and
   * the challengers get one of their own cards revealed for free — never their
   * last one, so a challenge can't hand out a win.
   */
  challengeClue(room: RoomState, requesterId: string): CipherOutcome {
    const state = room.cipherGridState;
    if (!state || state.phase !== 'DECODING' || !state.currentTeam || !state.currentClue) {
      return { error: 'NOT_DECODING' };
    }
    const challengerTeam = state.teams[requesterId];
    if (!challengerTeam || challengerTeam === state.currentTeam) return { error: 'NOT_OPPONENT' };
    if (state.currentClue.challenged) return { error: 'ALREADY_CHALLENGED' };

    state.currentClue.challenged = true;
    state.history.push({
      kind: 'CHALLENGE',
      team: challengerTeam,
      playerId: requesterId,
      word: state.currentClue.word,
    });

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
    if (state.phase === 'TEAM_SETUP') this.removeFromTeams(state, socketId);
  }

  // --- Helpers ---

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
        this.privateState.set(room.code, player.socketId, CIPHER_GRID_PRIVATE_KEY, [...keycard]);
      } else {
        this.privateState.delete(room.code, player.socketId, CIPHER_GRID_PRIVATE_KEY);
      }
    }
  }

  private clearKeycards(room: RoomState): void {
    this.privateState.delete(room.code, ROOM_KEY, ROOM_KEYCARD);
    for (const player of room.players) {
      this.privateState.delete(room.code, player.socketId, CIPHER_GRID_PRIVATE_KEY);
    }
  }

  private pickWords(language: 'th' | 'en' | undefined): string[] {
    const unique = Array.from(new Set(cipherGridWordPool(language)));
    return this.shuffle(unique).slice(0, CIPHER_GRID_BOARD_SIZE);
  }

  private buildKeycard(startingTeam: CipherTeam): CipherCardType[] {
    const cards: CipherCardType[] = [
      ...Array<CipherCardType>(STARTING_TEAM_CARDS).fill(startingTeam),
      ...Array<CipherCardType>(SECOND_TEAM_CARDS).fill(other(startingTeam)),
      ...Array<CipherCardType>(DECOY_CARDS).fill('DECOY'),
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
