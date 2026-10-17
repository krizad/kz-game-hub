import { test } from '@playwright/test';
import { playCipherScenario } from './cipher-grid-helpers';

test('Words: private key, zero clue, challenge, reconnect and rematch', async ({
  browser,
}, info) => {
  test.setTimeout(150000);
  await playCipherScenario(browser, 'WORDS', 'VIRUS', info);
});
