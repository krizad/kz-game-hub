# Private friends: first five implementation tasks

User authorized all five tasks on 2026-10-14. Baseline cb019bae. Execute serially, separate commits, regression tests and scoped review per task. No deployment, production database mutation or public-growth work is included.

## Global constraints

Keep existing React/Next/Zustand/Socket.io/Nest architecture and dependencies. Server authoritative, live rooms in memory, no new REST controllers. Roles/words/hands/private votes remain private. Update event constants/gateway/service/store together when event contracts change; rebuild shared types. Add new socket-ID fields to reconnect remapping. Native GameDialog handles modal focus trapping/restoration. TH/default and EN dictionaries/schema must agree. Music timerCommands/RoomTimerService convention stays intact.

The root .env points at production: never read/copy it into this worktree or use production DB. All DB test writes use DATABASE_URL and TEST_DATABASE_URL explicitly set to mysql://test:test@127.0.0.1:13306/kz_game_hub_test. Use scripts/test-isolated.mjs for browser tests (Web3100/API3101; no reuse unknown dev servers). API tests also set DATABASE_URL to that local URL. Temporary scripts belong to ignored tmp-script/. Run graphify query before codebase exploration when graph exists; graphify update . after changes.

Behavior defects require a meaningful failing regression before implementation. Record RED/GREEN commands/results in task reports. Verify browser interaction at 360x800, 390x844, 1280x900 and TH/EN where relevant. Run focused tests while iterating and a broader relevant suite before commit. Never pass an empty test selection. Do not modify unrelated pending tasks.

### Task 1: TASK-SH-006 — room visibility and spectator policy

Modify shared RoomConfig (packages/types/src/core.ts), games.gateway.ts, games.service.ts, useGameStore.ts, GameSettingsManager.tsx and dictionaries. Add visibility PUBLIC|UNLISTED and allowSpectators boolean. New rooms default UNLISTED/false. Legacy rooms with absent fields mean PUBLIC/true, preserving old sessions. getAvailableRooms exposes PUBLIC rooms only. Preserve code/invite JOIN_ROOM and existing per-game start/seat capacity rules. Source inspection found no generic JOIN_ROOM capacity limit; adding one belongs to deferred SH007, so do not invent new admission limits here. UNLISTED means omitted from catalog, not identity authentication.

SPECTATE_JOIN checks allowSpectators on the server and denies with reason SPECTATORS_DISABLED when false. Fresh late JOIN_ROOM that would become a viewer must follow the same policy, avoiding a code-join bypass; verify seated reconnect before this admission guard. Host alone can update policy via existing updateConfig, only in LOBBY. Seated moderator/player reconnects must remain allowed. Sharing a room link must never include the reconnect token.

Acceptance/regression: defaults and legacy fallback, public catalog filtering, host toggles/guest denied/non-lobby denied, spectator disabled/enabled, code joining unlisted and same-seat reconnect. Add meaningful API and browser tests using existing fixtures. Do not add quotas/rate limits, strict invite tokens, accounts or public matchmaking (SH007 deferred).

### Task 2: TASK-WA-001 — Who Am I host-input dialog

In LobbyStartButton move HOST_INPUT modal to existing GameDialog. Translate title/body/placeholder/Cancel/Start through schema/th/en. Store word draft keyed by stable player.id, building payload with each current socketId at submit. Required people are connected non-viewers excluding host. Preserve same person's draft across reconnect/socket remap; remove departed IDs so replacement players cannot satisfy input through old keys. Follow existing submitWordsWhoAmI/startGameHostInput contract; add minimal server boundary validation if necessary to prevent stale/invalid required assignments.

Acceptance: Thai modal has no hardcoded Set Words/Cancel/Start; Escape closes, Tab traps, focus restores; reconnect preserves draft and submits current socket key; leave/join cannot reuse stale keys. Add apps/web/e2e/who-am-i-experience.spec.ts and API tests for changed boundary behavior. Do not implement WA002/WA003 broader generation, guess draft or recap.

### Task 3: TASK-TT-001 — Tic-Tac-Toe keyboard controls

Cover Classic, Gobbler and Ultimate views under TIC_TAC_TOE (mode services, never new GameTypes). Gobbler inventory div onClick becomes button type=button, aria-pressed tracks selection, localized size/side name. Name each cell with row/column/owner and disabled reason via dictionaries, keeping current move handlers/rules. Ultimate names must distinguish the outer board and inner cell.

Acceptance: Tab then Enter selects inventory then plays a legal cell; empty cell names are distinct; non-turn players and viewers cannot act. Add apps/web/e2e/tic-tac-toe-experience.spec.ts. Validate existing tictactoe-modes and API tic-tac-toe/gobbler/ultimate-tic-tac-toe tests as needed. No TT002 board preview or TT003 rematch work.

### Task 4: TASK-DC-001 — Detective Club inspect/play controls

In PlayingPhase replace clickable overlay div with native separate inspect and play/confirm controls. Inspect opens CardViewerModal; play selects a card then confirms. Zoom control is visible on touch without hover. CardViewerModal and confirmation use GameDialog. Preserve existing Escape handling and add focus trap/restoration without underlying actions firing while modal open. Translate additions in schema/th/en.

Acceptance: touch without hover can inspect/play; keyboard can play; Escape closes and restores focus; Tab cannot reach background actions. Add apps/web/e2e/detective-club-experience.spec.ts and changed backend tests only if applicable. No DC002 whole setup mobile redesign or DC003 score recap.

### Task 5: TASK-MT-001 — Music local playback status

Create apps/web/src/hooks/useMusicPlayback.ts, integrate MusicTriviaView. MusicPlaybackStatus = loading|ready|playing|blocked|error. Return status, retry, muted and volume controls. Safe inputs: MusicTriviaSyncPlayPayload, phase, enabled and optional server offset default 0. Do not accept song title/artist in the hook or guest errors. Existing sync timestamps/seek/reconnect must keep working; do not wait for future SH001 clock service.

Map HTMLAudio play rejection/autoplay denial, error/404 and ReactPlayer onError to local status and reason AUTOPLAY_BLOCKED|NETWORK_OR_PROVIDER|EXPIRED_CLIP. UI cannot report Now Playing merely from server phase; use actual successful media signal. Show Enable audio or Retry with translated reason. Retry must not reset score/round or restart an expired clip. Preserve role privacy and music-reconnect.spec.ts.

Acceptance: deterministic mocked autoplay rejection, 404/network and embedded provider error show actionable controls, never false playing or guest answer/title leak; successful playback reports playing; retry does not reset game; expired clip remains stopped. Add apps/web/e2e/music-trivia-experience.spec.ts using local seeded E2E Artist/preset and media mocks. No live provider/iOS certification claim or MT002/MT003 scope expansion.
