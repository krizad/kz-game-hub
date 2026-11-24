import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AdminVerifyKeyPayload, DeleteArtistPayload, GetArtistPresetsPayload, SetArtistEnabledPayload, SetGameEnabledPayload } from '@repo/types';
import { GamesService } from '../games.service';
import { GameSettingsService } from '../game-settings.service';
import { ArtistPresetService } from '../artist-preset.service';
export interface AdminGatewayContext {
    server: Server;
    logger: Logger;
    gamesService: GamesService;
    gameSettingsService: GameSettingsService;
    artistPresetService: ArtistPresetService;
}
export declare function verifyGatewayAdminKey(ctx: AdminGatewayContext, adminKey: unknown): boolean;
export declare function listGatewayArtistPresets(ctx: AdminGatewayContext, includeDisabled: boolean): Promise<import("@repo/types").ArtistPresetSummary[]>;
export declare function broadcastGatewayArtistPresets(ctx: AdminGatewayContext): Promise<void>;
export declare function handleSetGameEnabledHelper(ctx: AdminGatewayContext, data: SetGameEnabledPayload, client: Socket): Promise<void>;
export declare function handleAdminVerifyKeyHelper(ctx: AdminGatewayContext, data: AdminVerifyKeyPayload, client: Socket): void;
export declare function handleGetArtistPresetsHelper(ctx: AdminGatewayContext, data: GetArtistPresetsPayload | undefined, client: Socket): Promise<void>;
export declare function handleSetArtistEnabledHelper(ctx: AdminGatewayContext, data: SetArtistEnabledPayload, client: Socket): Promise<void>;
export declare function handleDeleteArtistHelper(ctx: AdminGatewayContext, data: DeleteArtistPayload, client: Socket): Promise<void>;
