# Task 5 — MT001 implementation report

Task: `TASK-MT-001 — Music local playback status`

## Implemented

- Created `apps/web/src/hooks/useMusicPlayback.ts` providing local-only media playback state:
  - Status transitions across `loading`, `ready`, `playing`, `blocked`, and `error`.
  - Reasons mapped to `AUTOPLAY_BLOCKED`, `NETWORK_OR_PROVIDER`, and `EXPIRED_CLIP`.
  - Strict input safety: hook consumes `MusicTriviaSyncPlayPayload | null`, `phase`, `enabled`, and optional `serverOffsetMs` (default 0). No song title, artist, or answer is accepted by the hook or leaked to guest UI.
  - Media controls: `retry`, `paused`/`setPaused`, `muted`/`setMuted`, and `volume`/`setVolume`.
  - HTMLAudio lifecycle handling: audio seek on track change, `AbortError` ignored on interruption, `NotAllowedError` mapped to `AUTOPLAY_BLOCKED`, network/source failure to `NETWORK_OR_PROVIDER`, and `ended` event triggers `EXPIRED_CLIP`.
  - ReactPlayer lifecycle handling: provider playing signal, error code 150/autoplay to `AUTOPLAY_BLOCKED`, provider network errors to `NETWORK_OR_PROVIDER`, seek synchronization on ready/retry.
  - Stale callback prevention: audio error listeners, play rejection handlers, and ReactPlayer callbacks guard against stale attempts, expired clips, unmounted states, and phase changes outside `PLAYING`.
  - Expiry protection: timer and elapsed duration guard prevent playback restart on expired clips; retry does not reset round or score.
- Updated `MusicTriviaView.tsx`:
  - Displays localized status in `data-testid="music-playback-status"` (`Now Playing...`, `Loading audio...`, `Audio blocked`, `Audio unavailable`).
  - Displays localized reason in `data-testid="music-playback-reason"` alert banner.
  - Action button presents `Enable audio` when blocked or `Retry audio` when unavailable; hidden on expired clips.
  - Neobrutalism mute toggle with accessible `aria-label` (`muteAudio`/`unmuteAudio`) and `aria-pressed`.
  - Retry button in controls toolbar is disabled when clip is expired.
- Localized dictionaries in `apps/web/src/i18n/dictionaries/{schema,th,en}.ts` for statuses, reasons, and actions.

## TDD evidence

- RED: Interrupted run reported absent `music-playback-status` before hook integration. Pre-fix run reproduced failure when mock player was unconfigured (`Now Playing...` was false positive from premature play trigger).
- GREEN: `TEST_DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test DATABASE_URL=mysql://test:test@127.0.0.1:13306/kz_game_hub_test node scripts/test-isolated.mjs music-trivia-experience.spec.ts --workers=1 --reporter=line` -> 6 passed (1.7m).
  1. `the song phase does not claim local playback before media starts`
  2. `successful media signal reports Now Playing status`
  3. `autoplay blocked shows actionable Enable audio control and reason`
  4. `network error shows retry control and reason without revealing song title to guest`
  5. `expired clip stops playback, hides action button, and disables toolbar retry`
  6. `audio mute and volume controls function cleanly without game interruption`

## Verification

- Reconnect & privacy regression test: `node scripts/test-isolated.mjs music-reconnect.spec.ts --workers=1 --reporter=line` -> 1 passed (20.4s). Confirmed clip seek restoration, zero guest answer leakage, and host answer exclusivity.
- API tests: `pnpm -F api test -- --testPathPatterns=music-trivia --runInBand` -> 3 suites, 33 tests passed.
- Backend snapshot: `apps/api/`, `packages/types/`, `packages/database/` verified completely clean against `tmp-script/first-five-api-source-tree.txt`.
- Type checking: `pnpm -F web exec tsc --noEmit` passed with 0 errors.
- Linters: `pnpm -F web exec eslint src/components/games/music-trivia/MusicTriviaView.tsx src/hooks/useMusicPlayback.ts` passed (0 errors, 0 warnings).
- Formatting: `pnpm -F web exec prettier --check src/components/games/music-trivia/MusicTriviaView.tsx src/hooks/useMusicPlayback.ts src/i18n/dictionaries/schema.ts src/i18n/dictionaries/th.ts src/i18n/dictionaries/en.ts e2e/music-trivia-experience.spec.ts` passed.
- Git whitespace check: `git diff --check` clean.

## Files changed

- `apps/web/src/hooks/useMusicPlayback.ts` (new)
- `apps/web/src/components/games/music-trivia/MusicTriviaView.tsx`
- `apps/web/src/i18n/dictionaries/schema.ts`
- `apps/web/src/i18n/dictionaries/th.ts`
- `apps/web/src/i18n/dictionaries/en.ts`
- `apps/web/e2e/music-trivia-experience.spec.ts` (new)

## Self-review and concerns

- Guest answer privacy is strictly preserved: `musicTriviaSyncPlay` does not contain title/artist/answer; hook does not take title/artist; error states and alerts only display static localized strings without any dynamic track metadata.
- Reconnection restores same playback position via `playStartTime` calculation and seeking; reconnecting mid-round does not restart clip or advance rounds.
- Next.js route announcer element collision with `role="alert"` was resolved by adding unambiguous `data-testid="music-playback-reason"` to the alert element.
- Deterministic browser mocks certify web UI feedback and controls; live providers (iTunes/SoundCloud) and mobile Safari/iOS audio unlock require physical device validation outside mock scope.
