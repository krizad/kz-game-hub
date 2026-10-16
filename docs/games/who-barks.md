# หมาตัวไหน — Who Barks

A face-to-face acting relay for 5–9 players, each using their own phone. `DOG_RELAY` is its internal game identity; localized display names are หมาตัวไหน / Who Barks.

## Play

1. Host arranges the app's seat order to match the physical circle before starting.
2. Everyone privately reads their role. There is one public Leader, one hidden troublemaker and the remaining good dogs. Room host and Leader may be different people.
3. Leader sees two character cards labelled suspect and victim, then silently acts a scene to the next player. Other future viewers close their eyes. The viewer confirms they have watched, then repeats the scene to the next person. Players who finished acting may watch. The app cannot enforce physical eye-closing.
4. The last player tells the story aloud and selects suspect and victim from ten candidates. Correct characters in the correct positions immediately win for good.
5. A wrong answer opens a two-minute discussion. Host can end it early; a three-second countdown precedes voting. Every active player votes secretly for someone other than themselves or the known Leader. Ballots reveal together. Good wins only if the troublemaker alone has the highest vote count; every other outcome, including a tie, wins for the troublemaker.
6. Results reveal the true pair, roles and ballots. Optional performance awards do not affect winners. Host can start another round or return to the lobby.

An active player's network loss pauses the round and remaining phase time for up to 120 seconds from server disconnect detection. Returning with the same session restores the seat and private data. Leaving or grace expiry cancels a live round without a winner; spectators do not interrupt play. Explicitly leaving as room host retains the hub's standard room-closing behavior.

### Roles and goals

- **หมานำเรื่อง / Lead Dog:** knows the true suspect and victim and creates the first silent scene. Belongs to the good team; wins when the pair is restored or the Mischief Dog receives the unique highest vote total.
- **หมาป่วน / Mischief Dog:** secretly distorts the scene. Wins after the pair guess fails and the vote does not uniquely identify them; a tied highest total also favors this role.
- **หมาฝ่ายดี / Loyal Dog:** faithfully passes the scene and helps identify the pair or catch the Mischief Dog. Shares the Lead Dog's win conditions.

### First actor selection

The host chooses **Random each round** (default) or **Take turns in seat order** in the lobby. Rotation starts at the first arranged seat and advances each time a round starts, including after returning to the lobby or cancelling a round. It wraps after the final seat. Reordering changes the next clockwise neighbor of the most recent Leader; if that person has left, start at the first remaining seat. The Lead Dog is separate from room ownership. Configuration is locked during play.

Completed rounds record winning participants with score 1/rank 1 and losing participants with score 0/rank 2. Spectators and cancelled rounds produce no results. Leaderboard persistence failures do not invalidate the in-room outcome.

## Characters and artwork

The playable text catalog contains **#001–#030**, with distinct Thai/English names and recognition cues. See [the card catalog and individual generation prompts](who-barks-cards.md).

Use **View cards (30)** in the lobby, rules or active game to open the full numbered catalog. It shows static characters without selecting cards or revealing the case's true pair. Close the dialog or press Escape to return to the previous screen.

Use the user-supplied base at `apps/web/public/images/who-barks/base/dog-base.png`: the golden dog with floppy ears, blue collar and gold bell. This reference supersedes the earlier base brief. Attach that same original directly for every character variant. Every `generationPrompt` locks the seated pose, expression, body-part positions, character scale and framing to the base. Vary only costume overlays and stationary props on the ground beside the dog. The dog never holds or uses the props. Card numbers and translated names are rendered by the UI, not inside generated images. Add a card's optional `imageSrc` only when its artwork is ready; text remains the fallback.

All 30 character images were generated with Google's `gemini-3.1-flash-image` model and are registered in the card catalog. Images live in `apps/web/public/images/who-barks/cards/`; the asset manifest records their paths, model and SHA-256 hashes. The individual prompt files remain available for future variants. No image generation, API key or runtime image API is needed to play.

## Implementation boundaries

- Shared rules/content: `packages/types/src/dog-relay.ts` and `dog-relay-cards.ts`.
- Socket action: `dog_relay_action`; authoritative public state: `room_state_updated`; per-player private projection: `private_state_updated.data.dogRelay`.
- Stable `UserState.id` identifies seats, roles and ballots; socket IDs are delivery addresses only. Reconnection remaps private-store keys and refreshes entitled projections.
- Server-only roles, true pair, candidate order and ballots stay in `PrivateStateService`'s room record until public reveal is allowed.
- RoomTimerService handles discussion/countdown deadlines; each callback checks current round, phase, deadline and pause state.
- Live state stays in memory. GameResult and GameSetting use the existing database models; no schema migration is required.

## App policies

Tie handling, private digital ballots and reconnect behavior follow the rules documented above. Character cards have Thai/English names and descriptions; their numbers identify characters independently of player roles.
