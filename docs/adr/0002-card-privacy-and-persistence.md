# ADR 0002: Keep live card state private and in memory; persist only published rule configurations

- Status: Accepted
- Date: 2026-09-14

## Context

Existing rooms are server-authoritative and live in `GamesService`. Broadcast `RoomState` is visible to every socket in a room, while roles and other secrets are already emitted privately. Card games make hidden hands, stock order, and temporary target choices first-class secrets. The product also needs shareable Advanced Rules without introducing user accounts.

## Decision

- Keep every live deck, hand, stock order, private prompt, action log, chip balance, and match state in memory for the lifetime of the room only.
- Broadcast a redacted `CardGamePublicState`; send `CardGamePrivateState` only with `server.to(socketId).emit(...)` through the private-state path. Re-emit the entitled private state after reconnecting.
- Record an in-memory action log with redacted payloads for unauthorized viewers. Delete it when the room is deleted.
- Persist only an immutable, validated `CardRulePreset` document with an opaque share code and canonical configuration JSON. Any importer receives a room-local editable copy; edits never mutate the published document.
- Treat share-code possession as authorization to read/import. Do not add accounts, profiles, wallets, or cross-room chip balances in this feature.

## Consequences

- No private card identity can leak through `ROOM_STATE_UPDATED`, logs, spectator payloads, or reconnect flows.
- Database work is limited to rule configuration metadata; game play does not become persistent.
- Share codes must be high-entropy, rate-limited, and validated before storage and import.

## Alternatives considered

- **Broadcast all hands and hide them in the UI:** rejected because clients could inspect hidden cards.
- **Persist all game state:** rejected because it violates the existing in-memory game-state constraint and increases recovery/security scope.
- **Account-owned presets:** deferred because current rooms use temporary session identity and the agreed model is share-code plus copy-on-edit.

