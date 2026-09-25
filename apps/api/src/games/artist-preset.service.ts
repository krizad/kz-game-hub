import { Injectable, Logger } from '@nestjs/common';
import { ArtistPresetSummary } from '@repo/types';
import { prisma } from '@repo/database';
import { levelOfViewCount } from './music-trivia/music-trivia-levels';

/** One playable track from an artist preset's catalog (server-side only). */
export interface ArtistCatalogTrack {
  videoId: string;
  title: string;
  viewCount: number;
  releaseYear: number | null;
  durationMs: number;
  thumbnailUrl: string | null;
}

export interface ArtistCatalog {
  id: string;
  name: string;
  tracks: ArtistCatalogTrack[];
}

/**
 * Reference data for Music Trivia artist presets (ADR 0007): the artist list
 * and per-artist catalogs scraped from YouTube into the DB. Nothing here is
 * live game state — rooms read a catalog snapshot at game start and play from
 * memory afterwards, so disabling/deleting an artist never breaks a live match.
 */
@Injectable()
export class ArtistPresetService {
  private readonly logger = new Logger(ArtistPresetService.name);

  /**
   * Lobby/admin listing with per-level track counts. Enabled artists only,
   * unless includeDisabled (admin key holders) is set.
   */
  async listPresets(includeDisabled: boolean): Promise<ArtistPresetSummary[]> {
    const artists = await prisma.artistPreset.findMany({
      ...(includeDisabled ? {} : { where: { enabled: true } }),
      orderBy: { name: 'asc' },
      select: { id: true, name: true, enabled: true, tracks: { select: { viewCount: true } } },
    });

    return artists.map((artist) => {
      const trackCounts = { easy: 0, medium: 0, hard: 0, total: artist.tracks.length };
      for (const track of artist.tracks) {
        trackCounts[
          levelOfViewCount(track.viewCount).toLowerCase() as 'easy' | 'medium' | 'hard'
        ] += 1;
      }
      return {
        id: artist.id,
        name: artist.name,
        enabled: artist.enabled,
        trackCounts,
      };
    });
  }

  async setEnabled(artistId: string, enabled: boolean): Promise<void> {
    await prisma.artistPreset.update({
      where: { id: artistId },
      data: { enabled },
    });
  }

  /** Cascade-deletes the artist's catalog rows (FK onDelete: Cascade). */
  async deleteArtist(artistId: string): Promise<void> {
    await prisma.artistPreset.delete({
      where: { id: artistId },
    });
  }

  /** The playable catalog of one *enabled* artist; null when missing/disabled. */
  async getCatalog(artistId: string): Promise<ArtistCatalog | null> {
    const artist = await prisma.artistPreset.findUnique({
      where: { id: artistId },
      include: { tracks: { select: this.catalogTrackSelect() } },
    });
    if (!artist || !artist.enabled || artist.tracks.length === 0) return null;

    return {
      id: artist.id,
      name: artist.name,
      tracks: artist.tracks.map((track) => ({
        videoId: track.videoId,
        title: track.title,
        viewCount: track.viewCount,
        releaseYear: track.releaseYear,
        durationMs: track.durationMs,
        thumbnailUrl: track.thumbnailUrl,
      })),
    };
  }

  // Prisma's generated select shape isn't worth spelling out — a shared helper
  // keeps the include above readable.
  private catalogTrackSelect(): Record<string, true> {
    return {
      videoId: true,
      title: true,
      viewCount: true,
      releaseYear: true,
      durationMs: true,
      thumbnailUrl: true,
    };
  }
}
