import {
  GameType,
  getResultRevealPlan,
  getResultRevealProgress,
  ResultRevealActionPayload,
  RoomState,
  RoomStatus,
} from '@repo/types';
import { applyResultRevealAction, syncResultReveal } from './result-reveal';

function roomFor(gameType = GameType.WHO_KNOW, state: Record<string, unknown> = {}): RoomState {
  return {
    id: 'room',
    code: 'ABC123',
    gameType,
    status: RoomStatus.PLAYING,
    roomHostId: 'socket-1',
    createdAt: new Date(),
    config: { hostSelection: 'FIXED', timerMin: 5 },
    players: [1, 2, 3].map((id) => ({
      id: `player-${id}`,
      socketId: `socket-${id}`,
      name: `Player ${id}`,
      score: 0,
      roomId: 'room',
    })),
    ...state,
  } as RoomState;
}

describe('paced result reveal', () => {
  it.each([
    [GameType.WHO_KNOW, { status: RoomStatus.RESULT }],
    [GameType.SOUNDS_FISHY, { status: RoomStatus.RESULT }],
    [GameType.DETECTIVE_CLUB, { detectiveClubState: { currentPhase: 'SCORING' } }],
    [GameType.BANANA_THIEF, { bananaThiefState: { phase: 'RESULT' } }],
    [
      GameType.DOG_RELAY,
      {
        dogRelayState: {
          phase: 'RESULT',
          roundId: 'round-1',
          result: {},
          seatOrder: ['player-2', 'player-1'],
        },
      },
    ],
    [GameType.SABOTEUR, { saboteurState: { currentPhase: 'ROUND_END', round: 1 } }],
    [GameType.SABOTEUR, { saboteurState: { currentPhase: 'GAME_OVER', round: 3 } }],
    [GameType.COUP, { coupState: { phase: 'RESULT' } }],
    [GameType.WHO_AM_I, { status: RoomStatus.RESULT, whoAmIState: { winner: null } }],
    [GameType.RPS, { status: RoomStatus.RESULT }],
    [GameType.MUSIC_TRIVIA, { musicTriviaState: { phase: 'ROUND_RESULT', scores: {} } }],
    [GameType.MUSIC_TRIVIA, { musicTriviaState: { phase: 'ANSWER_RESULT', scores: {} } }],
    [GameType.MUSIC_TRIVIA, { musicTriviaState: { phase: 'FINISHED', scores: {} } }],
    [
      GameType.WHO_FIRST,
      { whoFirstState: { phase: 'ROUND_RESULT', currentRound: 1, presses: [] } },
    ],
    [GameType.WHO_FIRST, { whoFirstState: { phase: 'FINISHED', currentRound: 1, presses: [] } }],
    [GameType.CARD_GAME, { cardGameState: { phase: 'RESULT', preset: 'POK_DENG', result: {} } }],
    [GameType.CARD_GAME, { cardGameState: { phase: 'RESULT', preset: 'SLAVE', result: {} } }],
    [GameType.POKER, { pokerState: { phase: 'HAND_RESULT', handNumber: 1 } }],
    [GameType.TIC_TAC_TOE, { ticTacToeState: { winner: 'X' } }],
    [
      GameType.TIC_TAC_TOE,
      { config: { ticTacToeMode: 'GOBBLER' }, gobblerState: { winner: 'DRAW' } },
    ],
    [
      GameType.TIC_TAC_TOE,
      { config: { ticTacToeMode: 'ULTIMATE' }, ultimateTicTacToeState: { winner: 'O' } },
    ],
    [GameType.CIPHER_GRID, { cipherGridState: { phase: 'ROUND_END', round: 1 } }],
    [GameType.THE_MIND, { theMindState: { phase: 'GAME_OVER', level: 2 } }],
  ] as const)('recognizes the result for %s (%j)', (gameType, state) => {
    const room = roomFor(gameType, state);
    expect(getResultRevealPlan(room)).not.toBeNull();
    room.status = RoomStatus.LOBBY;
    expect(getResultRevealPlan(room)).toBeNull();
  });

  it('keeps Poker show/muck, Saboteur gold picking and The Mind level replay interactive', () => {
    expect(
      getResultRevealPlan(roomFor(GameType.POKER, { pokerState: { phase: 'SHOWDOWN' } })),
    ).toBeNull();
    expect(
      getResultRevealPlan(
        roomFor(GameType.SABOTEUR, { saboteurState: { currentPhase: 'GOLD_PICK' } }),
      ),
    ).toBeNull();
    expect(
      getResultRevealPlan(roomFor(GameType.THE_MIND, { theMindState: { phase: 'LEVEL_RESULT' } })),
    ).toBeNull();
  });

  it('keeps the same timeline across broadcasts and reconnects, then starts fresh next round', () => {
    const room = roomFor(GameType.WHO_KNOW, { status: RoomStatus.RESULT });
    syncResultReveal(room, 1000);
    const original = { ...room.resultReveal! };
    room.players[0].socketId = 'reconnected';
    syncResultReveal(room, 5000);
    expect(room.resultReveal).toEqual(original);
    room.status = RoomStatus.PLAYING;
    syncResultReveal(room, 6000);
    expect(room.resultReveal).toBeUndefined();
    room.status = RoomStatus.RESULT;
    syncResultReveal(room, 7000);
    expect(room.resultReveal!.id).not.toBe(original.id);
  });

  it('automatically opens cards and announces the winner only after every slot', () => {
    const room = roomFor(GameType.WHO_KNOW, { status: RoomStatus.RESULT });
    syncResultReveal(room, 1000);
    const reveal = room.resultReveal!;
    expect(getResultRevealProgress(reveal, 1000).revealedCount).toBe(0);
    expect(
      getResultRevealProgress(reveal, 1000 + reveal.introMs + reveal.stepMs / 2).revealedCount,
    ).toBe(1);
    const winnerAt = 1000 + reveal.introMs + reveal.playerIds.length * reveal.stepMs;
    expect(getResultRevealProgress(reveal, winnerAt - 1).showWinner).toBe(false);
    expect(getResultRevealProgress(reveal, winnerAt).showWinner).toBe(true);
    expect(getResultRevealProgress(reveal, winnerAt + reveal.winnerMs).complete).toBe(true);
  });

  it('accepts only the active owner once, including after socket remapping', () => {
    const room = roomFor(GameType.WHO_KNOW, { status: RoomStatus.RESULT });
    syncResultReveal(room, 1000);
    const payload: ResultRevealActionPayload = {
      code: room.code,
      revealId: room.resultReveal!.id,
      action: 'REVEAL',
    };
    const now = 1000 + room.resultReveal!.introMs;
    expect(applyResultRevealAction(room, 'socket-1', payload, now - 1)).toBe(false);
    expect(applyResultRevealAction(room, 'socket-2', payload, now)).toBe(false);
    room.players[0].socketId = 'new-socket';
    expect(applyResultRevealAction(room, 'socket-1', payload, now)).toBe(false);
    expect(applyResultRevealAction(room, 'new-socket', payload, now)).toBe(true);
    expect(getResultRevealProgress(room.resultReveal!, now).revealedCount).toBe(1);
    expect(applyResultRevealAction(room, 'new-socket', payload, now)).toBe(false);
  });

  it('rejects stale requests, viewers and guests attempting a shared skip', () => {
    const room = roomFor(GameType.WHO_KNOW, { status: RoomStatus.RESULT });
    syncResultReveal(room, 1000);
    const payload: ResultRevealActionPayload = {
      code: room.code,
      revealId: room.resultReveal!.id,
      action: 'SKIP',
    };
    expect(applyResultRevealAction(room, 'socket-1', { ...payload, revealId: 'old' }, 1100)).toBe(
      false,
    );
    expect(applyResultRevealAction(room, 'socket-2', payload, 1100)).toBe(false);
    expect(applyResultRevealAction(room, 'spectator', payload, 1100)).toBe(false);
    expect(applyResultRevealAction(room, 'socket-1', payload, 1100)).toBe(true);
    expect(getResultRevealProgress(room.resultReveal!, 1100).complete).toBe(true);
    expect(applyResultRevealAction(room, 'socket-1', payload, 1100)).toBe(false);
  });

  it('does not allow role actions to rush hands or scores', () => {
    const room = roomFor(GameType.RPS, { status: RoomStatus.RESULT });
    syncResultReveal(room, 1000);
    expect(
      applyResultRevealAction(
        room,
        'socket-1',
        { code: room.code, revealId: room.resultReveal!.id, action: 'REVEAL' },
        2600,
      ),
    ).toBe(false);
  });

  it('announces Poker final standings separately from the last completed hand', () => {
    const room = roomFor(GameType.POKER, { pokerState: { phase: 'HAND_RESULT', handNumber: 5 } });
    syncResultReveal(room, 1000);
    expect(room.resultReveal!.kind).toBe('HANDS');
    const handId = room.resultReveal!.id;
    room.status = RoomStatus.RESULT;
    syncResultReveal(room, 2000);
    expect(room.resultReveal!.kind).toBe('SCORES');
    expect(room.resultReveal!.id).not.toBe(handId);
  });

  it('ignores a stale winner belonging to another tic-tac-toe mode', () => {
    const room = roomFor(GameType.TIC_TAC_TOE, {
      config: { ticTacToeMode: 'ULTIMATE' },
      ticTacToeState: { winner: 'X' },
      ultimateTicTacToeState: {},
    });
    expect(getResultRevealPlan(room)).toBeNull();
  });

  it('uses game seat order and excludes viewers', () => {
    const room = roomFor(GameType.DOG_RELAY, {
      dogRelayState: {
        phase: 'RESULT',
        roundId: 'r',
        result: {},
        seatOrder: ['player-2', 'player-1', 'player-3'],
      },
    });
    room.players[2].isViewer = true;
    expect(getResultRevealPlan(room)!.playerIds).toEqual(['player-2', 'player-1']);
  });

  it('leaves enough time for every blind-mode card before the cooperative result', () => {
    const room = roomFor(GameType.THE_MIND, {
      config: { theMindBlindMode: true },
      theMindState: { phase: 'GAME_OVER', level: 1, playedCards: [1, 2, 3] },
    });
    expect(getResultRevealPlan(room)!.introMs).toBe(5200);
  });

  it('shows reflex players who missed the press while excluding the non-playing host', () => {
    const room = roomFor(GameType.WHO_FIRST, {
      whoFirstState: {
        phase: 'ROUND_RESULT',
        currentRound: 1,
        presses: [{ socketId: 'socket-2' }],
      },
    });
    expect(getResultRevealPlan(room)!.playerIds).toEqual(['player-2', 'player-3']);
  });

  it('keeps the Music Trivia game master out of competing score reveals', () => {
    const room = roomFor(GameType.MUSIC_TRIVIA, {
      musicTriviaState: {
        phase: 'ANSWER_RESULT',
        hostPlays: false,
        scores: { 'socket-1': 0, 'socket-2': 1, 'socket-3': 0 },
      },
    });
    expect(getResultRevealPlan(room)!.playerIds).toEqual(['player-2', 'player-3']);
  });
});
