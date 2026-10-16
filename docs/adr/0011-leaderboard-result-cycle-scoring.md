# 0011. Leaderboard Result Cycle Scoring Contract

Status: Accepted
Date: 2026-10-16

## Context

`GamesGateway.maybeRecordGameResult` records rows to `LeaderboardService.recordGameResult` whenever a room enters `RoomStatus.RESULT`, and `LeaderboardService` aggregates `totalScore = SUM(score)`, `gamesPlayed = COUNT(*)`, and `wins = COUNT(rank = 1)`.

Several games (`RPS`, `TIC_TAC_TOE` modes, `SOUNDS_FISHY`, `WHO_KNOW`, `WHO_AM_I`, `WHO_FIRST`, `THE_MIND`, `COUP`, `CIPHER_GRID`) accumulate `player.score` on `room.players` across multiple `PLAYING -> RESULT` cycles within the same room, while others reset `player.score` only when returning to `LOBBY`. Recording raw `player.score` on each `RESULT` transition caused cumulative points from earlier rounds/matches to be summed multiple times.

## Decision

1. **Unit of recording (`Result Cycle`)**: Each valid transition of a room into `RoomStatus.RESULT` represents one completed result cycle (or one `roundId` in `DOG_RELAY`, which retains its dedicated `buildDogRelayResultRows` path).
2. **Cancelled/aborted transitions**: Forced transitions to `RoomStatus.RESULT` caused by player removal without a resolved outcome (`RPS` without `roundWinner`, `TIC_TAC_TOE`/`GOBBLER`/`ULTIMATE_TIC_TAC_TOE` without `winner`, `CARD_GAME` with empty `finishOrder`) are not completed result cycles and must not be recorded.
3. **Incremental score (`cycleScore`)**: For non-`DOG_RELAY` games, the gateway tracks a per-room baseline map keyed by stable player identity (`player.name`, which is enforced unique per room and matches `GameResult.playerName`, never volatile `socketId`). On each completed result cycle, `score = currentScore - baseline` (resetting `baseline` to `0` whenever `currentScore < baseline` or the room resets scores in `LOBBY`), and updates the player's baseline to `currentScore`.
4. **Rank & Draw semantics**: Players are ordered by `cycleScore` descending with standard competition ranking (`1, 1, 3`). If `topScore <= 0` (a draw or zero-point cycle), all participants receive `rank = 2` so `rank = 1` strictly represents a cycle win.
5. **Deduplication & cleanup**: Result-cycle deduplication uses a `socketId`-independent cycle signature cleared when the room leaves `RoomStatus.RESULT`, and all per-room tracking maps are cleaned up when the room is deleted.
