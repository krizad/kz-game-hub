import { test, expect, type Page } from '@playwright/test';
import type { RoomState, Role } from '@repo/types';
import { GameType, RoomStatus } from '@repo/types';
import { createRoom, joinRoom, getOrigin } from './helpers';
import {
  getRevealCard,
  getRevealEvidence,
  getRevealOutcome,
} from '../src/components/core/result-reveal-content';
import { dictionaries } from '../src/i18n/dictionaries';

interface RevealTestStore {
  room: RoomState;
  playerId: string;
  socketId: string;
  myRole: Role;
  updateConfig: (config: Record<string, unknown>) => void;
  setWord: (word: string) => void;
  endQuestioning: (timeout?: boolean) => void;
  submitVote: (targetId: string) => void;
  resultRevealAction: (action: 'SKIP' | 'REVEAL') => void;
  musicTriviaGameAction: (action: { type: string; correct?: boolean }) => void;
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const state = (
      window as unknown as { __useGameStore: { getState(): RevealTestStore } }
    ).__useGameStore.getState();
    return {
      room: state.room,
      playerId: state.playerId,
      socketId: state.socketId,
      myRole: state.myRole,
    };
  });
}

test('choices open before the winner and automatically reach a persistent summary', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    const code = await createRoom(host, 'Rocky', 'Hand Duel');
    await joinRoom(guest, await getOrigin(host), code, 'Paper');
    await host.getByTestId('lobby-start-game').click();
    await host.getByRole('button', { name: 'Rock', exact: true }).click();
    await guest.getByRole('button', { name: 'Paper', exact: true }).click();
    await expect(host.getByTestId('result-reveal')).toBeVisible();
    await expect(host.getByTestId('result-reveal-winner')).toHaveCount(0);
    await expect(host.getByTestId('rps-next-round-btn')).toHaveCount(0);
    await expect(guest.getByTestId('result-reveal-skip')).toHaveCount(0);
    const hostReveal = (await snapshot(host)).room.resultReveal!;
    expect((await snapshot(guest)).room.resultReveal!.id).toBe(hostReveal.id);
    await expect(host.getByTestId('result-reveal-current-role')).toContainText('Rock');
    await host.screenshot({ path: '/tmp/kz-result-reveal-rps.png', fullPage: true });
    await expect(host.getByTestId('result-reveal-winner')).toContainText('Paper');
    await expect(host.getByText('You didn’t win this round', { exact: true })).toBeVisible();
    await expect(guest.getByText('You won this round!', { exact: true })).toBeVisible();
    await expect(host.getByTestId('result-reveal')).toHaveCount(0);
    await expect(host.getByTestId('rps-next-round-btn')).toBeVisible();
    await expect(host.getByTestId('rps-round-outcome')).toContainText('Paper');
    // A language change rebroadcasts/rerenders without replaying the ending.
    await host.getByText('TH', { exact: true }).click();
    await expect(host.getByTestId('result-reveal')).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('role owners can reveal, reconnect resumes the timeline, and host skip reaches everyone', async ({
  browser,
}) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  try {
    const code = await createRoom(host, 'Host', 'Knowguise');
    const origin = await getOrigin(host);
    for (let index = 1; index < pages.length; index++)
      await joinRoom(pages[index], origin, code, `Player ${index}`);
    await host.evaluate(() =>
      (window as unknown as { __useGameStore: { getState(): RevealTestStore } }).__useGameStore
        .getState()
        .updateConfig({ hostSelection: 'FIXED' }),
    );
    await host.getByTestId('lobby-start-game').click();
    await expect(host.locator('#secretWordModalInput')).toBeVisible();
    await host.locator('#secretWordModalInput').fill('แมว');
    await host.locator('#secretWordModalInput').press('Enter');
    await expect.poll(async () => (await snapshot(host)).room.status).toBe('QUESTIONING');
    await host.evaluate(() =>
      (window as unknown as { __useGameStore: { getState(): RevealTestStore } }).__useGameStore
        .getState()
        .endQuestioning(false),
    );
    await expect.poll(async () => (await snapshot(host)).room.status).toBe('VOTING');
    const participants = await Promise.all(pages.map(snapshot));
    const insider = participants.find((entry) => entry.myRole === 'Know')!;
    for (const page of pages) {
      const own = await snapshot(page);
      const target =
        own.myRole === 'Know'
          ? participants.find((p) => p.myRole === 'Unknow')!.socketId
          : insider.socketId;
      if (own.myRole !== 'Host')
        await page.evaluate(
          (id) =>
            (
              window as unknown as { __useGameStore: { getState(): RevealTestStore } }
            ).__useGameStore
              .getState()
              .submitVote(id),
          target,
        );
    }
    await expect(host.getByTestId('result-reveal')).toBeVisible();
    await expect(host.getByTestId('wk-winner-result')).toHaveCount(0);
    await expect(host.getByTestId('result-reveal-winner')).toHaveCount(0);
    await expect(host.getByTestId('result-reveal-mine')).toBeVisible();
    const before = (await snapshot(host)).room.resultReveal!;
    await host.getByTestId('result-reveal-mine').click();
    const hostId = (await snapshot(host)).playerId;
    for (const page of pages)
      await expect(page.getByTestId(`result-reveal-player-${hostId}`)).toContainText('Word Keeper');

    await pages[3].reload();
    await expect(pages[3].getByTestId('result-reveal')).toHaveAttribute(
      'data-reveal-id',
      before.id,
    );
    const resumed = (await snapshot(pages[3])).room.resultReveal!;
    expect(resumed.startedAt).toBe(before.startedAt);
    expect(resumed.advancedMs).toBeGreaterThan(0);
    await pages[1].getByText('TH', { exact: true }).click();
    await pages[1].setViewportSize({ width: 360, height: 800 });
    await expect(pages[1].getByTestId('result-reveal')).toContainText('ถึงเวลาเฉลย');
    expect(
      await pages[1].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await pages[1].screenshot({ path: '/tmp/kz-result-reveal-role-th.png', fullPage: true });
    await host.getByTestId('result-reveal-skip').click();
    for (const page of pages) {
      await expect(page.getByTestId('result-reveal')).toHaveCount(0);
      await expect(page.getByTestId('wk-winner-result')).toBeVisible();
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('Music Trivia paces a correct answer and retains audio readiness for the next round', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    await guest.route(/youtube\.com|youtu\.be|googlevideo\.com/, (route) => route.abort());
    const code = await createRoom(host, 'Host', 'Music Trivia');
    await joinRoom(guest, await getOrigin(host), code, 'Listener');
    await host.evaluate(() =>
      (window as unknown as { __useGameStore: { getState(): RevealTestStore } }).__useGameStore
        .getState()
        .updateConfig({
          musicTriviaArtistPresetId: 'e2e-artist',
          musicTriviaMode: 'GAME_MASTER',
          musicTriviaHostPlays: false,
          musicTriviaRounds: 2,
        }),
    );
    await host.getByTestId('lobby-start-game').click();
    await guest.getByRole('button', { name: "I'm Ready!", exact: true }).click();
    await host.getByRole('button', { name: 'Start Song (Countdown)', exact: true }).click();
    await expect
      .poll(async () => (await snapshot(guest)).room.musicTriviaState?.phase)
      .toBe('PLAYING');
    await guest.evaluate(() =>
      (window as unknown as { __useGameStore: { getState(): RevealTestStore } }).__useGameStore
        .getState()
        .musicTriviaGameAction({ type: 'PRESS_BUZZER' }),
    );
    await expect
      .poll(async () => (await snapshot(host)).room.musicTriviaState?.phase)
      .toBe('BUZZED');
    await host.evaluate(() =>
      (window as unknown as { __useGameStore: { getState(): RevealTestStore } }).__useGameStore
        .getState()
        .musicTriviaGameAction({ type: 'HOST_JUDGE', correct: true }),
    );
    await expect(guest.getByTestId('result-reveal')).toBeVisible();
    await expect(guest.getByTestId('result-reveal-winner')).toHaveCount(0);
    await host.getByTestId('result-reveal-skip').click();
    await expect(host.getByTestId('music-next-round')).toBeVisible();
    // The summary remains readable until the host explicitly advances.
    await host.waitForTimeout(10500);
    expect((await snapshot(host)).room.musicTriviaState?.phase).toBe('ANSWER_RESULT');
    await host.getByTestId('music-next-round').click();
    const guestId = (await snapshot(guest)).socketId;
    await expect
      .poll(async () => (await snapshot(guest)).room.musicTriviaState?.readyPlayerIds)
      .toContain(guestId);
    await expect(guest.getByRole('button', { name: "I'm Ready!", exact: true })).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('reveal copy resolves role names in both languages', () => {
  for (const language of ['en', 'th'] as const) {
    const t = (key: string, params?: Record<string, string | number>): string => {
      let value: unknown = dictionaries[language];
      for (const part of key.split('.')) value = (value as Record<string, unknown>)?.[part];
      expect(typeof value, `${language}: ${key}`).toBe('string');
      return Object.entries(params ?? {}).reduce(
        (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
        value as string,
      );
    };
    const player = {
      id: 'p',
      socketId: 's',
      name: 'Name',
      score: 1,
      roomId: 'room',
      role: 'Know',
    } as RoomState['players'][number];
    const room = {
      gameType: 'WHO_KNOW',
      players: [player],
      config: {},
      winner: 'INSIDER',
    } as RoomState;
    expect(getRevealCard(room, player, t).label).toBe(t('gameWhoKnow.insider'));
    expect(getRevealOutcome(room, t).winnerIds).toEqual(['s']);
  }
});

test('every game result resolves localized evidence, roles and outcome', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['WHO_KNOW', { winner: 'TIMEOUT' }],
    [
      'SOUNDS_FISHY',
      {
        soundsFishyState: {
          pickerId: 's',
          blueFishId: 'b',
          redHerringIds: ['s'],
          eliminatedPlayers: [],
          roundPoints: { s: 1 },
          playerAnswers: { s: { answer: 'Answer' } },
          question: { answer: 'Truth' },
        },
      },
    ],
    [
      'DETECTIVE_CLUB',
      {
        detectiveClubState: {
          players: { s: { role: 'DETECTIVE', votedFor: 's' } },
          scoreDeltas: { s: 1 },
          conspiratorId: 's',
          word: 'Secret',
        },
      },
    ],
    [
      'BANANA_THIEF',
      {
        bananaThiefState: {
          thiefId: 's',
          winner: 'SCAPEGOAT',
          caughtId: 's',
          scoreDeltas: { s: 1 },
          specials: { s: 'SCAPEGOAT' },
          votes: { s: 's' },
        },
      },
    ],
    [
      'DOG_RELAY',
      {
        dogRelayState: {
          result: {
            roles: { p: 'GOOD' },
            ballots: { p: 'p' },
            winningTeam: 'GOOD',
            reason: 'CORRECT_PAIR',
            winnerIds: ['p'],
          },
        },
      },
    ],
    [
      'SABOTEUR',
      {
        saboteurState: {
          currentPhase: 'ROUND_END',
          players: { s: { role: 'MINER' } },
          roundResult: { winnerRole: 'MINER' },
        },
      },
    ],
    [
      'SABOTEUR',
      {
        saboteurState: {
          currentPhase: 'GAME_OVER',
          players: { s: { role: 'SABOTEUR' } },
          finalResults: { scores: { s: 3 }, winnerIds: ['s'] },
        },
      },
    ],
    [
      'COUP',
      {
        coupState: {
          winnerId: 's',
          influences: { s: { count: 1, revealed: ['DUKE'] } },
          finalHands: { s: ['DUKE', 'CONTESSA'] },
        },
      },
    ],
    ['WHO_AM_I', { whoAmIState: { winner: 's', revealedWords: { s: 'Cat' } } }],
    ['RPS', { rpsState: { choices: { s: 'ROCK' }, scores: { s: 1 }, roundWinner: 's' } }],
    [
      'WHO_FIRST',
      {
        whoFirstState: {
          phase: 'FINISHED',
          presses: [{ socketId: 's', reactionTimeMs: 123 }],
          roundWinnerId: 's',
        },
      },
    ],
    [
      'MUSIC_TRIVIA',
      {
        musicTriviaState: {
          phase: 'FINISHED',
          scores: { s: 1 },
          revealedAnswer: { title: 'Song', artist: 'Artist' },
        },
      },
    ],
    [
      'CARD_GAME',
      {
        cardGameState: {
          preset: 'POK_DENG',
          result: {
            winnerIds: ['s'],
            playerScores: { s: 9 },
            deltas: { s: 10 },
            revealedHands: {},
          },
        },
      },
    ],
    [
      'CARD_GAME',
      {
        cardGameState: {
          preset: 'SLAVE',
          result: { winnerIds: ['s'], placements: ['s'], revealedHands: {} },
        },
      },
    ],
    [
      'POKER',
      {
        status: RoomStatus.PLAYING,
        pokerState: {
          seats: { s: { chips: 100, handCategory: 'FLUSH' } },
          handResult: { pots: [{ winnerIds: ['s'] }] },
        },
      },
    ],
    ['POKER', { pokerState: { playerOrder: ['s'], seats: { s: { chips: 100 } } } }],
    ['TIC_TAC_TOE', { ticTacToeState: { winner: 'X', playerXId: 's' } }],
    [
      'CIPHER_GRID',
      {
        cipherGridState: {
          winner: 'SOLAR',
          winReason: 'VIRUS',
          teams: { s: 'SOLAR' },
          history: [],
          board: [],
        },
      },
    ],
    ['THE_MIND', { theMindState: { lives: 1, level: 1, result: { success: true } } }],
  ];
  for (const language of ['th', 'en'] as const) {
    const t = (key: string, params?: Record<string, string | number>): string => {
      let value: unknown = dictionaries[language];
      for (const part of key.split('.')) value = (value as Record<string, unknown>)?.[part];
      expect(typeof value, `${language}: ${key}`).toBe('string');
      return Object.entries(params ?? {}).reduce(
        (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
        value as string,
      );
    };
    for (const [gameType, patch] of cases) {
      const player = {
        id: 'p',
        socketId: 's',
        name: 'Name',
        score: 1,
        roomId: 'room',
        role: 'Know',
      } as RoomState['players'][number];
      const room: RoomState = Object.assign(
        {
          id: 'room',
          code: 'ABC123',
          status: RoomStatus.RESULT,
          roomHostId: 's',
          createdAt: new Date(),
          gameType: gameType as GameType,
          players: [player],
          config: { hostSelection: 'FIXED' as const, timerMin: 5 },
        },
        patch,
      );
      expect(getRevealCard(room, player, t).label).toBeTruthy();
      expect(getRevealEvidence(room, t, 'Secret')).toBeTruthy();
      const outcome = getRevealOutcome(room, t);
      expect(outcome.title).toBeTruthy();
      expect(outcome.reason).toBeTruthy();
      if (room.gameType === GameType.POKER && room.status === RoomStatus.RESULT) {
        expect(outcome.winnerIds).toEqual(['s']);
        expect(outcome.reason).toBe(t('resultReveal.pokerMatchReason'));
      }
    }
  }
});
