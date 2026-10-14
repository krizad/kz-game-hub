import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  GameActionType,
  MusicTriviaAction,
  MusicTriviaHostAnswerPayload,
  MusicTriviaSyncPlayPayload,
  MusicTriviaTrackAnswerPayload,
  RoomState,
  RoomStatus,
  RoomConfig,
  Role,
  SOCKET_EVENTS,
  AvailableRoom,
  GameSettingsMap,
  SetGameEnabledPayload,
  GameType,
  WhoFirstGameActionType,
  WordCategory,
  SaboteurTool,
  CoupActionType,
  CoupRole,
  CardGameAction,
  CardGameConfig,
  PokerAction,
  TttModeFlag,
  ArtistPresetSummary,
  GetArtistPresetsPayload,
  SetArtistEnabledPayload,
  DeleteArtistPayload,
  ActionReceipt,
  ServerTimeResponsePayload,
} from '@repo/types';
import { toast } from 'react-hot-toast';
import { useI18nStore } from './useI18nStore';
import { translateServerError } from '@/i18n/serverErrors';
import { estimateServerOffset } from '../hooks/useServerClock';

export interface PendingAction {
  event: string;
  createdAt: number;
  status: 'pending' | 'accepted' | 'rejected' | 'unknown';
  reason?: string;
}

/**
 * Room config patch. `musicTriviaArtistPresetId: null` explicitly leaves
 * artist-preset mode (JSON can't carry undefined across the socket).
 */
type UpdateConfigPayload = Omit<Partial<RoomState['config']>, 'musicTriviaArtistPresetId'> & {
  musicTriviaArtistPresetId?: string | null;
};

const STORAGE_KEYS = {
  roomCode: 'kz-roomCode',
  name: 'kz-name',
  reconnectToken: 'kz-reconnectToken',
} as const;

// Helper to translate server messages
const translateError = (message: string) => {
  const language = useI18nStore.getState().language;
  return translateServerError(message, language);
};

interface GameState {
  socket: Socket | null;
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'failed';
  retryConnection: () => void;
  isSpectator: boolean;
  room: RoomState | null;
  myRole: Role | null;
  myName: string;
  socketId: string;
  playerId: string;
  secretWord: string | null;
  availableRooms: AvailableRoom[];
  gameSettings: GameSettingsMap;
  artistPresets: ArtistPresetSummary[];
  categories: WordCategory[];
  isLoading: boolean;
  gameStartError: string | null;
  clearGameStartError: () => void;
  privateState: Record<string, unknown>;
  musicTriviaHostAnswer: MusicTriviaHostAnswerPayload | null;
  actionLoading: boolean;
  serverOffset: number;
  syncServerTime: () => void;
  connect: () => void;
  setName: (name: string) => void;
  isGameEnabled: (gameType: GameType | TttModeFlag) => boolean;
  setGameEnabled: (gameType: GameType | TttModeFlag, enabled: boolean, adminKey: string) => void;
  getArtistPresets: (adminKey?: string) => void;
  setArtistEnabled: (artistId: string, enabled: boolean, adminKey: string) => void;
  deleteArtist: (artistId: string, adminKey: string) => void;
  createRoom: (gameType?: GameType, config?: Partial<RoomConfig>) => void;
  joinRoom: (code: string) => void;
  startGame: () => void;
  setWord: (word: string) => void;
  endQuestioning: (timeout?: boolean) => void;
  stopTimer: () => void;
  submitVote: (targetId: string) => void;
  resetRoom: () => void;
  leaveRoom: () => void;
  updateConfig: (config: UpdateConfigPayload, cardGameConfig?: Partial<CardGameConfig>) => void;
  tttJoinSide: (side: 'X' | 'O') => void;
  tttMakeMove: (index: number) => void;
  tttReset: (toLobby?: boolean) => void;
  utttJoinSide: (side: 'X' | 'O') => void;
  utttMakeMove: (macroIndex: number, microIndex: number) => void;
  utttReset: (toLobby?: boolean) => void;
  rpsMakeChoice: (choice: 'ROCK' | 'PAPER' | 'SCISSORS') => void;
  rpsNextRound: () => void;
  rpsReset: () => void;
  gobblerJoinSide: (side: 'X' | 'O') => void;
  gobblerPlacePiece: (pieceId: string, toIndex: number) => void;
  gobblerMovePiece: (fromIndex: number, toIndex: number) => void;
  gobblerReset: (toLobby?: boolean) => void;
  soundsFishyTypeAnswer: (answer: string) => void;
  soundsFishySubmitAnswer: (answer: string) => void;
  soundsFishyRevealAnswer: (targetId: string) => void;
  soundsFishyEliminatePlayer: (targetId: string) => void;
  soundsFishyBankPoints: () => void;
  soundsFishyNextRound: () => void;
  soundsFishyReset: () => void;
  detectiveClubSubmitWord: (word: string) => void;
  detectiveClubPlayCard: (cardIndex: number) => void;
  detectiveClubNextPhase: () => void;
  detectiveClubVote: (targetId: string) => void;
  detectiveClubNextRound: () => void;
  detectiveClubReset: () => void;
  submitWordsWhoAmI: (playerWords: Record<string, string>) => void;
  submitPlayerWordWhoAmI: (word: string) => void;
  getCategoriesWhoAmI: (lang?: string) => void;
  gameActionWhoAmI: (action: { type: GameActionType } & Record<string, unknown>) => void;
  whoFirstGameAction: (action: { type: WhoFirstGameActionType; payload?: unknown }) => void;
  musicTriviaGameAction: (action: MusicTriviaAction) => void;
  theMindReady: () => void;
  theMindPlayCard: (card: number, pile?: 'UP' | 'DOWN') => void;
  theMindNextLevel: () => void;
  theMindProposeShuriken: () => void;
  theMindVoteShuriken: (agree: boolean) => void;
  theMindCancelShuriken: () => void;
  saboteurPlacePath: (cardIndex: number, x: number, y: number, rotation: 0 | 180) => void;
  saboteurPlayAction: (payload: {
    cardIndex: number;
    targetPlayerId?: string;
    repairTool?: SaboteurTool;
    goalIndex?: number;
    targetX?: number;
    targetY?: number;
  }) => void;
  saboteurDiscard: (cardIndex: number) => void;
  saboteurPickGold: (poolIndex: number) => void;
  saboteurNextRound: () => void;
  saboteurReset: () => void;
  coupDeclare: (type: CoupActionType, targetId?: string) => void;
  coupChallenge: () => void;
  coupBlock: (role?: CoupRole) => void;
  coupExchangeSelect: (keepIndices: number[]) => void;
  bananaThiefPeek: (targetId: string) => void;
  bananaThiefReady: (force?: boolean) => void;
  bananaThiefRollDie: () => void;
  bananaThiefChooseFollower: (targetId: string) => void;
  bananaThiefNextHour: () => void;
  bananaThiefVote: (targetId: string) => void;
  bananaThiefStartVote: () => void;
  bananaThiefNextRound: () => void;
  bananaThiefReset: () => void;
  bananaThiefReaction: (emoji: string) => void;
  cardGameAction: (action: CardGameAction) => void;
  pokerAction: (action: PokerAction) => void;
  spectateJoin: (code: string) => void;

  musicTriviaTrackAnswer: MusicTriviaTrackAnswerPayload | null;
  musicTriviaSyncPlay: MusicTriviaSyncPlayPayload | null;
  /** Latest room-wide emoji reaction (Banana Thief sound board). */
  lastBananaThiefReaction: { fromName: string; emoji: string; seq: number } | null;
  pendingActions: Record<string, PendingAction>;
  dismissPendingAction: (requestId: string) => void;
}

export const useGameStore = create<GameState>((set, get) => {
  let pendingSpectatorJoin: { code: string; previousIsSpectator: boolean } | null = null;
  const actionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  const clockSyncTimeouts: ReturnType<typeof setTimeout>[] = [];
  let bestRtt = Infinity;

  const clearAllActionTimeouts = () => {
    actionTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    actionTimeouts.clear();
  };

  const clearClockSyncTimeouts = () => {
    clockSyncTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    clockSyncTimeouts.length = 0;
  };

  /**
   * Standard game-action emitter: guards on socket/room/loading state,
   * flips `actionLoading`, and sends `{ code, ...payload }`.
   * Returns true when the event was actually emitted.
   */
  const emitGameAction = (
    event: string,
    options: {
      loading?: boolean;
      trackReceipt?: boolean;
      payload?: (room: RoomState) => Record<string, unknown>;
    } = {},
  ): boolean => {
    const { socket, room, actionLoading, connected, connectionStatus } = get();
    // Offline check: "offline ไม่ queue"
    if (!socket?.connected || !connected || connectionStatus !== 'connected' || !room) return false;
    const withLoading = options.loading ?? true;
    if (withLoading && actionLoading) return false;

    const shouldTrackReceipt =
      options.trackReceipt ??
      (event === SOCKET_EVENTS.TTT_MAKE_MOVE || event === SOCKET_EVENTS.RPS_MAKE_CHOICE);

    let requestId: string | undefined;
    if (shouldTrackReceipt) {
      requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const timeoutId = setTimeout(() => {
        actionTimeouts.delete(requestId!);
        const current = get().pendingActions[requestId!];
        if (current && current.status === 'pending') {
          const updated = { ...get().pendingActions };
          updated[requestId!] = { ...current, status: 'unknown' };
          const hasOtherPending = Object.values(updated).some((a) => a.status === 'pending');
          set({
            pendingActions: updated,
            actionLoading: hasOtherPending,
          });
        }
      }, 5000);

      actionTimeouts.set(requestId, timeoutId);
      set({
        pendingActions: {
          ...get().pendingActions,
          [requestId]: {
            event,
            createdAt: Date.now(),
            status: 'pending',
          },
        },
      });
    }

    if (withLoading) set({ actionLoading: true });
    socket.emit(event, {
      code: room.code,
      ...(options.payload ? options.payload(room) : {}),
      ...(requestId ? { requestId } : {}),
    });
    return true;
  };

  const clearRoomSession = () => {
    clearAllActionTimeouts();
    set({
      room: null,
      myRole: null,
      secretWord: null,
      privateState: {},
      isSpectator: false,
      playerId: '',
      pendingActions: {},
      actionLoading: false,
    });
  };

  return {
    socket: null,
    connected: false,
    connectionStatus: 'connecting',
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
    isSpectator: false,
    room: null,
    myRole: null,
    myName: '',
    socketId: '',
    playerId: '',
    secretWord: null,
    availableRooms: [],
    gameSettings: {},
    artistPresets: [],
    categories: [],

    isLoading: false,
    gameStartError: null,
    clearGameStartError: () => set({ gameStartError: null }),
    privateState: {},
    musicTriviaHostAnswer: null,
    actionLoading: false,
    serverOffset: 0,
    syncServerTime: () => {
      const socket = get().socket;
      if (!socket?.connected) return;
      clearClockSyncTimeouts();
      bestRtt = Infinity;
      for (let i = 0; i < 5; i++) {
        const timeout = setTimeout(() => {
          if (get().socket?.connected) {
            get().socket?.emit(SOCKET_EVENTS.SERVER_TIME_REQUEST, { clientSentAt: Date.now() });
          }
        }, i * 250);
        clockSyncTimeouts.push(timeout);
      }
    },
    pendingActions: {},
    dismissPendingAction: (requestId: string) => {
      const timeout = actionTimeouts.get(requestId);
      if (timeout) {
        clearTimeout(timeout);
        actionTimeouts.delete(requestId);
      }
      const updated = { ...get().pendingActions };
      delete updated[requestId];
      const hasOtherPending = Object.values(updated).some((a) => a.status === 'pending');
      set({ pendingActions: updated, actionLoading: hasOtherPending });
    },
    musicTriviaTrackAnswer: null,
    musicTriviaSyncPlay: null,
    lastBananaThiefReaction: null,

    setName: (name) => set({ myName: name }),

    isGameEnabled: (gameType) => get().gameSettings[gameType] ?? true,

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

    connect: () => {
      if (get().socket) return;
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.hostname}:3001`
          : 'http://localhost:3001');
      const socket = io(apiUrl);
      // Store the socket synchronously so a double-invoked mount effect
      // (React StrictMode) cannot open a second connection with the
      // single-use reconnect token.
      set({ socket });

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

      socket.on('disconnect', () => {
        clearAllActionTimeouts();
        clearClockSyncTimeouts();
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
      socket.on('connect_error', () => {
        clearAllActionTimeouts();
        set({
          connected: false,
          socketId: '',
          connectionStatus: 'failed',
          isLoading: false,
          actionLoading: false,
          pendingActions: {},
        });
      });

      socket.on(SOCKET_EVENTS.ROOM_STATE_UPDATED, (room: RoomState) => {
        if (pendingSpectatorJoin?.code === room.code) pendingSpectatorJoin = null;
        // Check if the current player is still in the room
        const isMe = room.players.some((p) => p.socketId === socket.id);

        // If we're not in the room's player list, ignore this update
        // (prevents race condition where leaveRoom sets room=null but server broadcast re-sets it)
        if (!isMe && !get().isSpectator) return;
        set({ connectionStatus: 'connected' });

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
          // Clear host answer when state updates (if not GAME_MASTER playing)
          if (
            room.musicTriviaState?.phase !== 'PLAYING' &&
            room.musicTriviaState?.phase !== 'BUZZED' &&
            room.musicTriviaState?.phase !== 'ANSWERING'
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
        const timeout = actionTimeouts.get(receipt.requestId);
        if (timeout) {
          clearTimeout(timeout);
          actionTimeouts.delete(receipt.requestId);
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
          toast.error(translateError(receipt.reason));
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
        if (rtt < bestRtt) {
          bestRtt = rtt;
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
          set({ privateState: data ?? {} });
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
          set({ isSpectator: false, playerId });
        },
      );

      socket.on(SOCKET_EVENTS.ROOM_DELETED, () => {
        localStorage.removeItem(STORAGE_KEYS.roomCode);
        localStorage.removeItem(STORAGE_KEYS.reconnectToken);
        clearRoomSession();
        toast.error(translateError('The Room Host has left. Room has been closed.'));
      });

      socket.on(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, (rooms: AvailableRoom[]) => {
        set({ availableRooms: rooms });
      });

      socket.on(SOCKET_EVENTS.WORD_SETTING_COMPLETED, ({ word }: { word: string }) => {
        set({ secretWord: word });
      });

      socket.on(SOCKET_EVENTS.WHO_AM_I_CATEGORIES_LIST, (categories: WordCategory[]) => {
        set({ categories });
      });

      socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, (answer: MusicTriviaHostAnswerPayload) => {
        set({ musicTriviaHostAnswer: answer });
      });

      socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
        let redirectedFromMissingInviteRoom = false;
        if (message === 'SPECTATORS_DISABLED' && pendingSpectatorJoin) {
          set({ isSpectator: pendingSpectatorJoin.previousIsSpectator });
          pendingSpectatorJoin = null;
        }
        if (message === 'Room not found') {
          localStorage.removeItem(STORAGE_KEYS.roomCode);
          localStorage.removeItem(STORAGE_KEYS.reconnectToken);
          clearRoomSession();
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

    createRoom: (gameType: GameType = GameType.WHO_KNOW, config?: Partial<RoomConfig>) => {
      const { socket, myName } = get();
      if (!myName) {
        toast.error(translateError('Please enter your name first'));
        return;
      }
      if (socket) {
        socket.emit(SOCKET_EVENTS.CREATE_ROOM, {
          name: myName,
          gameType,
          ...(config ? { config } : {}),
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

    startGame: () => {
      set({ gameStartError: null });
      if (emitGameAction(SOCKET_EVENTS.START_GAME)) set({ isLoading: true });
    },

    setWord: (word: string) => {
      emitGameAction(SOCKET_EVENTS.SET_WORD, { payload: () => ({ word }) });
    },

    endQuestioning: (timeout: boolean = false) => {
      emitGameAction(SOCKET_EVENTS.END_QUESTIONING, { payload: () => ({ timeout }) });
    },

    stopTimer: () => {
      emitGameAction(SOCKET_EVENTS.STOP_TIMER);
    },

    submitVote: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.SUBMIT_VOTE, { payload: () => ({ targetId }) });
    },

    resetRoom: () => {
      if (emitGameAction(SOCKET_EVENTS.RESET_GAME)) set({ myRole: null, secretWord: null });
    },

    leaveRoom: () => {
      set({ gameStartError: null });
      const { socket } = get();
      if (socket) {
        if (socket.connected) socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
        localStorage.removeItem(STORAGE_KEYS.roomCode);
        localStorage.removeItem(STORAGE_KEYS.reconnectToken);
        clearRoomSession();
        set({ connectionStatus: socket.connected ? 'connected' : 'connecting' });
      }
    },

    updateConfig: (config: UpdateConfigPayload, cardGameConfig?: Partial<CardGameConfig>) => {
      emitGameAction(SOCKET_EVENTS.UPDATE_CONFIG, {
        payload: () => ({ config, ...(cardGameConfig ? { cardGameConfig } : {}) }),
      });
    },

    cardGameAction: (action: CardGameAction) => {
      emitGameAction(SOCKET_EVENTS.CARD_GAME_ACTION, { payload: () => ({ action }) });
    },

    pokerAction: (action: PokerAction) => {
      emitGameAction(SOCKET_EVENTS.POKER_ACTION, { payload: () => ({ action }) });
    },

    tttJoinSide: (side: 'X' | 'O') => {
      emitGameAction(SOCKET_EVENTS.TTT_JOIN_SIDE, { payload: () => ({ side }) });
    },

    tttMakeMove: (index: number) => {
      emitGameAction(SOCKET_EVENTS.TTT_MAKE_MOVE, { payload: () => ({ index }) });
    },

    tttReset: (toLobby?: boolean) => {
      emitGameAction(SOCKET_EVENTS.TTT_RESET, { payload: () => ({ toLobby }) });
    },

    utttJoinSide: (side: 'X' | 'O') => {
      emitGameAction(SOCKET_EVENTS.UTTT_JOIN_SIDE, { payload: () => ({ side }) });
    },

    utttMakeMove: (macroIndex: number, microIndex: number) => {
      emitGameAction(SOCKET_EVENTS.UTTT_MAKE_MOVE, {
        payload: () => ({ macroIndex, microIndex }),
      });
    },

    utttReset: (toLobby?: boolean) => {
      emitGameAction(SOCKET_EVENTS.UTTT_RESET, { payload: () => ({ toLobby }) });
    },

    rpsNextRound: () => {
      emitGameAction(SOCKET_EVENTS.RPS_NEXT_ROUND);
    },

    rpsMakeChoice: (choice: 'ROCK' | 'PAPER' | 'SCISSORS') => {
      emitGameAction(SOCKET_EVENTS.RPS_MAKE_CHOICE, { payload: () => ({ choice }) });
    },

    rpsReset: () => {
      emitGameAction(SOCKET_EVENTS.RPS_RESET);
    },

    gobblerJoinSide: (side: 'X' | 'O') => {
      emitGameAction(SOCKET_EVENTS.GOBBLER_JOIN_SIDE, { payload: () => ({ side }) });
    },

    gobblerPlacePiece: (pieceId: string, toIndex: number) => {
      emitGameAction(SOCKET_EVENTS.GOBBLER_PLACE, { payload: () => ({ pieceId, toIndex }) });
    },

    gobblerMovePiece: (fromIndex: number, toIndex: number) => {
      emitGameAction(SOCKET_EVENTS.GOBBLER_MOVE, { payload: () => ({ fromIndex, toIndex }) });
    },

    gobblerReset: (toLobby?: boolean) => {
      emitGameAction(SOCKET_EVENTS.GOBBLER_RESET, { payload: () => ({ toLobby }) });
    },

    soundsFishyTypeAnswer: (answer: string) => {
      // Typing must stay responsive — no loading guard
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_TYPE_ANSWER, {
        loading: false,
        payload: () => ({ answer }),
      });
    },

    soundsFishySubmitAnswer: (answer: string) => {
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_SUBMIT_ANSWER, { payload: () => ({ answer }) });
    },

    soundsFishyRevealAnswer: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_REVEAL_ANSWER, { payload: () => ({ targetId }) });
    },

    soundsFishyEliminatePlayer: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_ELIMINATE_PLAYER, {
        payload: () => ({ targetId }),
      });
    },

    soundsFishyBankPoints: () => {
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_BANK_POINTS);
    },

    soundsFishyNextRound: () => {
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_NEXT_ROUND);
    },

    soundsFishyReset: () => {
      emitGameAction(SOCKET_EVENTS.SOUNDS_FISHY_RESET);
    },

    detectiveClubSubmitWord: (word: string) => {
      emitGameAction(SOCKET_EVENTS.DETECTIVE_CLUB_SUBMIT_WORD, { payload: () => ({ word }) });
    },

    detectiveClubPlayCard: (cardIndex: number) => {
      emitGameAction(SOCKET_EVENTS.DETECTIVE_CLUB_PLAY_CARD, { payload: () => ({ cardIndex }) });
    },

    detectiveClubNextPhase: () => {
      emitGameAction(SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_PHASE);
    },

    detectiveClubVote: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.DETECTIVE_CLUB_VOTE, { payload: () => ({ targetId }) });
    },

    detectiveClubNextRound: () => {
      emitGameAction(SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_ROUND);
    },

    detectiveClubReset: () => {
      emitGameAction(SOCKET_EVENTS.DETECTIVE_CLUB_RESET);
    },

    submitWordsWhoAmI: (playerWords: Record<string, string>) => {
      emitGameAction(SOCKET_EVENTS.WHO_AM_I_SUBMIT_WORDS, { payload: () => ({ playerWords }) });
    },

    submitPlayerWordWhoAmI: (word: string) => {
      emitGameAction(SOCKET_EVENTS.WHO_AM_I_SUBMIT_PLAYER_WORD, { payload: () => ({ word }) });
    },

    getCategoriesWhoAmI: (lang?: string) => {
      const { socket } = get();
      if (socket) {
        socket.emit(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang });
      }
    },

    gameActionWhoAmI: (action: { type: GameActionType } & Record<string, unknown>) => {
      emitGameAction(SOCKET_EVENTS.GAME_ACTION, { payload: () => ({ action }) });
    },

    whoFirstGameAction: (action: { type: WhoFirstGameActionType; payload?: unknown }) => {
      emitGameAction(SOCKET_EVENTS.GAME_ACTION, { payload: () => ({ action }) });
    },

    musicTriviaGameAction: (action: MusicTriviaAction) => {
      emitGameAction(SOCKET_EVENTS.GAME_ACTION, { payload: () => ({ action }) });
    },

    theMindReady: () => {
      emitGameAction(SOCKET_EVENTS.THE_MIND_READY);
    },

    theMindPlayCard: (card: number, pile?: 'UP' | 'DOWN') => {
      emitGameAction(SOCKET_EVENTS.THE_MIND_PLAY_CARD, { payload: () => ({ card, pile }) });
    },

    theMindNextLevel: () => {
      emitGameAction(SOCKET_EVENTS.THE_MIND_NEXT_LEVEL);
    },

    theMindProposeShuriken: () => {
      emitGameAction(SOCKET_EVENTS.THE_MIND_PROPOSE_SHURIKEN);
    },

    theMindVoteShuriken: (agree: boolean) => {
      emitGameAction(SOCKET_EVENTS.THE_MIND_VOTE_SHURIKEN, { payload: () => ({ agree }) });
    },

    theMindCancelShuriken: () => {
      emitGameAction(SOCKET_EVENTS.THE_MIND_CANCEL_SHURIKEN);
    },

    saboteurPlacePath: (cardIndex, x, y, rotation) => {
      emitGameAction(SOCKET_EVENTS.SABOTEUR_PLACE_PATH, {
        payload: () => ({ cardIndex, x, y, rotation }),
      });
    },

    saboteurPlayAction: (payload) => {
      emitGameAction(SOCKET_EVENTS.SABOTEUR_PLAY_ACTION, { payload: () => payload });
    },

    saboteurDiscard: (cardIndex) => {
      emitGameAction(SOCKET_EVENTS.SABOTEUR_DISCARD, { payload: () => ({ cardIndex }) });
    },

    saboteurPickGold: (poolIndex) => {
      emitGameAction(SOCKET_EVENTS.SABOTEUR_PICK_GOLD, { payload: () => ({ poolIndex }) });
    },

    saboteurNextRound: () => {
      emitGameAction(SOCKET_EVENTS.SABOTEUR_NEXT_ROUND);
    },

    saboteurReset: () => {
      emitGameAction(SOCKET_EVENTS.SABOTEUR_RESET);
    },

    coupDeclare: (type: CoupActionType, targetId?: string) => {
      emitGameAction(SOCKET_EVENTS.COUP_DECLARE, {
        payload: () => ({ type, ...(targetId ? { targetId } : {}) }),
      });
    },

    coupChallenge: () => {
      emitGameAction(SOCKET_EVENTS.COUP_CHALLENGE);
    },

    coupBlock: (role?: CoupRole) => {
      emitGameAction(SOCKET_EVENTS.COUP_BLOCK, { payload: () => (role ? { role } : {}) });
    },

    coupExchangeSelect: (keepIndices: number[]) => {
      emitGameAction(SOCKET_EVENTS.COUP_EXCHANGE_SELECT, { payload: () => ({ keepIndices }) });
    },

    bananaThiefPeek: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_PEEK, { payload: () => ({ targetId }) });
    },

    bananaThiefReady: (force?: boolean) => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_READY, {
        loading: false,
        payload: () => (force ? { force: true } : {}),
      });
    },

    bananaThiefRollDie: () => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_ROLL_DIE, { loading: false });
    },

    bananaThiefChooseFollower: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_CHOOSE_FOLLOWER, { payload: () => ({ targetId }) });
    },

    bananaThiefNextHour: () => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_NEXT_HOUR, { loading: false });
    },

    bananaThiefVote: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_VOTE, { payload: () => ({ targetId }) });
    },

    bananaThiefStartVote: () => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_START_VOTE);
    },

    bananaThiefNextRound: () => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_NEXT_ROUND);
    },

    bananaThiefReset: () => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_RESET);
    },

    bananaThiefReaction: (emoji: string) => {
      emitGameAction(SOCKET_EVENTS.BANANA_THIEF_REACTION, {
        loading: false,
        payload: () => ({ emoji }),
      });
    },

    spectateJoin: (code: string) => {
      const { socket, myName } = get();
      if (socket && myName) {
        const normalizedCode = code.toUpperCase();
        pendingSpectatorJoin = { code: normalizedCode, previousIsSpectator: get().isSpectator };
        set({ isLoading: true, isSpectator: true });
        socket.emit(SOCKET_EVENTS.SPECTATE_JOIN, { code: normalizedCode, name: myName });
      }
    },
  };
});

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__useGameStore = useGameStore;
}
