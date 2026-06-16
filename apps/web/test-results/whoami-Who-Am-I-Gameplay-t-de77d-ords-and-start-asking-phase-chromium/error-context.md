# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: whoami.spec.ts >> Who Am I Gameplay >> two players can submit words and start asking phase
- Location: e2e/whoami.spec.ts:5:7

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
      - paragraph [ref=e20]: Join room R52L4I
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
  2  | import { createRoom, joinRoom, getOrigin } from './helpers';
  3  | 
  4  | test.describe('Who Am I Gameplay', () => {
  5  |   test('two players can submit words and start asking phase', async ({ browser }) => {
  6  |     const p1Ctx = await browser.newContext();
  7  |     const p2Ctx = await browser.newContext();
  8  |     const p1 = await p1Ctx.newPage();
  9  |     const p2 = await p2Ctx.newPage();
  10 | 
  11 |     const roomCode = await createRoom(p1, 'Amy', 'Who Am I');
  12 |     const origin = await getOrigin(p1);
  13 |     await joinRoom(p2, origin, roomCode, 'Bob');
  14 | 
  15 |     // Both players should be in the room
  16 |     await p1.waitForTimeout(2000);
  17 |     await expect(p2.getByText('Amy').first()).toBeVisible({ timeout: 5000 });
  18 | 
  19 |     // Player 1 tries to start game - note: Start may be disabled until config is set
  20 | 
  21 |     // Both should see COLLECTING_WORDS phase (PLAYER_INPUT default)
  22 |     await p1.waitForTimeout(1000);
  23 | 
  24 |     // Submit words if in COLLECTING_WORDS phase
  25 |     const p1Input = p1.locator('#playerWordInput').first();
  26 |     if (await p1Input.isVisible({ timeout: 5000 }).catch(() => false)) {
  27 |       await p1Input.fill('Elephant');
  28 |       await p1.locator('button:has-text("Submit Word")').first().click();
  29 |       await p1.waitForTimeout(500);
  30 | 
  31 |       const p2Input = p2.locator('#playerWordInput').first();
  32 |       if (await p2Input.isVisible({ timeout: 5000 }).catch(() => false)) {
  33 |         await p2Input.fill('Tiger');
  34 |         await p2.locator('button:has-text("Submit Word")').first().click();
  35 |         await p2.waitForTimeout(3000);
  36 |       }
  37 | 
  38 |       // After both submit, game should transition to ASKING
  39 |       await p1.waitForTimeout(1000);
  40 |     }
  41 | 
  42 |     // Check if asking phase is active (YES/NO/MAYBE buttons)
  43 |     await p1.waitForTimeout(1000);
  44 | 
  45 |     await p1Ctx.close();
> 46 |     await p2Ctx.close();
     |                 ^ Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
  47 |   });
  48 | 
  49 |   test('can create room and see lobby config', async ({ page }) => {
  50 |     await createRoom(page, 'WhoHost', 'Who Am I');
  51 |     await expect(page.getByText('WhoHost').first()).toBeVisible();
  52 |   });
  53 | });
  54 | 
```