import { Page } from '@playwright/test';

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
  const text = await page.$eval('body', (el) => el.innerText);
  const match = text.match(/\b[A-Z0-9]{6}\b/);
  return match?.[0] ?? '';
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
  await switchToEnglish(page);
  await page.locator('#inviteNameInput').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#inviteNameInput').fill(name);
  await page
    .locator('button')
    .filter({ hasText: /Enter Game|เข้าสู่เกม/ })
    .click();
  await page.waitForTimeout(2000);
}

export async function getOrigin(page: Page): Promise<string> {
  return page.evaluate(() => window.location.origin);
}
