import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, WhoFirstGameActionType } from '@repo/types';

@Injectable()
export class WhoFirstService {
  startGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;

    const maxRounds = room.config.whoFirstInfiniteRounds ? 0 : (room.config.maxRounds || 3);

    room.whoFirstState = {
      phase: 'LOBBY',
      presses: [],
      currentRound: 1,
      maxRounds,
    };
    room.status = RoomStatus.PLAYING;
    return room;
  }

  handleGameAction(
    room: RoomState,
    clientId: string,
    action: { type: WhoFirstGameActionType | string; payload?: unknown }
  ): RoomState | null {
    const state = room.whoFirstState;
    if (!state) return null;

    const isHost = room.roomHostId === clientId;
    const isPlayer = room.players.some((p) => p.socketId === clientId);

    const penaltyEnabled = room.config.whoFirstPenalty ?? false;
    const hostPlays = room.config.whoFirstHostPlays ?? false;

    const canPlay = isPlayer && (!isHost || hostPlays);

    switch (action.type) {
      case 'START_COUNTDOWN':
        if (isHost && (state.phase === 'LOBBY' || state.phase === 'ROUND_RESULT')) {
          state.phase = 'COUNTDOWN';
          state.presses = [];
          const min = room.config.whoFirstMinCountdownMs || 2000;
          const max = room.config.whoFirstMaxCountdownMs || 5000;
          state.countdownDurationMs = Math.floor(Math.random() * (max - min + 1) + min);
          state.countdownStartTime = Date.now();
        }
        break;

      case 'PRESS_BUTTON': {
        if (!canPlay) return room;

        // Prevent multiple presses from the same player in a round
        if (state.presses.some((p) => p.socketId === clientId)) {
          return room;
        }

        const pressTime = Date.now();

        if (state.phase === 'COUNTDOWN') {
          if (penaltyEnabled) {
            state.presses.push({
              socketId: clientId,
              timestamp: pressTime,
              isPenalty: true,
            });
            const expectedCount = room.players.filter((p) => p.connected).length - (hostPlays ? 0 : 1);
            if (state.presses.length >= expectedCount && expectedCount > 0) {
              state.phase = 'ROUND_RESULT';
            }
          }
        } else if (state.phase === 'ACTIVE') {
          const reactionTimeMs = state.activeStartTime
            ? pressTime - state.activeStartTime
            : 0;

          state.presses.push({
            socketId: clientId,
            timestamp: pressTime,
            reactionTimeMs,
            isPenalty: false,
          });

          // Check if all active players have pressed
          const expectedCount = room.players.filter((p) => p.connected).length - (hostPlays ? 0 : 1);
          const activePresses = state.presses.filter((p) => !p.isPenalty).length;
          const foulCount = state.presses.filter((p) => p.isPenalty).length;
          
          // Optionally end round automatically if everyone has pressed
          if (activePresses + foulCount >= expectedCount && expectedCount > 0) {
            state.phase = 'ROUND_RESULT';
          }
        }
        break;
      }

      case 'NEXT_ROUND':
        if (isHost && state.phase === 'ROUND_RESULT') {
          if (state.maxRounds === 0 || state.currentRound < state.maxRounds) {
            state.currentRound++;
            state.phase = 'COUNTDOWN';
            state.presses = [];
            const min = room.config.whoFirstMinCountdownMs || 2000;
            const max = room.config.whoFirstMaxCountdownMs || 5000;
            state.countdownDurationMs = Math.floor(Math.random() * (max - min + 1) + min);
            state.countdownStartTime = Date.now();
          } else {
            state.phase = 'FINISHED';
            room.status = RoomStatus.RESULT;
          }
        }
        break;

      case 'END_GAME':
        if (isHost) {
          state.phase = 'FINISHED';
          room.status = RoomStatus.RESULT;
        }
        break;
        
      default:
        // Handle custom internal action if frontend sends ACTIVE transition
        if (action.type === 'SET_ACTIVE' && isHost && state.phase === 'COUNTDOWN') {
           state.phase = 'ACTIVE';
           state.activeStartTime = Date.now();
        }
        break;
    }

    return room;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.whoFirstState = {
      phase: 'LOBBY',
      presses: [],
      currentRound: 1,
      maxRounds: room.config.whoFirstInfiniteRounds ? 0 : (room.config.maxRounds || 3),
    };

    return room;
  }
}
