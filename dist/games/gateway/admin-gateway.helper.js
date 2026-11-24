"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGatewayAdminKey = verifyGatewayAdminKey;
exports.listGatewayArtistPresets = listGatewayArtistPresets;
exports.broadcastGatewayArtistPresets = broadcastGatewayArtistPresets;
exports.handleSetGameEnabledHelper = handleSetGameEnabledHelper;
exports.handleAdminVerifyKeyHelper = handleAdminVerifyKeyHelper;
exports.handleGetArtistPresetsHelper = handleGetArtistPresetsHelper;
exports.handleSetArtistEnabledHelper = handleSetArtistEnabledHelper;
exports.handleDeleteArtistHelper = handleDeleteArtistHelper;
const types_1 = require("@repo/types");
const admin_auth_util_1 = require("../../common/admin-auth.util");
const payload_validator_1 = require("./payload-validator");
function verifyGatewayAdminKey(ctx, adminKey) {
    if (ctx.gamesService?.verifyAdminKey) {
        return ctx.gamesService.verifyAdminKey(adminKey);
    }
    return (0, admin_auth_util_1.timingSafeSecretEqual)(adminKey, process.env.ADMIN_SECRET);
}
async function listGatewayArtistPresets(ctx, includeDisabled) {
    try {
        return await ctx.artistPresetService.listPresets(includeDisabled);
    }
    catch (error) {
        ctx.logger.error('Failed to list artist presets', error);
        return [];
    }
}
async function broadcastGatewayArtistPresets(ctx) {
    ctx.server.emit(types_1.SOCKET_EVENTS.ARTIST_PRESETS_UPDATED, await listGatewayArtistPresets(ctx, false));
}
async function handleSetGameEnabledHelper(ctx, data, client) {
    if (!verifyGatewayAdminKey(ctx, data?.adminKey)) {
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
        return;
    }
    if (!data || !(0, payload_validator_1.isSettingsKey)(data.gameType) || typeof data.enabled !== 'boolean') {
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
        return;
    }
    try {
        await ctx.gameSettingsService.setEnabled(data.gameType, data.enabled);
    }
    catch (error) {
        ctx.logger.error(`Failed to persist game setting for ${data.gameType}`, error);
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Failed to update the game setting.' });
        return;
    }
    ctx.logger.log(`Game ${data.gameType} ${data.enabled ? 'enabled' : 'disabled'}`);
    ctx.server.emit(types_1.SOCKET_EVENTS.GAME_SETTINGS_UPDATED, ctx.gameSettingsService.snapshot());
    ctx.server.emit(types_1.SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, ctx.gamesService.getAvailableRooms());
}
function handleAdminVerifyKeyHelper(ctx, data, client) {
    const valid = verifyGatewayAdminKey(ctx, data?.adminKey);
    client.emit(types_1.SOCKET_EVENTS.ADMIN_KEY_VERIFIED, {
        valid,
    });
}
async function handleGetArtistPresetsHelper(ctx, data, client) {
    const includeDisabled = verifyGatewayAdminKey(ctx, data?.adminKey);
    client.emit(types_1.SOCKET_EVENTS.ARTIST_PRESETS_LIST, await listGatewayArtistPresets(ctx, includeDisabled));
}
async function handleSetArtistEnabledHelper(ctx, data, client) {
    if (!verifyGatewayAdminKey(ctx, data?.adminKey)) {
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
        return;
    }
    if (!data ||
        typeof data.artistId !== 'string' ||
        data.artistId.length > 64 ||
        typeof data.enabled !== 'boolean') {
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
        return;
    }
    try {
        await ctx.artistPresetService.setEnabled(data.artistId, data.enabled);
    }
    catch (error) {
        ctx.logger.error(`Failed to set artist preset ${data.artistId}`, error);
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Failed to update the artist preset.' });
        return;
    }
    ctx.logger.log(`Artist preset ${data.artistId} ${data.enabled ? 'enabled' : 'disabled'}`);
    await broadcastGatewayArtistPresets(ctx);
}
async function handleDeleteArtistHelper(ctx, data, client) {
    if (!verifyGatewayAdminKey(ctx, data?.adminKey)) {
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Unauthorized.' });
        return;
    }
    if (!data || typeof data.artistId !== 'string' || data.artistId.length > 64) {
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Invalid request payload' });
        return;
    }
    try {
        await ctx.artistPresetService.deleteArtist(data.artistId);
    }
    catch (error) {
        ctx.logger.error(`Failed to delete artist preset ${data.artistId}`, error);
        client.emit(types_1.SOCKET_EVENTS.ERROR, { message: 'Failed to delete the artist preset.' });
        return;
    }
    ctx.logger.log(`Artist preset ${data.artistId} deleted`);
    await broadcastGatewayArtistPresets(ctx);
}
//# sourceMappingURL=admin-gateway.helper.js.map