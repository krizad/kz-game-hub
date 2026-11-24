import {
  AdminKeyVerifiedPayload,
  AdminVerifyKeyPayload,
  CardGameConfig,
  DeleteArtistPayload,
  GameType,
  GetArtistPresetsPayload,
  ResultRevealActionPayload,
  RoomConfig,
  SOCKET_EVENTS,
  SetArtistEnabledPayload,
  SetGameEnabledPayload,
} from '@repo/types';
import { toast } from 'react-hot-toast';
import { useI18nStore } from '../useI18nStore';
import {
  LobbySlice,
  STORAGE_KEYS,
  StoreGet,
  StoreSet,
  StoreSharedContext,
  UpdateConfigPayload,
  translateError,
} from './types';

export function createLobbySlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreSharedContext,
): LobbySlice {
  return {
    isSpectator: false,
    room: null,
    myRole: null,
    myName: '',
    playerId: '',
    secretWord: null,
    availableRooms: [],
    gameSettings: {},
    artistPresets: [],
    categories: [],
    categoriesLoading: false,
    categoriesError: null,
    categoriesLang: null,
    isLoading: false,
    gameStartError: null,
    privateState: {},

    clearGameStartError: () => set({ gameStartError: null }),

    resultRevealAction: (action) => {
      const { room, socket } = get();
      if (!room?.resultReveal || !socket?.connected) return;
      socket.emit(SOCKET_EVENTS.RESULT_REVEAL_ACTION, {
        code: room.code,
        revealId: room.resultReveal.id,
        action,
      } satisfies ResultRevealActionPayload);
    },

    setName: (name) => {
      set({ myName: name });
      if (typeof window !== 'undefined') {
        if (name && name.trim()) {
          localStorage.setItem(STORAGE_KEYS.name, name);
        } else {
          localStorage.removeItem(STORAGE_KEYS.name);
        }
      }
    },

    isGameEnabled: (gameType) => get().gameSettings[gameType] ?? true,

    verifyAdminKey: (adminKey) => {
      const { socket } = get();
      if (!socket || !socket.connected) {
        return Promise.resolve(false);
      }
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          socket.off(SOCKET_EVENTS.ADMIN_KEY_VERIFIED, onVerified);
          resolve(false);
        }, 5000);

        const onVerified = (payload: AdminKeyVerifiedPayload) => {
          clearTimeout(timeout);
          socket.off(SOCKET_EVENTS.ADMIN_KEY_VERIFIED, onVerified);
          resolve(payload?.valid === true);
        };

        socket.once(SOCKET_EVENTS.ADMIN_KEY_VERIFIED, onVerified);
        socket.emit(SOCKET_EVENTS.ADMIN_VERIFY_KEY, { adminKey } satisfies AdminVerifyKeyPayload);
      });
    },

    setGameEnabled: (gameType, enabled, adminKey) => {
      const { socket } = get();
      socket?.emit(SOCKET_EVENTS.SET_GAME_ENABLED, {
        gameType,
        enabled,
        adminKey,
      } satisfies SetGameEnabledPayload);
    },

    getArtistPresets: (adminKey) => {
      const { socket } = get();
      socket?.emit(
        SOCKET_EVENTS.GET_ARTIST_PRESETS,
        adminKey ? ({ adminKey } satisfies GetArtistPresetsPayload) : undefined,
      );
    },

    setArtistEnabled: (artistId, enabled, adminKey) => {
      const { socket } = get();
      socket?.emit(SOCKET_EVENTS.SET_ARTIST_ENABLED, {
        artistId,
        enabled,
        adminKey,
      } satisfies SetArtistEnabledPayload);
    },

    deleteArtist: (artistId, adminKey) => {
      const { socket } = get();
      socket?.emit(SOCKET_EVENTS.DELETE_ARTIST, {
        artistId,
        adminKey,
      } satisfies DeleteArtistPayload);
    },

    createRoom: (gameType: GameType = GameType.WHO_KNOW, config?: Partial<RoomConfig>) => {
      const { socket, myName } = get();
      if (!myName) {
        toast.error(translateError('Please enter your name first'));
        return;
      }
      if (socket) {
        const language = config?.language ?? useI18nStore.getState().language;
        socket.emit(SOCKET_EVENTS.CREATE_ROOM, {
          name: myName,
          gameType,
          config: {
            ...config,
            language,
          },
        });
      }
    },

    joinRoom: (code: string) => {
      const { socket, myName } = get();
      if (!myName) {
        toast.error(translateError('Please enter your name first'));
        return;
      }
      if (socket) {
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code, name: myName });
      }
    },

    spectateJoin: (code: string) => {
      const { socket, myName } = get();
      if (socket && myName) {
        const normalizedCode = code.toUpperCase();
        ctx.pendingSpectatorJoin = {
          code: normalizedCode,
          previousIsSpectator: get().isSpectator,
        };
        set({ isLoading: true, isSpectator: true });
        socket.emit(SOCKET_EVENTS.SPECTATE_JOIN, { code: normalizedCode, name: myName });
      }
    },

    startGame: () => {
      set({ gameStartError: null });
      if (ctx.emitGameAction(SOCKET_EVENTS.START_GAME)) set({ isLoading: true });
    },

    resetRoom: () => {
      if (ctx.emitGameAction(SOCKET_EVENTS.RESET_GAME)) set({ myRole: null, secretWord: null });
    },

    leaveRoom: () => {
      set({ gameStartError: null });
      const { socket } = get();
      if (socket) {
        if (socket.connected) socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
        localStorage.removeItem(STORAGE_KEYS.roomCode);
        localStorage.removeItem(STORAGE_KEYS.reconnectToken);
        ctx.clearRoomSession();
        set({ connectionStatus: socket.connected ? 'connected' : 'connecting' });
      }
    },

    updateConfig: (config: UpdateConfigPayload, cardGameConfig?: Partial<CardGameConfig>) => {
      ctx.emitGameAction(SOCKET_EVENTS.UPDATE_CONFIG, {
        loading: false,
        payload: () => ({ config, ...(cardGameConfig ? { cardGameConfig } : {}) }),
      });
    },
  };
}
