# 0013. Ciphergrid word and picture modes

Status: Accepted
Date: 2026-10-17

## Context

Ciphergrid needs a Pictures variant alongside its existing word board. Both variants share teams, roles, guessing, timers, and results. Actual picture artwork is deferred; the initial implementation uses explicitly marked development geometry fixtures.

## Decision

- Keep `GameType.CIPHER_GRID`. The host selects `RoomConfig.cipherGridMode` in the lobby; missing mode means `WORDS`.
- Snapshot the selected mode in game state. Words uses 25 cards (9/8 agents, 7 Decoys, 1 Virus); Pictures uses 20 cards (8/7 agents, 4 Decoys, 1 Virus). Both display five columns with stable indices.
- Public cards contain either a word or an allow-listed picture ID. The shared public catalog maps picture IDs to static images and bilingual descriptions. Picture descriptions, paths, and IDs are not forbidden clue words. Keycard assignments remain in private server state, sent only to the two Leads until reveal or round end.
- Replacing fixture artwork changes the catalog/assets and provenance manifest, not gameplay. Development fixtures are visibly identified and are not a final playable artwork pack.
- A challenge records a pending dispute, without changing the board, timer, or active team. Only that clue's giver may accept or reject it using its unique clue ID. Each clue can be challenged once. Acceptance ends the turn and reveals a random opponent card only when more than one remains; rejection leaves play running. A stale response has no effect.
- Temporary disconnect retains the seat during the shared reconnect grace. Permanent departure removes it. Losing a required Lead or the last Tracker cancels a live round back to team setup, clears secrets and timers, and awards no result or points. Losing an extra Tracker permits play to continue. A Tracker never becomes Lead on the same live board.

## Consequences

The server and renderer share board presets and discriminated card types. No new game identity, database model, or image service is needed. Asset integrity checks catch missing or duplicate pictures before shipment; artwork quality and image-association playtesting remain separate work after actual art is supplied. Online challenges rely on a table agreement rather than automatic semantic judging.
