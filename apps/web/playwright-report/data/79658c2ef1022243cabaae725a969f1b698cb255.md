# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: whoknow.spec.ts >> Who Know Gameplay >> four players can start game flow
- Location: e2e/whoknow.spec.ts:5:7

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
            - generic [ref=e8]: Who Know!
            - generic [ref=e9]: UB8G37
          - generic [ref=e10]:
            - generic [ref=e11]: "Room Host:"
            - generic "Room Creator" [ref=e12]: Host
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
      - generic [ref=e41]:
        - generic [ref=e42]:
          - generic [ref=e43]:
            - heading "Players" [level=3] [ref=e44]
            - generic [ref=e45]: "4"
          - table [ref=e47]:
            - rowgroup [ref=e48]:
              - row "Players Score" [ref=e49]:
                - columnheader "Players" [ref=e50]
                - columnheader "Score" [ref=e51]
            - rowgroup [ref=e52]:
              - row "🐐 Host(YOU) 0" [ref=e53]:
                - cell "🐐 Host(YOU)" [ref=e54]:
                  - generic "Host" [ref=e55]: 🐐
                  - generic [ref=e56]:
                    - text: Host
                    - generic [ref=e57]: (YOU)
                - cell "0" [ref=e58]
              - row "🐗 P1 (OFFLINE) 0" [ref=e59]:
                - cell "🐗 P1 (OFFLINE)" [ref=e60]:
                  - generic "P1" [ref=e61]: 🐗
                  - generic [ref=e62]:
                    - text: P1
                    - generic [ref=e63]: (OFFLINE)
                - cell "0" [ref=e64]
              - row "🦬 P2 (OFFLINE) HOST 0" [ref=e65]:
                - cell "🦬 P2 (OFFLINE) HOST" [ref=e66]:
                  - generic "P2" [ref=e67]: 🦬
                  - generic [ref=e68]:
                    - text: P2
                    - generic [ref=e69]: (OFFLINE)
                  - generic "Game Host" [ref=e70]: HOST
                - cell "0" [ref=e71]
              - row "🐍 P3 (OFFLINE) 0" [ref=e72]:
                - cell "🐍 P3 (OFFLINE)" [ref=e73]:
                  - generic "P3" [ref=e74]: 🐍
                  - generic [ref=e75]:
                    - text: P3
                    - generic [ref=e76]: (OFFLINE)
                - cell "0" [ref=e77]
        - paragraph [ref=e82]: Waiting for the Game Host to pick a word...
      - generic [ref=e83]:
        - generic [ref=e84]: Phase
        - generic [ref=e85]: SECRET WORD SELECTION
  - alert [ref=e86]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createRoom, joinRoom, getOrigin } from './helpers';
  3  | 
  4  | test.describe('Who Know Gameplay', () => {
  5  |   test('four players can start game flow', async ({ browser }) => {
  6  |     const contexts = await Promise.all([
  7  |       browser.newContext(), browser.newContext(),
  8  |       browser.newContext(), browser.newContext(),
  9  |     ]);
  10 |     const [p1, p2, p3, p4] = await Promise.all(contexts.map((c) => c.newPage()));
  11 | 
  12 |     const roomCode = await createRoom(p1, 'Host', 'Who Know');
  13 |     const origin = await getOrigin(p1);
  14 | 
  15 |     await joinRoom(p2, origin, roomCode, 'P1');
  16 |     await joinRoom(p3, origin, roomCode, 'P2');
  17 |     await joinRoom(p4, origin, roomCode, 'P3');
  18 | 
  19 |     // All should be in the room
  20 |     await p1.waitForTimeout(2000);
  21 | 
  22 |     // Host starts game
  23 |     const startBtn = p1.locator('button').filter({ hasText: /Start Game|เริ่มเกม/ });
  24 |     if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  25 |       await startBtn.click();
  26 |       await p1.waitForTimeout(3000);
  27 |     }
  28 | 
  29 |     // Verify game started - check for the timer, questioning text, or the game content changed
  30 |     await p1.waitForTimeout(1500);
  31 |     await p2.waitForTimeout(1500);
  32 | 
> 33 |     await Promise.all(contexts.map((c) => c.close()));
     |                                             ^ Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
  34 |   });
  35 | 
  36 |   test('host sees lobby config options', async ({ page }) => {
  37 |     await createRoom(page, 'SoloHost', 'Who Know');
  38 |     await expect(page.getByText('SoloHost').first()).toBeVisible();
  39 |     await expect(page.getByText('Host Selection').or(page.getByText('การเลือกโฮสต์'))).toBeVisible({ timeout: 5000 });
  40 |   });
  41 | });
  42 | 
```