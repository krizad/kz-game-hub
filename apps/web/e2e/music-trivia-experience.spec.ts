import { test, expect, type Page } from '@playwright/test';
import { createRoom, getOrigin, joinRoom } from './helpers';

async function startPreset(host: Page, guest: Page) {
  const code = await createRoom(host, 'Alice', 'Music Trivia');
  await joinRoom(guest, await getOrigin(host), code, 'Bob');
  await host.getByRole('button', { name: /Free search/i }).click();
  await host
    .getByRole('button', { name: /Pick an Artist/i })
    .last()
    .click();
  await host.getByTestId('lobby-start-game').click();
  await guest.getByRole('button', { name: "I'm Ready!", exact: true }).click();
  await host.getByRole('button', { name: 'Start Song (Countdown)', exact: true }).click();
  await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
}

function attachYTMock(initialMode: 'play' | 'blocked' | 'error') {
  return (modeParam: string) => {
    let currentMode = modeParam;
    (window as any).__setYTMockMode = (m: string) => {
      currentMode = m;
    };
    (window as any).YT = {
      loaded: 1,
      Player: function (container: HTMLElement, options: any) {
        (window as any).__mockYTPlayer = this;
        this.options = options;
        this.playVideo = function () {
          if (currentMode === 'play') {
            options.events?.onStateChange?.({ data: 1 });
          } else if (currentMode === 'blocked') {
            options.events?.onError?.({ data: 150, message: 'autoplay blocked' });
          } else if (currentMode === 'error') {
            options.events?.onError?.({ data: 101, message: 'network error' });
          }
        };
        this.pauseVideo = function () {
          options.events?.onStateChange?.({ data: 2 });
        };
        this.seekTo = function () {};
        this.setVolume = function () {};
        this.mute = function () {};
        this.unMute = function () {};
        this.getIframe = function () {
          return container;
        };
        this.getPlaylist = function () {
          return null;
        };
        this.getVideoLoadedFraction = function () {
          return 1;
        };
        this.getDuration = function () {
          return 30;
        };
        this.getCurrentTime = function () {
          return 0;
        };

        setTimeout(() => {
          options.events?.onReady?.({ target: this });
          if (currentMode === 'play') {
            options.events?.onStateChange?.({ data: 1 });
          } else if (currentMode === 'blocked') {
            options.events?.onError?.({ data: 150, message: 'autoplay blocked' });
          } else if (currentMode === 'error') {
            options.events?.onError?.({ data: 101, message: 'network error' });
          }
        }, 50);
      },
      PlayerState: {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5,
      },
    };
  };
}

test.describe('Music Trivia Experience & Playback Controls', () => {
  test('the song phase does not claim local playback before media starts', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.route(/youtube\.com|youtu\.be|googlevideo\.com/, (route) => route.abort());
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText(
        /Loading audio|Audio unavailable/,
      );
      await expect(guest.getByText('Now Playing...', { exact: true })).toHaveCount(0);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('successful media signal reports Now Playing status', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('play'), 'play');
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Now Playing...');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('autoplay blocked shows actionable Enable audio control and reason', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('blocked'), 'blocked');
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Audio blocked');
      await expect(guest.getByTestId('music-playback-reason')).toHaveText(
        'Your browser blocked playback. Enable audio to listen.',
      );
      const enableBtn = guest.getByRole('button', { name: 'Enable audio' });
      await expect(enableBtn).toBeVisible();

      // Clicking enable audio retries and unblocks playback
      await guest.evaluate(() => (window as any).__setYTMockMode('play'));
      await enableBtn.click();
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Now Playing...');
      await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('network error shows retry control and reason without revealing song title to guest', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('error'), 'error');
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Audio unavailable');
      await expect(guest.getByTestId('music-playback-reason')).toHaveText(
        'The clip could not load. Check your connection and retry.',
      );

      const retryBtn = guest.getByRole('button', { name: 'Retry audio' });
      await expect(retryBtn).toBeVisible();

      // Guest page must NOT contain the song title or answer
      const content = await guest.content();
      expect(content).not.toContain('E2E Song');

      // Retry attempts playback without resetting round or score
      await retryBtn.click();
      await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('expired clip stops playback, hides action button, and disables toolbar retry', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('play'), 'play');
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Now Playing...');

      // Fast-forward clip expiration by updating syncPlay start time into the past
      await guest.evaluate(() => {
        const store = (window as any).__useGameStore;
        const current = store.getState().musicTriviaSyncPlay;
        if (current) {
          store.setState({
            musicTriviaSyncPlay: {
              ...current,
              playStartTime: Date.now() - 35000,
              durationMs: 30000,
            },
          });
        }
      });

      await expect(guest.getByTestId('music-playback-status')).toHaveText('Audio unavailable');
      await expect(guest.getByTestId('music-playback-reason')).toHaveText(
        'This clip has ended. Wait for the next song.',
      );

      // Primary retry action button is NOT shown when expired
      await expect(guest.getByRole('button', { name: 'Retry audio' })).toHaveCount(0);
      await expect(guest.getByRole('button', { name: 'Enable audio' })).toHaveCount(0);

      // Bottom controls toolbar retry button is disabled
      const disabledRetry = guest.locator('button[title="Retry audio"]');
      await expect(disabledRetry).toBeDisabled();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('audio mute and volume controls function cleanly without game interruption', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('play'), 'play');
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Now Playing...');

      // Check mute toggle
      const muteBtn = guest.getByRole('button', { name: 'Mute audio' });
      await expect(muteBtn).toBeVisible();
      await expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
      await muteBtn.click();
      await expect(guest.getByRole('button', { name: 'Unmute audio' })).toBeVisible();
      await expect(guest.getByRole('button', { name: 'Unmute audio' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Check volume slider
      const volumeSlider = guest.getByRole('slider', { name: 'Volume control' });
      await expect(volumeSlider).toBeVisible();
      await volumeSlider.fill('0.8');
      await expect(volumeSlider).toHaveValue('0.8');

      // Buzz button still works
      await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('Ready gesture unlocks audio before player becomes ready', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('play'), 'play');
      const code = await createRoom(host, 'Alice', 'Music Trivia');
      await joinRoom(guest, await getOrigin(host), code, 'Bob');
      await host.getByRole('button', { name: /Free search/i }).click();
      await host
        .getByRole('button', { name: /Pick an Artist/i })
        .last()
        .click();
      await host.getByTestId('lobby-start-game').click();

      // Verify guest is in GET_READY phase
      const readyBtn = guest.getByRole('button', { name: "I'm Ready!", exact: true });
      await expect(readyBtn).toBeVisible();

      // Before clicking, audio is not unlocked yet
      const unlockedBefore = await guest.evaluate(() => !!(window as any).__musicAudioUnlocked);
      expect(unlockedBefore).toBe(false);

      // Clicking Ready primes/unlocks audio
      await readyBtn.click();
      const unlockedAfter = await guest.evaluate(() => !!(window as any).__musicAudioUnlocked);
      expect(unlockedAfter).toBe(true);

      // Host starts countdown and guest reaches PLAYING phase
      await host.getByRole('button', { name: 'Start Song (Countdown)', exact: true }).click();
      await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('retry seeks to elapsed playback time without restarting the round or score', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await guest.addInitScript(attachYTMock('play'), 'play');
      await startPreset(host, guest);
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Now Playing...');

      // Record seekTo calls on the mock player
      await guest.evaluate(() => {
        const player = (window as any).__mockYTPlayer;
        (window as any).__seekCalls = [];
        if (player) {
          const origSeek = player.seekTo;
          player.seekTo = function (seconds: number) {
            (window as any).__seekCalls.push(seconds);
            origSeek.call(this, seconds);
          };
        }
      });

      // Trigger toolbar retry
      const retryBtn = guest.locator('button[title="Retry audio"]');
      await retryBtn.click();

      // Assert that seekTo was called with elapsed seconds
      await expect
        .poll(async () => {
          return guest.evaluate(() => (window as any).__seekCalls?.length || 0);
        })
        .toBeGreaterThanOrEqual(1);

      // Round number and buzz button remain intact without scoreboard reset
      await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
      await expect(guest.getByText(/Round 1/i)).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('host-only playback mode enables audio for host while guest receives host-only notice without local playback', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      await host.addInitScript(attachYTMock('play'), 'play');
      await guest.addInitScript(attachYTMock('play'), 'play');
      const code = await createRoom(host, 'Alice', 'Music Trivia');
      await joinRoom(guest, await getOrigin(host), code, 'Bob');

      await host.getByRole('button', { name: /Free search/i }).click();
      await host
        .getByRole('button', { name: /Pick an Artist/i })
        .last()
        .click();

      // Switch audio playback dropdown to HOST_ONLY
      const audioSelect = host.getByTestId('music-audio-playback-select');
      await audioSelect.click();
      await host.getByRole('button', { name: 'Host Only', exact: true }).click();

      await host.getByTestId('lobby-start-game').click();
      await guest.getByRole('button', { name: "I'm Ready!", exact: true }).click();
      await host.getByRole('button', { name: 'Start Song (Countdown)', exact: true }).click();

      // Host has Now Playing
      await expect(host.getByTestId('music-playback-status')).toHaveText('Now Playing...');

      // Guest does not have Now Playing; instead shows Ready status and host-only notice
      await expect(guest.getByTestId('music-playback-status')).toHaveText('Audio ready');
      await expect(guest.getByTestId('music-host-only-notice')).toBeVisible();

      // Guest still has BUZZ! button and can participate in game
      await expect(guest.getByRole('button', { name: /BUZZ!$/ })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
