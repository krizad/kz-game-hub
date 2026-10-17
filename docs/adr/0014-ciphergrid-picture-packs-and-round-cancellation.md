# 0014. Ciphergrid picture packs and host round cancellation

Status: Accepted
Date: 2026-10-17
Supersedes: artwork and fixture descriptions in ADR 0013; supplements its round lifecycle policy.

## Context

ADR 0013 described development geometry while artwork was deferred. The working implementation now includes two static WebP packs: Classic (20 pictures) and Minimal (60 pictures), each with thumbnails, bilingual descriptions, and a provenance manifest. The host also needs a way to abandon a board when an image remains unavailable after retry.

## Decision

- Keep the Words/Pictures modes and private keycard boundaries of ADR 0013.
- The host selects Classic or Minimal in the lobby; Minimal is the default. A Pictures round always uses 20 unique cards from the selected pack. The shared catalog and each pack's manifest must agree, and `check:cipher-grid-pictures` verifies file integrity and image budgets.
- These packs are no longer flagged as development fixtures. Integrity checks validate assets mechanically; they do not replace visual review or playtesting of image associations.
- During clue giving or decoding, the host may confirm cancellation of the current round. The server validates host ownership, live phase, game identity, and the requested round number. Cancellation returns to team setup without awarding points or recording a result.
- Cancellation preserves teams, Leads, mode, picture pack, round counter, and accumulated scores. It clears the board, clues, history, pings, private keycards, and deadline. The gateway cancels the active turn timer. Starting again creates a new board and keycard.
- A stale or repeated cancellation request cannot cancel a later round. Other players and spectators cannot cancel.

## Consequences

Players can recover from asset-loading failures without scoring a broken round or closing the room. Cancel round is separate from reset to lobby, which retains its existing match-reset behavior. Artwork replacement remains a static catalog/asset operation and does not require game-state persistence.
