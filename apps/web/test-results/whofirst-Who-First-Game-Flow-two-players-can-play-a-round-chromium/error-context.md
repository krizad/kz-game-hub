# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: whofirst.spec.ts >> Who First Game Flow >> two players can play a round
- Location: e2e/whofirst.spec.ts:14:7

# Error details

```
Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - button "EN" [ref=e5] [cursor=pointer]
      - button "TH" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - button "🏆 Leaderboard" [ref=e8] [cursor=pointer]:
        - text: 🏆
        - generic [ref=e9]: Leaderboard
      - button "Rules" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
        - generic [ref=e14]: Rules
    - generic [ref=e15]:
      - img "KZ Game Hub Logo" [ref=e18]
      - heading "You've been invited!" [level=1] [ref=e19]
      - paragraph [ref=e20]: Join room FTNNAD
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]: Display Name
          - textbox "Display Name" [active] [ref=e24]:
            - /placeholder: Enter your name to play
            - text: Bob
        - button "Enter Game" [ref=e25] [cursor=pointer]
        - button "Return to Home" [ref=e26] [cursor=pointer]
  - status [ref=e32]: The Room Host has left. Room has been closed.
  - alert [ref=e33]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createRoom, joinRoom, getOrigin, goToLobbyInEnglish } from './helpers';
  3  | 
  4  | test.describe('Who First Game Flow', () => {
  5  |   test('player can create room and see lobby setup', async ({ page }) => {
  6  |     const roomCode = await createRoom(page, 'HostPlayer', 'Who First');
  7  |     expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  8  |     
  9  |     // Check for Who First lobby specifics
  10 |     await expect(page.locator('text=Who First Lobby')).toBeVisible({ timeout: 5000 });
  11 |     await expect(page.locator('button:has-text("Start Countdown!")')).toBeVisible({ timeout: 5000 });
  12 |   });
  13 | 
  14 |   test('two players can play a round', async ({ browser }) => {
  15 |     const p1Ctx = await browser.newContext();
  16 |     const p2Ctx = await browser.newContext();
  17 |     const p1 = await p1Ctx.newPage();
  18 |     const p2 = await p2Ctx.newPage();
  19 | 
  20 |     const roomCode = await createRoom(p1, 'Alice', 'Who First');
  21 |     const origin = await getOrigin(p1);
  22 |     await joinRoom(p2, origin, roomCode, 'Bob');
  23 | 
  24 |     // Both should be in the game lobby
  25 |     await p1.waitForTimeout(1000);
  26 |     await p2.waitForTimeout(1000);
  27 | 
  28 |     // Host (Alice) enables "Host plays too" just in case it's off by default
  29 |     // Wait, the test might fail if the switch ID doesn't exist, but it does: id="host-plays-switch"
  30 |     const hostPlaysSwitch = p1.locator('#host-plays-switch');
  31 |     if (await hostPlaysSwitch.isVisible()) {
  32 |        // if not checked, click it
  33 |        const isChecked = await hostPlaysSwitch.getAttribute('aria-checked');
  34 |        if (isChecked !== 'true') {
  35 |          await hostPlaysSwitch.click();
  36 |          await p1.waitForTimeout(500);
  37 |        }
  38 |     }
  39 | 
  40 |     // Host starts game
  41 |     await p1.locator('button:has-text("Start Countdown!")').click();
  42 | 
  43 |     // Verify COUNTDOWN phase is active
  44 |     await expect(p1.locator('text=Ready...')).toBeVisible({ timeout: 5000 });
  45 |     await expect(p2.locator('text=Ready...')).toBeVisible({ timeout: 5000 });
  46 | 
  47 |     // Both wait for GO!!
  48 |     // Wait for the ACTIVE phase up to 6 seconds since countdown duration is 2-5s
  49 |     await expect(p1.locator('text=GO!!')).toBeVisible({ timeout: 8000 });
  50 |     await expect(p2.locator('text=GO!!')).toBeVisible({ timeout: 8000 });
  51 | 
  52 |     // P1 presses button
  53 |     await p1.locator('button:has-text("PRESS!")').click();
  54 |     await p1.waitForTimeout(500);
  55 | 
  56 |     // P2 presses button
  57 |     await p2.locator('button:has-text("PRESS!")').click();
  58 | 
  59 |     // Verify Round Result
  60 |     await expect(p1.locator('text=Round Result')).toBeVisible({ timeout: 5000 });
  61 |     await expect(p2.locator('text=Round Result')).toBeVisible({ timeout: 5000 });
  62 | 
  63 |     // Alice should be first since she pressed first
  64 |     await expect(p1.locator('text=Alice').first()).toBeVisible();
  65 |     await expect(p1.locator('text=Bob').first()).toBeVisible();
  66 | 
  67 |     await p1Ctx.close();
> 68 |     await p2Ctx.close();
     |                 ^ Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
  69 |   });
  70 | });
  71 | 
```