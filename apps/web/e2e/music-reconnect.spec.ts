import { test, expect, type Page } from '@playwright/test';
import type { MusicTriviaSyncPlayPayload, RoomState } from '@repo/types';
import { createRoom, joinRoom, getOrigin } from './helpers';

function observeEvents(page: Page) {
  const events: Array<[string, unknown]> = [];
  const record = (frame: string) => {
    if (frame.startsWith('42[')) events.push(JSON.parse(frame.slice(2)));
  };
  // Socket.IO may deliver join recovery over polling before upgrading to WebSocket.
  page.on('response', async (response) => {
    if (!response.url().includes('/socket.io/?') || !response.url().includes('transport=polling'))
      return;
    const body = await response.text().catch(() => '');
    body.split('\x1e').forEach(record);
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      record(payload.toString());
    });
  });
  return events;
}

test('Music reconnect restores the same playing clip without restarting the round or leaking answers', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const bob = await guestContext.newPage();
  const events = observeEvents(bob);
  try {
    const code = await createRoom(host, 'Alice', 'Music Trivia');
    await joinRoom(bob, await getOrigin(host), code, 'Bob');
    await host.getByRole('button', { name: /Free search/i }).click();
    await host
      .getByRole('button', { name: /Pick an Artist/i })
      .last()
      .click();
    await host.getByTestId('lobby-start-game').click();
    await expect(bob.getByRole('button', { name: "I'm Ready!", exact: true })).toBeVisible();
    await bob.getByRole('button', { name: "I'm Ready!", exact: true }).click();
    await host.getByRole('button', { name: 'Start Song (Countdown)', exact: true }).click();
    await expect
      .poll(() => events.filter(([name]) => name === 'music_trivia_sync_play').length)
      .toBe(1);
    const original = events.find(
      ([name]) => name === 'music_trivia_sync_play',
    )![1] as MusicTriviaSyncPlayPayload;
    const beforeReload = events.length;
    await bob.reload();
    await expect
      .poll(() => events.slice(beforeReload).some(([name]) => name === 'music_trivia_sync_play'))
      .toBe(true);
    const restored = events
      .slice(beforeReload)
      .find(([name]) => name === 'music_trivia_sync_play')![1] as MusicTriviaSyncPlayPayload;
    expect(restored).toEqual(original);
    const snapshots = events
      .slice(beforeReload)
      .filter(([name]) => name === 'room_state_updated')
      .map(([, data]) => data as RoomState);
    expect(snapshots.at(-1)?.musicTriviaState?.phase).toBe('PLAYING');
    expect(snapshots.at(-1)?.musicTriviaState?.currentRound?.roundNumber).toBe(
      original.roundNumber,
    );
    expect(JSON.stringify(snapshots)).not.toContain('E2E Song');
    expect(events.some(([name]) => name === 'music_trivia_host_answer')).toBe(false);
    await expect(bob.getByTestId('connection-status')).toHaveCount(0);
    await bob.getByRole('button', { name: /BUZZ!$/ }).click({ timeout: 10000 });
    await expect(bob.getByPlaceholder('Type answer here...')).toBeVisible();
  } finally {
    await hostContext.close().catch(() => {});
    await guestContext.close().catch(() => {});
  }
});
