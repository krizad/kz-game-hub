import { Page, expect } from '@playwright/test';

export async function waitForConnection(page: Page) {
  await page.waitForFunction(
    () => {
      const h1 = document.querySelector('h1');
      return (
        h1 && !h1.textContent?.includes('Connecting') && !h1.textContent?.includes('กำลังเชื่อมต่อ')
      );
    },
    { timeout: 20000 },
  );
  await page.locator('h1').waitFor({ state: 'visible', timeout: 5000 });
}

export async function switchToEnglish(page: Page) {
  await page.getByText('EN').click();
  await page.waitForTimeout(300);
}

export async function goToLobby(page: Page) {
  await page.goto('/');
  await waitForConnection(page);
}

export async function goToLobbyInEnglish(page: Page) {
  await goToLobby(page);
  await switchToEnglish(page);
}

export async function extractRoomCode(page: Page): Promise<string> {
  // The room code is displayed in a specific element with indigo-400 color and tracking-widest
  const code = await page.$eval(
    'span.text-indigo-400.tracking-widest',
    (el) => el.textContent?.trim() ?? '',
  );
  // Validate it's a 6-char alphanumeric code
  if (/^[A-Z0-9]{6}$/.test(code)) return code;
  // Fallback: scan body text and find code after the game name
  const bodyText = await page.$eval('body', (el) => el.innerText);
  // Look for room code pattern preceded by a known game name pattern
  const knownNames = [
    'Music Trivia',
    'Who Know',
    'Tic Tac Toe',
    'Hand Duel',
    'Sounds Fishy',
    'Detective Club',
    'Who Am I',
    'Who First',
    'Gobbler',
  ];
  for (const name of knownNames) {
    const idx = bodyText.indexOf(name);
    if (idx >= 0) {
      const after = bodyText.substring(idx + name.length);
      const match = after.match(/^[\s]*([A-Z0-9]{6})\b/);
      if (match) return match[1];
    }
  }
  // Last resort: find any 6-char alphanumeric word not part of a known game name
  const matches = bodyText.match(/\b[A-Z0-9]{6}\b/g);
  if (matches) {
    const gameWords = new Set(['TRIVIA', 'FISHY', 'GOBBLE']);
    const filtered = matches.filter((m) => !gameWords.has(m));
    if (filtered.length > 0) return filtered[0];
  }
  return '';
}

export async function createRoom(
  page: Page,
  playerName: string,
  gameButtonText: string,
): Promise<string> {
  await goToLobbyInEnglish(page);
  await page.locator('#lobbyNameInput').fill(playerName);
  await page
    .locator('button:has-text("' + gameButtonText + '")')
    .first()
    .click();
  await page.waitForTimeout(3000);
  const code = await extractRoomCode(page);
  if (!code) throw new Error('Could not extract room code');
  return code;
}

export async function joinRoom(page: Page, origin: string, roomCode: string, name: string) {
  const joinUrl = `${origin}/?room=${roomCode}`;
  await page.goto(joinUrl);
  await page.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
  await switchToEnglish(page);
  await page.locator('#inviteNameInput').fill(name);
  await expect(page.locator('#inviteNameInput')).toHaveValue(name);
  // Press Enter to submit via the onKeyDown handler
  await page.locator('#inviteNameInput').press('Enter');
  await page.locator('#inviteNameInput').waitFor({ state: 'hidden', timeout: 20000 });
}

export async function getOrigin(page: Page): Promise<string> {
  return page.evaluate(() => window.location.origin);
}
