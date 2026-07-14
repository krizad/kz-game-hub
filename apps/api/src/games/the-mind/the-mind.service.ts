import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, TheMindPhase } from '@repo/types';

@Injectable()
export class TheMindService {
  private shuffleArray(arr: number[]): number[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private getMaxLevel(playerCount: number): number {
    if (playerCount <= 2) return 12;
    if (playerCount === 3) return 10;
    return 8;
  }

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;

    const playerCount = room.players.filter((p) => p.connected).length;
    if (playerCount < 2) return null;

    const deck = this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));

    const playerHands: Record<string, number[]> = {};
    const playerIds = room.players.filter((p) => p.connected).map((p) => p.socketId);

    playerIds.forEach((id) => {
      playerHands[id] = [];
    });

    const startingLives = room.config?.theMindStartingLives ?? playerCount;
    const startingShurikens = room.config?.theMindStartingShurikens ?? 1;

    room.theMindState = {
      phase: TheMindPhase.SETUP,
      deck,
      level: 1,
      maxLevel: this.getMaxLevel(playerCount),
      lives: startingLives,
      shuriken: startingShurikens,
      pileTop: 0,
      pileTopPlayerId: null,
      playedCards: [],
      playerHands,
      readyPlayers: [],
      failedPlayerId: null,
      discardedCards: {},
      shurikenProposerId: null,
      shurikenVotes: {},
      result: null,
    };

    room.status = RoomStatus.PLAYING;
    this.dealCards(room);
    return room;
  }

  private dealCards(room: RoomState): void {
    const state = room.theMindState;
    if (!state) return;

    const playerIds = room.players.filter((p) => p.connected).map((p) => p.socketId);
    const cardsPerPlayer = state.level;

    playerIds.forEach((id) => {
      const cards = state.deck.splice(0, cardsPerPlayer);
      state.playerHands[id] = cards.sort((a, b) => a - b);
    });

    state.pileTop = 0;
    state.pileTopPlayerId = null;
    state.playedCards = [];
    state.readyPlayers = [];
    state.failedPlayerId = null;
    state.discardedCards = {};
    state.shurikenProposerId = null;
    state.shurikenVotes = {};
    state.result = null;
  }

  ready(room: RoomState, clientId: string): RoomState | null {
    const state = room.theMindState;
    if (!state) return null;
    if (state.phase !== TheMindPhase.SETUP && state.phase !== TheMindPhase.LEVEL_RESULT)
      return null;

    if (!state.readyPlayers.includes(clientId)) {
      state.readyPlayers.push(clientId);
    }

    const playerCount = room.players.filter((p) => p.connected).length;
    if (state.readyPlayers.length >= playerCount) {
      state.phase = TheMindPhase.PLAYING;
    }

    return room;
  }

  playCard(room: RoomState, clientId: string, card: number): RoomState | null {
    const state = room.theMindState;
    if (!state) return null;
    if (state.phase !== TheMindPhase.PLAYING) return null;

    const hand = state.playerHands[clientId];
    if (!hand || !hand.includes(card)) return null;
    if (hand.length > 0 && card !== hand[0]) return null;

    if (room.config?.theMindBlindMode) {
      state.pileTop = card;
      state.pileTopPlayerId = clientId;
      state.playedCards.push({ card, playerId: clientId });
      state.playerHands[clientId] = hand.filter((c) => c !== card);

      const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
      
      if (allEmpty) {
        let isSuccess = true;
        let lastCard = -1;
        for (const pc of state.playedCards) {
          if (pc.card < lastCard) {
            isSuccess = false;
            break;
          }
          lastCard = pc.card;
        }

        if (isSuccess) {
          if (state.level >= state.maxLevel) {
            state.phase = TheMindPhase.GAME_OVER;
            room.status = RoomStatus.RESULT;
            state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };

            room.players.forEach((p) => {
              p.score += state.level;
            });
          } else {
            state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
            state.phase = TheMindPhase.LEVEL_RESULT;
          }
        } else {
          state.lives -= 1;
          state.result = {
            success: false,
            failedPlayerId: undefined, // no single person to blame in blind mode
            discardedCards: {},
            livesLost: 1,
            levelCleared: false,
          };
          state.phase = TheMindPhase.LEVEL_RESULT;

          if (state.lives <= 0) {
            state.phase = TheMindPhase.GAME_OVER;
            room.status = RoomStatus.RESULT;
          }
        }
      }
      return room;
    }

    const playerCount = room.players.filter((p) => p.connected).length;

    const minCards: { playerId: string; card: number }[] = [];
    for (const [pid, h] of Object.entries(state.playerHands)) {
      if (pid !== clientId && h.length > 0) {
        minCards.push({ playerId: pid, card: h[0] });
      }
    }

    const failedPlayers = minCards.filter((m) => m.card < card);

    if (failedPlayers.length > 0) {
      state.lives -= 1;

      const discarded: Record<string, number[]> = {};
      for (const fp of failedPlayers) {
        const fpHand = state.playerHands[fp.playerId];
        if (fpHand) {
          const toDiscard = fpHand.filter((c) => c < card);
          discarded[fp.playerId] = toDiscard;
          state.playerHands[fp.playerId] = fpHand.filter((c) => c >= card);
        }
      }

      state.pileTop = card;
      state.pileTopPlayerId = clientId;
      state.playedCards.push({ card, playerId: clientId });
      state.playerHands[clientId] = hand.filter((c) => c !== card);

      const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);

      state.result = {
        success: false,
        failedPlayerId: clientId,
        discardedCards: discarded,
        livesLost: 1,
        levelCleared: allEmpty,
      };

      state.failedPlayerId = clientId;
      state.discardedCards = discarded;
      state.phase = TheMindPhase.LEVEL_RESULT;

      if (state.lives <= 0) {
        state.phase = TheMindPhase.GAME_OVER;
        room.status = RoomStatus.RESULT;
      }
    } else {
      state.pileTop = card;
      state.pileTopPlayerId = clientId;
      state.playedCards.push({ card, playerId: clientId });
      state.playerHands[clientId] = hand.filter((c) => c !== card);

      const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
      if (allEmpty) {
        if (state.level >= state.maxLevel) {
          state.phase = TheMindPhase.GAME_OVER;
          room.status = RoomStatus.RESULT;
          state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };

          room.players.forEach((p) => {
            p.score += state.level;
          });
        } else {
          state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
          state.phase = TheMindPhase.LEVEL_RESULT;
        }
      }
    }

    return room;
  }

  nextLevel(room: RoomState, clientId: string): RoomState | null {
    const state = room.theMindState;
    if (!state) return null;
    if (room.roomHostId !== clientId) return null;
    if (state.phase !== TheMindPhase.LEVEL_RESULT && state.phase !== TheMindPhase.SETUP && state.phase !== TheMindPhase.SHURIKEN_RESULT)
      return null;

    if (state.phase === TheMindPhase.SHURIKEN_RESULT) {
      state.phase = TheMindPhase.PLAYING;
      state.discardedCards = {};
      return room;
    }

    if (state.phase === TheMindPhase.LEVEL_RESULT && state.result && !state.result.success && !state.result.levelCleared) {
      if (room.config?.theMindBlindMode) {
        state.phase = TheMindPhase.SETUP;
        state.result = null;
        state.discardedCards = {};
        state.failedPlayerId = null;
        
        state.deck = this.shuffleArray(
          state.deck.length > 0 ? state.deck : Array.from({ length: 100 }, (_, i) => i + 1),
        );
        if (state.deck.length < state.level * room.players.filter((p) => p.connected).length) {
          state.deck = this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));
        }
        
        state.playedCards = [];
        state.pileTop = 0;
        state.pileTopPlayerId = null;
        this.dealCards(room);
        return room;
      } else {
        state.phase = TheMindPhase.PLAYING;
        state.result = null;
        state.discardedCards = {};
        state.failedPlayerId = null;
        return room;
      }
    }

    if (state.level < state.maxLevel) {
      state.level += 1;
      state.phase = TheMindPhase.SETUP;
      state.deck = this.shuffleArray(
        state.deck.length > 0 ? state.deck : Array.from({ length: 100 }, (_, i) => i + 1),
      );
      if (state.deck.length < state.level * room.players.filter((p) => p.connected).length) {
        state.deck = this.shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1));
      }
      this.dealCards(room);
    }

    return room;
  }

  proposeShuriken(room: RoomState, clientId: string): RoomState | null {
    const state = room.theMindState;
    if (!state) return null;
    if (state.phase !== TheMindPhase.PLAYING) return null;
    if (state.shuriken <= 0) return null;

    state.shurikenProposerId = clientId;
    state.shurikenVotes = { [clientId]: true };
    state.phase = TheMindPhase.SHURIKEN_VOTE;

    return room;
  }

  voteShuriken(room: RoomState, clientId: string, agree: boolean): RoomState | null {
    const state = room.theMindState;
    if (!state) return null;
    if (state.phase !== TheMindPhase.SHURIKEN_VOTE) return null;

    state.shurikenVotes[clientId] = agree;

    const playerCount = room.players.filter((p) => p.connected).length;
    const voteCount = Object.keys(state.shurikenVotes).length;

    if (voteCount >= playerCount) {
      const allAgree = Object.values(state.shurikenVotes).every((v) => v);
      state.shurikenProposerId = null;
      state.shurikenVotes = {};

      if (allAgree) {
        state.shuriken -= 1;
        const discarded: Record<string, number[]> = {};
        for (const [pid, hand] of Object.entries(state.playerHands)) {
          if (hand.length > 0) {
            discarded[pid] = [hand[0]];
            state.playerHands[pid] = hand.slice(1);
          }
        }
        state.discardedCards = discarded;
        state.phase = TheMindPhase.SHURIKEN_RESULT;

        const allEmpty = Object.values(state.playerHands).every((h) => h.length === 0);
        if (allEmpty) {
          let isSuccess = true;
          if (room.config?.theMindBlindMode) {
            let lastCard = -1;
            for (const pc of state.playedCards) {
              if (pc.card < lastCard) {
                isSuccess = false;
                break;
              }
              lastCard = pc.card;
            }
          }

          if (isSuccess) {
            if (state.level >= state.maxLevel) {
              state.phase = TheMindPhase.GAME_OVER;
              room.status = RoomStatus.RESULT;
              state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
              room.players.forEach((p) => {
                p.score += state.level;
              });
            } else {
              state.phase = TheMindPhase.LEVEL_RESULT;
              state.result = { success: true, discardedCards: {}, livesLost: 0, levelCleared: true };
            }
          } else {
            state.lives -= 1;
            state.result = {
              success: false,
              discardedCards: {},
              livesLost: 1,
              levelCleared: false,
            };
            state.phase = TheMindPhase.LEVEL_RESULT;

            if (state.lives <= 0) {
              state.phase = TheMindPhase.GAME_OVER;
              room.status = RoomStatus.RESULT;
            }
          }
        }
      }
    }

    return room;
  }

  cancelShurikenProposal(room: RoomState, clientId: string): RoomState | null {
    const state = room.theMindState;
    if (!state) return null;
    if (state.phase !== TheMindPhase.SHURIKEN_VOTE) return null;
    if (state.shurikenProposerId !== clientId) return null;

    state.shurikenProposerId = null;
    state.shurikenVotes = {};
    state.phase = TheMindPhase.PLAYING;

    return room;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.theMindState = undefined;

    return room;
  }
}
