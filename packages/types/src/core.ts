import { TicTacToeState } from './tic-tac-toe';
import { RPSState } from './rps';
import { GobblerState } from './gobbler-tic-tac-toe';
import { WinningTeam, Role } from './who-know';
import { SoundsFishyState } from './sounds-fishy';
import { DetectiveClubState } from './detective-club';
import { WhoAmIGameState } from './who-am-i';

export enum RoomStatus {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  WORD_SETTING = 'WORD_SETTING',
  QUESTIONING = 'QUESTIONING',
  VOTING = 'VOTING',
  RESULT = 'RESULT',
}

export enum GameType {
  WHO_KNOW = 'WHO_KNOW',
  TIC_TAC_TOE = 'TIC_TAC_TOE',
  RPS = 'RPS',
  GOBBLER_TIC_TAC_TOE = 'GOBBLER_TIC_TAC_TOE',
  SOUNDS_FISHY = 'SOUNDS_FISHY',
  DETECTIVE_CLUB = 'DETECTIVE_CLUB',
  WHO_AM_I = 'WHO_AM_I',
}

// Socket Constants
export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  ROOM_STATE_UPDATED: 'room_state_updated',
  ROOM_DELETED: 'room_deleted',
  START_GAME: 'start_game',
  ROLE_ASSIGNED: 'role_assigned',
  SET_WORD: 'set_word',
  WORD_SETTING_COMPLETED: 'word_setting_completed',
  END_QUESTIONING: 'end_questioning',
  STOP_TIMER: 'stop_timer',
  TIMER_UPDATE: 'timer_update',
  SUBMIT_VOTE: 'submit_vote',
  RESET_GAME: 'reset_game',
  UPDATE_CONFIG: 'update_config',
  GET_AVAILABLE_ROOMS: 'get_available_rooms',
  AVAILABLE_ROOMS_UPDATED: 'available_rooms_updated',
  ERROR: 'error',
  // Tic-Tac-Toe specific events
  TTT_JOIN_SIDE: 'ttt_join_side',
  TTT_MAKE_MOVE: 'ttt_make_move',
  TTT_RESET: 'ttt_reset',
  // RPS specific events
  RPS_NEXT_ROUND: 'rps_next_round',
  RPS_MAKE_CHOICE: 'rps_make_choice',
  RPS_RESET: 'rps_reset',
  // Gobbler Tic-Tac-Toe specific events
  GOBBLER_JOIN_SIDE: 'gobbler_join_side',
  GOBBLER_PLACE: 'gobbler_place',
  GOBBLER_MOVE: 'gobbler_move',
  GOBBLER_RESET: 'gobbler_reset',
  // Sounds Fishy specific events
  SOUNDS_FISHY_SUBMIT_ANSWER: 'sounds_fishy_submit_answer',
  SOUNDS_FISHY_REVEAL_ANSWER: 'sounds_fishy_reveal_answer',
  SOUNDS_FISHY_ELIMINATE_PLAYER: 'sounds_fishy_eliminate_player',
  SOUNDS_FISHY_BANK_POINTS: 'sounds_fishy_bank_points',
  SOUNDS_FISHY_RESET: 'sounds_fishy_reset',
  SOUNDS_FISHY_NEXT_ROUND: 'sounds_fishy_next_round',
  SOUNDS_FISHY_TYPE_ANSWER: 'sounds_fishy_type_answer',
  // Detective Club specific events
  DETECTIVE_CLUB_SUBMIT_WORD: 'detective_club_submit_word',
  DETECTIVE_CLUB_PLAY_CARD: 'detective_club_play_card',
  DETECTIVE_CLUB_NEXT_PHASE: 'detective_club_next_phase',
  DETECTIVE_CLUB_VOTE: 'detective_club_vote',
  DETECTIVE_CLUB_NEXT_ROUND: 'detective_club_next_round',
  DETECTIVE_CLUB_RESET: 'detective_club_reset',
  // Who Am I specific events
  WHO_AM_I_SUBMIT_WORDS: 'who_am_i_submit_words',
  WHO_AM_I_SUBMIT_PLAYER_WORD: 'who_am_i_submit_player_word',
  WHO_AM_I_GET_CATEGORIES: 'who_am_i_get_categories',
  WHO_AM_I_CATEGORIES_LIST: 'who_am_i_categories_list',
  GAME_ACTION: 'game_action',
} as const;

export interface UserState {
  id: string;
  name: string;
  socketId: string;
  role?: Role;
  score: number;
  roomId: string;
  hasBeenHost?: boolean;
  connected?: boolean;
}

export interface RoomConfig {
  hostSelection: 'ROUND_ROBIN' | 'RANDOM' | 'FIXED';
  timerMin: number;
  rpsBestOf?: number; // e.g., 1, 3, 5
  rpsMode?: '1V1_ROUND_ROBIN' | 'ALL_AT_ONCE';
  language?: 'en' | 'th';
  // Who Am I config
  maxRounds?: number;
  wordMode?: 'HOST_INPUT' | 'RANDOM' | 'PLAYER_INPUT';
  wordCategory?: string;
}

export interface RoomState {
  id: string;
  gameType: GameType;
  code: string;
  status: RoomStatus;
  roomHostId: string;
  players: UserState[];
  createdAt: Date;
  endTime?: number;
  votes?: Record<string, string>;
  winner?: WinningTeam;
  config: RoomConfig;
  ticTacToeState?: TicTacToeState;
  rpsState?: RPSState;
  gobblerState?: GobblerState;
  soundsFishyState?: SoundsFishyState;
  detectiveClubState?: DetectiveClubState;
  whoAmIState?: WhoAmIGameState;
}

export interface AvailableRoom {
  code: string;
  gameType: GameType;
  hostName: string;
  playerCount: number;
}
