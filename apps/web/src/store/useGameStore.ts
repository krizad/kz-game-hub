import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  RoomState,
  RoomStatus,
  Role,
  SOCKET_EVENTS,
  AvailableRoom,
  GameType,
  WordCategory,
} from '@repo/types';
import { toast } from 'react-hot-toast';

interface GameState {
  socket: Socket | null;
  connected: boolean;
  room: RoomState | null;
  myRole: Role | null;
  myName: string;
  socketId: string;
  secretWord: string | null;
  availableRooms: AvailableRoom[];
  categories: WordCategory[];
  isLoading: boolean;
  musicTriviaHostAnswer: {
    title: string;
    artist: string;
    artworkUrl?: string;
    trackViewUrl?: string;
  } | null;
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
  gameActionWhoAmI: (action: any) => void;
  musicTriviaGameAction: (action: any) => void;
  spectateJoin: (code: string) => void;
  getLeaderboard: (gameType?: string) => void;
  leaderboard: any[];
  setLeaderboard: (data: any[]) => void;
  musicTriviaTrackAnswer: { roundNumber: number } | null;
  musicTriviaSyncPlay: {
    roundNumber: number;
    playStartTime: number;
    previewUrl: string;
    sourceType: string;
    durationMs: number;
    artworkUrl?: string;
  } | null;
}

export const useGameStore = create<GameState>((set, get) => ({
  socket: null,
  connected: false,
  room: null,
  myRole: null,
  myName: '',
  socketId: '',
  secretWord: null,
  availableRooms: [],
  categories: [],
  leaderboard: [],
  isLoading: false,
  musicTriviaHostAnswer: null,
  actionLoading: false,
  musicTriviaTrackAnswer: null,
  musicTriviaSyncPlay: null,

  setName: (name) => set({ myName: name }),

  connect: () => {
    if (get().socket) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(apiUrl);

    socket.on('connect', () => {
      set({ connected: true, socket, socketId: socket.id });

      // Auto-reconnect if session exists
      const savedCode = localStorage.getItem('who-know-roomCode');
      const savedName = localStorage.getItem('who-know-name');
      if (savedCode && savedName) {
        set({ myName: savedName });
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: savedCode, name: savedName });
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
      if (!isMe) return;

      if (room.status === RoomStatus.LOBBY) {
        set({ room, myRole: null, secretWord: null, isLoading: false, actionLoading: false });
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

      // Save session
      localStorage.setItem('who-know-roomCode', room.code);
      localStorage.setItem('who-know-name', currentName);
    });

    socket.on(SOCKET_EVENTS.ROLE_ASSIGNED, ({ role }: { role: Role }) => {
      set({ myRole: role });
    });

    socket.on(SOCKET_EVENTS.ROOM_DELETED, () => {
      localStorage.removeItem('who-know-roomCode');
      set({ room: null, myRole: null, secretWord: null });
      toast.error('The Room Host has left. Room has been closed.');
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

    socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_HOST_ANSWER, (answer: any) => {
      set({ musicTriviaHostAnswer: answer });
    });

    socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
      if (message === 'Room not found') {
        localStorage.removeItem('who-know-roomCode');
        set({ room: null });
      }
      set({ isLoading: false, actionLoading: false });
      toast.error(message);
    });

    socket.on(SOCKET_EVENTS.LEADERBOARD_DATA, (data: any[]) => {
      set({ leaderboard: data || [] });
    });

    socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_TRACK_ANSWER, (data) => {
      set({ musicTriviaTrackAnswer: data });
    });

    socket.on(SOCKET_EVENTS.MUSIC_TRIVIA_SYNC_PLAY, (data) => {
      set({ musicTriviaSyncPlay: data });
    });
  },

  createRoom: (gameType: GameType = GameType.WHO_KNOW) => {
    const { socket, myName } = get();
    if (socket && myName) {
      socket.emit('create_room', { name: myName, gameType });
    } else if (!myName) {
      toast.error('Please enter your name first');
    }
  },

  joinRoom: (code: string) => {
    const { socket, myName } = get();
    if (socket && myName) {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code, name: myName });
    } else if (!myName) {
      toast.error('Please enter your name first');
    }
  },

  startGame: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ isLoading: true, actionLoading: true });
      socket.emit(SOCKET_EVENTS.START_GAME, { code: room.code });
    }
  },

  setWord: (word: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SET_WORD, { code: room.code, word });
    }
  },

  endQuestioning: (timeout: boolean = false) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.END_QUESTIONING, { code: room.code, timeout });
    }
  },

  stopTimer: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.STOP_TIMER, { code: room.code });
    }
  },

  submitVote: (targetId: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SUBMIT_VOTE, { code: room.code, targetId });
    }
  },

  resetRoom: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ myRole: null, secretWord: null, actionLoading: true });
      socket.emit(SOCKET_EVENTS.RESET_GAME, { code: room.code });
    }
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('leave_room');
      localStorage.removeItem('who-know-roomCode');
      set({ room: null, myRole: null, secretWord: null });
    }
  },

  updateConfig: (config: Partial<RoomState['config']>) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, { code: room.code, config });
    }
  },

  tttJoinSide: (side: 'X' | 'O') => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.TTT_JOIN_SIDE, { code: room.code, side });
    }
  },

  tttMakeMove: (index: number) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.TTT_MAKE_MOVE, { code: room.code, index });
    }
  },

  tttReset: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.TTT_RESET, { code: room.code });
    }
  },

  rpsNextRound: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.RPS_NEXT_ROUND, { code: room.code });
    }
  },

  rpsMakeChoice: (choice: 'ROCK' | 'PAPER' | 'SCISSORS') => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.RPS_MAKE_CHOICE, { code: room.code, choice });
    }
  },

  rpsReset: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.RPS_RESET, { code: room.code });
    }
  },

  gobblerJoinSide: (side: 'X' | 'O') => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.GOBBLER_JOIN_SIDE, { code: room.code, side });
    }
  },

  gobblerPlacePiece: (pieceId: string, toIndex: number) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.GOBBLER_PLACE, { code: room.code, pieceId, toIndex });
    }
  },

  gobblerMovePiece: (fromIndex: number, toIndex: number) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.GOBBLER_MOVE, { code: room.code, fromIndex, toIndex });
    }
  },

  gobblerReset: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.GOBBLER_RESET, { code: room.code });
    }
  },

  soundsFishyTypeAnswer: (answer: string) => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_TYPE_ANSWER, { code: room.code, answer });
    }
  },

  soundsFishySubmitAnswer: (answer: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_SUBMIT_ANSWER, { code: room.code, answer });
    }
  },

  soundsFishyRevealAnswer: (targetId: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_REVEAL_ANSWER, { code: room.code, targetId });
    }
  },

  soundsFishyEliminatePlayer: (targetId: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_ELIMINATE_PLAYER, { code: room.code, targetId });
    }
  },

  soundsFishyBankPoints: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_BANK_POINTS, { code: room.code });
    }
  },

  soundsFishyNextRound: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_NEXT_ROUND, { code: room.code });
    }
  },

  soundsFishyReset: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.SOUNDS_FISHY_RESET, { code: room.code });
    }
  },

  detectiveClubSubmitWord: (word: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.DETECTIVE_CLUB_SUBMIT_WORD, { code: room.code, word });
    }
  },

  detectiveClubPlayCard: (cardIndex: number) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.DETECTIVE_CLUB_PLAY_CARD, { code: room.code, cardIndex });
    }
  },

  detectiveClubNextPhase: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_PHASE, { code: room.code });
    }
  },

  detectiveClubVote: (targetId: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.DETECTIVE_CLUB_VOTE, { code: room.code, targetId });
    }
  },

  detectiveClubNextRound: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.DETECTIVE_CLUB_NEXT_ROUND, { code: room.code });
    }
  },

  detectiveClubReset: () => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.DETECTIVE_CLUB_RESET, { code: room.code });
    }
  },

  submitWordsWhoAmI: (playerWords: Record<string, string>) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.WHO_AM_I_SUBMIT_WORDS, { code: room.code, playerWords });
    }
  },

  submitPlayerWordWhoAmI: (word: string) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.WHO_AM_I_SUBMIT_PLAYER_WORD, { code: room.code, word });
    }
  },

  getCategoriesWhoAmI: (lang?: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, { lang });
    }
  },

  gameActionWhoAmI: (action: any) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.GAME_ACTION, { code: room.code, action });
    }
  },

  musicTriviaGameAction: (action: any) => {
    const { socket, room, actionLoading } = get();
    if (socket && room && !actionLoading) {
      set({ actionLoading: true });
      socket.emit(SOCKET_EVENTS.GAME_ACTION, { code: room.code, action });
    }
  },

  spectateJoin: (code: string) => {
    const { socket, myName } = get();
    if (socket && myName) {
      set({ isLoading: true });
      socket.emit(SOCKET_EVENTS.SPECTATE_JOIN, { code: code.toUpperCase(), name: myName });
    }
  },

  getLeaderboard: (gameType?: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SOCKET_EVENTS.LEADERBOARD_GET, { gameType });
    }
  },

  setLeaderboard: (data: any[]) => {
    set({ leaderboard: data });
  },
}));
