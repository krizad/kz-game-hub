import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { createRoom, joinRoom, getOrigin } from './helpers';

/**
 * Who Am I e2e coverage against the current UI + server logic:
 * - Word Mode is a custom NeobrutalismSelect dropdown (not a native <select>)
 * - Start Game stays disabled for RANDOM mode until a category is chosen,
 *   so gameplay tests switch to PLAYER_INPUT ("✍️ Players Write")
 * - COLLECTING_WORDS uses #playerWordInput + "Submit Word"; the LAST submission
 *   transitions every client straight into the ASKING phase (no intermediate
 *   "Word submitted!" render for the final submitter)
 * - Turn flow per who-am-i.service.ts: VOTING votes are ADVISORY only and are
 *   wiped by GUESS_WORD; the binding YES/NO verification happens in the RESULT
 *   phase ("Is their guess correct?") before Continue (NEXT_TURN)
 * - Wrong guess + NO majority -> elimination; all players eliminated -> no winner
 * - Wrapping past maxRounds via "End Asking" -> FINAL_GUESS phase badge
 * - HOST_INPUT mode ("📝 Host Picks"): Start Game opens a "📝 Set Words" modal in
 *   the lobby; the host assigns words and then acts as a moderator/voter only
 */

async function selectWordMode(page: Page, label: RegExp) {
  const trigger = page
    .getByRole('button')
    .filter({ hasText: /Host Picks|Random \(DB\)|Players Write|AI Generate/ })
    .first();
  await trigger.click();
  await page.getByRole('button').filter({ hasText: label }).last().click();
}

interface AskingRound {
  p1: Page; // host (Amy)
  p2: Page; // guest (Bob)
  cleanup: () => Promise<void>;
}

/**
 * Shared setup: 2-player room, PLAYER_INPUT word mode, maxRounds reduced to 1,
 * both secret words submitted, ASKING phase reached (a Guess button is visible).
 */
async function setupAskingPhase(browser: import('@playwright/test').Browser): Promise<AskingRound> {
  const p1Ctx = await browser.newContext();
  const p2Ctx = await browser.newContext();
  const p1 = await p1Ctx.newPage(); // host
  const p2 = await p2Ctx.newPage(); // guest

  const roomCode = await createRoom(p1, 'Amy', 'Who Am I');
  const origin = await getOrigin(p1);
  await joinRoom(p2, origin, roomCode, 'Bob');

  // Both players should be in the room
  await expect(p2.getByText('Amy').first()).toBeVisible({ timeout: 5000 });

  // --- Lobby configuration ---
  // Reduce rounds 3 -> 1 so a single turn finishes the match
  const minusBtn = p1.locator('button', { hasText: '-' }).first();
  await minusBtn.click();
  await minusBtn.click();

  // Switch word mode to PLAYER_INPUT via the custom dropdown
  await selectWordMode(p1, /Players Write/i);

  // Theme input appears for the host in PLAYER_INPUT mode
  await expect(p1.locator('#themeInput')).toBeVisible();

  const startBtn = p1.getByRole('button', { name: /Start Game/i });
  await expect(startBtn).toBeEnabled({ timeout: 5000 });
  await startBtn.click();

  // --- COLLECTING_WORDS phase ---
  await expect(p1.locator('#playerWordInput')).toBeVisible({ timeout: 10000 });
  await expect(p2.locator('#playerWordInput')).toBeVisible({ timeout: 10000 });

  await p1.locator('#playerWordInput').fill('Elephant');
  await p1.getByRole('button', { name: /Submit Word/i }).click();
  // First submitter still sees the confirmation while waiting for others
  await expect(p1.getByText('Word submitted!')).toBeVisible();

  // Last submitter goes straight to ASKING — verified via the Guess button below
  await p2.locator('#playerWordInput').fill('Tiger');
  await p2.getByRole('button', { name: /Submit Word/i }).click();

  // --- ASKING phase: exactly one player is active, the other votes ---
  const guessBtnP1 = p1.getByRole('button', { name: /Guess the Word!/i });
  const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
  await waitForAnyVisible([guessBtnP1, guessBtnP2]);
  return {
    p1,
    p2,
    cleanup: async () => {
      await p1Ctx.close();
      await p2Ctx.close();
    },
  };
}

/** Detects which of the two players currently holds the Guess (active) button. */
async function detectActivePage(
  guessBtnP1: Locator,
  guessBtnP2: Locator,
  p1: Page,
  p2: Page,
): Promise<[Page, Page]> {
  return (await guessBtnP1.isVisible().catch(() => false)) ? [p1, p2] : [p2, p1];
}

/**
 * Polls until one of the locators (possibly on DIFFERENT pages) is visible and
 * returns its index. Locator.or() cannot combine locators across pages.
 */
async function waitForAnyVisible(locators: Locator[], timeoutMs = 10000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (let i = 0; i < locators.length; i++) {
      if (await locators[i].isVisible().catch(() => false)) return i;
    }
    await locators[0].page().waitForTimeout(150);
  } while (Date.now() < deadline);
  throw new Error('None of the locators became visible within timeout');
}

test.describe('Who Am I Gameplay', () => {
  test('full round: configure, collect words, vote, guess, finish match', async ({ browser }) => {
    const { p1, p2, cleanup } = await setupAskingPhase(browser);

    const guessBtnP1 = p1.getByRole('button', { name: /Guess the Word!/i });
    const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
    const [activePage, voterPage] = await detectActivePage(guessBtnP1, guessBtnP2, p1, p2);

    // Active player opens the guess modal and submits a guess
    await activePage.getByRole('button', { name: /Guess the Word!/i }).click();
    const guessInput = activePage.locator('#guessWordInput');
    await expect(guessInput).toBeVisible();
    await guessInput.fill('A correct guess');
    await activePage.getByRole('button', { name: /Submit Guess/i }).click();

    // --- RESULT phase: votes were wiped by the guess; voter must verify ---
    await expect(activePage.getByText('Word Guess')).toBeVisible({ timeout: 10000 });
    await expect(voterPage.getByText('Is their guess correct?')).toBeVisible({ timeout: 5000 });

    await voterPage.getByRole('button', { name: /YES/i }).click();
    await expect(voterPage.getByText(/Vote cast!/)).toBeVisible({ timeout: 5000 });

    // Majority YES on a guessed word -> active player wins, match ends
    const continueBtn = p1.getByRole('button', { name: /Continue/i });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();

    await expect(p1.getByText('Game Over')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Game Over')).toBeVisible({ timeout: 5000 });

    // Words are revealed on the final screen
    await expect(p1.getByText('Elephant').first()).toBeVisible();
    await expect(p1.getByText('Tiger').first()).toBeVisible();

    // --- Host plays again -> everyone returns to the lobby ---
    await p1.getByRole('button', { name: /Play Again/i }).click();
    await expect(p1.getByRole('button', { name: /Start Game/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(p2.getByText('Amy').first()).toBeVisible({ timeout: 5000 });

    await cleanup();
  });

  test('wrong guess eliminates players until nobody wins', async ({ browser }) => {
    const { p1, p2, cleanup } = await setupAskingPhase(browser);

    const guessBtnP1 = p1.getByRole('button', { name: /Guess the Word!/i });
    const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
    const [activePage, voterPage] = await detectActivePage(guessBtnP1, guessBtnP2, p1, p2);

    // Advisory vote during VOTING — the asker sees it, but it will be wiped on guess
    await voterPage.getByRole('button', { name: /MAYBE/i }).click();
    await expect(voterPage.getByText(/Vote cast!/)).toBeVisible({ timeout: 5000 });

    const guessWrongly = async (page: Page) => {
      await page.getByRole('button', { name: /Guess the Word!/i }).click();
      const input = page.locator('#guessWordInput');
      await expect(input).toBeVisible();
      await input.fill('Definitely wrong');
      await page.getByRole('button', { name: /Submit Guess/i }).click();
      await expect(page.getByText('Word Guess')).toBeVisible({ timeout: 10000 });
    };

    await guessWrongly(activePage);

    // RESULT phase verification: NO majority -> elimination
    await voterPage.getByRole('button', { name: /NO/i }).click();
    await expect(voterPage.getByText(/Vote cast!/)).toBeVisible({ timeout: 5000 });

    await p1.getByRole('button', { name: /Continue/i }).click();

    // First player is eliminated; the remaining player starts their turn
    await expect(activePage.getByText('Eliminated', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    const nextActive = voterPage;
    const eliminatedPage = activePage;
    await expect(nextActive.getByRole('button', { name: /Guess the Word!/i })).toBeVisible({
      timeout: 10000,
    });

    await guessWrongly(nextActive);
    await eliminatedPage.getByRole('button', { name: /NO/i }).click();
    await expect(eliminatedPage.getByText(/Vote cast!/)).toBeVisible({ timeout: 5000 });

    await p1.getByRole('button', { name: /Continue/i }).click();

    // Everyone eliminated -> match ends without a winner
    await expect(p1.getByText('Game Over')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Game Over')).toBeVisible({ timeout: 5000 });
    await expect(p1.getByText('NO WINNER')).toBeVisible();
    await expect(p2.getByText('Everyone used all their guesses.')).toBeVisible();

    await cleanup();
  });

  test('ending all asking turns enters the Final Guess Round', async ({ browser }) => {
    const { p1, p2, cleanup } = await setupAskingPhase(browser);

    const guessBtnP1 = p1.getByRole('button', { name: /Guess the Word!/i });
    const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
    const [firstActive] = await detectActivePage(guessBtnP1, guessBtnP2, p1, p2);
    const secondPlayer = firstActive === p1 ? p2 : p1;

    // End the first asking turn without guessing
    await firstActive.getByRole('button', { name: /End Asking/i }).click();

    // Depending on turn order the round may wrap straight into FINAL_GUESS,
    // otherwise the second player gets their asking turn first
    const finalBadgeP1 = p1.getByText(/Final Guess Round/i).first();
    const secondEndsTurn = secondPlayer.getByRole('button', { name: /End Asking/i });
    const which = await waitForAnyVisible([finalBadgeP1, secondEndsTurn]);
    if (which === 1) {
      await secondEndsTurn.click();
      await expect(finalBadgeP1).toBeVisible({ timeout: 10000 });
    }
    await expect(p2.getByText(/Final Guess Round/i).first()).toBeVisible({ timeout: 5000 });

    // FINAL_GUESS: someone must make their last-chance guess
    await waitForAnyVisible([guessBtnP1, guessBtnP2]);
    const [activePage, voterPage] = await detectActivePage(guessBtnP1, guessBtnP2, p1, p2);

    await activePage.getByRole('button', { name: /Guess the Word!/i }).click();
    const guessInput = activePage.locator('#guessWordInput');
    await expect(guessInput).toBeVisible();
    await guessInput.fill('My final answer');
    await activePage.getByRole('button', { name: /Submit Guess/i }).click();

    await expect(activePage.getByText('Word Guess')).toBeVisible({ timeout: 10000 });
    await voterPage.getByRole('button', { name: /YES/i }).click();

    await p1.getByRole('button', { name: /Continue/i }).click();

    await expect(p1.getByText('Game Over')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Game Over')).toBeVisible({ timeout: 5000 });
    await expect(p1.getByText(/WINS!/i)).toBeVisible();

    await cleanup();
  });

  test('host picks words for players in HOST_INPUT mode', async ({ browser }) => {
    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage(); // host — does not play
    const p2 = await p2Ctx.newPage(); // guest
    const p3 = await p3Ctx.newPage(); // guest

    const roomCode = await createRoom(p1, 'Amy', 'Who Am I');
    const origin = await getOrigin(p1);
    await joinRoom(p2, origin, roomCode, 'Bob');
    await joinRoom(p3, origin, roomCode, 'Cara');

    await selectWordMode(p1, /Host Picks/i);

    const startBtn = p1.getByRole('button', { name: /Start Game/i });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

    // Guests see the waiting-for-host panel instead of a start button
    await expect(p2.getByText('Waiting for Room Host to start')).toBeVisible({ timeout: 5000 });
    await expect(p3.getByText('Waiting for Room Host to start')).toBeVisible({ timeout: 5000 });

    // HOST_INPUT opens the "Set Words" modal in the lobby — one input per guest
    await startBtn.click();
    await expect(p1.getByText('📝 Set Words')).toBeVisible({ timeout: 5000 });

    const wordInputs = p1.getByPlaceholder('Enter a character, animal, object...');
    await expect(wordInputs).toHaveCount(2);
    await wordInputs.nth(0).fill('Pirate');
    await wordInputs.nth(1).fill('Astronaut');

    // The modal's own Start Game button submits the words and starts the match
    await p1
      .getByRole('button', { name: /Start Game/i })
      .last()
      .click();

    // Guests play, host only votes — host never gets a Guess button
    const guessBtnP2 = p2.getByRole('button', { name: /Guess the Word!/i });
    const guessBtnP3 = p3.getByRole('button', { name: /Guess the Word!/i });
    const activeIdx = await waitForAnyVisible([guessBtnP2, guessBtnP3]);
    await expect(p1.getByRole('button', { name: /Guess the Word!/i })).toHaveCount(0);
    const activePage = activeIdx === 0 ? p2 : p3;

    await activePage.getByRole('button', { name: /Guess the Word!/i }).click();
    const guessInput = activePage.locator('#guessWordInput');
    await expect(guessInput).toBeVisible();
    await guessInput.fill('I know who I am');
    await activePage.getByRole('button', { name: /Submit Guess/i }).click();

    // Host verifies in the RESULT phase — a single YES beats zero NOs
    await expect(activePage.getByText('Word Guess')).toBeVisible({ timeout: 10000 });
    await p1.getByRole('button', { name: /YES/i }).click();

    await p1.getByRole('button', { name: /Continue/i }).click();

    await expect(p1.getByText('Game Over')).toBeVisible({ timeout: 10000 });
    await expect(p2.getByText('Game Over')).toBeVisible({ timeout: 5000 });
    await expect(p3.getByText('Game Over')).toBeVisible({ timeout: 5000 });
    await expect(p1.getByText('Pirate').first()).toBeVisible();
    await expect(p1.getByText('Astronaut').first()).toBeVisible();

    await p1Ctx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test('can create room and see lobby config', async ({ page }) => {
    await createRoom(page, 'WhoHost', 'Who Am I');
    await expect(page.getByText('WhoHost').first()).toBeVisible();

    // Default config UI is rendered for the host
    await expect(page.getByText('Number of Rounds')).toBeVisible();
    await expect(page.getByText('Word Mode')).toBeVisible();
    await expect(
      page
        .getByRole('button')
        .filter({ hasText: /Random \(DB\)/ })
        .first(),
    ).toBeVisible();
  });
});
