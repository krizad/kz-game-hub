# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: soundsfishy.spec.ts >> Sounds Fishy Gameplay >> three players can start game and enter answer phase
- Location: e2e/soundsfishy.spec.ts:5:7

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
      - paragraph [ref=e20]: Join room SOUNDS
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]: Display Name
          - textbox "Display Name" [active] [ref=e24]:
            - /placeholder: Enter your name to play
            - text: This is the truth
        - button "Enter Game" [ref=e25] [cursor=pointer]
        - button "Return to Home" [ref=e26] [cursor=pointer]
  - alert [ref=e27]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createRoom, joinRoom, getOrigin } from './helpers';
  3  | 
  4  | test.describe('Sounds Fishy Gameplay', () => {
  5  |   test('three players can start game and enter answer phase', async ({ browser }) => {
  6  |     const contexts = await Promise.all([
  7  |       browser.newContext(),
  8  |       browser.newContext(),
  9  |       browser.newContext(),
  10 |     ]);
  11 |     const [p1, p2, p3] = await Promise.all(contexts.map((c) => c.newPage()));
  12 | 
  13 |     const roomCode = await createRoom(p1, 'FishHost', 'Sounds Fishy');
  14 |     const origin = await getOrigin(p1);
  15 | 
  16 |     await joinRoom(p2, origin, roomCode, 'F1');
  17 |     await joinRoom(p3, origin, roomCode, 'F2');
  18 | 
  19 |     // All should be in the room
  20 |     await p1.waitForTimeout(1500);
  21 | 
  22 |     // Host starts game
  23 |     const startBtn = p1.getByText('Start Game');
  24 |     if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  25 |       await startBtn.click();
  26 |       await p1.waitForTimeout(3000);
  27 |     }
  28 | 
  29 |     // Check for answer submission phase
  30 |     // Non-picker players should see an answer input
  31 |     await p1.waitForTimeout(1000);
  32 | 
  33 |     for (const page of [p2, p3]) {
  34 |       const input = page.locator('input').filter({ hasText: '' });
  35 |       if ((await input.count()) > 0) {
  36 |         const answerInput = input.last();
  37 |         if (await answerInput.isVisible({ timeout: 5000 }).catch(() => false)) {
  38 |           await answerInput.fill('This is the truth');
  39 |         }
  40 |         const submitBtn = page.locator('button').filter({ hasText: /Submit/ });
  41 |         if (await submitBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
  42 |           await submitBtn.first().click();
  43 |         }
  44 |       }
  45 |     }
  46 | 
  47 |     await p1.waitForTimeout(2000);
> 48 |     await Promise.all(contexts.map((c) => c.close()));
     |                                             ^ Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
  49 |   });
  50 | 
  51 |   test('can create room and see lobby', async ({ page }) => {
  52 |     await createRoom(page, 'FishTest', 'Sounds Fishy');
  53 |     await expect(page.getByText('FishTest').first()).toBeVisible();
  54 |   });
  55 | });
  56 | 
```