import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import {
  CardGameAction,
  CardGamePrivateState,
  CardGameState,
  GameType,
  PlayingCard,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { PrivateStateService } from '../private-state.service';

const PRIVATE_KEY = 'cardGame';
const STARTING_CHIPS = 100;
const RANKS: PlayingCard['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: PlayingCard['suit'][] = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];

@Injectable()
export class CardGameService {
  constructor(private readonly privateStateService: PrivateStateService) {}

  startPokDeng(room: RoomState, requesterId: string): RoomState | null {
    if (room.gameType !== GameType.CARD_GAME || room.roomHostId !== requesterId) return null;
    const players = room.players.filter((player) => !player.isViewer && player.connected !== false);
    if (players.length < 2) return null;

    const previousDealer = room.cardGameState?.dealerId;
    const previousIndex = players.findIndex((player) => player.socketId === previousDealer);
    const dealer =
      previousIndex === -1 ? players[0] : players[(previousIndex + 1) % players.length];
    const deck = this.shuffle(this.createDeck());
    const hands = new Map<string, PlayingCard[]>();
    for (const player of players) hands.set(player.socketId, [deck.pop()!, deck.pop()!]);

    const chipBalances = room.cardGameChips ?? {};
    room.cardGameChips = chipBalances;
    for (const player of players) {
      chipBalances[player.socketId] = chipBalances[player.socketId] ?? STARTING_CHIPS;
    }

    const state: CardGameState = {
      preset: 'POK_DENG',
      phase: 'PLAYER_TURNS',
      dealerId: dealer.socketId,
      activePlayerId: null,
      playerOrder: players.map((player) => player.socketId),
      handCounts: Object.fromEntries(players.map((player) => [player.socketId, 2])),
      chips: Object.fromEntries(
        players.map((player) => [player.socketId, chipBalances[player.socketId]]),
      ),
      decisions: {},
    };

    for (const player of players) {
      const hand = hands.get(player.socketId)!;
      const natural = this.score(hand) >= 8;
      state.decisions[player.socketId] =
        player.socketId === dealer.socketId || natural ? 'NATURAL' : 'PENDING';
      this.setHand(room.code, player.socketId, hand);
    }
    room.cardGameState = state;
    room.status = RoomStatus.PLAYING;
    this.advance(room, deck);
    return room;
  }

  handleAction(room: RoomState, socketId: string, action: CardGameAction): RoomState | null {
    const state = room.cardGameState;
    if (!state || room.gameType !== GameType.CARD_GAME) return null;
    if (action.type === 'NEXT_ROUND') {
      if (state.phase !== 'RESULT' || socketId !== room.roomHostId) return null;
      return this.startPokDeng(room, room.roomHostId);
    }
    if (room.status !== RoomStatus.PLAYING) return null;
    if (state.phase !== 'PLAYER_TURNS' || state.activePlayerId !== socketId) return null;
    const hand = this.getHand(room.code, socketId);
    if (!hand) return null;
    if (action.type === 'DRAW') {
      const deck = this.getDeck(room.code);
      const card = deck.pop();
      if (!card) return null;
      hand.push(card);
      this.setHand(room.code, socketId, hand);
      state.handCounts[socketId] = hand.length;
      state.decisions[socketId] = 'DRAWN';
    } else if (action.type === 'STAND') {
      state.decisions[socketId] = 'STAND';
    } else {
      return null;
    }
    this.advance(room, deckOrEmpty(this.getDeck(room.code)));
    return room;
  }

  cancelRound(room: RoomState): void {
    const state = room.cardGameState;
    if (!state || room.gameType !== GameType.CARD_GAME) return;
    for (const socketId of state.playerOrder) {
      this.privateStateService.delete(room.code, socketId, PRIVATE_KEY);
    }
    this.privateStateService.delete(room.code, '__card-game-engine__', 'deck');
    room.cardGameState = undefined;
    room.status = RoomStatus.LOBBY;
  }

  remapSocketId(state: CardGameState, oldSocketId: string, newSocketId: string): void {
    if (state.dealerId === oldSocketId) state.dealerId = newSocketId;
    if (state.activePlayerId === oldSocketId) state.activePlayerId = newSocketId;
    state.playerOrder = state.playerOrder.map((id) => (id === oldSocketId ? newSocketId : id));
    state.handCounts = this.remapRecord(state.handCounts, oldSocketId, newSocketId);
    state.chips = this.remapRecord(state.chips, oldSocketId, newSocketId);
    state.decisions = this.remapRecord(state.decisions, oldSocketId, newSocketId);
    if (state.result) {
      state.result.playerScores = this.remapRecord(state.result.playerScores, oldSocketId, newSocketId);
      state.result.winnerIds = state.result.winnerIds.map((id) => (id === oldSocketId ? newSocketId : id));
      state.result.revealedHands = this.remapRecord(state.result.revealedHands, oldSocketId, newSocketId);
    }
  }

  private advance(room: RoomState, deck: PlayingCard[]): void {
    const state = room.cardGameState!;
    const next = state.playerOrder.find((id) => id !== state.dealerId && state.decisions[id] === 'PENDING');
    if (next) {
      state.activePlayerId = next;
      this.setDeck(room.code, deck);
      return;
    }
    const dealerHand = this.getHand(room.code, state.dealerId)!;
    if (this.score(dealerHand) < 5) {
      const card = deck.pop();
      if (card) dealerHand.push(card);
      this.setHand(room.code, state.dealerId, dealerHand);
      state.handCounts[state.dealerId] = dealerHand.length;
    }
    this.setDeck(room.code, deck);
    this.resolve(room);
  }

  private resolve(room: RoomState): void {
    const state = room.cardGameState!;
    const dealerHand = this.getHand(room.code, state.dealerId)!;
    const dealerScore = this.score(dealerHand);
    const playerScores: Record<string, number> = {};
    const revealedHands: Record<string, PlayingCard[]> = {};
    const winnerIds: string[] = [];
    for (const id of state.playerOrder) {
      const hand = this.getHand(room.code, id)!;
      revealedHands[id] = hand;
      playerScores[id] = this.score(hand);
      if (id === state.dealerId) continue;
      if (playerScores[id] > dealerScore) {
        state.chips[id] += 1;
        state.chips[state.dealerId] -= 1;
        winnerIds.push(id);
      } else {
        state.chips[id] -= 1;
        state.chips[state.dealerId] += 1;
      }
    }
    state.phase = 'RESULT';
    state.activePlayerId = null;
    state.result = { dealerScore, playerScores, winnerIds, revealedHands };
    room.cardGameChips = state.chips;
    room.status = RoomStatus.RESULT;
  }

  private createDeck(): PlayingCard[] {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${rank}-${suit}`, rank, suit })));
  }

  private shuffle(deck: PlayingCard[]): PlayingCard[] {
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const target = randomInt(index + 1);
      [deck[index], deck[target]] = [deck[target], deck[index]];
    }
    return deck;
  }

  private score(hand: PlayingCard[]): number {
    return hand.reduce((total, card) => total + (card.rank === 'A' ? 1 : Number(card.rank) || 0), 0) % 10;
  }

  private setHand(roomCode: string, socketId: string, hand: PlayingCard[]): void {
    this.privateStateService.set(roomCode, socketId, PRIVATE_KEY, {
      preset: 'POK_DENG',
      hand,
    } satisfies CardGamePrivateState);
  }

  private getHand(roomCode: string, socketId: string): PlayingCard[] | undefined {
    return this.privateStateService.get<CardGamePrivateState>(roomCode, socketId, PRIVATE_KEY)?.hand;
  }

  private setDeck(roomCode: string, deck: PlayingCard[]): void {
    this.privateStateService.set(roomCode, '__card-game-engine__', 'deck', deck);
  }

  private getDeck(roomCode: string): PlayingCard[] | undefined {
    return this.privateStateService.get<PlayingCard[]>(roomCode, '__card-game-engine__', 'deck');
  }

  private remapRecord<T>(record: Record<string, T>, oldKey: string, newKey: string): Record<string, T> {
    if (!(oldKey in record)) return record;
    const { [oldKey]: value, ...remaining } = record;
    return { ...remaining, [newKey]: value };
  }
}

function deckOrEmpty(deck: PlayingCard[] | undefined): PlayingCard[] {
  return deck ?? [];
}
