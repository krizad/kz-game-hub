"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidName = isValidName;
exports.isSettingsKey = isSettingsKey;
exports.hasSafeValues = hasSafeValues;
exports.isValidPayload = isValidPayload;
const types_1 = require("@repo/types");
function isValidName(value) {
    return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40;
}
function isSettingsKey(value) {
    return (typeof value === 'string' &&
        (Object.values(types_1.GameType).includes(value) ||
            types_1.TTT_MODE_FLAGS.includes(value)));
}
function hasSafeValues(value, depth = 0) {
    if (depth > 4)
        return false;
    if (typeof value === 'string')
        return value.length <= 500;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value === 'boolean' || value === null || value === undefined)
        return true;
    if (Array.isArray(value)) {
        return value.length <= 100 && value.every((item) => hasSafeValues(item, depth + 1));
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        return (entries.length <= 50 &&
            entries.every(([key, item]) => key.length <= 100 && hasSafeValues(item, depth + 1)));
    }
    return false;
}
function isValidPayload(event, payload) {
    if (event === types_1.SOCKET_EVENTS.LEAVE_ROOM ||
        event === types_1.SOCKET_EVENTS.GET_AVAILABLE_ROOMS ||
        event === types_1.SOCKET_EVENTS.GET_GAME_SETTINGS) {
        return true;
    }
    if (event === types_1.SOCKET_EVENTS.GET_ARTIST_PRESETS) {
        if (payload === undefined || payload === null)
            return true;
        if (typeof payload !== 'object' || Array.isArray(payload))
            return false;
        const d = payload;
        return d.adminKey === undefined || (typeof d.adminKey === 'string' && d.adminKey.length <= 200);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        return false;
    const data = payload;
    if (!hasSafeValues(data))
        return false;
    const isValidArtistId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
    if (event === types_1.SOCKET_EVENTS.SET_ARTIST_ENABLED) {
        return (isValidArtistId(data.artistId) &&
            typeof data.enabled === 'boolean' &&
            typeof data.adminKey === 'string' &&
            data.adminKey.length <= 200);
    }
    if (event === types_1.SOCKET_EVENTS.DELETE_ARTIST) {
        return (isValidArtistId(data.artistId) &&
            typeof data.adminKey === 'string' &&
            data.adminKey.length <= 200);
    }
    if (event === types_1.SOCKET_EVENTS.SET_GAME_ENABLED) {
        return (isSettingsKey(data.gameType) &&
            typeof data.enabled === 'boolean' &&
            typeof data.adminKey === 'string' &&
            data.adminKey.length <= 200);
    }
    if (event === types_1.SOCKET_EVENTS.ADMIN_VERIFY_KEY) {
        return typeof data.adminKey === 'string' && data.adminKey.length <= 200;
    }
    if (event === types_1.SOCKET_EVENTS.CREATE_ROOM) {
        return (isValidName(data.name) &&
            (data.gameType === undefined || Object.values(types_1.GameType).includes(data.gameType)));
    }
    if (event === types_1.SOCKET_EVENTS.LEADERBOARD_GET) {
        return data.gameType === undefined || typeof data.gameType === 'string';
    }
    if (event === types_1.SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES) {
        return ((data.lang === undefined || (typeof data.lang === 'string' && data.lang.length <= 10)) &&
            (data.requestId === undefined ||
                (typeof data.requestId === 'string' &&
                    data.requestId.length >= 1 &&
                    data.requestId.length <= 64)));
    }
    if (event === types_1.SOCKET_EVENTS.SERVER_TIME_REQUEST) {
        return typeof data.clientSentAt === 'number' && Number.isFinite(data.clientSentAt);
    }
    if (typeof data.code !== 'string' || !/^[a-z0-9]{6}$/i.test(data.code))
        return false;
    if (event === types_1.SOCKET_EVENTS.RESULT_REVEAL_ACTION) {
        return (typeof data.revealId === 'string' &&
            data.revealId.length <= 64 &&
            (data.action === 'REVEAL' || data.action === 'SKIP'));
    }
    if (data.requestId !== undefined &&
        (typeof data.requestId !== 'string' || data.requestId.length < 1 || data.requestId.length > 64)) {
        return false;
    }
    if (event === types_1.SOCKET_EVENTS.JOIN_ROOM || event === types_1.SOCKET_EVENTS.SPECTATE_JOIN) {
        return (isValidName(data.name) &&
            (data.reconnectToken === undefined ||
                (typeof data.reconnectToken === 'string' && data.reconnectToken.length <= 100)));
    }
    if (event === types_1.SOCKET_EVENTS.UPDATE_CONFIG) {
        return !!data.config && typeof data.config === 'object' && !Array.isArray(data.config);
    }
    if (event === types_1.SOCKET_EVENTS.GAME_ACTION) {
        return !!data.action && typeof data.action === 'object' && !Array.isArray(data.action);
    }
    if (event === types_1.SOCKET_EVENTS.CARD_GAME_ACTION) {
        return (!!data.action &&
            typeof data.action === 'object' &&
            !Array.isArray(data.action) &&
            typeof data.action.type === 'string');
    }
    if (event === types_1.SOCKET_EVENTS.POKER_ACTION) {
        if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
            return false;
        }
        const action = data.action;
        if (typeof action.type !== 'string')
            return false;
        if (action.type === 'BET') {
            return typeof action.amount === 'number' && Number.isInteger(action.amount);
        }
        if (action.type === 'REBUY' || action.type === 'ADJUST_CHIPS') {
            return (typeof action.targetId === 'string' &&
                action.targetId.length <= 64 &&
                (action.type === 'REBUY' ||
                    (typeof action.amount === 'number' && Number.isInteger(action.amount))));
        }
        if (action.type === 'POT_AWARD') {
            return (Array.isArray(action.targetIds) &&
                action.targetIds.length >= 1 &&
                action.targetIds.length <= 10 &&
                action.targetIds.every((id) => typeof id === 'string' && id.length <= 64));
        }
        return true;
    }
    if (event === types_1.SOCKET_EVENTS.POKER_V2_ACTION) {
        if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
            return false;
        }
        const action = data.action;
        if (typeof action.type !== 'string')
            return false;
        if (action.type === 'BET') {
            return typeof action.amount === 'number' && Number.isInteger(action.amount);
        }
        return true;
    }
    if (event === types_1.SOCKET_EVENTS.THIRTY_ONE_ACTION) {
        if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
            return false;
        }
        const action = data.action;
        if (typeof action.type !== 'string')
            return false;
        if (!['DRAW_STOCK', 'DRAW_DISCARD', 'DISCARD', 'KNOCK', 'NEXT_ROUND', 'END_MATCH'].includes(action.type)) {
            return false;
        }
        if (action.type === 'DISCARD') {
            return (typeof action.cardId === 'string' && action.cardId.length >= 1 && action.cardId.length <= 32);
        }
        return true;
    }
    const isSmallInt = (v) => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 10_000;
    if (event === types_1.SOCKET_EVENTS.SABOTEUR_PLACE_PATH) {
        return (isSmallInt(data.cardIndex) &&
            isSmallInt(data.x) &&
            isSmallInt(data.y) &&
            (data.rotation === 0 || data.rotation === 180));
    }
    if (event === types_1.SOCKET_EVENTS.SABOTEUR_PLAY_ACTION) {
        return (isSmallInt(data.cardIndex) &&
            (data.targetPlayerId === undefined || typeof data.targetPlayerId === 'string') &&
            (data.repairTool === undefined || typeof data.repairTool === 'string') &&
            (data.goalIndex === undefined || isSmallInt(data.goalIndex)) &&
            (data.targetX === undefined || isSmallInt(data.targetX)) &&
            (data.targetY === undefined || isSmallInt(data.targetY)));
    }
    if (event === types_1.SOCKET_EVENTS.SABOTEUR_DISCARD) {
        return isSmallInt(data.cardIndex);
    }
    if (event === types_1.SOCKET_EVENTS.SABOTEUR_PICK_GOLD) {
        return isSmallInt(data.poolIndex);
    }
    if (event === types_1.SOCKET_EVENTS.COUP_DECLARE) {
        return (typeof data.type === 'string' &&
            ['INCOME', 'FOREIGN_AID', 'COUP', 'TAX', 'ASSASSINATE', 'STEAL', 'EXCHANGE'].includes(data.type) &&
            (data.targetId === undefined || typeof data.targetId === 'string'));
    }
    if (event === types_1.SOCKET_EVENTS.COUP_CHALLENGE) {
        return true;
    }
    if (event === types_1.SOCKET_EVENTS.COUP_BLOCK) {
        return data.role === undefined || typeof data.role === 'string';
    }
    if (event === types_1.SOCKET_EVENTS.COUP_EXCHANGE_SELECT) {
        return (Array.isArray(data.keepIndices) &&
            data.keepIndices.length >= 1 &&
            data.keepIndices.length <= 4 &&
            data.keepIndices.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4));
    }
    if (event === types_1.SOCKET_EVENTS.BANANA_THIEF_PEEK || event === types_1.SOCKET_EVENTS.BANANA_THIEF_VOTE) {
        return typeof data.targetId === 'string' && data.targetId.length <= 64;
    }
    if (event === types_1.SOCKET_EVENTS.BANANA_THIEF_REACTION) {
        return types_1.BANANA_THIEF_REACTIONS.includes(data.emoji);
    }
    if (event === types_1.SOCKET_EVENTS.WEREWOLF_NIGHT_ACTION) {
        return (['KILL', 'CHECK', 'HEAL', 'POISON', 'SHOT'].includes(data.action) &&
            typeof data.targetId === 'string' &&
            data.targetId.length <= 64);
    }
    if (event === types_1.SOCKET_EVENTS.WEREWOLF_DAY_VOTE) {
        return typeof data.targetId === 'string' && data.targetId.length <= 64;
    }
    if (event === types_1.SOCKET_EVENTS.CIPHER_ASSIGN_TEAM) {
        return ((data.team === null ||
            data.team === undefined ||
            data.team === 'SOLAR' ||
            data.team === 'LUNAR') &&
            (data.role === undefined || data.role === 'CIPHER_LEAD' || data.role === 'TRACKER') &&
            (data.targetId === undefined || typeof data.targetId === 'string'));
    }
    if (event === types_1.SOCKET_EVENTS.CIPHER_GIVE_CLUE) {
        return (typeof data.word === 'string' &&
            data.word.trim().length >= 1 &&
            data.word.trim().length <= 50 &&
            (data.count === 'UNLIMITED' ||
                (typeof data.count === 'number' &&
                    Number.isInteger(data.count) &&
                    data.count >= 0 &&
                    data.count <= 9)));
    }
    if (event === types_1.SOCKET_EVENTS.CIPHER_PING_CARD || event === types_1.SOCKET_EVENTS.CIPHER_REVEAL_CARD) {
        return (typeof data.cardIndex === 'number' &&
            Number.isInteger(data.cardIndex) &&
            data.cardIndex >= 0 &&
            data.cardIndex < 25);
    }
    return true;
}
//# sourceMappingURL=payload-validator.js.map