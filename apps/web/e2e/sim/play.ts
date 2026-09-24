import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from '../helpers';
import type { MatrixEntry } from './matrix';

const STEP = 700; // settle wait after a successful UI action

export interface SimSession {
  host: Page;
  players: Page[];
  contexts: BrowserContext[];
  origin: string;
  cleanup: () => Promise<void>;
}

/** Create a room for the entry, join N-1 guests, then apply lobby config. */
export async function setupSession(
  browser: Browser,
  entry: MatrixEntry,
  playIndex: number,
): Promise<SimSession> {
  void playIndex;
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < entry.players; i++) {
    const ctx = await browser.newContext();
    contexts.push(ctx);
    pages.push(await ctx.newPage());
  }
  const host = pages[0];
  const roomCode = await createRoom(host, 'Alice', entry.lobbyButton);
  const origin = await getOrigin(host);
  for (let i = 1; i < entry.players; i++) {
    await joinRoom(pages[i], origin, roomCode, ['Bob', 'Carol', 'Dave'][i - 1]);
  }
  // Bob appears in the players list (multiple elements possible: grid + scores)
  if (entry.players > 1) {
    await expect(host.getByText('Bob').first()).toBeVisible({ timeout: 10000 });
  }

  if (entry.configure?.length) {
    await applyLobbyConfig(host, entry.configure);
  }
  return {
    host,
    players: pages,
    contexts,
    origin,
    cleanup: async () => {
      for (const ctx of contexts) await ctx.close().catch(() => {});
    },
  };
}

async function selectNeobrutalism(page: Page, triggerLabel: RegExp, optionLabel: RegExp) {
  await page.locator('button').filter({ hasText: triggerLabel }).first().click();
  await page.locator('button').filter({ hasText: optionLabel }).last().click();
}

/** Apply lobby configuration strings like 'rps-bestof:1' or 'the-mind-blind'. */
export async function applyLobbyConfig(page: Page, steps: string[]) {
  for (const step of steps) {
    const [key, value] = step.split(':');
    switch (key) {
      case 'rps-mode': {
        const map: Record<string, RegExp> = {
          ALL_AT_ONCE: /All At Once/i,
          '1V1_ROUND_ROBIN': /1v1 Round Robin/i,
        };
        await selectNeobrutalism(page, /All At Once|1v1 Round Robin/i, map[value]);
        break;
      }
      case 'rps-bestof': {
        const map: Record<string, RegExp> = {
          '1': /BO1/i,
          '3': /BO3/i,
          '5': /BO5/i,
        };
        await selectNeobrutalism(page, /BO1|BO3|BO5|First to/i, map[value]);
        break;
      }
      case 'whoami-rounds': {
        const minus = page.locator('button', { hasText: '-' }).first();
        for (let i = 0; i < 3; i++) {
          await minus.click().catch(() => {});
          await page.waitForTimeout(200);
        }
        break;
      }
      case 'whoami-wordmode': {
        const map: Record<string, RegExp> = {
          PLAYER_INPUT: /Players Write/i,
          HOST_INPUT: /Host Picks/i,
          RANDOM: /Random \(DB\)/i,
          AI_GENERATED: /AI Generate/i,
        };
        await selectNeobrutalism(
          page,
          /Host Picks|Random \(DB\)|Players Write|AI Generate/i,
          map[value],
        );
        break;
      }
      case 'whoami-category': {
        await selectNeobrutalism(page, /Select a category|Animals|Food/i, new RegExp(value, 'i'));
        break;
      }
      case 'who-first-penalty': {
        const sw = page.locator('#penalty-switch');
        if (await sw.isVisible().catch(() => false)) {
          if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
        }
        break;
      }
      case 'music-trivia-source': {
        const map: Record<string, RegExp> = {
          ITUNES: /Apple Music/i,
          SOUNDCLOUD: /SoundCloud/i,
          YOUTUBE: /YouTube/i,
        };
        await selectNeobrutalism(page, /Apple Music|SoundCloud|YouTube/i, map[value]);
        break;
      }
      case 'music-trivia-mode': {
        await selectNeobrutalism(
          page,
          /Typing \(Auto Judge\)|Voice \(Host Judge\)/i,
          /Voice \(Host Judge\)/i,
        );
        break;
      }
      case 'music-trivia-rounds': {
        await selectNeobrutalism(page, /Rounds/i, new RegExp(`${value} Rounds`, 'i'));
        break;
      }
      case 'music-trivia-query': {
        const input = page.locator('#musicSearchTermInput');
        await input.fill(value);
        break;
      }
      case 'the-mind-blind': {
        // The checkbox is sr-only (hidden): click its visible label toggle
        const blindLabel = page.locator('label:has(input[type="checkbox"])').first();
        await blindLabel.click({ timeout: 3000 }).catch(() => {});
        break;
      }
      case 'the-mind-extreme': {
        await selectNeobrutalism(page, /Normal \(Classic\)|Extreme \(2 Piles\)/i, /Extreme/i);
        break;
      }
      case 'ttt-opponent-bot': {
        await page.locator('[data-testid="ttt-opponent-bot"]').click();
        break;
      }
      case 'ttt-diff-easy': {
        await page.locator('[data-testid="ttt-diff-easy"]').click();
        break;
      }
      case 'ttt-diff-god': {
        await page.locator('[data-testid="ttt-diff-god"]').click();
        break;
      }
      case 'the-mind-maxlevel': {
        await selectNeobrutalism(page, /^Auto$/, new RegExp(`^\\s*${value}\\s*$`));
        break;
      }
      case 'saboteur-stone-on': {
        // The stone toggle renders label text + On/Off buttons; click "On" in
        // the group that follows the stone label.
        const stoneLabel = page.getByText(/Stone ends the round instantly/i).first();
        const group = stoneLabel.locator('xpath=..');
        await group
          .getByRole('button', { name: 'On', exact: true })
          .click()
          .catch(() => {});
        break;
      }
      default:
        throw new Error(`Unknown lobby config step: ${key}`);
    }
    await page.waitForTimeout(300);
    // Close any stray NeobrutalismSelect dropdown so it can't swallow clicks
    await page.keyboard.press('Escape').catch(() => {});
    await page
      .locator('h1, h2, h3')
      .first()
      .click({ timeout: 1000 })
      .catch(() => {});
    await page.waitForTimeout(150);
  }
}

/** Click the lobby Start Game button on the host page (retries if it stays). */
async function startGame(host: Page) {
  const startBtn = host
    .locator('button')
    .filter({ hasText: /^Start Game|เริ่มเกม/ })
    .first();
  await expect(startBtn).toBeVisible({ timeout: 10000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    await startBtn.click().catch(() => {});
    await host.waitForTimeout(900);
    if (!(await startBtn.isVisible().catch(() => false))) return;
  }
}

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

async function anyVisible(pages: Page[], locate: (p: Page) => Locator): Promise<Page | null> {
  for (const p of pages) {
    if (
      await locate(p)
        .isVisible({ timeout: 300 })
        .catch(() => false)
    )
      return p;
  }
  return null;
}

/** Click with a bounded actionability timeout so disabled buttons never hang. */
async function clickIfVisible(loc: Locator, timeout = 1500): Promise<boolean> {
  if (await loc.isVisible({ timeout }).catch(() => false)) {
    await loc
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Game drivers                                                        */
/* ------------------------------------------------------------------ */

/** Classic / Gobbler / Ultimate TTT (PVP). */
async function playTicTacToeFamily(s: SimSession, entry: MatrixEntry): Promise<void> {
  const { host, players } = s;
  if (entry.id === 'ttt-ultimate-2p') {
    await host.locator('[data-testid="uttt-join-x"]').click();
    await players[1].locator('[data-testid="uttt-join-o"]').click();
  } else if (entry.id === 'ttt-gobbler-2p') {
    await host.locator('button:has-text("Join X")').click();
    await players[1].locator('button:has-text("Join O")').click();
  } else {
    await host.locator('[data-testid="ttt-join-x"]').click();
    await players[1].locator('[data-testid="ttt-join-o"]').click();
  }

  if (entry.id === 'ttt-classic-2p') {
    const cells = (p: Page) => p.locator('div.grid.grid-cols-3 button');
    const moves: Array<[Page, number]> = [
      [host, 0],
      [players[1], 4],
      [host, 1],
      [players[1], 5],
      [host, 2],
    ];
    for (const [p, idx] of moves) {
      await expect(cells(p).nth(idx)).toBeEnabled({ timeout: 5000 });
      await cells(p).nth(idx).click();
      await p.waitForTimeout(STEP);
    }
    await expect(host.getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
    await expect(players[1].getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
  } else if (entry.id === 'ttt-gobbler-2p') {
    const board = (p: Page) => p.locator('[data-testid^="gobbler-cell-"]');
    const inv = (p: Page, side: 'X' | 'O') =>
      p.locator(`[data-testid^="gobbler-inventory-${side}-"]`);
    const moves: Array<[Page, 'X' | 'O', number, number]> = [
      [host, 'X', 0, 2],
      [players[1], 'O', 6, 2],
      [host, 'X', 1, 2],
      [players[1], 'O', 7, 2],
      [host, 'X', 2, 1],
    ];
    for (const [p, side, cell, stack] of moves) {
      await expect(inv(p, side).nth(stack)).toBeVisible({ timeout: 5000 });
      await inv(p, side).nth(stack).click();
      await expect(board(p).nth(cell)).toBeVisible({ timeout: 5000 });
      await board(p).nth(cell).click();
      await p.waitForTimeout(STEP);
    }
    await expect(host.getByTestId('winner-banner')).toBeVisible({ timeout: 10000 });
    await expect(players[1].getByTestId('winner-banner')).toBeVisible({ timeout: 10000 });
  } else {
    // Ultimate: a verified 17-move script where X wins macro boards 0,1,2
    // (row 3-4-5 in each) while O's routed moves keep sending X back on plan.
    // Simulated against the service routing rules before being recorded here.
    const cell = (p: Page, m: number, u: number) =>
      p.locator(`[data-testid="uttt-cell-${m}-${u}"]`);
    const script: Array<[number, number]> = [
      [0, 3],
      [3, 0],
      [0, 4],
      [4, 0],
      [0, 5],
      [5, 1],
      [1, 3],
      [3, 1],
      [1, 4],
      [4, 1],
      [1, 5],
      [5, 2],
      [2, 3],
      [3, 2],
      [2, 4],
      [4, 2],
      [2, 5],
    ];
    for (let i = 0; i < script.length; i++) {
      const [m, u] = script[i];
      const p = i % 2 === 0 ? host : players[1];
      await expect(cell(p, m, u)).toBeEnabled({ timeout: 8000 });
      await cell(p, m, u).click();
      await p.waitForTimeout(STEP);
    }
    await expect(host.getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
    await expect(players[1].getByText(/wins/i).first()).toBeVisible({ timeout: 10000 });
  }
}

/** TTT vs bot: only the host page exists. */
async function playTicTacToeBot(s: SimSession): Promise<void> {
  const host = s.host;
  await host.locator('[data-testid="ttt-join-x"]').click();
  const cells = host.locator('div.grid.grid-cols-3 button');
  const resultPanel = host.locator(
    'button:has-text("Play Again"), button:has-text("เล่นอีกครั้ง")',
  );
  for (let i = 0; i < 25; i++) {
    if (await resultPanel.isVisible().catch(() => false)) break;
    const texts = await cells.allInnerTexts();
    const empty = texts
      .map((t, idx) => (t.trim() === '' ? idx : null))
      .filter((v): v is number => v !== null);
    if (empty.length === 0) break;
    const oBefore = texts.filter((t) => t.trim() === 'O').length;
    let clicksForCell = 0;
    await cells
      .nth(empty[0])
      .click()
      .catch(() => {});
    clicksForCell++;
    // wait until the bot's O lands (or the game ends) before the next move;
    // under parallel-suite load the bot response can lag, so be generous and
    // re-click the same cell if our move never registered
    for (let w = 0; w < 24; w++) {
      await host.waitForTimeout(250);
      if (await resultPanel.isVisible().catch(() => false)) break;
      const now = await cells.allInnerTexts();
      const xNow = now.filter((t) => t.trim() === 'X').length;
      const oNow = now.filter((t) => t.trim() === 'O').length;
      if (oNow > oBefore) break;
      if (xNow === texts.filter((t) => t.trim() === 'X').length && clicksForCell < 3) {
        // our X never registered; retry the same cell
        await cells
          .nth(empty[0])
          .click({ force: true, timeout: 2000 })
          .catch(() => {});
        clicksForCell++;
      }
    }
  }
  await expect(resultPanel).toBeVisible({ timeout: 20000 });
}

/** RPS: both players throw every round until a match winner is set. */
async function playRps(s: SimSession): Promise<void> {
  const { host, players } = s;
  const [p1, p2] = players;
  await startGame(host);
  const target = 2; // BO3 target (also covers BO1 which ends at 1)
  for (let round = 0; round < target + 1; round++) {
    const rock = (p: Page) => p.locator('button', { hasText: '✊' }).first();
    const paper = (p: Page) => p.locator('button', { hasText: '✋' }).first();
    await expect(rock(p1)).toBeVisible({ timeout: 15000 });
    await expect(rock(p2)).toBeVisible({ timeout: 15000 });
    await rock(p1)
      .click()
      .catch(() => {});
    await paper(p2)
      .click()
      .catch(() => {});
    // Round result → Next Round (host only) or match end (Play Again)
    await expect(
      p1
        .locator('button', { hasText: /Next Round|Play Again/i })
        .or(p1.getByText(/Wins the Match/i))
        .first(),
    ).toBeVisible({ timeout: 15000 });
    if (
      await p1
        .getByText(/Wins the Match/i)
        .isVisible()
        .catch(() => false)
    )
      return;
    await p1
      .locator('button', { hasText: /Next Round/i })
      .first()
      .click();
    await p1.waitForTimeout(STEP);
  }
  await expect(p1.getByText(/Wins the Match/i)).toBeVisible({ timeout: 15000 });
}

/** Who Know: 4 players, word popup, questioning, vote, results. */
async function playWhoKnow(s: SimSession): Promise<void> {
  const { host, players } = s;
  await startGame(host);
  // Find whichever page shows the secret word popup
  let hostPage: Page = host;
  for (const p of players) {
    const visible = await p
      .locator('#secretWordModalInput')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (visible) {
      hostPage = p;
      break;
    }
  }
  const wordInput = hostPage.locator('#secretWordModalInput');
  await expect(wordInput).toBeVisible({ timeout: 5000 });
  await wordInput.fill('E2E Sim Secret Word');
  await wordInput.press('Enter');
  await hostPage.waitForTimeout(1000);

  // End questioning
  const endBtn = hostPage
    .locator('button')
    .filter({ hasText: /Word Guessed \(Vote\)|Time's Up \(Fail\)/i })
    .first();
  await expect(endBtn).toBeVisible({ timeout: 20000 });
  await endBtn.click();

  // Everyone except the in-game host votes (button per candidate player)
  await host.waitForTimeout(1500);
  for (const p of players) {
    const voteBtn = p
      .locator('button')
      .filter({ hasText: /^Alice$|^Bob$|^Carol$|^Dave$/ })
      .first();
    await clickIfVisible(voteBtn, 2500);
  }
  // Results render after voting (winners or voting results panel)
  await expect(host.getByText(/Voting Results|Wins|No winner|Time/i).first()).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Sounds Fishy: answers, reveal all, eliminate, bank, Round Over.
 * The picker/roles are random and phases flip on every action, so one unified
 * act-loop scans every page each iteration and performs whatever control is
 * available (proven pattern from the debug run).
 */
async function playSoundsFishy(s: SimSession): Promise<void> {
  const { host, players } = s;
  await startGame(host);

  for (let i = 0; i < 40; i++) {
    if (
      await host
        .getByText(/Round Over/i)
        .first()
        .isVisible()
        .catch(() => false)
    )
      break;
    for (const p of players) {
      // 1. Submit an answer when the input is up
      const input = p.locator('input#answerInput');
      if (await input.isVisible().catch(() => false)) {
        let text = 'This is the truth';
        if (
          await p
            .getByText(/You MUST enter the true answer exactly/i)
            .isVisible()
            .catch(() => false)
        ) {
          text =
            (await p
              .locator('span:has-text("The True Answer") + p')
              .textContent()
              .catch(() => null)) ?? '';
          text = text.trim();
        }
        if (text) {
          await input.fill(text).catch(() => {});
          await p
            .locator('button')
            .filter({ hasText: /Submit Answer/i })
            .first()
            .click({ timeout: 2000 })
            .catch(() => {});
        }
      }
      // 2. Reveal an answer when the picker control is up
      const reveal = p
        .locator('button')
        .filter({ hasText: /Reveal Answer/i })
        .first();
      if (await reveal.isVisible().catch(() => false)) {
        await reveal.click({ timeout: 2000 }).catch(() => {});
      }
      // 3. Eliminate during the hunt
      const elim = p
        .locator('button')
        .filter({ hasText: /Eliminate \(Looks Fishy\)/i })
        .first();
      if (await elim.isVisible().catch(() => false)) {
        await elim.click({ timeout: 2000 }).catch(() => {});
      }
      // 4. Bank points to end the round
      const bank = p
        .locator('button')
        .filter({ hasText: /Bank Points & End Round/i })
        .first();
      if (await bank.isVisible().catch(() => false)) {
        await bank.click({ timeout: 2000 }).catch(() => {});
      }
    }
    await host.waitForTimeout(1200);
  }
  await expect(host.getByText(/Round Over/i).first()).toBeVisible({ timeout: 20000 });
}

/**
 * Detective Club: word, 9 card plays (1 each R1 + 2 each R2), discussion, vote,
 * scoring. The informer is random and turns rotate, so one unified act-loop
 * scans every page each iteration and performs whatever control is available.
 */
async function playDetectiveClub(s: SimSession): Promise<void> {
  const { host, players } = s;
  await startGame(host);

  let sawScoring = false;
  for (let i = 0; i < 60; i++) {
    // SCORING reached: the host sees the round controls
    if (
      await host
        .locator('button')
        .filter({ hasText: /Play Next Round|End Game/i })
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      sawScoring = true;
      break;
    }
    for (const p of players) {
      // 1. Informer submits the word
      const wordInput = p.locator('input#wordInput');
      if (await wordInput.isVisible().catch(() => false)) {
        await wordInput.fill('Mystery').catch(() => {});
        await p
          .locator('button')
          .filter({ hasText: /Confirm|Submit/i })
          .first()
          .click({ timeout: 2000 })
          .catch(() => {});
        continue;
      }
      // 2. Active player plays a card: a plain click opens the confirm modal
      // (same interaction the legacy detectiveclub spec proved works).
      // Only on this page's turn — the hand stays visible during discussion,
      // and falling through is what lets the host reach Start Voting.
      const myTurnNow = await p
        .getByText(/Your Turn - Play a Card/i)
        .isVisible({ timeout: 200 })
        .catch(() => false);
      const hand = p.locator('img[alt="Hand Card"]').first();
      if (myTurnNow && (await hand.isVisible({ timeout: 200 }).catch(() => false))) {
        // force click: the hover overlay covers the img, so actionability checks
        // never pass; force still fires the overlay's onClick and opens the modal
        // (proven by the debug variant test)
        await hand.click({ force: true, timeout: 3000 }).catch(() => {});
        const confirmBtn = p
          .locator('button')
          .filter({ hasText: /^Play Card$/i })
          .last();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await confirmBtn.click({ timeout: 2000 }).catch(() => {});
        }
        continue;
      }
      // 3. Discussion: host starts the vote
      const startVoting = p
        .locator('button')
        .filter({ hasText: /Start Voting/i })
        .first();
      if (await startVoting.isVisible().catch(() => false)) {
        await startVoting.click({ timeout: 2000 }).catch(() => {});
        continue;
      }
      // 4. Voting: pick a candidate then confirm
      const candidate = p
        .locator('button')
        .filter({ hasText: /Alice|Bob|Carol/ })
        .first();
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 2000 }).catch(() => {});
      }
      const confirmVote = p
        .locator('button')
        .filter({ hasText: /Confirm Vote/i })
        .first();
      if (await confirmVote.isVisible().catch(() => false)) {
        await confirmVote.click({ timeout: 2000 }).catch(() => {});
      }
    }
    await host.waitForTimeout(1200);
  }
  if (!sawScoring) {
    throw new Error('Detective Club did not reach the scoring phase in the step budget');
  }
  await expect(
    host
      .locator('button')
      .filter({ hasText: /Play Next Round|End Game/i })
      .first(),
  ).toBeVisible({ timeout: 10000 });
}

/** Who Am I (2 players): driven to a YES vote on a guess, which ends the match. */
async function playWhoAmI(s: SimSession, entry?: MatrixEntry): Promise<void> {
  const { host, players } = s;
  const [p1, p2] = players;
  const isHostInput = entry?.configure?.some((c) => c.startsWith('whoami-wordmode:HOST_INPUT'));
  if (isHostInput && players.length > 2) {
    // HOST_INPUT: the host is a moderator; guests 1..N-1 receive words.
    const lobbyStart = host
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .first();
    await expect(lobbyStart).toBeVisible({ timeout: 10000 });
    await lobbyStart.click();
    const modalInputs = host.locator('input[id^="hostWordInput-"]');
    await expect(modalInputs.first()).toBeVisible({ timeout: 10000 });
    await host.waitForTimeout(500);
    const words = ['Pirate', 'Astronaut', 'Robot', 'Chef'];
    const n = await modalInputs.count();
    for (let i = 0; i < n; i++) {
      await modalInputs
        .nth(i)
        .fill(words[i % 4])
        .catch(() => {});
    }
    const modalStart = host
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .last();
    await expect(modalStart).toBeEnabled({ timeout: 10000 });
    await modalStart.click();
    // host moderates; guests guess in turn. Drive the guest who has the Guess
    // button: guess their own word (revealed on their page) — first guest wins
    // on YES majority (2 voters: guest2 + host? host is spectator/moderator).
    const guessers = players.slice(1);
    const guessBtn = (p: Page) => p.getByRole('button', { name: /Guess the Word!/i });
    let active: Page | null = null;
    for (let i = 0; i < 15 && !active; i++) {
      active = await anyVisible(guessers, guessBtn);
      if (!active) await host.waitForTimeout(1000);
    }
    if (!active) throw new Error('No Guess button appeared in ASKING phase (host-input)');
    await active.getByRole('button', { name: /Guess the Word!/i }).click();
    await active.locator('#guessWordInput').fill('Pirate');
    await active
      .locator('button')
      .filter({ hasText: /Submit Guess/i })
      .first()
      .click();
    await expect(active.getByText(/Word Guess/i).first()).toBeVisible({ timeout: 10000 });
    // every other guest votes YES; host/moderator confirms with Continue
    for (const p of guessers) {
      if (p === active) continue;
      const yes = p.locator('button').filter({ hasText: /YES/i }).first();
      await clickIfVisible(yes, 5000);
    }
    const cont = host
      .locator('button')
      .filter({ hasText: /Continue/i })
      .first();
    await expect(cont).toBeVisible({ timeout: 10000 });
    await cont.click();
    await expect(host.getByText(/Game Over/i).first()).toBeVisible({ timeout: 15000 });
    return;
  }
  if (isHostInput) {
    // HOST_INPUT: the lobby Start opens the "📝 Set Words" modal; clicking Start
    // again while the modal is open would block on its overlay, so handle the
    // whole start+modal sequence here without startGame()'s retry loop.
    const lobbyStart = host
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .first();
    await expect(lobbyStart).toBeVisible({ timeout: 10000 });
    await lobbyStart.click();
    const modalInputs = host.locator('input[id^="hostWordInput-"]');
    await expect(modalInputs.first()).toBeVisible({ timeout: 10000 });
    await host.waitForTimeout(500);
    const words = ['Pirate', 'Astronaut', 'Robot', 'Chef'];
    const n = await modalInputs.count();
    for (let i = 0; i < n; i++) {
      const val = words[i % 4];
      await modalInputs
        .nth(i)
        .fill(val)
        .catch(() => {});
    }
    // the modal's Start Game renders AFTER the lobby one in the DOM
    const modalStart = host
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .last();
    await expect(modalStart).toBeEnabled({ timeout: 10000 });
    await modalStart.click();
  } else {
    await startGame(host);
  }
  // Word collection in-game: player input (PLAYER_INPUT), the host's per-player
  // word inputs (HOST_INPUT second stage), or nothing (RANDOM auto)
  const inGameHostInputs = host.locator('input[placeholder="Type your word..."]');
  if (
    await inGameHostInputs
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    const n = await inGameHostInputs.count();
    for (let i = 0; i < n; i++) {
      await inGameHostInputs
        .nth(i)
        .fill(['Pirate', 'Astronaut', 'Robot', 'Chef'][i % 4])
        .catch(() => {});
    }
    await host
      .locator('button')
      .filter({ hasText: /Submit Word|Set Words/i })
      .first()
      .click()
      .catch(() => {});
  }
  const wordInputs = p1.locator('#playerWordInput');
  const assignedWord = new Map<Page, string>();
  if (
    await wordInputs
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false)
  ) {
    // Submit sequentially: wait until each input is gone so a broadcast
    // re-render can't swallow the second player's submission
    for (const [p, word] of [
      [p1, 'Elephant'],
      [p2, 'Tiger'],
    ] as Array<[Page, string]>) {
      const input = p.locator('#playerWordInput');
      for (let attempt = 0; attempt < 6; attempt++) {
        if (!(await input.isVisible({ timeout: 800 }).catch(() => false))) break;
        await input.fill(word).catch(() => {});
        await p
          .locator('button')
          .filter({ hasText: /Submit Word/i })
          .first()
          .click({ timeout: 2000 })
          .catch(() => {});
        await p.waitForTimeout(600);
      }
      assignedWord.set(p, word);
    }
  }
  // ASKING: exactly one player holds the Guess button. If submissions were
  // swallowed by a re-render race, retry the sequential submission once.
  const guessBtn = (p: Page) => p.getByRole('button', { name: /Guess the Word!/i });
  let active: Page | null = null;
  for (let i = 0; i < 20 && !active; i++) {
    active = await anyVisible([p1, p2], guessBtn);
    if (!active) {
      if (i === 8) {
        for (const [p, word] of [
          [p1, 'Elephant'],
          [p2, 'Tiger'],
        ] as Array<[Page, string]>) {
          const input = p.locator('#playerWordInput');
          if (await input.isVisible({ timeout: 400 }).catch(() => false)) {
            await input.fill(word).catch(() => {});
            await p
              .locator('button')
              .filter({ hasText: /Submit Word/i })
              .first()
              .click({ timeout: 2000 })
              .catch(() => {});
          }
        }
      }
      await host.waitForTimeout(1000);
    }
  }
  if (!active) throw new Error('No Guess button appeared in ASKING phase');
  await active.getByRole('button', { name: /Guess the Word!/i }).click();
  // The guesser guesses their OWN secret word; use the word this session
  // submitted for that page (fallback 'Elephant' for RANDOM mode's first word).
  const myWord = assignedWord.get(active) ?? 'Elephant';
  await active.locator('#guessWordInput').fill(myWord);
  await active
    .locator('button')
    .filter({ hasText: /Submit Guess/i })
    .first()
    .click();
  await expect(active.getByText(/Word Guess/i).first()).toBeVisible({ timeout: 10000 });
  // The other player votes YES (correct guess), then the host confirms with
  // Continue (NEXT_TURN) — that finishes the match
  const other = active === p1 ? p2 : p1;
  const yes = other.locator('button').filter({ hasText: /YES/i }).first();
  await expect(yes).toBeVisible({ timeout: 10000 });
  await yes.click();
  const cont = host
    .locator('button')
    .filter({ hasText: /Continue/i })
    .first();
  await expect(cont).toBeVisible({ timeout: 10000 });
  await cont.click();
  await expect(host.getByText(/Game Over/i).first()).toBeVisible({ timeout: 15000 });
  await expect(other.getByText(/Game Over/i).first()).toBeVisible({ timeout: 15000 });
}

/** Who First: countdown duel then End Game. */
async function playWhoFirst(s: SimSession): Promise<void> {
  const { host, players } = s;
  // The host only participates when "Host plays too" is on (off by default)
  const hostPlays = host.locator('#host-plays-switch');
  if (await hostPlays.isVisible().catch(() => false)) {
    if ((await hostPlays.getAttribute('aria-checked')) !== 'true') await hostPlays.click();
    await host.waitForTimeout(300);
  }
  // Who First's lobby button is "Start Countdown!" (data-testid start-btn)
  const startBtn = host.getByTestId('start-btn');
  await expect(startBtn).toBeVisible({ timeout: 10000 });
  await startBtn.click();
  await expect(host.getByTestId('status-ready')).toBeVisible({ timeout: 8000 });
  await expect(host.getByTestId('status-go')).toBeVisible({ timeout: 10000 });
  await host.getByTestId('press-btn').click();
  await players[1].getByTestId('press-btn').click();
  await expect(host.getByTestId('round-result-title')).toBeVisible({ timeout: 8000 });
  await expect(players[1].getByTestId('round-result-title')).toBeVisible({ timeout: 8000 });
  // End the game (host control)
  const endGame = host
    .locator('button')
    .filter({ hasText: /End Game/i })
    .first();
  await expect(endGame).toBeVisible({ timeout: 8000 });
  await endGame.click();
  await expect(host.getByTestId('who-first-results')).toBeVisible({ timeout: 8000 });
}

/** Music Trivia (TYPING or GAME_MASTER) to Game Over. */
async function playMusicTrivia(s: SimSession): Promise<void> {
  const { host, players } = s;
  const [p1, p2] = players;
  await startGame(host);
  // SETUP → "I'm Ready!" on both pages
  await p1.getByText("I'm Ready!").waitFor({ state: 'visible', timeout: 60000 });
  await p2.getByText("I'm Ready!").waitFor({ state: 'visible', timeout: 60000 });
  await p1.getByText("I'm Ready!").click();
  await p2.getByText("I'm Ready!").click();
  const isGameMaster = await host
    .getByText(/Voice \(Host Judge\)|GAME MASTER/i)
    .isVisible()
    .catch(() => false);
  const startSong = host.getByText('Start Song (Countdown)');
  await expect(startSong).toBeVisible({ timeout: 20000 });
  await startSong.click();
  // Rounds may auto-advance; loop until Game Over shows up
  for (let i = 0; i < 10; i++) {
    if (
      await host
        .getByText(/Game Over/i)
        .first()
        .isVisible()
        .catch(() => false)
    )
      break;
    if (isGameMaster) {
      // GM mode: a non-host buzzes, the host judges Yes
      const buzz = p2.locator('button:has-text("BUZZ!")').last();
      await buzz.waitFor({ state: 'attached', timeout: 45000 });
      await buzz.scrollIntoViewIfNeeded();
      await buzz.click({ force: true, timeout: 10000 });
      const input = p2.getByPlaceholder('Type answer here...');
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.fill('Bob guess');
      await p2.keyboard.press('Enter');
      await clickIfVisible(
        host
          .locator('button')
          .filter({ hasText: /Yes \(Correct\)/i })
          .first(),
        10000,
      );
    } else {
      const buzz = p1.locator('button:has-text("BUZZ!")').first();
      await buzz.waitFor({ state: 'attached', timeout: 45000 });
      await buzz.scrollIntoViewIfNeeded();
      await buzz.click({ force: true, timeout: 10000 });
      const input = p1.getByPlaceholder('Type answer here...');
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.fill('Alice guess');
      await p1.keyboard.press('Enter');
    }
    await clickIfVisible(
      host
        .locator('button')
        .filter({ hasText: /Next Round/i })
        .first(),
      8000,
    );
    await host.waitForTimeout(800);
  }
  await expect(host.getByText(/Game Over/i).first()).toBeVisible({ timeout: 45000 });
  await expect(p2.getByText(/Game Over/i).first()).toBeVisible({ timeout: 45000 });
}

/**
 * The Mind: play cards in ascending order to the max level.
 * NORMAL/BLIND: clicking a playable card plays it immediately.
 * EXTREME: select a card, then use the White pile (UP) button.
 */
async function playTheMind(s: SimSession): Promise<void> {
  const { host, players } = s;
  const isExtreme = await host
    .getByText(/Extreme \(2 Piles\)/i)
    .isVisible()
    .catch(() => false);
  await startGame(host);
  for (let i = 0; i < 150; i++) {
    if (
      await host
        .getByText(/You Win|Game Over/i)
        .first()
        .isVisible()
        .catch(() => false)
    )
      break;
    // Per-level Ready gate: everyone must confirm before cards are dealt
    for (const p of players) {
      await clickIfVisible(p.locator('button').filter({ hasText: /Ready/i }).first(), 300);
    }
    await clickIfVisible(
      host
        .locator('button')
        .filter({ hasText: /Next Level|Resume Level|Continue/i })
        .first(),
      400,
    );
    // Play the globally-lowest visible card (The Mind requires strict ascending
    // order across ALL players). Blind mode shows '?' — accept mistakes there;
    // lost lives still end the game (a valid completion).
    type CardInfo = { page: Page; idx: number; val: number };
    const all: CardInfo[] = [];
    for (const p of players) {
      const handBtns = p.locator('button').filter({ hasText: /^[0-9]+$/ });
      const n = await handBtns.count();
      for (let b = 0; b < n; b++) {
        const t = (
          await handBtns
            .nth(b)
            .innerText()
            .catch(() => '')
        ).trim();
        const v = parseInt(t, 10);
        if (!Number.isNaN(v)) all.push({ page: p, idx: b, val: v });
      }
    }
    if (all.length === 0) {
      // blind mode: click first hand card on each page in turn
      for (const p of players) {
        const first = p
          .locator('button')
          .filter({ hasText: /^[?0-9]+$/ })
          .first();
        if (await first.isVisible({ timeout: 200 }).catch(() => false)) {
          await first.click({ timeout: 1200 }).catch(() => {});
          if (isExtreme) {
            await clickIfVisible(
              p
                .locator('button')
                .filter({ hasText: /White Pile/i })
                .first(),
              600,
            );
          }
          break;
        }
      }
    } else {
      all.sort((a, b) => a.val - b.val);
      const target = all[0];
      const btn = target.page
        .locator('button')
        .filter({ hasText: /^[0-9]+$/ })
        .nth(target.idx);
      await btn.click({ timeout: 1500 }).catch(() => {});
      if (isExtreme) {
        await clickIfVisible(
          target.page
            .locator('button')
            .filter({ hasText: /White Pile/i })
            .first(),
          800,
        );
      }
    }
    await host.waitForTimeout(500);
  }
  await expect(host.getByText(/You Win|Game Over/i).first()).toBeVisible({ timeout: 10000 });
}

/**
 * Saboteur: everyone discards on their turn until the round resolves
 * (goal reached / deck dry + hands empty) → ROUND_END overlay → Back to lobby.
 */
async function playSaboteur(s: SimSession): Promise<void> {
  const { host, players } = s;
  await startGame(host);
  await expect(host.getByTestId('saboteur-my-role')).toBeVisible({ timeout: 15000 });
  const roundOver = () =>
    anyVisible(players, (p) => p.getByText(/Miners win|Saboteurs win|Back to lobby/i).first());
  for (let i = 0; i < 130; i++) {
    if (await roundOver()) break;
    let acted = false;
    for (const p of players) {
      if (acted) break;
      // The active player's page shows the select-card hint; hand cards are
      // enabled only on that player's turn
      const onTurn =
        (await p
          .getByText(/Pick a card from your hand/i)
          .first()
          .isVisible({ timeout: 250 })
          .catch(() => false)) ||
        (await p
          .getByText(/Your Turn!/i)
          .first()
          .isVisible({ timeout: 150 })
          .catch(() => false));
      if (!onTurn) continue;
      const hand = p.locator('[data-testid^="saboteur-hand-"]');
      if ((await hand.count()) === 0) continue;
      await hand
        .first()
        .click({ timeout: 1500 })
        .catch(() => {});
      const discard = p
        .locator('button')
        .filter({ hasText: /Discard/i })
        .first();
      if (await discard.isVisible({ timeout: 800 }).catch(() => false)) {
        await discard.click({ timeout: 1500 }).catch(() => {});
        acted = true;
        await p.waitForTimeout(STEP);
      }
    }
    if (!acted) await host.waitForTimeout(600);
  }
  // A full match = 3 rounds. ROUND_END shows "Next Round" (host); after round 3
  // the GAME_OVER overlay shows "Back to lobby" which returns everyone to lobby.
  let startVisible = () =>
    host
      .locator('button')
      .filter({ hasText: /^Start Game|เริ่มเกม/ })
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
  const gameEnded = () =>
    anyVisible(players, (p) => p.getByText(/Saboteurs win|Miners win|🏆/i).first());
  for (let round = 1; round <= 3 && !(await startVisible()); round++) {
    // play cards until this round resolves (deck+hands dry or gold dug)
    for (let i = 0; i < 130; i++) {
      if (await roundOver()) break;
      let acted = false;
      for (const p of players) {
        if (acted) break;
        const onTurn =
          (await p
            .getByText(/Pick a card from your hand/i)
            .first()
            .isVisible({ timeout: 250 })
            .catch(() => false)) ||
          (await p
            .getByText(/Your Turn!/i)
            .first()
            .isVisible({ timeout: 150 })
            .catch(() => false));
        if (!onTurn) continue;
        const hand = p.locator('[data-testid^="saboteur-hand-"]');
        if ((await hand.count()) === 0) continue;
        await hand
          .first()
          .click({ timeout: 1500 })
          .catch(() => {});
        const discard = p
          .locator('button')
          .filter({ hasText: /Discard/i })
          .first();
        if (await discard.isVisible({ timeout: 800 }).catch(() => false)) {
          await discard.click({ timeout: 1500 }).catch(() => {});
          acted = true;
          await p.waitForTimeout(STEP);
        }
      }
      if (!acted) await host.waitForTimeout(600);
    }
    if (round === 3) break; // GAME_OVER overlay reached
    // host advances to the next round
    const next = host
      .locator('button')
      .filter({ hasText: /Next Round/i })
      .first();
    for (let i = 0; i < 6; i++) {
      if (!(await next.isVisible({ timeout: 1000 }).catch(() => false))) break;
      await next.click({ timeout: 2000, force: true }).catch(() => {});
      await host.waitForTimeout(1200);
      if (!(await next.isVisible({ timeout: 500 }).catch(() => false))) break;
    }
  }
  // Final state: back in lobby OR the win overlay (both prove the match completed)
  const completed = (await startVisible()) || (await gameEnded());
  for (let i = 0; i < 6 && !completed; i++) {
    const btn = host
      .locator('button')
      .filter({ hasText: /Next Round|Back to lobby/i })
      .first();
    if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await btn.click({ timeout: 2000, force: true }).catch(() => {});
      await host.waitForTimeout(1000);
    }
    if ((await startVisible()) || (await gameEnded())) break;
  }
  expect(
    (await startVisible()) || (await gameEnded()),
    'Saboteur must end in lobby or with a win overlay',
  ).toBeTruthy();
}

/** Coup: income until 7+, then coup the next player until one remains. */
async function playCoup(s: SimSession): Promise<void> {
  const { host, players } = s;
  await startGame(host);
  await expect(host.getByText(/Coup — PLAYING/i)).toBeVisible({ timeout: 15000 });
  const income = (p: Page) => p.getByRole('button', { name: /Income/i });
  for (let i = 0; i < 60; i++) {
    if (
      await host
        .getByText(/Winner:/i)
        .isVisible()
        .catch(() => false)
    )
      break;
    let turnPage: Page | null = null;
    for (const p of players) {
      if (
        await p
          .getByText(/Your Turn/i)
          .first()
          .isVisible({ timeout: 300 })
          .catch(() => false)
      ) {
        turnPage = p;
        break;
      }
    }
    if (!turnPage) {
      await host.waitForTimeout(500);
      continue;
    }
    // Income-only rush reaches 10 coins where Income disables (Must Coup) and
    // only Coup remains. The Coup button enables only after picking a target in
    // the LAST select; if the normal selectOption doesn't stick (React state),
    // set the value via JS and dispatch a change event.
    const coupBtn = turnPage.getByRole('button', { name: /Coup Pay 7 to Kill/i });
    const coupVisible = await coupBtn.isVisible({ timeout: 300 }).catch(() => false);
    const mustCoup = await turnPage
      .getByText(/Must Coup/i)
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false);
    const coupSelect = turnPage.locator('select').last();
    if (coupVisible && mustCoup) {
      await coupSelect.selectOption({ index: 1 }).catch(() => {});
      const applied = await coupSelect
        .inputValue()
        .then((v) => v !== '')
        .catch(() => false);
      if (!applied) {
        await coupSelect.evaluate((el) => {
          const sel = el as HTMLSelectElement;
          sel.value = sel.options[1]?.value ?? '';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
      await expect(coupBtn).toBeEnabled({ timeout: 5000 });
      await coupBtn.click();
    } else {
      const incEnabled = await income(turnPage)
        .isEnabled()
        .catch(() => false);
      if (incEnabled) {
        await income(turnPage)
          .click()
          .catch(() => {});
      }
    }
    await host.waitForTimeout(STEP);
  }
  await expect(host.getByText(/Winner:/i)).toBeVisible({ timeout: 20000 });
}

/** Thai Card Game: Pok Deng (one full round) or Slave (all cards played). */
async function playCardGame(s: SimSession, entry: MatrixEntry): Promise<void> {
  const { host, players } = s;
  const [p1, p2] = players;
  if (entry.id === 'card-slave') {
    await host.getByTestId('card-game-preset-slave').click();
    await expect(host.getByTestId('card-game-preset-slave')).toHaveClass(/bg-lime-300/);
  }
  await startGame(host);
  await expect(host.getByText(/Dealer: Alice|⛓️ Slave/)).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < 60; i++) {
    const result = await anyVisible([host, p2], (p) => p.getByTestId('card-game-result'));
    if (result) break;
    const actor = await anyVisible([host, p2], (p) => p.getByTestId('card-game-actions'));
    if (!actor) {
      await host.waitForTimeout(600);
      continue;
    }
    const panel = actor.getByTestId('card-game-actions');
    if (entry.id === 'card-slave') {
      // Pass is always legal for followers (button disabled while leading).
      // The leader must play: probe cards until Play enables, starting from 3♣.
      const passBtn = panel.getByRole('button', { name: 'Pass' });
      const playBtn = panel.getByRole('button', { name: 'Play' });
      const passEnabled = await passBtn.isEnabled().catch(() => false);
      if (passEnabled) {
        await passBtn.click().catch(() => {});
      } else {
        const threeClubs = actor.locator('[data-testid="card-3-CLUBS"]');
        if (await threeClubs.isVisible().catch(() => false)) {
          await threeClubs.click().catch(() => {});
        }
        if (!(await playBtn.isEnabled().catch(() => false))) {
          const cards = actor.locator('[data-testid^="card-"]');
          const n = await cards.count();
          for (let c = 0; c < n; c++) {
            await cards
              .nth(c)
              .click()
              .catch(() => {});
            if (await playBtn.isEnabled().catch(() => false)) break;
          }
        }
        await playBtn.click().catch(() => {});
      }
    } else {
      // Pok Deng: stand immediately
      if (!(await clickIfVisible(panel.getByRole('button', { name: 'Stand' }), 800))) {
        await clickIfVisible(panel.getByRole('button', { name: 'Draw' }), 800);
      }
    }
    await host.waitForTimeout(STEP);
  }
  await expect(host.getByTestId('card-game-result')).toBeVisible({ timeout: 20000 });
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export async function playToCompletion(s: SimSession, entry: MatrixEntry): Promise<void> {
  switch (entry.game) {
    case 'TIC_TAC_TOE':
      if (entry.players === 1) return playTicTacToeBot(s);
      return playTicTacToeFamily(s, entry);
    case 'RPS':
      return playRps(s);
    case 'WHO_KNOW':
      return playWhoKnow(s);
    case 'SOUNDS_FISHY':
      return playSoundsFishy(s);
    case 'DETECTIVE_CLUB':
      return playDetectiveClub(s);
    case 'WHO_AM_I':
      return playWhoAmI(s, entry);
    case 'WHO_FIRST':
      return playWhoFirst(s);
    case 'MUSIC_TRIVIA':
      return playMusicTrivia(s);
    case 'THE_MIND':
      return playTheMind(s);
    case 'SABOTEUR':
      return playSaboteur(s);
    case 'COUP':
      return playCoup(s);
    case 'CARD_GAME':
      return playCardGame(s, entry);
    default:
      throw new Error(`No driver for game ${entry.game}`);
  }
}
