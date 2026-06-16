# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tictactoe.spec.ts >> Tic-Tac-Toe Game Flow >> two players can play a full game
- Location: e2e/tictactoe.spec.ts:12:7

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
      - paragraph [ref=e20]: Join room I5HWI5
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
  4  | test.describe('Tic-Tac-Toe Game Flow', () => {
  5  |   test('player can create room and see lobby setup', async ({ page }) => {
  6  |     const roomCode = await createRoom(page, 'HostPlayer', 'Classic Tic Tac Toe');
  7  |     expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  8  |     await expect(page.locator('button:has-text("Join as X")')).toBeVisible({ timeout: 5000 });
  9  |     await expect(page.locator('button:has-text("Join as O")')).toBeVisible({ timeout: 5000 });
  10 |   });
  11 | 
  12 |   test('two players can play a full game', async ({ browser }) => {
  13 |     const p1Ctx = await browser.newContext();
  14 |     const p2Ctx = await browser.newContext();
  15 |     const p1 = await p1Ctx.newPage();
  16 |     const p2 = await p2Ctx.newPage();
  17 | 
  18 |     const roomCode = await createRoom(p1, 'Alice', 'Classic Tic Tac Toe');
  19 |     const origin = await getOrigin(p1);
  20 |     await joinRoom(p2, origin, roomCode, 'Bob');
  21 | 
  22 |     // Both should be in the game room
  23 |     await p1.waitForTimeout(2000);
  24 |     await p2.waitForTimeout(1000);
  25 | 
  26 |     // P1 joins X
  27 |     await p1.locator('button:has-text("Join as X")').click();
  28 |     await p1.waitForTimeout(1000);
  29 | 
  30 |     await p1Ctx.close();
> 31 |     await p2Ctx.close();
     |                 ^ Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
  32 |   });
  33 | });
  34 | 
```