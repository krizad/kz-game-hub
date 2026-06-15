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

@Injectable()
export class DetectiveClubService {
  private readonly logger = new Logger(DetectiveClubService.name);
  private availableCards: string[] = [];

  constructor() {
    this.loadAvailableCards();
  }

  private loadAvailableCards() {
    try {
      // Adjusted path to map to the Next.js public directory from the API service
      const imagesDir = path.join(process.cwd(), '..', 'web', 'public', 'images', 'detective-club');
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
      } else {
        this.logger.warn(`Detective club images directory not found at ${imagesDir}`);
      }
    } catch (error) {
      this.logger.error('Failed to load detective club cards', error);
    }
  }
  private drawCards(state: DetectiveClubState, player: DetectiveClubPlayer, count: number) {
    for (let i = 0; i < count; i++) {
      if (!state.deck || state.deck.length === 0) {
        // Reshuffle discard pile into deck, keeping an initial randomized state if empty
        if (state.discardPile && state.discardPile.length > 0) {
          state.deck = [...state.discardPile].sort(() => 0.5 - Math.random());
          state.discardPile = [];
        } else {
          // Fallback: refill with all available cards if everything is empty
          state.deck = [...this.availableCards].sort(() => 0.5 - Math.random());
          state.discardPile = [];
        }
      }

      const card = state.deck!.pop();
      if (card) {
        // Map filename to URL format if it isn't already (availableCards contains just filenames)
        const cardUrl = card.startsWith('/') ? card : `/images/detective-club/${card}`;
        player.hand.push(cardUrl);
      }
    }
  }

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.players.length < 3) return null; // Need at least 3 players
    if (room.roomHostId !== requesterId) return null;

    // Assign roles randomly
    // 1 Informer, 1 Conspirator, rest Detectives
    const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
    const informer = shuffledPlayers[0];
    const conspirator = shuffledPlayers[1];

    const deck = [...this.availableCards].sort(() => 0.5 - Math.random());
    const discardPile: string[] = [];
    const playersRecord: Record<string, DetectiveClubPlayer> = {};

    const state: DetectiveClubState = {
      currentPhase: DetectiveClubPhase.SETUP,
      informerId: informer.socketId,
      conspiratorId: conspirator.socketId,
      word: null,
      activePlayerId: null,
      players: playersRecord,
      playOrder: [], // Will be set when word is submitted
      round1StarterId: informer.socketId,
      deck,
      discardPile,
    };

    shuffledPlayers.forEach((player) => {
      let role = DetectiveClubRole.DETECTIVE;
      if (player.socketId === informer.socketId) role = DetectiveClubRole.INFORMER;
      if (player.socketId === conspirator.socketId) role = DetectiveClubRole.CONSPIRATOR;

      playersRecord[player.socketId] = {
        id: player.socketId,
        role,
        score: player.score || 0,
        hand: [],
        playedCards: [],
        votedFor: null,
      };

      this.drawCards(state, playersRecord[player.socketId], 5);
    });

    room.status = RoomStatus.PLAYING;
    room.detectiveClubState = state;

    return room;
  }

  submitWord(room: RoomState, playerId: string, word: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (state.currentPhase !== DetectiveClubPhase.SETUP) return null;
    if (playerId !== state.informerId) return null;

    state.word = word;
    state.currentPhase = DetectiveClubPhase.PLAYING_ROUND_1;

    // Generate play order starting from Informer
    const playerIds = room.players.map((p) => p.socketId);
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

    const player = state.players[playerId];
    if (!player || cardIndex < 0 || cardIndex >= player.hand.length) return null;

    const playedCard = player.hand.splice(cardIndex, 1)[0]!;
    player.playedCards.push(playedCard);

    // Draw a new card to replace it (hand should maintain 5 cards)
    this.drawCards(state, player, 1);

    // Next active player
    const currentIndex = state.playOrder.indexOf(playerId);
    let nextIndex = (currentIndex + 1) % state.playOrder.length;
    let nextPlayerId = state.playOrder[nextIndex];

    // Skip disconnected players to avoid soft-lock
    const activePlayerIds = new Set(
      room.players.filter((p) => p.connected !== false).map((p) => p.socketId),
    );
    let skippedCount = 0;
    while (!activePlayerIds.has(nextPlayerId) && skippedCount < state.playOrder.length) {
      nextIndex = (nextIndex + 1) % state.playOrder.length;
      nextPlayerId = state.playOrder[nextIndex];
      skippedCount++;
    }

    // Check if round is over (back to the starter of the round, or the next available player if starter left)
    // Actually, round is over when we've cycled back to the starting position (index 0 is starter).
    // If nextIndex wrap-around or skipped over 0, we move to the next phase.
    if ((nextIndex <= currentIndex && skippedCount > 0) || nextIndex === 0) {
      if (state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1) {
        state.currentPhase = DetectiveClubPhase.PLAYING_ROUND_2;
        // Informer starts again, or next active
        state.activePlayerId =
          state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
      } else {
        state.currentPhase = DetectiveClubPhase.DISCUSSION;
        state.activePlayerId =
          state.playOrder.find((id) => activePlayerIds.has(id)) || state.playOrder[0];
      }
    } else {
      state.activePlayerId = nextPlayerId;
    }

    return room;
  }

  nextPhase(room: RoomState, requesterId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (state.currentPhase === DetectiveClubPhase.DISCUSSION) {
      // Only host or Informer can move from Discussion to Voting? Let's say Host.
      if (room.roomHostId !== requesterId) return null;
      state.currentPhase = DetectiveClubPhase.VOTING;
    }

    return room;
  }

  submitVote(room: RoomState, playerId: string, targetId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    const state = room.detectiveClubState;

    if (state.currentPhase !== DetectiveClubPhase.VOTING) return null;

    // Informer cannot vote
    if (playerId === state.informerId) return null;

    const player = state.players[playerId];
    if (!player || !state.players[targetId]) return null;

    // Conspirator CAN vote (to blend in).

    player.votedFor = targetId;

    // Check if everyone (except Informer) has voted
    // Only wait for players who are still in the room to prevent softlocks
    const activePlayerIds = new Set(room.players.map((p) => p.socketId));
    const votingPlayers = Object.values(state.players).filter(
      (p) => p.role !== DetectiveClubRole.INFORMER && activePlayerIds.has(p.id),
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

    let conspiratorVotes = 0;
    const activePlayerIds = new Set(
      room.players.filter((p) => p.connected !== false).map((p) => p.socketId),
    );
    const votingPlayers = Object.values(state.players).filter(
      (p) => p.role !== DetectiveClubRole.INFORMER && activePlayerIds.has(p.id),
    );

    votingPlayers.forEach((p: DetectiveClubPlayer) => {
      if (p.votedFor === state.conspiratorId) {
        conspiratorVotes++;
      }
    });

    const SCORE_DETECTIVE_WIN = 3;
    const SCORE_CONSPIRATOR_WIN = 5;
    const SCORE_INFORMER_WIN = 4;

    // Detectives who voted correctly ALWAYS get 3 points
    votingPlayers.forEach((p: DetectiveClubPlayer) => {
      if (p.role === DetectiveClubRole.DETECTIVE && p.votedFor === state.conspiratorId) {
        p.score += SCORE_DETECTIVE_WIN;
        state.scoreDeltas![p.id] = SCORE_DETECTIVE_WIN;
      }
    });

    // If 1 or fewer players guessed the conspirator, Conspirator and Informer win
    if (conspiratorVotes <= 1) {
      if (state.players[state.conspiratorId!]) {
        state.players[state.conspiratorId!].score += SCORE_CONSPIRATOR_WIN;
        state.scoreDeltas![state.conspiratorId!] =
          (state.scoreDeltas![state.conspiratorId!] || 0) + SCORE_CONSPIRATOR_WIN;
      }
      if (state.players[state.informerId!]) {
        state.players[state.informerId!].score += SCORE_INFORMER_WIN;
        state.scoreDeltas![state.informerId!] =
          (state.scoreDeltas![state.informerId!] || 0) + SCORE_INFORMER_WIN;
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

  nextRound(room: RoomState, requesterId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    if (room.roomHostId !== requesterId) return null;

    const state = room.detectiveClubState;
    if (state.currentPhase !== DetectiveClubPhase.SCORING) return null;

    // Rotate Informer
    const playerIds = room.players.map((p) => p.socketId);
    let nextInformerId = state.informerId!;
    const currentIndex = playerIds.indexOf(state.informerId!);
    if (currentIndex !== -1) {
      nextInformerId = playerIds[(currentIndex + 1) % playerIds.length]!;
    } else if (playerIds.length > 0) {
      nextInformerId = playerIds[0]!;
    }

    const nonInformerPlayers = playerIds.filter((id) => id !== nextInformerId);
    if (nonInformerPlayers.length === 0) return null;
    const randomConspiratorIndex = Math.floor(Math.random() * nonInformerPlayers.length);
    const nextConspiratorId = nonInformerPlayers[randomConspiratorIndex]!;

    if (!state.discardPile) state.discardPile = [];

    const activePlayerIds = new Set(
      room.players.filter((p) => p.connected !== false).map((p) => p.socketId),
    );
    Object.keys(state.players).forEach((id) => {
      if (!activePlayerIds.has(id)) delete state.players[id];
    });

    Object.values(state.players).forEach((p: DetectiveClubPlayer) => {
      // Move played cards to discard pile before clearing
      if (p.playedCards && p.playedCards.length > 0) {
        state.discardPile!.push(...p.playedCards);
      }

      p.role = DetectiveClubRole.DETECTIVE;
      if (p.id === nextInformerId) p.role = DetectiveClubRole.INFORMER;
      if (p.id === nextConspiratorId) p.role = DetectiveClubRole.CONSPIRATOR;

      // Keep hand, keep score, reset playedCards and votedFor
      // Refill hand to 5 if it isn't (it should be 5 because we draw after play, but let's be safe)
      while (p.hand.length < 5) this.drawCards(state, p, 1);

      p.playedCards = [];
      p.votedFor = null;
    });

    state.currentPhase = DetectiveClubPhase.SETUP;
    state.informerId = nextInformerId;
    state.conspiratorId = nextConspiratorId;
    state.word = null;
    state.activePlayerId = null;
    state.playOrder = [];
    state.round1StarterId = nextInformerId;

    return room;
  }

  reset(room: RoomState, requesterId: string): RoomState | null {
    if (!room.detectiveClubState) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.detectiveClubState = undefined;

    room.players.forEach((p) => {
      p.score = 0;
    });

    return room;
  }
}
