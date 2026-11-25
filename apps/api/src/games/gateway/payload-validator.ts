import {
  BANANA_THIEF_REACTIONS,
  GameType,
  SOCKET_EVENTS,
  TTT_MODE_FLAGS,
  TttModeFlag,
} from '@repo/types';

export function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40;
}

/** Games plus the Tic-Tac-Toe mode flags are togglable via set_game_enabled. */
export function isSettingsKey(value: unknown): value is GameType | TttModeFlag {
  return (
    typeof value === 'string' &&
    (Object.values(GameType).includes(value as GameType) ||
      (TTT_MODE_FLAGS as readonly string[]).includes(value))
  );
}

export function hasSafeValues(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (typeof value === 'string') return value.length <= 500;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean' || value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((item) => hasSafeValues(item, depth + 1));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return (
      entries.length <= 50 &&
      entries.every(([key, item]) => key.length <= 100 && hasSafeValues(item, depth + 1))
    );
  }
  return false;
}

export function isValidPayload(event: string, payload: unknown): boolean {
  if (
    event === SOCKET_EVENTS.LEAVE_ROOM ||
    event === SOCKET_EVENTS.GET_AVAILABLE_ROOMS ||
    event === SOCKET_EVENTS.GET_GAME_SETTINGS
  ) {
    return true;
  }
  // Optional-payload read: no adminKey (lobby) or one string (admin panel).
  if (event === SOCKET_EVENTS.GET_ARTIST_PRESETS) {
    if (payload === undefined || payload === null) return true;
    if (typeof payload !== 'object' || Array.isArray(payload)) return false;
    const d = payload as Record<string, unknown>;
    return d.adminKey === undefined || (typeof d.adminKey === 'string' && d.adminKey.length <= 200);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;

  const data = payload as Record<string, unknown>;
  if (!hasSafeValues(data)) return false;

  const isValidArtistId = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

  if (event === SOCKET_EVENTS.SET_ARTIST_ENABLED) {
    return (
      isValidArtistId(data.artistId) &&
      typeof data.enabled === 'boolean' &&
      typeof data.adminKey === 'string' &&
      data.adminKey.length <= 200
    );
  }
  if (event === SOCKET_EVENTS.DELETE_ARTIST) {
    return (
      isValidArtistId(data.artistId) &&
      typeof data.adminKey === 'string' &&
      data.adminKey.length <= 200
    );
  }
  if (event === SOCKET_EVENTS.SET_GAME_ENABLED) {
    return (
      isSettingsKey(data.gameType as string) &&
      typeof data.enabled === 'boolean' &&
      typeof data.adminKey === 'string' &&
      data.adminKey.length <= 200
    );
  }
  if (event === SOCKET_EVENTS.ADMIN_VERIFY_KEY) {
    return typeof data.adminKey === 'string' && data.adminKey.length <= 200;
  }
  if (event === SOCKET_EVENTS.CREATE_ROOM) {
    return (
      isValidName(data.name) &&
      (data.gameType === undefined || Object.values(GameType).includes(data.gameType as GameType))
    );
  }
  if (event === SOCKET_EVENTS.LEADERBOARD_GET) {
    return data.gameType === undefined || typeof data.gameType === 'string';
  }
  if (event === SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES) {
    return (
      (data.lang === undefined || (typeof data.lang === 'string' && data.lang.length <= 10)) &&
      (data.requestId === undefined ||
        (typeof data.requestId === 'string' &&
          data.requestId.length >= 1 &&
          data.requestId.length <= 64))
    );
  }
  if (event === SOCKET_EVENTS.SERVER_TIME_REQUEST) {
    return typeof data.clientSentAt === 'number' && Number.isFinite(data.clientSentAt);
  }
  if (typeof data.code !== 'string' || !/^[a-z0-9]{6}$/i.test(data.code)) return false;
  if (event === SOCKET_EVENTS.RESULT_REVEAL_ACTION) {
    return (
      typeof data.revealId === 'string' &&
      data.revealId.length <= 64 &&
      (data.action === 'REVEAL' || data.action === 'SKIP')
    );
  }
  if (
    data.requestId !== undefined &&
    (typeof data.requestId !== 'string' || data.requestId.length < 1 || data.requestId.length > 64)
  ) {
    return false;
  }
  if (event === SOCKET_EVENTS.JOIN_ROOM || event === SOCKET_EVENTS.SPECTATE_JOIN) {
    return (
      isValidName(data.name) &&
      (data.reconnectToken === undefined ||
        (typeof data.reconnectToken === 'string' && data.reconnectToken.length <= 100))
    );
  }
  if (event === SOCKET_EVENTS.UPDATE_CONFIG) {
    return !!data.config && typeof data.config === 'object' && !Array.isArray(data.config);
  }
  if (event === SOCKET_EVENTS.GAME_ACTION) {
    return !!data.action && typeof data.action === 'object' && !Array.isArray(data.action);
  }
  if (event === SOCKET_EVENTS.CARD_GAME_ACTION) {
    return (
      !!data.action &&
      typeof data.action === 'object' &&
      !Array.isArray(data.action) &&
      typeof (data.action as Record<string, unknown>).type === 'string'
    );
  }
  if (event === SOCKET_EVENTS.POKER_ACTION) {
    if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
      return false;
    }
    const action = data.action as Record<string, unknown>;
    if (typeof action.type !== 'string') return false;
    if (action.type === 'BET') {
      return typeof action.amount === 'number' && Number.isInteger(action.amount);
    }
    if (action.type === 'REBUY' || action.type === 'ADJUST_CHIPS') {
      return (
        typeof action.targetId === 'string' &&
        action.targetId.length <= 64 &&
        (action.type === 'REBUY' ||
          (typeof action.amount === 'number' && Number.isInteger(action.amount)))
      );
    }
    if (action.type === 'POT_AWARD') {
      return (
        Array.isArray(action.targetIds) &&
        action.targetIds.length >= 1 &&
        action.targetIds.length <= 10 &&
        action.targetIds.every((id: unknown) => typeof id === 'string' && id.length <= 64)
      );
    }
    return true;
  }
  if (event === SOCKET_EVENTS.POKER_V2_ACTION) {
    if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
      return false;
    }
    const action = data.action as Record<string, unknown>;
    if (typeof action.type !== 'string') return false;
    if (action.type === 'BET') {
      return typeof action.amount === 'number' && Number.isInteger(action.amount);
    }
    return true;
  }
  if (event === SOCKET_EVENTS.THIRTY_ONE_ACTION) {
    if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
      return false;
    }
    const action = data.action as Record<string, unknown>;
    if (typeof action.type !== 'string') return false;
    if (
      !['DRAW_STOCK', 'DRAW_DISCARD', 'DISCARD', 'KNOCK', 'NEXT_ROUND', 'END_MATCH'].includes(
        action.type,
      )
    ) {
      return false;
    }
    if (action.type === 'DISCARD') {
      return (
        typeof action.cardId === 'string' && action.cardId.length >= 1 && action.cardId.length <= 32
      );
    }
    return true;
  }

  const isSmallInt = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 10_000;

  if (event === SOCKET_EVENTS.SABOTEUR_PLACE_PATH) {
    return (
      isSmallInt(data.cardIndex) &&
      isSmallInt(data.x) &&
      isSmallInt(data.y) &&
      (data.rotation === 0 || data.rotation === 180)
    );
  }
  if (event === SOCKET_EVENTS.SABOTEUR_PLAY_ACTION) {
    return (
      isSmallInt(data.cardIndex) &&
      (data.targetPlayerId === undefined || typeof data.targetPlayerId === 'string') &&
      (data.repairTool === undefined || typeof data.repairTool === 'string') &&
      (data.goalIndex === undefined || isSmallInt(data.goalIndex)) &&
      (data.targetX === undefined || isSmallInt(data.targetX)) &&
      (data.targetY === undefined || isSmallInt(data.targetY))
    );
  }
  if (event === SOCKET_EVENTS.SABOTEUR_DISCARD) {
    return isSmallInt(data.cardIndex);
  }
  if (event === SOCKET_EVENTS.SABOTEUR_PICK_GOLD) {
    return isSmallInt(data.poolIndex);
  }
  if (event === SOCKET_EVENTS.COUP_DECLARE) {
    return (
      typeof data.type === 'string' &&
      ['INCOME', 'FOREIGN_AID', 'COUP', 'TAX', 'ASSASSINATE', 'STEAL', 'EXCHANGE'].includes(
        data.type,
      ) &&
      (data.targetId === undefined || typeof data.targetId === 'string')
    );
  }
  if (event === SOCKET_EVENTS.COUP_CHALLENGE) {
    return true;
  }
  if (event === SOCKET_EVENTS.COUP_BLOCK) {
    return data.role === undefined || typeof data.role === 'string';
  }
  if (event === SOCKET_EVENTS.COUP_EXCHANGE_SELECT) {
    return (
      Array.isArray(data.keepIndices) &&
      data.keepIndices.length >= 1 &&
      data.keepIndices.length <= 4 &&
      data.keepIndices.every(
        (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4,
      )
    );
  }
  if (event === SOCKET_EVENTS.BANANA_THIEF_PEEK || event === SOCKET_EVENTS.BANANA_THIEF_VOTE) {
    return typeof data.targetId === 'string' && data.targetId.length <= 64;
  }
  if (event === SOCKET_EVENTS.BANANA_THIEF_REACTION) {
    return (BANANA_THIEF_REACTIONS as readonly string[]).includes(data.emoji as string);
  }
  if (event === SOCKET_EVENTS.WEREWOLF_NIGHT_ACTION) {
    return (
      ['KILL', 'CHECK', 'HEAL', 'POISON', 'SHOT'].includes(data.action as string) &&
      typeof data.targetId === 'string' &&
      data.targetId.length <= 64
    );
  }
  if (event === SOCKET_EVENTS.WEREWOLF_DAY_VOTE) {
    return typeof data.targetId === 'string' && data.targetId.length <= 64;
  }
  if (event === SOCKET_EVENTS.CIPHER_ASSIGN_TEAM) {
    return (
      (data.team === null ||
        data.team === undefined ||
        data.team === 'SOLAR' ||
        data.team === 'LUNAR') &&
      (data.role === undefined || data.role === 'CIPHER_LEAD' || data.role === 'TRACKER') &&
      (data.targetId === undefined || typeof data.targetId === 'string')
    );
  }
  if (event === SOCKET_EVENTS.CIPHER_GIVE_CLUE) {
    return (
      typeof data.word === 'string' &&
      data.word.trim().length >= 1 &&
      data.word.trim().length <= 50 &&
      (data.count === 'UNLIMITED' ||
        (typeof data.count === 'number' &&
          Number.isInteger(data.count) &&
          data.count >= 0 &&
          data.count <= 9))
    );
  }
  if (event === SOCKET_EVENTS.CIPHER_PING_CARD || event === SOCKET_EVENTS.CIPHER_REVEAL_CARD) {
    return (
      typeof data.cardIndex === 'number' &&
      Number.isInteger(data.cardIndex) &&
      data.cardIndex >= 0 &&
      data.cardIndex < 25
    );
  }
  return true;
}
