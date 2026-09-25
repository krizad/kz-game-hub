# 0007. Music Trivia Artist Presets: YouTube-Scraped Catalog with Fixed View-Count Levels

Status: Accepted
Date: 2026-09

## Context

Music Trivia builds each match from a single live search: the host picks a source adapter and types a free-text query, and the server fetches whatever the source returns at game start. There is no notion of difficulty and no control over how well-known the songs are. A new "artist preset" feature wants: pick a curated artist, play their songs, with three difficulty levels split mainly by view count (and release year as supporting metadata).

Two facts from the source adapters drove the design:

- **Only YouTube can serve the feature as specced.** iTunes is the only adapter exposing a release year; none of the five adapters expose a view count today. YouTube's InnerTube layer has both — but search snippets only carry a rounded view string ("1.2M views") and a relative date ("3 years ago"). Exact integers and the true upload year require a per-video `getBasicInfo` call.
- **The existing system never persists music data.** Tracks live in `PrivateStateService` for the duration of a match; the DB holds only reference data.

## Decision

- **Scraped catalog, not live fetch.** An artist's songs are fetched once by an offline script (`pnpm db:scrape-artist`, `apps/api/scripts/scrape-artist.ts`) and stored as reference data in two new tables, `ArtistPreset` and `ArtistTrack`. The script searches YouTube (~200 candidates per artist), dedupes by normalized song title keeping the highest-view video (official channel as tiebreak), then calls `getBasicInfo` per survivor for the **exact view count and release year** before upserting up to 150 tracks. Re-running the script refreshes snapshots and prunes videos no longer in the shortlist.
- **Levels are fixed view-count bands computed at game time** from the stored snapshot: Easy ≥ 50M views, Medium 5–50M, Hard < 5M. No level is persisted on the track row, so thresholds can be retuned without rescraping. Release year is recorded and shown at reveal but does not affect a track's band.
- **YouTube-only.** Preset rooms force `sourceType: 'YOUTUBE'`; the free-search path keeps all five sources untouched.
- **Borrowing instead of blocking.** If the chosen level has fewer songs than the round count, tracks are borrowed from the nearest bands (chosen level plays first). A match never fails to start over a thin catalog.
- **Admin surface follows the `GameSetting` pattern**: `GET_ARTIST_PRESETS` / `ARTIST_PRESETS_LIST` / `ARTIST_PRESETS_UPDATED` / `SET_ARTIST_ENABLED` / `DELETE_ARTIST` socket events with `ADMIN_SECRET` re-validated per action. Enabling/disabling/deleting an artist affects only new room setup — a room that already selected the artist finishes its match from memory.

## Consequences

- View snapshots age: view counts drift upward between scrapes, so a track near a band edge can sit in the "wrong" level until refreshed. Accepted — the alternative (live counts at game start) reintroduces per-round YouTube traffic and InnerTube fragility.
- YouTube's ATV (topic-channel) video IDs occasionally restrict embedding; the catalog keeps whatever video won the dedupe. Dead videos are skipped at scrape time.
- Adding an artist is a CLI action, not an admin-UI action, by design: scraping takes minutes and is idempotent, while the admin panel handles curation (enable/disable/delete).
- The new tables are the first Music-Trivia-related DB models; `sync-schema.ts` pushes them to the shared MySQL instance like other reference data.
