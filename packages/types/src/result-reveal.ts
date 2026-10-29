import { GameType, RoomState, RoomStatus } from './core';

export interface ResultRevealPlan {
  key: string;
  kind: 'ROLES' | 'HANDS' | 'SCORES' | 'BOARD' | 'COOPERATIVE';
  /** Stable UserState.id values, in reveal order. */
  playerIds: string[];
  introMs: number;
  stepMs: number;
  winnerMs: number;
}

export interface ResultRevealState extends ResultRevealPlan {
  id: string;
  startedAt: number;
  /** Incremented when a participant opens their card ahead of its timeout. */
  advancedMs: number;
  skipped?: boolean;
}

export interface ResultRevealActionPayload {
  code: string;
  revealId: string;
  action: 'REVEAL' | 'SKIP';
}

/** Result phases only: never infer secrets or change a game's outcome. */
export function getResultRevealPlan(room: RoomState): ResultRevealPlan | null {
  if (room.status === RoomStatus.LOBBY) return null;
  let key: string | undefined;
  let kind: ResultRevealPlan['kind'] = 'SCORES';
  let sockets = room.players.filter((p) => !p.isViewer).map((p) => p.socketId);
  switch (room.gameType) {
    case GameType.WHO_KNOW:
      if (room.status === RoomStatus.RESULT) key = 'result';
      kind = 'ROLES';
      break;
    case GameType.SOUNDS_FISHY:
      if (room.status === RoomStatus.RESULT) key = 'result';
      kind = 'ROLES';
      break;
    case GameType.DETECTIVE_CLUB:
      if (room.detectiveClubState?.currentPhase === 'SCORING') key = 'scoring';
      kind = 'ROLES';
      sockets = room.detectiveClubState?.playOrder ?? sockets;
      break;
    case GameType.BANANA_THIEF:
      if (room.bananaThiefState?.phase === 'RESULT') key = 'result';
      kind = 'ROLES';
      break;
    case GameType.DOG_RELAY:
      if (room.dogRelayState?.phase === 'RESULT' && room.dogRelayState.result) {
        key = room.dogRelayState.roundId ?? 'result';
        sockets = room.dogRelayState.seatOrder.map(
          (id) => room.players.find((p) => p.id === id)?.socketId ?? '',
        );
      }
      kind = 'ROLES';
      break;
    case GameType.SABOTEUR:
      if (['ROUND_END', 'GAME_OVER'].includes(room.saboteurState?.currentPhase ?? '')) {
        key = `${room.saboteurState!.round}:${room.saboteurState!.currentPhase}`;
      }
      kind = room.saboteurState?.currentPhase === 'GAME_OVER' ? 'SCORES' : 'ROLES';
      sockets = room.saboteurState?.turnOrder ?? sockets;
      break;
    case GameType.COUP:
      if (room.coupState?.phase === 'RESULT') key = 'result';
      kind = 'ROLES';
      break;
    case GameType.WEREWOLF:
      if (room.werewolfState?.phase === 'GAME_OVER') key = 'result';
      kind = 'ROLES';
      break;
    case GameType.WHO_AM_I:
      if (room.status === RoomStatus.RESULT && room.whoAmIState) key = 'result';
      break;
    case GameType.MUSIC_TRIVIA: {
      const state = room.musicTriviaState;
      if (state && ['ANSWER_RESULT', 'REVEAL', 'ROUND_RESULT', 'FINISHED'].includes(state.phase)) {
        key = state.phase === 'FINISHED' ? 'finished' : `round:${state.currentRound?.roundNumber}`;
        sockets = sockets.filter(
          (id) => id in state.scores && (state.hostPlays || id !== room.roomHostId),
        );
      }
      break;
    }
    case GameType.WHO_FIRST:
      if (['ROUND_RESULT', 'FINISHED'].includes(room.whoFirstState?.phase ?? '')) {
        key = `${room.whoFirstState!.currentRound}:${room.whoFirstState!.phase}`;
        sockets = sockets.filter(
          (id) => (room.config?.whoFirstHostPlays ?? false) || id !== room.roomHostId,
        );
      }
      break;
    case GameType.CARD_GAME:
      if (room.cardGameState?.phase === 'RESULT' && room.cardGameState.result) key = 'result';
      sockets = room.cardGameState?.playerOrder ?? sockets;
      kind = room.cardGameState?.preset === 'SLAVE' ? 'SCORES' : 'HANDS';
      break;
    case GameType.POKER:
      if (room.pokerState?.phase === 'HAND_RESULT')
        key =
          room.status === RoomStatus.RESULT
            ? `match:${room.pokerState.handNumber}`
            : `hand:${room.pokerState.handNumber}`;
      sockets = room.pokerState?.playerOrder ?? sockets;
      kind = room.status === RoomStatus.RESULT ? 'SCORES' : 'HANDS';
      break;
    case GameType.CIPHER_GRID:
      if (room.cipherGridState?.phase === 'ROUND_END') key = `round:${room.cipherGridState.round}`;
      kind = 'BOARD';
      sockets = [];
      break;
    case GameType.THE_MIND:
      if (room.theMindState?.phase === 'GAME_OVER') key = `level:${room.theMindState.level}`;
      kind = 'COOPERATIVE';
      sockets = [];
      break;
  }
  if (!key) return null;
  return {
    key: `${room.gameType}:${key}`,
    kind,
    playerIds: [
      ...new Set(
        sockets.flatMap((socketId) => {
          const player = room.players.find((p) => p.socketId === socketId && !p.isViewer);
          return player ? [player.id] : [];
        }),
      ),
    ],
    introMs:
      room.gameType === GameType.DOG_RELAY
        ? 6000
        : room.gameType === GameType.THE_MIND && room.config?.theMindBlindMode
          ? 2800 + (room.theMindState?.playedCards.length ?? 0) * 800
          : kind === 'BOARD' || kind === 'COOPERATIVE'
            ? 2200
            : 1500,
    stepMs: kind === 'ROLES' ? 5000 : kind === 'HANDS' ? 3200 : 2200,
    winnerMs: 3200,
  };
}

export function getResultRevealProgress(state: ResultRevealState, now: number) {
  const elapsed = Math.max(0, now - state.startedAt + state.advancedMs);
  const winnerAt = state.introMs + state.playerIds.length * state.stepMs;
  return {
    elapsed,
    activeIndex: Math.min(
      state.playerIds.length - 1,
      Math.floor((elapsed - state.introMs) / state.stepMs),
    ),
    revealedCount: Math.min(
      state.playerIds.length,
      Math.max(0, Math.floor((elapsed - state.introMs + state.stepMs / 2) / state.stepMs)),
    ),
    showWinner: elapsed >= winnerAt,
    complete: !!state.skipped || elapsed >= winnerAt + state.winnerMs,
  };
}
