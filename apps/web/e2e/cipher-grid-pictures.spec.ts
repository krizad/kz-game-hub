import { test } from '@playwright/test';
import { playCipherScenario } from './cipher-grid-helpers';

test('Pictures Classic: 20 cards, zoom, private key, ALL_FOUND and rematch', async ({
  browser,
}, info) => {
  test.setTimeout(150000);
  await playCipherScenario(browser, 'PICTURES', 'ALL_FOUND', info, 'CLASSIC');
});

test('Pictures Minimal: 20 cards, zoom, private key, VIRUS and rematch', async ({
  browser,
}, info) => {
  test.setTimeout(150000);
  await playCipherScenario(browser, 'PICTURES', 'VIRUS', info, 'MINIMAL');
});
