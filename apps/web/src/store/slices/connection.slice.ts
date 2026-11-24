import { io } from 'socket.io-client';
import {
  ActionReceipt,
  ArtistPresetSummary,
  AvailableRoom,
  DogRelayPrivateState,
  GameSettingsMap,
  GameType,
  MusicTriviaHostAnswerPayload,
  MusicTriviaSyncPlayPayload,
  MusicTriviaTrackAnswerPayload,
  Role,
  RoomState,
  RoomStatus,
  SOCKET_EVENTS,
  ServerTimeResponsePayload,
  WhoAmICategoriesResponsePayload,
  WordCategory,
} from '@repo/types';
import { toast } from 'react-hot-toast';
import { useI18nStore } from '../useI18nStore';
import { dictionaries } from '@/i18n/dictionaries';
import { estimateServerOffset } from '../../hooks/useServerClock';
import {
  ConnectionSlice,
  STORAGE_KEYS,
  StoreGet,
  StoreSet,
  StoreSharedContext,
  translateError,
} from './types';

export function createConnectionSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreSharedContext,
): ConnectionSlice {
  return {
    socket: null,
    connected: false,
    connectionStatus: 'connecting',
    socketId: '',
    serverOffset: 0,
    actionLoading: false,
    pendingActions: {},

    retryConnection: () => {
      const socket = get().socket;
      if (!socket) {
        get().connect();
        return;
      }
      set({ connectionStatus: get().room ? 'reconnecting' : 'connecting' });
      if (socket.connected) socket.disconnect();
      socket.connect();
    },

    syncServerTime: () => {
      const socket = get().socket;
      if (!socket?.connected) return;
      ctx.clearClockSyncTimeouts();
      ctx.bestRtt = Infinity;
      for (let i = 0; i < 5; i++) {
        const timeout = setTimeout(() => {
          if (get().socket?.connected) {
            get().socket?.emit(SOCKET_EVENTS.SERVER_TIME_REQUEST, { clientSentAt: Date.now() });
          }
        }, i * 250);
        ctx.clockSyncTimeouts.push(timeout);
      }
    },

    dismissPendingAction: (requestId: string) => {
      const timeout = ctx.actionTimeouts.get(requestId);
      if (timeout) {
        clearTimeout(timeout);
        ctx.actionTimeouts.delete(requestId);
      }
      const updated = { ...get().pendingActions };
      delete updated[requestId];
      const hasOtherPending = Object.values(updated).some((a) => a.status === 'pending');
      set({ pendingActions: updated, actionLoading: hasOtherPending });
    },

    connect: () => {
      if (get().socket) return;
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.hostname}:3001`
          : 'http://localhost:3001');
      const configuredTransports = (process.env.NEXT_PUBLIC_SOCKET_TRANSPORTS || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is 'polling' | 'websocket' => item === 'polling' || item === 'websocket');
      const socket = io(apiUrl, {
        transports: configuredTransports.length > 0 ? configuredTransports : ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20_000,
      });
      // Store the socket synchronously so a double-invoked mount effect
      // (React StrictMode) cannot open a second connection with the
      // single-use reconnect token.
      set({ socket });

      if (typeof window !== 'undefined' && !ctx.browserListenersAttached) {
        ctx.browserListenersAttached = true;
        const resumeSocket = () => {
          const currentSocket = get().socket;
          if (!currentSocket || currentSocket.connected) return;
          set({ connectionStatus: get().room ? 'reconnecting' : 'connecting' });
          currentSocket.connect();
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') resumeSocket();
        });
        window.addEventListener('online', resumeSocket);

        const keepAliveMs = Number.parseInt(
          process.env.NEXT_PUBLIC_KEEPALIVE_INTERVAL_MS || '90000',
          10,
        );
        if (Number.isFinite(keepAliveMs) && keepAliveMs > 0 && !ctx.keepAliveTimer) {
          ctx.keepAliveTimer = setInterval(() => {
            if (!get().room) return;
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            void fetch(`${apiUrl.replace(/\/$/, '')}/health`, {
              method: 'GET',
              cache: 'no-store',
              mode: 'cors',
            }).catch(() => {
              // Keep-alive is best-effort and must never surface errors to players.
            });
          }, keepAliveMs);
        }
      }

      socket.on('connect', () => {
        // Auto-reconnect if session exists
        const savedCode = localStorage.getItem(STORAGE_KEYS.roomCode);
        const savedName = localStorage.getItem(STORAGE_KEYS.name);
        const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken);
        const spectatingRoom = get().isSpectator ? get().room : null;
        set({
          connected: true,
          socketId: socket.id,
          connectionStatus:
            (savedCode && savedName) || spectatingRoom ? 'reconnecting' : 'connected',
        });
        if (spectatingRoom)
          socket.emit(SOCKET_EVENTS.SPECTATE_JOIN, {
            code: spectatingRoom.code,
            name: get().myName,
          });
        else if (savedCode && savedName) {
          set({ myName: savedName });
          socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
            code: savedCode,
            name: savedName,
            ...(reconnectToken ? { reconnectToken } : {}),
          });
        }

        // Request active rooms lobby
        socket.emit(SOCKET_EVENTS.GET_AVAILABLE_ROOMS);
        socket.emit(SOCKET_EVENTS.GET_GAME_SETTINGS);
        socket.emit(SOCKET_EVENTS.GET_ARTIST_PRESETS);
        get().syncServerTime();
      });

      socket.on(SOCKET_EVENTS.GAME_SETTINGS_UPDATED, (settings: GameSettingsMap) => {
        set({ gameSettings: settings });
      });

      socket.on(SOCKET_EVENTS.ARTIST_PRESETS_LIST, (presets: ArtistPresetSummary[]) => {
        set({ artistPresets: presets });
      });

      socket.on(SOCKET_EVENTS.ARTIST_PRESETS_UPDATED, (presets: ArtistPresetSummary[]) => {
        set({ artistPresets: presets });
      });

      socket.on(SOCKET_EVENTS.ADMIN_KEY_VERIFIED, () => {
        // Individual verifyAdminKey invocations resolve via their own once listener.
      });

      socket.on('disconnect', () => {
        ctx.stagedDogRelay = null;
        ctx.clearAllActionTimeouts();
        ctx.clearClockSyncTimeouts();
        set({
          connected: false,
          socketId: '',
          connectionStatus: get().room ? 'reconnecting' : 'connecting',
          isLoading: false,
          actionLoading: false,
          pendingActions: {},
          myRole: null,
          secretWord: null,
          privateState: {},
          musicTriviaHostAnswer: null,
          musicTriviaTrackAnswer: null,
          musicTriviaSyncPlay: null,
        });
      });

      socket.io.on('reconnect_attempt', () => {
        set({
          connected: false,
          connectionStatus: get().room ? 'reconnecting' : 'connecting',
        });
      });

      socket.io.on('reconnect_failed', () => {
        set({
          connected: false,
          socketId: '',
          connectionStatus: 'failed',
        });
      });

      socket.on('connect_error', () => {
        ctx.clearAllActionTimeouts();
        set({
          connected: false,
          socketId: '',
          connectionStatus:
            socket.active && get().room
              ? 'reconnecting'
              : socket.active
                ? 'connecting'
                : 'failed',
          isLoading: false,
          actionLoading: false,
          pendingActions: {},
        });
      });

      socket.on(SOCKET_EVENTS.ROOM_STATE_UPDATED, (room: RoomState) => {
        if (ctx.pendingSpectatorJoin?.code === room.code) ctx.pendingSpectatorJoin = null;
        const isMe = room.players.some((p) => p.socketId === socket.id);
        if (!isMe && !get().isSpectator) return;

        const prevRoom = get().room;
        const nextRoomLang = room.config?.language;
        if (
          (prevRoom && prevRoom.code !== room.code) ||
          (get().categoriesLang && nextRoomLang && get().categoriesLang !== nextRoomLang)
        ) {
          const isRequestInFlightForNext =
            ctx.latestCategoriesRequest?.roomCode === room.code &&
            ctx.latestCategoriesRequest?.lang === nextRoomLang;
          if (!isRequestInFlightForNext) {
            ctx.latestCategoriesRequest = null;
          }
          set({
            categories: [],
            categoriesLoading: isRequestInFlightForNext,
            categoriesError: null,
            categoriesLang: null,
          });
        }

        set({ connectionStatus: 'connected' });
        if (room.gameType === GameType.DOG_RELAY) {
          const roundId = room.dogRelayState?.roundId;
          if (roundId) ctx.seenDogRelayRounds.add(roundId);
          const current = get().privateState;
          const own = current.dogRelay as DogRelayPrivateState | undefined;
          const { dogRelay: ignored, ...rest } = current;
          void ignored;
          const matching =
            ctx.stagedDogRelay?.roundId === roundId
              ? ctx.stagedDogRelay
              : own?.roundId === roundId
                ? own
                : null;
          set({ privateState: matching && roundId ? { ...rest, dogRelay: matching } : rest });
          if (matching === ctx.stagedDogRelay || !roundId) ctx.stagedDogRelay = null;
        }

        const hasPendingAction = Object.values(get().pendingActions).some(
          (a) => a.status === 'pending',
        );

        if (room.status === RoomStatus.LOBBY) {
          set({
            room,
            myRole: null,
            secretWord: null,
            privateState: {},
            isLoading: false,
            actionLoading: hasPendingAction,
          });
        } else {
          const isCurrentHost = room.roomHostId === socket.id;
          const activeHostPhases = ['GET_READY', 'COUNTDOWN', 'PLAYING', 'BUZZED', 'ANSWERING'];
          if (
            !isCurrentHost ||
            room.musicTriviaState?.mode !== 'GAME_MASTER' ||
            !room.musicTriviaState?.phase ||
            !activeHostPhases.includes(room.musicTriviaState.phase)
          ) {
            set({ musicTriviaHostAnswer: null });
          }

          set({ room, isLoading: false, actionLoading: hasPendingAction, gameStartError: null });
        }

        if (!get().isSpectator) {
          localStorage.setItem(STORAGE_KEYS.roomCode, room.code);
          localStorage.setItem(STORAGE_KEYS.name, get().myName);
        }
      });

      socket.on(SOCKET_EVENTS.ACTION_RECEIPT, (receipt: ActionReceipt) => {
        const timeout = ctx.actionTimeouts.get(receipt.requestId);
        if (timeout) {
          clearTimeout(timeout);
          ctx.actionTimeouts.delete(receipt.requestId);
        }

        const pending = get().pendingActions[receipt.requestId];
        if (!pending) return;

        const updated = { ...get().pendingActions };
        delete updated[receipt.requestId];
        const hasOtherPending = Object.values(updated).some((a) => a.status === 'pending');
        set({
          pendingActions: updated,
          actionLoading: hasOtherPending,
        });

        if (receipt.status === 'rejected' && receipt.reason) {
          toast.error(
            pending.event === SOCKET_EVENTS.DOG_RELAY_ACTION
              ? dictionaries[useI18nStore.getState().language].dogRelay.actionRejected
              : translateError(receipt.reason),
          );
        }
      });

      socket.on(SOCKET_EVENTS.SERVER_TIME_RESPONSE, (payload: ServerTimeResponsePayload) => {
        if (
          !payload ||
          typeof payload.clientSentAt !== 'number' ||
          typeof payload.serverNow !== 'number'
        ) {
          return;
        }
        const t0 = payload.clientSentAt;
        const t1 = Date.now();
        const rtt = t1 - t0;
        if (rtt < 0 || rtt > 3000) return;
        if (rtt < ctx.bestRtt) {
          ctx.bestRtt = rtt;
          const offset = estimateServerOffset(t0, t1, payload.serverNow);
          set({ serverOffset: offset });
        }
      });

      socket.on(SOCKET_EVENTS.ROLE_ASSIGNED, ({ role }: { role: Role }) => {
        set({ myRole: role });
      });

      socket.on(
        SOCKET_EVENTS.PRIVATE_STATE_UPDATED,
        ({ data }: { data: Record<string, unknown> }) => {
          const next = { ...(data ?? {}) };
          const candidate = next.dogRelay as DogRelayPrivateState | undefined;
          if (candidate && typeof candidate.roundId === 'string') {
            const roundId = get().room?.dogRelayState?.roundId;
            if (candidate.roundId !== roundId) {
              if (!ctx.seenDogRelayRounds.has(candidate.roundId)) ctx.stagedDogRelay = candidate;
              delete next.dogRelay;
              const current = get().privateState.dogRelay as DogRelayPrivateState | undefined;
              if (current?.roundId === roundId) next.dogRelay = current;
            }
          }
          set({ privateState: next });
        },
      );

      socket.on(
        SOCKET_EVENTS.SESSION_ASSIGNED,
        ({
          code,
          reconnectToken,
          playerId,
        }: {
          code: string;
          reconnectToken: string;
          playerId: string;
        }) => {
          localStorage.setItem(STORAGE_KEYS.roomCode, code);
          localStorage.setItem(STORAGE_KEYS.reconnectToken, reconnectToken);
          if (get().playerId && get().playerId !== playerId) {
            ctx.stagedDogRelay = null;
            set({ privateState: {} });
          }
          set({ isSpectator: false, playerId });
        },
      );

      socket.on(SOCKET_EVENTS.ROOM_DELETED, () => {
        localStorage.removeItem(STORAGE_KEYS.roomCode);
        localStorage.removeItem(STORAGE_KEYS.reconnectToken);
        ctx.clearRoomSession();
        toast.error(translateError('The Room Host has left. Room has been closed.'));
      });

      socket.on(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, (rooms: AvailableRoom[]) => {
        set({ availableRooms: rooms });
      });

      socket.on(SOCKET_EVENTS.WORD_SETTING_COMPLETED, ({ word }: { word: string }) => {
        set({ secretWord: word });
      });

      socket.on(
        SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST,
        (payload: WordCategory[] | WhoAmICategoriesResponsePayload) => {
          const currentRoom = get().room;
          const currentRoomLang = currentRoom?.config?.language;
          if (Array.isArray(payload)) {
            if (ctx.latestCategoriesRequest) {
              if (
                ctx.latestCategoriesRequest.roomCode &&
                currentRoom?.code !== ctx.latestCategoriesRequest.roomCode
              ) {
                return;
              }
              if (currentRoomLang && ctx.latestCategoriesRequest.lang !== currentRoomLang) {
                return;
              }
            }
            set({
              categories: payload,
              categoriesLoading: false,
              categoriesError: null,
              categoriesLang: ctx.latestCategoriesRequest?.lang ?? currentRoomLang ?? null,
            });
            return;
          }

          if (!payload || typeof payload !== 'object') return;
          if (payload.requestId) {
            if (
              !ctx.latestCategoriesRequest ||
              payload.requestId !== ctx.latestCategoriesRequest.requestId
            ) {
              return;
            }
          }
          if (
            ctx.latestCategoriesRequest?.roomCode &&
            currentRoom?.code !== ctx.latestCategoriesRequest.roomCode
          ) {
            return;
          }
          const responseLang = payload.lang ?? ctx.latestCategoriesRequest?.lang ?? null;
          if (responseLang && currentRoomLang && responseLang !== currentRoomLang) {
            return;
          }
          if (payload.error) {
            set({
              categories: [],
              categoriesLoading: false,
              categoriesError: payload.error,
              categoriesLang: responseLang,
            });
            return;
          }
          set({
            categories: Array.isArray(payload.categories) ? payload.categories : [],
            categoriesLoading: false,
            categoriesError: null,
            categoriesLang: responseLang,
          });
        },
      );

      socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, (answer: MusicTriviaHostAnswerPayload) => {
        set({ musicTriviaHostAnswer: answer });
      });

      socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
        let redirectedFromMissingInviteRoom = false;
        if (message === 'CATEGORIES_UNAVAILABLE') {
          set({
            categories: [],
            categoriesLoading: false,
            categoriesError: message,
          });
        }
        if (message === 'SPECTATORS_DISABLED' && ctx.pendingSpectatorJoin) {
          set({ isSpectator: ctx.pendingSpectatorJoin.previousIsSpectator });
          ctx.pendingSpectatorJoin = null;
        }
        if (message === 'Room not found') {
          localStorage.removeItem(STORAGE_KEYS.roomCode);
          localStorage.removeItem(STORAGE_KEYS.reconnectToken);
          ctx.clearRoomSession();
          if (
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).has('room')
          ) {
            redirectedFromMissingInviteRoom = true;
            window.location.replace('/');
          }
        }
        const wasLoading = get().isLoading;
        set({ isLoading: false, actionLoading: false });
        if (
          wasLoading ||
          message.includes('Questions are unavailable') ||
          message.includes('Cannot start game')
        ) {
          set({ gameStartError: message });
        }
        if (get().connectionStatus === 'reconnecting')
          set({ connectionStatus: get().room ? 'failed' : 'connected' });
        if (!redirectedFromMissingInviteRoom) {
          toast.error(translateError(message));
        }
      });

      socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_TRACK_ANSWER, (data: MusicTriviaTrackAnswerPayload) => {
        set({ musicTriviaTrackAnswer: data });
      });

      socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, (data: MusicTriviaSyncPlayPayload) => {
        set({ musicTriviaSyncPlay: data });
      });

      socket.on(
        SOCKET_EVENTS.BANANA_THIEF_REACTION,
        (data: { fromName: string; emoji: string }) => {
          set({
            lastBananaThiefReaction: { ...data, seq: Date.now() + Math.random() },
          });
        },
      );
    },
  };
}
