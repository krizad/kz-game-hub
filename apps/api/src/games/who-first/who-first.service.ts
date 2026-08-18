import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus } from '@repo/types';

type WhoFirstActionType = 'START_COUNTDOWN' | 'PRESS_BUTTON' | 'NEXT_ROUND' | 'END_GAME';

const VALID_ACTIONS: WhoFirstActionType[] = [
  'START_COUNTDOWN',
  'PRESS_BUTTON',
  'NEXT_ROUND',
  'END_GAME',
];

@Injectable()
export class WhoFirstService {
  private getCountdownRange(room: RoomState): { min: number; max: number } {
    const minConfig = room.config.whoFirstMinCountdownMs ?? 2000;
    const maxConfig = room.config.whoFirstMaxCountdownMs ?? 5000;
    return { min: Math.min(minConfig, maxConfig), max: Math.max(minConfig, maxConfig) };
  }

  private startCountdown(room: RoomState): void {
    const state = room.whoFirstState;
    if (!state) return;
    state.phase = 'COUNTDOWN';
    state.presses = [];
    state.roundWinnerId = undefined;
    const { min, max } = this.getCountdownRange(room);
    state.countdownDurationMs = Math.floor(Math.random() * (max - min + 1) + min);
    state.countdownStartTime = Date.now();
    state.countdownEndTime = state.countdownStartTime + state.countdownDurationMs;
  }

  private getExpectedCount(room: RoomState): number {
    const hostPlays = room.config.whoFirstHostPlays ?? false;
    return room.players.filter((p) => p.connected).length - (hostPlays ? 0 : 1);
  }

  private resolveRoundWinner(room: RoomState): void {
    const state = room.whoFirstState;
    if (!state) return;
    const validPresses = state.presses
      .filter((p) => !p.isPenalty)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (validPresses.length === 0) return;
    const winnerId = validPresses[0].socketId;
    state.roundWinnerId = winnerId;
    const winner = room.players.find((p) => p.socketId === winnerId);
    if (winner) winner.score += 1;
  }

  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;

    const connectedCount = room.players.filter((p) => p.connected !== false).length;
    if (connectedCount < 2) return null;

    const maxRounds = room.config.whoFirstInfiniteRounds
      ? 0
      : (room.config.whoFirstMaxRounds ?? room.config.maxRounds ?? 3);

    room.whoFirstState = {
      phase: 'COUNTDOWN',
      presses: [],
      currentRound: 1,
      maxRounds,
    };
    room.status = RoomStatus.PLAYING;
    this.startCountdown(room);
    return room;
  }

  setActive(room: RoomState): RoomState | null {
    const state = room.whoFirstState;
    if (!state || state.phase !== 'COUNTDOWN') return null;

    state.phase = 'ACTIVE';
    state.activeStartTime = Date.now();
    return room;
  }

  handleGameAction(
    room: RoomState,
    clientId: string,
    action: { type: string; payload?: unknown },
  ): RoomState | null {
    const state = room.whoFirstState;
    if (!state) return null;

    if (!VALID_ACTIONS.includes(action.type as WhoFirstActionType)) return null;

    const isHost = room.roomHostId === clientId;
    const isPlayer = room.players.some((p) => p.socketId === clientId);

    const penaltyEnabled = room.config.whoFirstPenalty ?? false;
    const hostPlays = room.config.whoFirstHostPlays ?? false;

    const canPlay = isPlayer && (!isHost || hostPlays);

    switch (action.type as WhoFirstActionType) {
      case 'START_COUNTDOWN':
        if (isHost && state.phase === 'ROUND_RESULT') {
          this.startCountdown(room);
        } else {
          return null;
        }
        break;

      case 'PRESS_BUTTON': {
        if (!canPlay) return null;

        // Prevent multiple presses from the same player in a round
        if (state.presses.some((p) => p.socketId === clientId)) {
          return null;
        }

        const pressTime = Date.now();

        if (state.phase === 'COUNTDOWN') {
          if (penaltyEnabled) {
            state.presses.push({
              socketId: clientId,
              timestamp: pressTime,
              isPenalty: true,
            });
            const expectedCount = this.getExpectedCount(room);
            if (state.presses.length >= expectedCount && expectedCount > 0) {
              state.phase = 'ROUND_RESULT';
            }
          }
        } else if (state.phase === 'ACTIVE') {
          const reactionTimeMs = state.activeStartTime ? pressTime - state.activeStartTime : 0;

          state.presses.push({
            socketId: clientId,
            timestamp: pressTime,
            reactionTimeMs,
            isPenalty: false,
          });

          // Check if all active players have pressed
          const expectedCount = this.getExpectedCount(room);
          const activePresses = state.presses.filter((p) => !p.isPenalty).length;
          const foulCount = state.presses.filter((p) => p.isPenalty).length;

          // Optionally end round automatically if everyone has pressed
          if (activePresses + foulCount >= expectedCount && expectedCount > 0) {
            state.phase = 'ROUND_RESULT';
            this.resolveRoundWinner(room);
          }
        } else {
          return null;
        }
        break;
      }

      case 'NEXT_ROUND':
        if (isHost && state.phase === 'ROUND_RESULT') {
          if (state.maxRounds === 0 || state.currentRound < state.maxRounds) {
            state.currentRound++;
            this.startCountdown(room);
          } else {
            state.phase = 'FINISHED';
            room.status = RoomStatus.RESULT;
          }
        } else {
          return null;
        }
        break;

      case 'END_GAME':
        if (isHost) {
          state.phase = 'FINISHED';
          room.status = RoomStatus.RESULT;
        } else {
          return null;
        }
        break;

      default:
        return null;
    }

    return room;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.whoFirstState = {
      phase: 'COUNTDOWN',
      presses: [],
      currentRound: 1,
      maxRounds: room.config.whoFirstInfiniteRounds
        ? 0
        : (room.config.whoFirstMaxRounds ?? room.config.maxRounds ?? 3),
    };

    return room;
  }
}
