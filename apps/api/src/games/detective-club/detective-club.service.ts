import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RoomState,
  RoomStatus,
  DetectiveClubPhase,
  DetectiveClubState,
  DetectiveClubRole,
  DetectiveClubPlayer,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';

const ROOM_KEY = '__room__';
const DC_ROLE = 'dcRole';
const DC_HAND = 'dcHand';
const DC_WORD = 'dcWord';
const DC_ROOM_CONSPIRATOR = 'dcRoomConspirator';
const DC_ROOM_WORD = 'dcRoomWord';
const DC_ROOM_DECK = 'dcRoomDeck';
const DC_ROOM_DISCARD = 'dcRoomDiscard';

const MAX_WORD_LENGTH = 30;

@Injectable()
export class DetectiveClubService {
  private readonly logger = new Logger(DetectiveClubService.name);
  private availableCards: string[] = [];

  constructor(private readonly privateState: PrivateStateService) {
    this.loadAvailableCards();
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private loadAvailableCards() {
    try {
      const candidates = [
        process.env.DETECTIVE_CLUB_CARDS_DIR,
        path.join(process.cwd(), '..', 'web', 'public', 'images', 'detective-club'),
        path.join(process.cwd(), 'apps', 'web', 'public', 'images', 'detective-club'),
      ].filter((p): p is string => !!p);

      for (const imagesDir of candidates) {
        if (fs.existsSync(imagesDir)) {
          const files = fs.readdirSync(imagesDir);
          this.availableCards = files.filter(
            (file) =>
              file.toLowerCase().endsWith('.jpg') ||
              file.toLowerCase().endsWith('.png') ||
              file.toLowerCase().endsWith('.jpeg'),
          );
          this.logger.log(
            `Loaded ${this.availableCards.length} detective club cards from ${imagesDir}`,
          );
          return;
        }
      }
      this.logger.warn('Detective club images directory not found');
    } catch (error) {
      this.logger.error('Failed to load detective club cards', error);
    }
  }

  private isMember(room: RoomState, socketId: string): boolean {
    return room.players.some((p) => p.socketId === socketId && !p.isViewer);
  }

  /** Players who participate in the current game (connected non-viewers). */
  private participatingIds(room: RoomState): string[] {
    return room.players.filter((p) => p.connected !== false && !p.isViewer).map((p) => p.socketId);
  }

  private getRole(room: RoomState, socketId: string): DetectiveClubRole | undefined {
    return this.privateState.get<DetectiveClubRole>(room.code, socketId, DC_ROLE);
  }

  private setRole(room: RoomState, socketId: string, role: DetectiveClubRole): void {
    this.privateState.set(room.code, socketId, DC_ROLE, role);
  }

  private getHand(room: RoomState, socketId: string): string[] {
    return this.privateState.get<string[]>(room.code, socketId, DC_HAND) ?? [];
  }

  private setHand(room: RoomState, socketId: string, hand: string[]): void {
    if (hand.length === 0) {
      this.privateState.delete(room.code, socketId, DC_HAND);
    } else {
      this.privateState.set(room.code, socketId, DC_HAND, hand);
    }
  }

  private getConspiratorId(room: RoomState): string | null {
    return this.privateState.get<string>(room.code, ROOM_KEY, DC_ROOM_CONSPIRATOR) ?? null;
  }

  private setConspiratorId(room: RoomState, socketId: string): void {
    this.privateState.set(room.code, ROOM_KEY, DC_ROOM_CONSPIRATOR, socketId);
  }

  private getSecretWord(room: RoomState): string | null {
    return this.privateState.get<string>(room.code, ROOM_KEY, DC_ROOM_WORD) ?? null;
  }

  private setSecretWord(room: RoomState, word: string): void {
    this.privateState.set(room.code, ROOM_KEY, DC_ROOM_WORD, word);
  }

  private getDeck(room: RoomState): string[] {
    return this.privateState.get<string[]>(room.code, ROOM_KEY, DC_ROOM_DECK) ?? [];
  }

  private setDeck(room: RoomState, deck: string[]): void {
    this.privateState.set(room.code, ROOM_KEY, DC_ROOM_DECK, deck);
  }

  private getDiscard(room: RoomState): string[] {
    return this.privateState.get<string[]>(room.code, ROOM_KEY, DC_ROOM_DISCARD) ?? [];
  }

  private setDiscard(room: RoomState, discard: string[]): void {
    this.privateState.set(room.code, ROOM_KEY, DC_ROOM_DISCARD, discard);
  }

  private drawCards(room: RoomState, playerSocketId: string, count: number) {
    let deck = this.getDeck(room);
    let discard = this.getDiscard(room);

    for (let i = 0; i < count; i++) {
      if (deck.length === 0) {
        if (discard.length > 0) {
          deck = this.shuffleArray(discard);
          discard = [];
        } else {
          deck = this.shuffleArray(this.availableCards);
        }
      }

      const card = deck.pop();
      if (card) {
        const cardUrl = card.startsWith('/') ? card : `/images/detective-club/${card}`;
        const hand = this.getHand(room, playerSocketId);
        hand.push(cardUrl);
        this.setHand(room, playerSocketId, hand);
      }
    }

    this.setDeck(room, deck);
    this.setDiscard(room, discard);
  }

  private syncHandSizes(room: RoomState): void {
    const state = room.detectiveClubState;
    if (!state) return;
    for (const [socketId, player] of Object.entries(state.players)) {
      player.handSize = this.getHand(room, socketId).length;
    }
  }

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.LOBBY) return null;
    const connectedPlayers = room.players.filter((p) => p.connected !== false);
    if (connectedPlayers.length < 3) return null; // Need at least 3 players
    if (room.roomHostId !== requesterId) return null;

    // Assign roles randomly
    // 1 Informer, 1 Conspirator, rest Detectives
    const shuffledPlayers = this.shuffleArray(connectedPlayers);
    const informer = shuffledPlayers[0];
    const conspirator = shuffledPlayers[1];

    const deck = this.shuffleArray(this.availableCards);
    this.setDeck(room, deck);
    this.setDiscard(room, []);

    const playersRecord: Record<string, DetectiveClubPlayer> = {};

    const state: DetectiveClubState = {
      currentPhase: DetectiveClubPhase.SETUP,
      informerId: informer.socketId,
      conspiratorId: null,
      word: null,
      activePlayerId: null,
      players: playersRecord,
      playOrder: [], // Will be set when word is submitted
      round1StarterId: informer.socketId,
    };

    shuffledPlayers.forEach((player) => {
      let role = DetectiveClubRole.DETECTIVE;
      if (player.socketId === informer.socketId) role = DetectiveClubRole.INFORMER;
      if (player.socketId === conspirator.socketId) role = DetectiveClubRole.CONSPIRATOR;

      this.setRole(room, player.socketId, role);
      this.setHand(room, player.socketId, []);

      playersRecord[player.socketId] = {
        id: player.socketId,
        score: player.score || 0,
        handSize: 0,
        playedCards: [],
        votedFor: null,
      };

      this.drawCards(room, player.socketId, 5);
    });

    this.setConspiratorId(room, conspirator.socketId);

    room.status = RoomStatus.PLAYING;
    room.detectiveClubState = state;
    this.syncHandSizes(room);

    return room;
  }

  submitWord(room: RoomState, playerId: string, word: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (state.currentPhase !== DetectiveClubPhase.SETUP) return null;
    if (playerId !== state.informerId) return null;

    const trimmed = word.trim();
    if (!trimmed || trimmed.length > MAX_WORD_LENGTH) return null;

    this.setSecretWord(room, trimmed);

    // Deliver the word to everyone EXCEPT the conspirator (viewers never get it)
    const conspiratorId = this.getConspiratorId(room);
    for (const p of room.players) {
      if (p.connected === false || p.isViewer) continue;
      if (p.socketId === conspiratorId) continue;
      this.privateState.set(room.code, p.socketId, DC_WORD, trimmed);
    }

    state.currentPhase = DetectiveClubPhase.PLAYING_ROUND_1;

    // Generate play order starting from Informer (participants only)
    const playerIds = this.participatingIds(room);
    const informerIndex = playerIds.indexOf(state.informerId);
    state.playOrder = [];
    for (let i = 0; i < playerIds.length; i++) {
      state.playOrder.push(playerIds[(informerIndex + i) % playerIds.length]);
    }

    state.activePlayerId = state.informerId;

    return room;
  }

  playCard(room: RoomState, playerId: string, cardIndex: number): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (
      state.currentPhase !== DetectiveClubPhase.PLAYING_ROUND_1 &&
      state.currentPhase !== DetectiveClubPhase.PLAYING_ROUND_2
    ) {
      return null;
    }

    if (playerId !== state.activePlayerId) return null;
    if (!this.isMember(room, playerId)) return null;

    const player = state.players[playerId];
    if (!player) return null;

    const hand = this.getHand(room, playerId);
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) return null;

    const playedCard = hand.splice(cardIndex, 1)[0]!;
    this.setHand(room, playerId, hand);
    player.playedCards.push(playedCard);

    // Draw a new card to replace it (hand should maintain 5 cards)
    this.drawCards(room, playerId, 1);

    // Next active player
    const currentIndex = state.playOrder.indexOf(playerId);
    let nextIndex = (currentIndex + 1) % state.playOrder.length;
    let nextPlayerId = state.playOrder[nextIndex];

    // Skip disconnected players and viewers to avoid soft-lock
    const activePlayerIds = new Set(this.participatingIds(room));
    let skippedCount = 0;
    while (!activePlayerIds.has(nextPlayerId) && skippedCount < state.playOrder.length) {
      nextIndex = (nextIndex + 1) % state.playOrder.length;
      nextPlayerId = state.playOrder[nextIndex];
      skippedCount++;
    }

    if ((nextIndex <= currentIndex && skippedCount > 0) || nextIndex === 0) {
      if (state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1) {
        state.currentPhase = DetectiveClubPhase.PLAYING_ROUND_2;
        state.activePlayerId =
          state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
      } else {
        state.currentPhase = DetectiveClubPhase.DISCUSSION;
        state.activePlayerId =
          state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
        // The word becomes public at discussion
        state.word = this.getSecretWord(room);
      }
    } else {
      state.activePlayerId = nextPlayerId;
    }

    this.syncHandSizes(room);
    return room;
  }

  nextPhase(room: RoomState, requesterId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (state.currentPhase !== DetectiveClubPhase.DISCUSSION) return null;
    if (room.roomHostId !== requesterId) return null;

    state.currentPhase = DetectiveClubPhase.VOTING;
    return room;
  }

  submitVote(room: RoomState, playerId: string, targetId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (state.currentPhase !== DetectiveClubPhase.VOTING) return null;

    // Informer cannot vote
    if (playerId === state.informerId) return null;
    if (playerId === targetId) return null; // Cannot vote for yourself
    if (!this.isMember(room, targetId)) return null;
    if (targetId === state.informerId) return null; // Cannot vote for the informer

    const player = state.players[playerId];
    if (!player) return null;
    if (player.votedFor !== null) return null; // No re-voting

    player.votedFor = targetId;

    // Only wait for participants (connected non-viewers) to prevent softlocks
    const activePlayerIds = new Set(this.participatingIds(room));
    const votingPlayers = Object.values(state.players).filter(
      (p) => p.id !== state.informerId && activePlayerIds.has(p.id),
    );
    const allVoted = votingPlayers.every((p) => p.votedFor !== null);

    if (allVoted && votingPlayers.length > 0) {
      this.calculateScore(room);
    }

    return room;
  }

  private calculateScore(room: RoomState) {
    const state = room.detectiveClubState!;
    state.currentPhase = DetectiveClubPhase.SCORING;
    state.scoreDeltas = {};

    const conspiratorId = this.getConspiratorId(room);
    state.conspiratorId = conspiratorId;
    state.word = this.getSecretWord(room);

    // Reveal roles publicly at scoring
    for (const [socketId, player] of Object.entries(state.players)) {
      player.role = this.getRole(room, socketId) ?? DetectiveClubRole.DETECTIVE;
    }

    let conspiratorVotes = 0;
    const activePlayerIds = new Set(this.participatingIds(room));
    const votingPlayers = Object.values(state.players).filter(
      (p) => p.id !== state.informerId && activePlayerIds.has(p.id),
    );

    votingPlayers.forEach((p: DetectiveClubPlayer) => {
      if (p.votedFor === conspiratorId) {
        conspiratorVotes++;
      }
    });

    const SCORE_DETECTIVE_WIN = 3;
    const SCORE_CONSPIRATOR_WIN = 5;
    const SCORE_INFORMER_WIN = 4;

    // Detectives who voted correctly ALWAYS get 3 points
    votingPlayers.forEach((p: DetectiveClubPlayer) => {
      if (p.role === DetectiveClubRole.DETECTIVE && p.votedFor === conspiratorId) {
        p.score += SCORE_DETECTIVE_WIN;
        state.scoreDeltas![p.id] = SCORE_DETECTIVE_WIN;
      }
    });

    // If 1 or fewer players guessed the conspirator, Conspirator and Informer win
    if (conspiratorVotes <= 1) {
      if (conspiratorId && state.players[conspiratorId]) {
        state.players[conspiratorId].score += SCORE_CONSPIRATOR_WIN;
        state.scoreDeltas![conspiratorId] =
          (state.scoreDeltas![conspiratorId] || 0) + SCORE_CONSPIRATOR_WIN;
      }
      if (state.informerId && state.players[state.informerId]) {
        state.players[state.informerId].score += SCORE_INFORMER_WIN;
        state.scoreDeltas![state.informerId] =
          (state.scoreDeltas![state.informerId] || 0) + SCORE_INFORMER_WIN;
      }
    }

    // Initialize 0 deltas for players who didn't gain points
    Object.values(state.players).forEach((p) => {
      if (state.scoreDeltas![p.id] === undefined) {
        state.scoreDeltas![p.id] = 0;
      }
    });

    // Update RoomState players copy for consistency
    Object.values(state.players).forEach((p: DetectiveClubPlayer) => {
      const roomPlayer = room.players.find((rp) => rp.socketId === p.id);
      if (roomPlayer) {
        roomPlayer.score = p.score;
      }
    });
  }

  handlePlayerDisconnect(room: RoomState, socketId: string): void {
    const state = room.detectiveClubState;
    if (!state) return;

    const connectedIds = this.participatingIds(room).filter((id) => id !== socketId);

    if (state.currentPhase === DetectiveClubPhase.SETUP) {
      if (state.informerId === socketId && connectedIds.length > 0) {
        const newInformerId = connectedIds[0];
        state.informerId = newInformerId;
        state.round1StarterId = newInformerId;
        this.setRole(room, newInformerId, DetectiveClubRole.INFORMER);
        if (this.getConspiratorId(room) === newInformerId) {
          const newConspirator = connectedIds.find((id) => id !== newInformerId);
          if (newConspirator) {
            this.setConspiratorId(room, newConspirator);
            this.setRole(room, newConspirator, DetectiveClubRole.CONSPIRATOR);
          }
        }
      }
      if (this.getConspiratorId(room) === socketId && connectedIds.length > 1) {
        const newConspirator = connectedIds.find((id) => id !== state.informerId);
        if (newConspirator) {
          this.setConspiratorId(room, newConspirator);
          this.setRole(room, newConspirator, DetectiveClubRole.CONSPIRATOR);
        }
      }
      return;
    }

    if (
      (state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1 ||
        state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_2) &&
      state.activePlayerId === socketId
    ) {
      const activePlayerIds = new Set(this.participatingIds(room));
      state.activePlayerId =
        state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
      return;
    }

    if (state.currentPhase === DetectiveClubPhase.VOTING) {
      const activePlayerIds = new Set(this.participatingIds(room));
      const votingPlayers = Object.values(state.players).filter(
        (p) => p.id !== state.informerId && activePlayerIds.has(p.id),
      );
      const allVoted = votingPlayers.every((p) => p.votedFor !== null);
      if (allVoted && votingPlayers.length > 0) {
        this.calculateScore(room);
      }
    }
  }

  nextRound(room: RoomState, requesterId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    if (room.roomHostId !== requesterId) return null;

    const state = room.detectiveClubState;
    if (state.currentPhase !== DetectiveClubPhase.SCORING) return null;

    // Rotate roles among participants only (viewers never play)
    const connectedIds = this.participatingIds(room);

    // Rotate Informer among connected players only
    let nextInformerId = state.informerId!;
    const currentIndex = connectedIds.indexOf(state.informerId!);
    if (currentIndex !== -1) {
      nextInformerId = connectedIds[(currentIndex + 1) % connectedIds.length]!;
    } else if (connectedIds.length > 0) {
      nextInformerId = connectedIds[0]!;
    }

    const nonInformerPlayers = connectedIds.filter((id) => id !== nextInformerId);
    if (nonInformerPlayers.length === 0) return null;
    const randomConspiratorIndex = Math.floor(Math.random() * nonInformerPlayers.length);
    const nextConspiratorId = nonInformerPlayers[randomConspiratorIndex]!;

    // Move played cards of disconnected players to discard before removing them
    const activePlayerIds = new Set(connectedIds);
    Object.entries(state.players).forEach(([id, p]) => {
      if (!activePlayerIds.has(id)) {
        if (p.playedCards && p.playedCards.length > 0) {
          this.setDiscard(room, [...this.getDiscard(room), ...p.playedCards]);
        }
      }
    });
    Object.keys(state.players).forEach((id) => {
      if (!activePlayerIds.has(id)) delete state.players[id];
    });

    Object.values(state.players).forEach((p: DetectiveClubPlayer) => {
      // Move played cards to discard pile before clearing
      if (p.playedCards && p.playedCards.length > 0) {
        this.setDiscard(room, [...this.getDiscard(room), ...p.playedCards]);
      }

      if (p.id === nextInformerId) this.setRole(room, p.id, DetectiveClubRole.INFORMER);
      else if (p.id === nextConspiratorId) this.setRole(room, p.id, DetectiveClubRole.CONSPIRATOR);
      else this.setRole(room, p.id, DetectiveClubRole.DETECTIVE);

      // Refill hand to 5
      const hand = this.getHand(room, p.id);
      let drawn = 0;
      while (hand.length < 5 && drawn < 5) {
        this.drawCards(room, p.id, 1);
        drawn++;
      }

      p.playedCards = [];
      p.votedFor = null;
      p.role = undefined;
      p.handSize = this.getHand(room, p.id).length;
    });

    this.setConspiratorId(room, nextConspiratorId);
    this.privateState.delete(room.code, ROOM_KEY, DC_ROOM_WORD);
    for (const p of room.players) {
      this.privateState.delete(room.code, p.socketId, DC_WORD);
    }

    state.currentPhase = DetectiveClubPhase.SETUP;
    state.informerId = nextInformerId;
    state.conspiratorId = null;
    state.word = null;
    state.activePlayerId = null;
    state.playOrder = [];
    state.round1StarterId = nextInformerId;
    state.scoreDeltas = undefined;

    return room;
  }

  reset(room: RoomState, requesterId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.detectiveClubState = undefined;
    this.privateState.clearRoom(room.code);

    room.players.forEach((p) => {
      p.score = 0;
    });

    return room;
  }

  /** Re-point every socket-id reference to the new socket id on reconnection. */
  remapSocketId(state: DetectiveClubState, oldSocketId: string, newSocketId: string): void {
    if (state.players[oldSocketId]) {
      state.players[newSocketId] = { ...state.players[oldSocketId], id: newSocketId };
      delete state.players[oldSocketId];
    }
    if (state.informerId === oldSocketId) state.informerId = newSocketId;
    if (state.conspiratorId === oldSocketId) state.conspiratorId = newSocketId;
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    if (state.round1StarterId === oldSocketId) state.round1StarterId = newSocketId;
    state.playOrder = state.playOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    Object.values(state.players).forEach((p) => {
      if (p.votedFor === oldSocketId) p.votedFor = newSocketId;
    });
  }
}
