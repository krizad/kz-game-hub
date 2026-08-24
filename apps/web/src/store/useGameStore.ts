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
  Role,
  SOCKET_EVENTS,
  AvailableRoom,
  GameType,
  WhoFirstGameActionType,
  WordCategory,
} from '@repo/types';
import { toast } from 'react-hot-toast';
import { useI18nStore } from './useI18nStore';
import { translateServerError } from '@/i18n/serverErrors';

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
  isSpectator: boolean;
  room: RoomState | null;
  myRole: Role | null;
  myName: string;
  socketId: string;
  playerId: string;
  secretWord: string | null;
  availableRooms: AvailableRoom[];
  categories: WordCategory[];
  isLoading: boolean;
  privateState: Record<string, unknown>;
  musicTriviaHostAnswer: MusicTriviaHostAnswerPayload | null;
  actionLoading: boolean;
  connect: () => void;
  setName: (name: string) => void;
  createRoom: (gameType?: GameType) => void;
  joinRoom: (code: string) => void;
  startGame: () => void;
  setWord: (word: string) => void;
  endQuestioning: (timeout?: boolean) => void;
  stopTimer: () => void;
  submitVote: (targetId: string) => void;
  resetRoom: () => void;
  leaveRoom: () => void;
  updateConfig: (config: Partial<RoomState['config']>) => void;
  tttJoinSide: (side: 'X' | 'O') => void;
  tttMakeMove: (index: number) => void;
  tttReset: () => void;
  rpsMakeChoice: (choice: 'ROCK' | 'PAPER' | 'SCISSORS') => void;
  rpsNextRound: () => void;
  rpsReset: () => void;
  gobblerJoinSide: (side: 'X' | 'O') => void;
  gobblerPlacePiece: (pieceId: string, toIndex: number) => void;
  gobblerMovePiece: (fromIndex: number, toIndex: number) => void;
  gobblerReset: () => void;
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
  spectateJoin: (code: string) => void;

  musicTriviaTrackAnswer: MusicTriviaTrackAnswerPayload | null;
  musicTriviaSyncPlay: MusicTriviaSyncPlayPayload | null;
}

export const useGameStore = create<GameState>((set, get) => {
  /**
   * Standard game-action emitter: guards on socket/room/loading state,
   * flips `actionLoading`, and sends `{ code, ...payload }`.
   * Returns true when the event was actually emitted.
   */
  const emitGameAction = (
    event: string,
    options: { loading?: boolean; payload?: (room: RoomState) => Record<string, unknown> } = {},
  ): boolean => {
    const { socket, room, actionLoading } = get();
    if (!socket || !room) return false;
    const withLoading = options.loading ?? true;
    if (withLoading && actionLoading) return false;
    if (withLoading) set({ actionLoading: true });
    socket.emit(event, {
      code: room.code,
      ...(options.payload ? options.payload(room) : {}),
    });
    return true;
  };

  const clearRoomSession = () =>
    set({
      room: null,
      myRole: null,
      secretWord: null,
      privateState: {},
      isSpectator: false,
      playerId: '',
    });

  return {
    socket: null,
    connected: false,
    isSpectator: false,
    room: null,
    myRole: null,
    myName: '',
    socketId: '',
    playerId: '',
    secretWord: null,
    availableRooms: [],
    categories: [],

    isLoading: false,
    privateState: {},
    musicTriviaHostAnswer: null,
    actionLoading: false,
    musicTriviaTrackAnswer: null,
    musicTriviaSyncPlay: null,

    setName: (name) => set({ myName: name }),

    connect: () => {
      if (get().socket) return;
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.hostname}:3001`
          : 'http://localhost:3001');
      const socket = io(apiUrl);

      socket.on('connect', () => {
        set({ connected: true, socket, socketId: socket.id });

        // Auto-reconnect if session exists
        const savedCode = localStorage.getItem(STORAGE_KEYS.roomCode);
        const savedName = localStorage.getItem(STORAGE_KEYS.name);
        const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken);
        if (savedCode && savedName) {
          set({ myName: savedName });
          socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
            code: savedCode,
            name: savedName,
            ...(reconnectToken ? { reconnectToken } : {}),
          });
        }

        // Request active rooms lobby
        socket.emit(SOCKET_EVENTS.GET_AVAILABLE_ROOMS);
      });

      socket.on('disconnect', () => {
        set({ connected: false, socketId: '' });
      });

      socket.on(SOCKET_EVENTS.ROOM_STATE_UPDATED, (room: RoomState) => {
        // Check if the current player is still in the room
        const currentName = get().myName;
        const isMe = room.players.find((p) => p.socketId === socket.id || p.name === currentName);

        // If we're not in the room's player list, ignore this update
        // (prevents race condition where leaveRoom sets room=null but server broadcast re-sets it)
        if (!isMe && !get().isSpectator) return;

        if (room.status === RoomStatus.LOBBY) {
          set({
            room,
            myRole: null,
            secretWord: null,
            privateState: {},
            isLoading: false,
            actionLoading: false,
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

          set({ room, isLoading: false, actionLoading: false });
        }

        if (!get().isSpectator) {
          localStorage.setItem(STORAGE_KEYS.roomCode, room.code);
          localStorage.setItem(STORAGE_KEYS.name, currentName);
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
        if (message.startsWith('Room not found')) {
          localStorage.removeItem(STORAGE_KEYS.roomCode);
          localStorage.removeItem(STORAGE_KEYS.reconnectToken);
          set({ room: null, isSpectator: false, playerId: '' });
        }
        set({ isLoading: false, actionLoading: false });
        toast.error(translateError(message));
      });

      socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_TRACK_ANSWER, (data: MusicTriviaTrackAnswerPayload) => {
        set({ musicTriviaTrackAnswer: data });
      });

      socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, (data: MusicTriviaSyncPlayPayload) => {
        set({ musicTriviaSyncPlay: data });
      });
    },

    createRoom: (gameType: GameType = GameType.WHO_KNOW) => {
      const { socket, myName } = get();
      if (!myName) {
        toast.error(translateError('Please enter your name first'));
        return;
      }
      if (socket) {
        socket.emit(SOCKET_EVENTS.CREATE_ROOM, { name: myName, gameType });
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
      const { socket } = get();
      if (socket) {
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
        localStorage.removeItem(STORAGE_KEYS.roomCode);
        localStorage.removeItem(STORAGE_KEYS.reconnectToken);
        clearRoomSession();
      }
    },

    updateConfig: (config: Partial<RoomState['config']>) => {
      emitGameAction(SOCKET_EVENTS.UPDATE_CONFIG, { payload: () => ({ config }) });
    },

    tttJoinSide: (side: 'X' | 'O') => {
      emitGameAction(SOCKET_EVENTS.TTT_JOIN_SIDE, { payload: () => ({ side }) });
    },

    tttMakeMove: (index: number) => {
      emitGameAction(SOCKET_EVENTS.TTT_MAKE_MOVE, { payload: () => ({ index }) });
    },

    tttReset: () => {
      emitGameAction(SOCKET_EVENTS.TTT_RESET);
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

    gobblerReset: () => {
      emitGameAction(SOCKET_EVENTS.GOBBLER_RESET);
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

    spectateJoin: (code: string) => {
      const { socket, myName } = get();
      if (socket && myName) {
        set({ isLoading: true, isSpectator: true });
        socket.emit(SOCKET_EVENTS.SPECTATE_JOIN, { code: code.toUpperCase(), name: myName });
      }
    },
  };
});

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__useGameStore = useGameStore;
}
