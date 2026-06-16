# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rps.spec.ts >> RPS (Hand Duel) Game Flow >> two players can join RPS room
- Location: e2e/rps.spec.ts:10:7

# Error details

```
Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - img "Logo" [ref=e6]
          - generic [ref=e7]:
            - generic [ref=e8]: Hand Duel
            - generic [ref=e9]: 09CBQE
          - generic [ref=e10]:
            - generic [ref=e11]: "Room Host:"
            - generic "Room Creator" [ref=e12]: Rocky
          - button "Copy Link" [ref=e13] [cursor=pointer]:
            - img [ref=e14]
            - generic [ref=e17]: Copy Link
          - button "QR Code" [ref=e18] [cursor=pointer]:
            - img [ref=e19]
            - generic [ref=e25]: QR Code
          - generic [ref=e26]:
            - button "EN" [ref=e27] [cursor=pointer]
            - button "TH" [ref=e28] [cursor=pointer]
        - generic [ref=e29]:
          - button "🏆" [ref=e30] [cursor=pointer]
          - button "Rules" [ref=e31] [cursor=pointer]:
            - img [ref=e32]
            - generic [ref=e35]: Rules
          - button "Leave" [ref=e36] [cursor=pointer]:
            - img [ref=e37]
            - generic [ref=e40]: Leave
      - generic [ref=e42]:
        - generic [ref=e43]:
          - generic [ref=e44]: 1V1 ROUND ROBIN
          - generic [ref=e45]: Playing
          - generic [ref=e46]: FIRST TO 2
        - generic [ref=e47]:
          - generic [ref=e48]:
            - generic [ref=e49]: P1
            - generic [ref=e50]: Rocky
            - generic [ref=e51]: 0 / 2
          - generic [ref=e52]:
            - generic [ref=e53]: P2
            - generic [ref=e54]: Paper
            - generic [ref=e55]: 0 / 2
        - generic [ref=e57]:
          - button "✊" [ref=e58] [cursor=pointer]
          - button "✋" [ref=e59] [cursor=pointer]
          - button "✌️" [ref=e60] [cursor=pointer]
  - alert [ref=e61]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createRoom, joinRoom, getOrigin, goToLobbyInEnglish } from './helpers';
  3  | 
  4  | test.describe('RPS (Hand Duel) Game Flow', () => {
  5  |   test('can create RPS room and see lobby config', async ({ page }) => {
  6  |     await createRoom(page, 'RPSHost', 'Hand Duel');
  7  |     await expect(page.getByText('Waiting Room').or(page.getByText('ห้องรอ'))).toBeVisible({ timeout: 5000 });
  8  |   });
  9  | 
  10 |   test('two players can join RPS room', async ({ browser }) => {
  11 |     const p1Ctx = await browser.newContext();
  12 |     const p2Ctx = await browser.newContext();
  13 |     const p1 = await p1Ctx.newPage();
  14 |     const p2 = await p2Ctx.newPage();
  15 | 
  16 |     const roomCode = await createRoom(p1, 'Rocky', 'Hand Duel');
  17 |     const origin = await getOrigin(p1);
  18 |     await joinRoom(p2, origin, roomCode, 'Paper');
  19 | 
  20 |     // Host starts the game
  21 |     const startBtn = p1.getByText('Start Game');
  22 |     if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  23 |       await startBtn.click();
  24 |       await p1.waitForTimeout(2000);
  25 |     }
  26 | 
  27 |     await p1Ctx.close();
> 28 |     await p2Ctx.close();
     |                 ^ Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
  29 |   });
  30 | });
  31 | 
```