/**
 * Scrape a Music Trivia artist preset catalog from YouTube into the DB.
 *
 * Usage:
 *   pnpm -F api db:scrape-artist -- "Artist One" "Artist Two"
 *   pnpm -F api db:scrape-artist -- --file artists.txt   (one name per line)
 *
 * Pipeline per artist (ADR 0007):
 *   1. Web-search YouTube with a few query variants (~200 candidate videos)
 *   2. Normalize song titles and dedupe — highest-view video wins, official
 *      channel ("Artist - Topic" / verified artist) breaks ties
 *   3. Fetch getBasicInfo per surviving video for the exact view count and
 *      release year (search snippets only carry rounded views + "x years ago")
 *   4. Upsert up to MAX_TRACKS_PER_ARTIST tracks into ArtistTrack
 *
 * Re-running the script for the same artist refreshes view snapshots (upsert).
 * Level thresholds here are informational (summary log); the API applies the
 * same bands at game time — keep the two in sync.
 */

import { prisma } from '@repo/database';
import type { Innertube, YTNodes } from 'youtubei.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MAX_TRACKS_PER_ARTIST = 150;
const MIN_DURATION_S = 60;
const MAX_DURATION_S = 600; // 10 min — drops mixes/full albums like the adapter
const BASIC_INFO_DELAY_MS = 150;

// Must match the bands the game service applies (music-trivia-levels.ts).
const EASY_MIN_VIEWS = 50_000_000;
const MEDIUM_MIN_VIEWS = 5_000_000;

const NOISE_PATTERNS = [
  /\((?:[^)]*)\)/g, // (...) parentheticals
  /\[(?:[^\]]*)\]/g, // [...] brackets
  /【(?:[^】]*)】/g,
  /official\s*(?:mv|music\s*video|audio|video|visualizer)/gi,
  /music\s*video/gi,
  /lyrics?\s*(?:video)?/gi,
  /visualizer/gi,
  /color\s*coded/gi,
  /\bmv\b/gi,
  /\bm\/v\b/gi,
  /\baudio\b/gi,
  /\b4k\b/gi,
  /\bhd\b/gi,
  /remaster(?:ed)?/gi,
  /\beng\s*sub\b/gi,
  /\bsub\s*th\b/gi,
];

function normalizeTitle(raw: string): string {
  let s = raw.toLowerCase();
  for (const pattern of NOISE_PATTERNS) {
    s = s.replace(pattern, ' ');
  }
  return s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse "1,234,567 views" / "1.2M views" / "No views" into a number. */
function parseViewCount(text: string | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function isOfficialChannel(authorName: string | undefined, isVerifiedArtist: boolean): boolean {
  return isVerifiedArtist || (!!authorName && authorName.trim().endsWith(' - Topic'));
}

function levelOf(viewCount: number): 'easy' | 'medium' | 'hard' {
  if (viewCount >= EASY_MIN_VIEWS) return 'easy';
  if (viewCount >= MEDIUM_MIN_VIEWS) return 'medium';
  return 'hard';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getInnertube(): Promise<Innertube> {
  const { Innertube } = await import('youtubei.js');
  return Innertube.create();
}

interface Candidate {
  videoId: string;
  title: string;
  channelName: string;
  viewCount: number;
  durationMs: number;
  thumbnailUrl: string | null;
  official: boolean;
}

async function searchCandidates(yt: Innertube, artist: string): Promise<Candidate[]> {
  const queries = [`${artist} songs`, `${artist} mv`, artist];
  const candidates = new Map<string, Candidate>();

  for (const query of queries) {
    try {
      const search = await yt.search(query, { type: 'video' });
      const videos = search.results.filter((r): r is YTNodes.Video => r.type === 'Video');
      for (const video of videos) {
        const seconds = video.duration?.seconds;
        if (seconds && (seconds < MIN_DURATION_S || seconds > MAX_DURATION_S)) continue;

        const videoId = video.video_id;
        if (!videoId) continue;

        const official = isOfficialChannel(video.author?.name, video.author?.is_verified_artist);
        const candidate: Candidate = {
          videoId,
          title: video.title?.toString() || 'Unknown Title',
          channelName: video.author?.name || 'Unknown Artist',
          viewCount: parseViewCount(video.view_count?.toString()),
          durationMs: seconds ? seconds * 1000 : 180_000,
          thumbnailUrl: video.best_thumbnail?.url ?? video.thumbnails?.[0]?.url ?? null,
          official,
        };

        const existing = candidates.get(videoId);
        if (!existing || (candidate.viewCount > existing.viewCount && official)) {
          candidates.set(videoId, candidate);
        }
      }
    } catch (error) {
      console.warn(`[scrape] search failed for "${query}" — continuing:`, error);
    }
  }

  return [...candidates.values()];
}

/** Dedupe by normalized title: best (most views, official tiebreak) video per song. */
function dedupeByTitle(candidates: Candidate[]): Candidate[] {
  const bySong = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = normalizeTitle(candidate.title);
    if (!key) continue;
    const incumbent = bySong.get(key);
    const better =
      !incumbent ||
      candidate.viewCount > incumbent.viewCount ||
      (candidate.viewCount === incumbent.viewCount && candidate.official && !incumbent.official);
    if (better) bySong.set(key, candidate);
  }
  return [...bySong.values()].sort((a, b) => b.viewCount - a.viewCount);
}

async function scrapeArtist(yt: Innertube, artist: string): Promise<void> {
  console.log(`\n[scrape] === ${artist} ===`);

  const artistRow = await prisma.artistPreset.upsert({
    where: { name: artist },
    update: {},
    create: { name: artist },
  });

  const candidates = await searchCandidates(yt, artist);
  console.log(`[scrape] ${candidates.length} unique videos from search`);
  const shortlist = dedupeByTitle(candidates).slice(0, MAX_TRACKS_PER_ARTIST);
  console.log(`[scrape] ${shortlist.length} songs after dedupe (shortlist)`);

  let stored = 0;
  const levelCounts = { easy: 0, medium: 0, hard: 0 };

  for (const candidate of shortlist) {
    let title = candidate.title;
    let viewCount = candidate.viewCount;
    let releaseYear: number | null = null;
    let durationMs = candidate.durationMs;
    let thumbnailUrl = candidate.thumbnailUrl;

    // Exact snapshot per video — search snippets only carry rounded values.
    try {
      await sleep(BASIC_INFO_DELAY_MS);
      const info = await yt.getBasicInfo(candidate.videoId);
      const basic = info.basic_info;
      if (typeof basic.view_count === 'number') viewCount = basic.view_count;
      if (basic.start_timestamp) {
        releaseYear = new Date(basic.start_timestamp).getFullYear();
      } else if (typeof basic.duration === 'number') {
        // No date available — leave releaseYear empty rather than guessing.
        releaseYear = null;
      }
      if (typeof basic.duration === 'number' && basic.duration > 0) {
        durationMs = basic.duration * 1000;
      }
      thumbnailUrl = info.basic_info.thumbnail?.[0]?.url ?? thumbnailUrl;
      if (basic.title) title = basic.title;
    } catch (error) {
      console.warn(
        `[scrape] basic info failed for ${candidate.videoId} (${candidate.title}) — keeping search-level data:`,
        error instanceof Error ? error.message : error,
      );
    }

    if (viewCount <= 0 && !releaseYear) {
      // Unplayable or dead video — skip it.
      continue;
    }

    await prisma.artistTrack.upsert({
      where: { videoId: candidate.videoId },
      update: {
        title,
        normalizedTitle: normalizeTitle(title),
        viewCount,
        releaseYear,
        durationMs,
        thumbnailUrl,
        scrapedAt: new Date(),
      },
      create: {
        artistId: artistRow.id,
        videoId: candidate.videoId,
        title,
        normalizedTitle: normalizeTitle(title),
        viewCount,
        releaseYear,
        durationMs,
        thumbnailUrl,
      },
    });

    levelCounts[levelOf(viewCount)] += 1;
    stored += 1;
    if (stored % 25 === 0) console.log(`[scrape] ${stored}/${shortlist.length} stored...`);
  }

  // The dedupe winner per song may have changed on refresh — drop rows whose
  // video no longer belongs to this artist's stored set.
  const keepVideoIds = new Set(shortlist.map((c) => c.videoId));
  const stale = await prisma.artistTrack.findMany({
    where: { artistId: artistRow.id },
    select: { id: true, videoId: true },
  });
  const staleIds = stale.filter((t) => !keepVideoIds.has(t.videoId)).map((t) => t.id);
  if (staleIds.length > 0) {
    await prisma.artistTrack.deleteMany({ where: { id: { in: staleIds } } });
  }

  console.log(
    `[scrape] ${artist}: stored ${stored} tracks — ` +
      `easy ${levelCounts.easy} · medium ${levelCounts.medium} · hard ${levelCounts.hard} ` +
      `(removed ${staleIds.length} stale rows)`,
  );
}

async function importSongs(yt: Innertube, csvPath: string): Promise<void> {
  interface SongRow {
    artist: string;
    song: string;
    year: number | null;
  }
  const lines = readFileSync(csvPath, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parseCsvLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const ai = header.indexOf('artist');
  const si = header.indexOf('song_name');
  const yi = header.indexOf('release_year');
  if (ai === -1 || si === -1) {
    throw new Error('CSV needs at least "artist" and "song_name" columns');
  }

  const rows: SongRow[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const artist = cells[ai];
    const song = cells[si];
    if (!artist || !song) continue;
    const key = `${artist.toLowerCase()}::${normalizeTitle(song)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rawYear = yi !== -1 ? parseInt(cells[yi], 10) : NaN;
    rows.push({ artist, song, year: Number.isFinite(rawYear) ? rawYear : null });
  }
  console.log(`[import] ${rows.length} unique songs from ${csvPath}`);

  // Resolve each artist row once; keep artist ids for the upserts below.
  const artistIds = new Map<string, string>();
  let stored = 0;
  let failed = 0;

  for (const [index, row] of rows.entries()) {
    try {
      let artistId = artistIds.get(row.artist);
      if (!artistId) {
        const artistRow = await prisma.artistPreset.upsert({
          where: { name: row.artist },
          update: {},
          create: { name: row.artist },
        });
        artistId = artistRow.id;
        artistIds.set(row.artist, artistId);
      }

      const query = `${row.artist} ${row.song}`;
      const search = await yt.search(query, { type: 'video' });
      const videos = search.results.filter((r): r is YTNodes.Video => r.type === 'Video');

      // Prefer a video whose title actually matches the song, then views.
      const target = normalizeTitle(row.song);
      const playable = videos.filter((v) => {
        const seconds = v.duration?.seconds;
        return !seconds || (seconds >= 45 && seconds <= MAX_DURATION_S);
      });
      const scored = playable
        .map((v) => ({
          v,
          views: parseViewCount(v.view_count?.toString()),
          match: normalizeTitle(v.title?.toString() || '').includes(target) ? 1 : 0,
        }))
        .sort((a, b) => b.match - a.match || b.views - a.views);

      const best = scored[0];
      if (!best || !best.v.video_id) {
        failed += 1;
        console.warn(`[import] no match: ${query}`);
        continue;
      }

      let viewCount = best.views;
      let durationMs = best.v.duration?.seconds ? best.v.duration.seconds * 1000 : 180_000;
      try {
        await sleep(BASIC_INFO_DELAY_MS);
        const info = await yt.getBasicInfo(best.v.video_id);
        if (typeof info.basic_info.view_count === 'number') viewCount = info.basic_info.view_count;
        if (typeof info.basic_info.duration === 'number' && info.basic_info.duration > 0) {
          durationMs = info.basic_info.duration * 1000;
        }
      } catch {
        // Keep search-level values — views may be rounded but still usable.
      }

      if (viewCount <= 0) {
        failed += 1;
        console.warn(`[import] unplayable (0 views): ${query}`);
        continue;
      }

      const thumbnail = best.v.best_thumbnail?.url ?? best.v.thumbnails?.[0]?.url ?? null;
      await prisma.artistTrack.upsert({
        where: { videoId: best.v.video_id },
        update: {
          viewCount,
          releaseYear: row.year,
          durationMs,
          thumbnailUrl: thumbnail,
          scrapedAt: new Date(),
        },
        create: {
          artistId,
          videoId: best.v.video_id,
          title: row.song,
          normalizedTitle: normalizeTitle(row.song),
          viewCount,
          releaseYear: row.year,
          durationMs,
          thumbnailUrl: thumbnail,
        },
      });

      stored += 1;
      if (stored % 25 === 0) console.log(`[import] ${stored}/${rows.length} stored...`);
    } catch (error) {
      failed += 1;
      console.warn(`[import] failed for "${row.artist} — ${row.song}":`, error);
    }
  }

  console.log(`\n[import] Done: ${stored} stored, ${failed} skipped/failed out of ${rows.length}.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const names: string[] = [];

  const songsIndex = args.indexOf('--songs');
  if (songsIndex !== -1 && args[songsIndex + 1]) {
    const csvPath = resolve(process.cwd(), args[songsIndex + 1]);
    if (!existsSync(csvPath)) {
      console.error(`File not found: ${csvPath}`);
      process.exit(1);
    }
    const yt = await getInnertube();
    await importSongs(yt, csvPath);
    await prisma.$disconnect();
    return;
  }

  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    const filePath = resolve(process.cwd(), args[fileIndex + 1]);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    names.push(
      ...readFileSync(filePath, 'utf-8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#')),
    );
  }

  for (const arg of args) {
    if (arg !== '--file' && arg !== args[fileIndex + 1] && arg.trim()) names.push(arg.trim());
  }

  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 0) {
    console.error(
      'Usage: pnpm -F api db:scrape-artist -- "Artist" [...] | --file artists.txt | --songs songs.csv',
    );
    process.exit(1);
  }

  console.log(`[scrape] Artists: ${uniqueNames.join(', ')}`);
  const yt = await getInnertube();

  for (const name of uniqueNames) {
    try {
      await scrapeArtist(yt, name);
    } catch (error) {
      console.error(`[scrape] FAILED for ${name}:`, error);
    }
  }

  console.log('\n[scrape] Done.');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[scrape] Fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
