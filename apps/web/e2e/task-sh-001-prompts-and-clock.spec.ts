import { test, expect } from '@playwright/test';
import {
  GameType,
  RoomState,
  RoomStatus,
  SoundsFishyPhase,
  DetectiveClubPhase,
  SaboteurPhase,
  CoupPhase,
} from '@repo/types';
import { getGamePrompt } from '../src/components/games/game-prompts';
import { estimateServerOffset } from '../src/hooks/useServerClock';
import { dictionaries } from '../src/i18n/dictionaries';

function translateKey(
  lang: 'en' | 'th',
  keyString: string,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang];
  const keys = keyString.split('.');
  let current: any = dict;
  for (const k of keys) {
    if (current?.[k] === undefined) return keyString;
    current = current[k];
  }
  if (typeof current !== 'string') return keyString;
  let text = current;
  if (params) {
    for (const [pk, pv] of Object.entries(params)) {
      text = text.replaceAll(`{${pk}}`, String(pv));
    }
  }
  return text;
}

test.describe('TASK-SH-001: Clock Offset & Wire Contract', () => {
  test('estimateServerOffset correctly handles ±5000ms clock skew', () => {
    // Aligned clocks
    expect(estimateServerOffset(1000, 1100, 1050)).toBe(0);

    // Client clock is 5000ms behind server clock
    // Client sent at 1000, recvd at 1100 (midpoint 1050). Server handled at 6050.
    const behindOffset = estimateServerOffset(1000, 1100, 6050);
    expect(behindOffset).toBe(5000);
    // Displayed server time when client now is 1200
    const clientNow = 1200;
    const estimatedServerNow = clientNow + behindOffset;
    expect(estimatedServerNow).toBe(6200);

    // Client clock is 5000ms ahead of server clock
    // Client sent at 6000, recvd at 6100 (midpoint 6050). Server handled at 1050.
    const aheadOffset = estimateServerOffset(6000, 6100, 1050);
    expect(aheadOffset).toBe(-5000);
    const clientNowAhead = 6200;
    const estimatedServerNowAhead = clientNowAhead + aheadOffset;
    expect(estimatedServerNowAhead).toBe(1200);
  });

  test('RTT filtering rejects > 3000ms and selects min RTT sample', () => {
    const samples = [
      { t0: 1000, t1: 1100, serverNow: 6050 }, // RTT = 100ms, offset = 5000
      { t0: 2000, t1: 2040, serverNow: 7020 }, // RTT = 40ms, offset = 5000 (best)
      { t0: 3000, t1: 6500, serverNow: 9750 }, // RTT = 3500ms (rejected > 3000)
    ];

    const validSamples = samples.filter((s) => {
      const rtt = s.t1 - s.t0;
      return rtt >= 0 && rtt <= 3000;
    });

    expect(validSamples.length).toBe(2);

    let bestRtt = Infinity;
    let selectedOffset = 0;
    for (const s of validSamples) {
      const rtt = s.t1 - s.t0;
      if (rtt < bestRtt) {
        bestRtt = rtt;
        selectedOffset = estimateServerOffset(s.t0, s.t1, s.serverNow);
      }
    }

    expect(bestRtt).toBe(40);
    expect(selectedOffset).toBe(5000);
  });
});

test.describe('TASK-SH-001: Phase Prompts System for all 14 GameTypes', () => {
  const baseRoom = (gameType: GameType): RoomState => ({
    code: 'ROOM01',
    gameType,
    status: RoomStatus.PLAYING,
    hostPlayerId: 'host-socket',
    players: [
      {
        id: 'p1',
        name: 'Alice',
        socketId: 'sock-alice',
        score: 0,
        roomId: 'ROOM01',
        connected: true,
      },
      { id: 'p2', name: 'Bob', socketId: 'sock-bob', score: 0, roomId: 'ROOM01', connected: true },
      {
        id: 'p3',
        name: 'Charlie',
        socketId: 'sock-charlie',
        score: 0,
        roomId: 'ROOM01',
        connected: true,
      },
      {
        id: 'p4',
        name: 'SpectatorSam',
        socketId: 'sock-spectator',
        score: 0,
        roomId: 'ROOM01',
        connected: true,
        isViewer: true,
      },
    ],
    config: { hostSelection: 'FIXED', timerMin: 0 },
    votes: {},
  });

  const verifyPrompt = (
    prompt: { key: string; params?: Record<string, string | number> },
    expectedKey: string,
  ) => {
    expect(prompt.key).toBe(expectedKey);
    // Translation check in EN and TH
    const enText = translateKey('en', prompt.key, prompt.params);
    const thText = translateKey('th', prompt.key, prompt.params);
    expect(enText).not.toBe(prompt.key);
    expect(thText).not.toBe(prompt.key);
    // Never leak private state values in params
    if (prompt.params) {
      for (const val of Object.values(prompt.params)) {
        expect(typeof val).toBe('string');
        expect(['THIEF', 'ASSASSIN', 'DUKE', 'MINER', 'SABOTEUR', 'secret_word_123']).not.toContain(
          val,
        );
      }
    }
  };

  test('1. WHO_KNOW prompts', () => {
    const room = baseRoom(GameType.WHO_KNOW);
    room.status = RoomStatus.WORD_SETTING;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gameWhoKnow.wordSettingWaiting');
    room.hostPlayerId = 'sock-alice';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gameWhoKnow.wordSettingHost');
    verifyPrompt(getGamePrompt(room, 'sock-spectator'), 'gamePrompts.spectating');

    room.status = RoomStatus.QUESTIONING;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gameWhoKnow.questioningHost');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gameWhoKnow.questioningPlayers');

    room.status = RoomStatus.VOTING;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gameWhoKnow.votingHostWait');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gameWhoKnow.votingPrompt');

    room.status = RoomStatus.RESULT;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gameWhoKnow.resultPrompt');
  });

  test('2. TIC_TAC_TOE prompts (Classic, Gobbler, Ultimate)', () => {
    const room = baseRoom(GameType.TIC_TAC_TOE);
    room.config.ticTacToeMode = 'CLASSIC';
    room.ticTacToeState = {
      board: Array(9).fill(null),
      playerXId: 'sock-alice',
      playerOId: 'sock-bob',
      currentTurn: 'X',
    };

    // Alice is X -> yourTurn
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.ttt.yourTurn');
    // Bob is O -> waitingOpponent (params.name = Alice)
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.ttt.waitingOpponent');
    expect(bobPrompt.params?.name).toBe('Alice');

    // Spectator -> spectating
    const specPrompt = getGamePrompt(room, 'sock-spectator');
    verifyPrompt(specPrompt, 'gamePrompts.ttt.spectating');
    expect(specPrompt.params?.playerX).toBe('Alice');
    expect(specPrompt.params?.playerO).toBe('Bob');

    // Winner
    room.ticTacToeState.winner = 'X';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.ttt.gameOver');
  });

  test('3. RPS prompts', () => {
    const room = baseRoom(GameType.RPS);
    room.rpsState = {
      activePlayers: ['sock-alice', 'sock-bob'],
      queue: [],
      choices: {},
      choicesMade: [],
      scores: { 'sock-alice': 0, 'sock-bob': 0 },
    };

    // Before choosing
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.rps.choose');
    verifyPrompt(getGamePrompt(room, 'sock-spectator'), 'gamePrompts.spectating');

    // Alice chooses
    room.rpsState.choicesMade = ['sock-alice'];
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.rps.waitingOpponent');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.rps.choose');

    // Round winner
    room.rpsState.roundWinner = 'sock-alice';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.rps.roundResult');

    // Game winner
    room.rpsState.gameWinner = 'sock-alice';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.rps.matchOver');
  });

  test('4. SOUNDS_FISHY prompts', () => {
    const room = baseRoom(GameType.SOUNDS_FISHY);
    room.soundsFishyState = {
      currentPhase: SoundsFishyPhase.THE_PITCH,
      pickerId: 'sock-alice',
      blueFishId: 'sock-bob',
      redHerringIds: ['sock-charlie'],
      question: null,
      playerAnswers: {},
      answeredPlayerIds: [],
      eliminatedPlayers: [],
      roundScorePool: 0,
      roundPoints: {},
      typingPlayerIds: [],
    };

    // Guesser (Alice) waiting
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.soundsFishy.guesserWaiting');
    // Bob needs to give answer
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.soundsFishy.giveAnswer');
    // Charlie answered
    room.soundsFishyState.answeredPlayerIds = ['sock-charlie'];
    verifyPrompt(getGamePrompt(room, 'sock-charlie'), 'gamePrompts.soundsFishy.waitingAnswers');

    // The Hunt phase
    room.soundsFishyState.currentPhase = SoundsFishyPhase.THE_HUNT;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.soundsFishy.guesserChoose');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.soundsFishy.othersWait');

    // Scoring phase
    room.soundsFishyState.currentPhase = SoundsFishyPhase.SCORING;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.soundsFishy.roundResult');
  });

  test('5. DETECTIVE_CLUB prompts', () => {
    const room = baseRoom(GameType.DETECTIVE_CLUB);
    room.detectiveClubState = {
      currentPhase: DetectiveClubPhase.SETUP,
      informerId: 'sock-alice',
      conspiratorId: 'sock-bob',
      word: null,
      activePlayerId: 'sock-alice',
      playOrder: ['sock-alice', 'sock-bob', 'sock-charlie'],
      round1StarterId: 'sock-alice',
      players: {},
    };

    // Setup: Informer sets word, others wait
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.detectiveClub.leaderWord');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.detectiveClub.othersWaitWord');

    // Round 1
    room.detectiveClubState.currentPhase = DetectiveClubPhase.PLAYING_ROUND_1;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.detectiveClub.playCardTurn');
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.detectiveClub.waitingCard');
    expect(bobPrompt.params?.name).toBe('Alice');

    // Discussion
    room.detectiveClubState.currentPhase = DetectiveClubPhase.DISCUSSION;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.detectiveClub.explainCards');

    // Voting
    room.detectiveClubState.currentPhase = DetectiveClubPhase.VOTING;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.detectiveClub.leaderWaitVote');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.detectiveClub.voteConspirator');
  });

  test('6. WHO_AM_I prompts', () => {
    const room = baseRoom(GameType.WHO_AM_I);
    room.whoAmIState = {
      currentTurn: 'sock-alice',
      currentGuess: null,
      votes: {},
      turnStatus: 'RESULT',
      winner: null,
      currentRound: 1,
      maxRounds: 3,
      eliminatedPlayers: [],
      phase: 'ASKING',
      finalGuessUsed: [],
      wordSubmittedIds: [],
    };

    // Turn player asks question
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.whoAmI.askQuestion');

    // Voting on turn
    room.whoAmIState.turnStatus = 'VOTING';
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.whoAmI.answerQuestion');
    expect(bobPrompt.params?.name).toBe('Alice');

    // Game over
    room.whoAmIState.winner = 'sock-alice';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.whoAmI.gameOver');
  });

  test('7. WHO_FIRST prompts', () => {
    const room = baseRoom(GameType.WHO_FIRST);
    room.whoFirstState = {
      phase: 'COUNTDOWN',
      presses: [],
      currentRound: 1,
      maxRounds: 3,
    };

    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.whoFirst.getReady');
    room.whoFirstState.phase = 'ACTIVE';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.whoFirst.pressButton');
    room.whoFirstState.phase = 'ROUND_RESULT';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.whoFirst.roundResult');
  });

  test('8. MUSIC_TRIVIA prompts', () => {
    const room = baseRoom(GameType.MUSIC_TRIVIA);
    room.config.musicTriviaMode = 'GAME_MASTER';
    room.hostPlayerId = 'sock-alice';
    room.musicTriviaState = {
      phase: 'PLAYING',
      currentRound: {
        roundNumber: 1,
        track: { id: 't1', previewUrl: '', sourceType: 'ITUNES', durationMs: 30000 },
        buzzerPresses: [],
        currentBuzzerId: null,
        struckOutIds: [],
      },
      roundHistory: [],
      scores: {},
      totalRounds: 5,
    };

    // Nobody buzzed
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.musicTrivia.pressBuzzer');

    // Bob buzzed
    room.musicTriviaState.phase = 'BUZZED';
    room.musicTriviaState.currentRound.currentBuzzerId = 'sock-bob';
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.musicTrivia.youBuzzed');
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.musicTrivia.hostJudging');
    const charliePrompt = getGamePrompt(room, 'sock-charlie');
    verifyPrompt(charliePrompt, 'gamePrompts.musicTrivia.otherBuzzed');
    expect(charliePrompt.params?.name).toBe('Bob');
  });

  test('9. THE_MIND prompts', () => {
    const room = baseRoom(GameType.THE_MIND);
    room.theMindState = {
      phase: 'SETUP' as any,
      level: 1,
      maxLevel: 12,
      lives: 3,
      shuriken: 1,
      pileTop: 0,
      playedCards: [],
      handSizes: {},
      readyPlayers: ['sock-alice'],
      failedPlayerId: null,
      discardedCards: {},
      shurikenProposerId: null,
      shurikenVotes: {},
      result: null,
    };

    // Alice is ready, Bob is not
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.theMind.waitingReady');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.theMind.getReady');

    // Playing
    room.theMindState.phase = 'PLAYING' as any;
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.theMind.playCard');
  });

  test('10. SABOTEUR prompts', () => {
    const room = baseRoom(GameType.SABOTEUR);
    room.saboteurState = {
      currentPhase: SaboteurPhase.PLAYING,
      round: 1,
      activePlayerId: 'sock-alice',
      turnOrder: ['sock-alice', 'sock-bob'],
      board: {},
      goalCells: [],
      revealedGoals: [],
      stockCount: 10,
      players: {},
      log: [],
    };

    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.saboteur.yourTurn');
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.saboteur.waitingFor');
    expect(bobPrompt.params?.name).toBe('Alice');
  });

  test('11. COUP prompts', () => {
    const room = baseRoom(GameType.COUP);
    room.coupState = {
      phase: CoupPhase.PLAYING,
      deck: [],
      deadPile: [],
      coins: {},
      influences: {},
      currentTurn: 'sock-alice',
      winnerId: null,
    };

    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.coup.yourTurn');
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.coup.waitingTurn');
    expect(bobPrompt.params?.name).toBe('Alice');

    room.coupState.phase = CoupPhase.AWAITING_CHALLENGE;
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.coup.respondAction');
  });

  test('12. CARD_GAME prompts', () => {
    const room = baseRoom(GameType.CARD_GAME);
    room.cardGameState = {
      preset: 'POK_DENG',
      phase: 'PLAYER_TURNS',
      dealerId: 'sock-bob',
      activePlayerId: 'sock-alice',
      playerOrder: ['sock-alice', 'sock-bob'],
      handCounts: {},
      chips: {},
      decisions: {},
    };

    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.cardGame.yourTurn');
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.cardGame.waitingTurn');
    expect(bobPrompt.params?.name).toBe('Alice');

    room.cardGameState.phase = 'RESULT';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.cardGame.showdown');
  });

  test('13. POKER prompts', () => {
    const room = baseRoom(GameType.POKER);
    room.pokerState = {
      mode: 'ONLINE',
      phase: 'PREFLOP',
      handNumber: 1,
      dealerSeat: 0,
      smallBlindSeat: 0,
      bigBlindSeat: 1,
      smallBlindAmount: 10,
      bigBlindAmount: 20,
      minRaise: 20,
      currentBet: 20,
      activePlayerId: 'sock-alice',
      seats: [],
      pots: [],
      communityCards: [],
      actionLog: [],
      eliminatedSeats: [],
    };

    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.poker.yourTurn');
    const bobPrompt = getGamePrompt(room, 'sock-bob');
    verifyPrompt(bobPrompt, 'gamePrompts.poker.waitingTurn');
    expect(bobPrompt.params?.name).toBe('Alice');

    room.pokerState.phase = 'SHOWDOWN';
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.poker.showdown');
  });

  test('14. BANANA_THIEF prompts', () => {
    const room = baseRoom(GameType.BANANA_THIEF);
    room.bananaThiefState = {
      phase: 'SETUP' as any,
      clock: 0,
      bananaStolen: false,
      votesRecorded: 0,
      votesTotal: 3,
      readyIds: ['sock-alice'],
    };

    // Alice ready, Bob not
    verifyPrompt(getGamePrompt(room, 'sock-alice'), 'gamePrompts.bananaThief.waitingOthersReady');
    verifyPrompt(getGamePrompt(room, 'sock-bob'), 'gamePrompts.bananaThief.tapReady');

    // Voting
    room.bananaThiefState.phase = 'VOTING' as any;
    verifyPrompt(getGamePrompt(room, 'sock-bob', {}), 'gamePrompts.bananaThief.votePrompt');
    verifyPrompt(
      getGamePrompt(room, 'sock-bob', { hasVoted: true }),
      'gamePrompts.bananaThief.waitingVotes',
    );
  });
});
