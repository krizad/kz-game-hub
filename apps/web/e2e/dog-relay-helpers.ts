import { expect, type Page } from '@playwright/test';
import { waitForAnyVisible } from './helpers';

export interface RelayRound {
  leader: Page;
  evil: Page;
  pair: [string, string];
  final: Page;
}

/** Read only this browser's received public and private projections. */
export async function relaySnapshot(page: Page) {
  return page.evaluate(() => {
    const store = (window as any).__useGameStore.getState();
    return {
      playerId: store.playerId as string,
      own: store.privateState.dogRelay,
      public: store.room?.dogRelayState,
    };
  });
}

export async function startRelay(players: Page[]): Promise<RelayRound> {
  await players[0].getByRole('button', { name: /Start Game|เริ่มเกม/ }).click();
  const roles: Array<{ page: Page; role: string }> = [];
  for (const page of players) {
    await page.getByTestId('dog-relay-role-reveal').click();
    const role = page.getByTestId('dog-relay-own-role');
    await expect(role).toBeVisible();
    roles.push({ page, role: (await relaySnapshot(page)).own.role });
    await page.getByTestId('dog-relay-role-ack').click();
    await expect(page.getByTestId('dog-relay-role-ack')).toHaveCount(0);
  }
  const leader = roles.find((entry) => entry.role === 'LEADER')?.page;
  const evil = roles.find((entry) => entry.role === 'EVIL')?.page;
  expect(roles.filter((entry) => entry.role === 'LEADER')).toHaveLength(1);
  expect(roles.filter((entry) => entry.role === 'EVIL')).toHaveLength(1);
  if (!leader || !evil) throw new Error('Expected one Leader and one Evil');
  await expect(leader.getByTestId('dog-relay-begin')).toBeVisible();
  const cards = leader.locator('[data-testid^="dog-relay-card-"]');
  await expect(cards).toHaveCount(2);
  const ids = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')!.replace('dog-relay-card-', '')),
  );
  const pair: [string, string] = [ids[0], ids[1]];
  for (const page of players) {
    const snapshot = await relaySnapshot(page);
    expect(snapshot.public.truePair).toBeUndefined();
    expect(snapshot.public.roles).toBeUndefined();
    expect(snapshot.public.result).toBeNull();
    if (page !== leader) {
      expect(snapshot.own.truePair).toBeUndefined();
      await expect(page.locator('[data-testid^="dog-relay-card-"]')).toHaveCount(0);
    }
  }
  await leader.getByTestId('dog-relay-begin').click();
  let final: Page | undefined;
  for (let step = 0; step < players.length - 1; step++) {
    const control = await waitForAnyVisible(
      players.map((page) => page.getByTestId('dog-relay-handoff')),
    );
    if (!control) throw new Error(`Missing handoff ${step + 1}`);
    final = control.page();
    await control.click();
    await expect(control).toHaveCount(0);
  }
  if (!final) throw new Error('Missing final viewer');
  await expect(final.locator('button[data-testid^="dog-relay-card-"]')).toHaveCount(10);
  await expect(final.locator('[data-testid^="dog-relay-card-"] img')).toHaveCount(0);
  return { leader, evil, pair, final };
}

export async function guessPair(round: RelayRound, correct = true) {
  // Reversing the ordered pair is always a valid, deterministically wrong guess.
  const pair = correct ? round.pair : [round.pair[1], round.pair[0]];
  await round.final.getByTestId(`dog-relay-card-${pair[0]}`).click();
  await round.final.getByTestId(`dog-relay-card-${pair[1]}`).click();
  await expect(round.final.getByTestId('dog-relay-selected-suspect')).toHaveText(
    await round.final.getByTestId(`dog-relay-card-${pair[0]}`).locator('strong').innerText(),
  );
  await expect(round.final.getByTestId('dog-relay-selected-victim')).toHaveText(
    await round.final.getByTestId(`dog-relay-card-${pair[1]}`).locator('strong').innerText(),
  );
  await round.final.getByTestId('dog-relay-confirm-guess').click();
}

export async function expectRelayResult(players: Page[], team: 'GOOD' | 'EVIL', reason: string) {
  for (const page of players) {
    await expect(page.getByTestId('dog-relay-result')).toBeVisible();
    const result = (await relaySnapshot(page)).public.result;
    expect(result.winningTeam).toBe(team);
    expect(result.reason).toBe(reason);
    expect(Object.keys(result.roles)).toHaveLength(players.length);
    expect(result.winnerIds).toHaveLength(team === 'GOOD' ? players.length - 1 : 1);
  }
}

export async function voteRelay(players: Page[], round: RelayRound, tie: boolean) {
  await players[0].getByTestId('dog-relay-end-discussion').click();
  const evilId = (await relaySnapshot(round.evil)).playerId;
  const leaderId = (await relaySnapshot(round.leader)).playerId;
  const ids = await Promise.all(players.map(async (page) => (await relaySnapshot(page)).playerId));
  const goodIds = ids.filter((id) => id !== evilId && id !== leaderId);
  const targets = tie ? [evilId, evilId, goodIds[0], goodIds[0], goodIds[1]] : [];
  const assign = (remaining: string[], index = 0): string[] | null => {
    if (index === ids.length) return [];
    for (let choice = 0; choice < remaining.length; choice++) {
      if (remaining[choice] === ids[index]) continue;
      const rest = assign(
        remaining.filter((_, i) => i !== choice),
        index + 1,
      );
      if (rest) return [remaining[choice], ...rest];
    }
    return null;
  };
  const tiedBallots = tie ? assign(targets) : null;
  if (tie && !tiedBallots) throw new Error('Unable to assign legal tied ballots');
  for (let index = 0; index < players.length; index++) {
    const page = players[index];
    const ownId = ids[index];
    await expect(page.getByTestId('dog-relay-confirm-vote')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`dog-relay-vote-${ownId}`)).toHaveCount(0);
    await expect(page.getByTestId(`dog-relay-vote-${leaderId}`)).toHaveCount(0);
    // Five ballots produce a 2–2–1 tie: Evil and a good seat share first place.
    const target = tiedBallots?.[index] ?? (ownId === evilId ? goodIds[0] : evilId);
    await page.getByTestId(`dog-relay-vote-${target}`).click();
    await page.getByTestId('dog-relay-confirm-vote').click();
    await expect(page.getByTestId('dog-relay-confirm-vote')).toHaveCount(0);
  }
}
