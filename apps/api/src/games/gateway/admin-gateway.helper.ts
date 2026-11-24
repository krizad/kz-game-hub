import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  AdminKeyVerifiedPayload,
  AdminVerifyKeyPayload,
  DeleteArtistPayload,
  GetArtistPresetsPayload,
  SOCKET_EVENTS,
  SetArtistEnabledPayload,
  SetGameEnabledPayload,
} from '@repo/types';
import { GamesService } from '../games.service';
import { GameSettingsService } from '../game-settings.service';
import { ArtistPresetService } from '../artist-preset.service';
import { timingSafeSecretEqual } from '../../common/admin-auth.util';
import { isSettingsKey } from './payload-validator';

export interface AdminGatewayContext {
  server: Server;
  logger: Logger;
  gamesService: GamesService;
  gameSettingsService: GameSettingsService;
  artistPresetService: ArtistPresetService;
}

export function verifyGatewayAdminKey(ctx: AdminGatewayContext, adminKey: unknown): boolean {
  if (ctx.gamesService?.verifyAdminKey) {
    return ctx.gamesService.verifyAdminKey(adminKey);
  }
  return timingSafeSecretEqual(adminKey, process.env.ADMIN_SECRET);
}

export async function listGatewayArtistPresets(
  ctx: AdminGatewayContext,
  includeDisabled: boolean,
) {
  try {
    return await ctx.artistPresetService.listPresets(includeDisabled);
  } catch (error) {
    ctx.logger.error('Failed to list artist presets', error as Error);
    return [];
  }
}

export async function broadcastGatewayArtistPresets(ctx: AdminGatewayContext): Promise<void> {
  ctx.server.emit(
    SOCKET_EVENTS.ARTIST_PRESETS_UPDATED,
    await listGatewayArtistPresets(ctx, false),
  );
}

export async function handleSetGameEnabledHelper(
  ctx: AdminGatewayContext,
  data: SetGameEnabledPayload,
  client: Socket,
): Promise<void> {
  if (!verifyGatewayAdminKey(ctx, data?.adminKey)) {
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
    return;
  }
  if (!data || !isSettingsKey(data.gameType) || typeof data.enabled !== 'boolean') {
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
    return;
  }
  try {
    await ctx.gameSettingsService.setEnabled(data.gameType, data.enabled);
  } catch (error) {
    ctx.logger.error(`Failed to persist game setting for ${data.gameType}`, error as Error);
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update the game setting.' });
    return;
  }
  ctx.logger.log(`Game ${data.gameType} ${data.enabled ? 'enabled' : 'disabled'}`);
  ctx.server.emit(SOCKET_EVENTS.GAME_SETTINGS_UPDATED, ctx.gameSettingsService.snapshot());
  ctx.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, ctx.gamesService.getAvailableRooms());
}

export function handleAdminVerifyKeyHelper(
  ctx: AdminGatewayContext,
  data: AdminVerifyKeyPayload,
  client: Socket,
): void {
  const valid = verifyGatewayAdminKey(ctx, data?.adminKey);
  client.emit(SOCKET_EVENTS.ADMIN_KEY_VERIFIED, {
    valid,
  } satisfies AdminKeyVerifiedPayload);
}

export async function handleGetArtistPresetsHelper(
  ctx: AdminGatewayContext,
  data: GetArtistPresetsPayload | undefined,
  client: Socket,
): Promise<void> {
  const includeDisabled = verifyGatewayAdminKey(ctx, data?.adminKey);
  client.emit(
    SOCKET_EVENTS.ARTIST_PRESETS_LIST,
    await listGatewayArtistPresets(ctx, includeDisabled),
  );
}

export async function handleSetArtistEnabledHelper(
  ctx: AdminGatewayContext,
  data: SetArtistEnabledPayload,
  client: Socket,
): Promise<void> {
  if (!verifyGatewayAdminKey(ctx, data?.adminKey)) {
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
    return;
  }
  if (
    !data ||
    typeof data.artistId !== 'string' ||
    data.artistId.length > 64 ||
    typeof data.enabled !== 'boolean'
  ) {
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
    return;
  }
  try {
    await ctx.artistPresetService.setEnabled(data.artistId, data.enabled);
  } catch (error) {
    ctx.logger.error(`Failed to set artist preset ${data.artistId}`, error as Error);
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update the artist preset.' });
    return;
  }
  ctx.logger.log(`Artist preset ${data.artistId} ${data.enabled ? 'enabled' : 'disabled'}`);
  await broadcastGatewayArtistPresets(ctx);
}

export async function handleDeleteArtistHelper(
  ctx: AdminGatewayContext,
  data: DeleteArtistPayload,
  client: Socket,
): Promise<void> {
  if (!verifyGatewayAdminKey(ctx, data?.adminKey)) {
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
    return;
  }
  if (!data || typeof data.artistId !== 'string' || data.artistId.length > 64) {
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
    return;
  }
  try {
    await ctx.artistPresetService.deleteArtist(data.artistId);
  } catch (error) {
    ctx.logger.error(`Failed to delete artist preset ${data.artistId}`, error as Error);
    client.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete the artist preset.' });
    return;
  }
  ctx.logger.log(`Artist preset ${data.artistId} deleted`);
  await broadcastGatewayArtistPresets(ctx);
}
