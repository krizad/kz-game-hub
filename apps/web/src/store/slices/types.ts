import { Socket } from 'socket.io-client';
import {
  ArtistPresetSummary,
  AvailableRoom,
  CardGameAction,
  CardGameConfig,
  CipherAssignTeamPayload,
  CipherClueCount,
  CoupActionType,
  CoupRole,
  DogRelayAction,
  DogRelayPrivateState,
  GameActionType,
  GameSettingsMap,
  GameType,
  MusicTriviaAction,
  MusicTriviaHostAnswerPayload,
  MusicTriviaSyncPlayPayload,
  MusicTriviaTrackAnswerPayload,
  PokerAction,
  PokerV2Action,
  ResultRevealActionPayload,
  Role,
  RoomConfig,
  RoomState,
  SaboteurTool,
  ShipPlacement,
  TttModeFlag,
  WerewolfNightActionKind,
  WhoFirstGameActionType,
  WordCategory,
} from '@repo/types';
import { useI18nStore } from '../useI18nStore';
import { translateServerError } from '@/i18n/serverErrors';

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
export type UpdateConfigPayload = Omit<Partial<RoomState['config']>, 'musicTriviaArtistPresetId'> & {
  musicTriviaArtistPresetId?: string | null;
};

export const STORAGE_KEYS = {
  roomCode: 'kz-roomCode',
  name: 'kz-name',
  reconnectToken: 'kz-reconnectToken',
} as const;

export const translateError = (message: string): string => {
  const language = useI18nStore.getState().language;
  return translateServerError(message, language);
};

export interface ConnectionSlice {
  socket: Socket | null;
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'failed';
  socketId: string;
  serverOffset: number;
  actionLoading: boolean;
  pendingActions: Record<string, PendingAction>;
  retryConnection: () => void;
  syncServerTime: () => void;
  connect: () => void;
  dismissPendingAction: (requestId: string) => void;
}

export interface LobbySlice {
  isSpectator: boolean;
  room: RoomState | null;
  myRole: Role | null;
  myName: string;
  playerId: string;
  secretWord: string | null;
  availableRooms: AvailableRoom[];
  gameSettings: GameSettingsMap;
  artistPresets: ArtistPresetSummary[];
  categories: WordCategory[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  categoriesLang: string | null;
  isLoading: boolean;
  gameStartError: string | null;
  privateState: Record<string, unknown>;
  clearGameStartError: () => void;
  resultRevealAction: (action: ResultRevealActionPayload['action']) => void;
  setName: (name: string) => void;
  isGameEnabled: (gameType: GameType | TttModeFlag) => boolean;
  verifyAdminKey: (adminKey: string) => Promise<boolean>;
  setGameEnabled: (gameType: GameType | TttModeFlag, enabled: boolean, adminKey: string) => void;
  getArtistPresets: (adminKey?: string) => void;
  setArtistEnabled: (artistId: string, enabled: boolean, adminKey: string) => void;
  deleteArtist: (artistId: string, adminKey: string) => void;
  createRoom: (gameType?: GameType, config?: Partial<RoomConfig>) => void;
  joinRoom: (code: string) => void;
  spectateJoin: (code: string) => void;
  startGame: () => void;
  resetRoom: () => void;
  leaveRoom: () => void;
  updateConfig: (config: UpdateConfigPayload, cardGameConfig?: Partial<CardGameConfig>) => void;
}

export interface GameActionsSlice {
  musicTriviaHostAnswer: MusicTriviaHostAnswerPayload | null;
  musicTriviaTrackAnswer: MusicTriviaTrackAnswerPayload | null;
  musicTriviaSyncPlay: MusicTriviaSyncPlayPayload | null;
  /** Latest room-wide emoji reaction (Banana Thief sound board). */
  lastBananaThiefReaction: { fromName: string; emoji: string; seq: number } | null;
  sendDogRelayAction: (action: DogRelayAction) => void;
  setWord: (word: string) => void;
  endQuestioning: (timeout?: boolean) => void;
  stopTimer: () => void;
  submitVote: (targetId: string) => void;
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
  pokerV2Action: (action: PokerV2Action) => void;
  cipherAssignTeam: (payload: CipherAssignTeamPayload) => void;
  cipherRandomizeTeams: () => void;
  cipherStartMatch: () => void;
  cipherGiveClue: (word: string, count: CipherClueCount) => void;
  cipherPingCard: (cardIndex: number) => void;
  cipherRevealCard: (cardIndex: number) => void;
  cipherEndTurn: () => void;
  cipherChallengeClue: () => void;
  cipherRespondChallenge: (clueId: string, accept: boolean) => void;
  cipherNextRound: () => void;
  cipherReset: () => void;
  cipherCancelRound: (round: number) => void;
  werewolfNightAction: (action: WerewolfNightActionKind, targetId: string) => void;
  werewolfDayVote: (targetId: string) => void;
  werewolfSkipDiscussion: () => void;
  battleshipPlaceShips: (ships: ShipPlacement[]) => void;
  battleshipFire: (targetId: string, x: number, y: number) => void;
  battleshipPing: (x: number, y: number) => void;
  battleshipReset: () => void;
}

export type GameState = ConnectionSlice & LobbySlice & GameActionsSlice;

export type StoreSet = (
  partial: Partial<GameState> | ((state: GameState) => Partial<GameState>),
) => void;
export type StoreGet = () => GameState;

export interface StoreSharedContext {
  pendingSpectatorJoin: { code: string; previousIsSpectator: boolean } | null;
  actionTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  clockSyncTimeouts: ReturnType<typeof setTimeout>[];
  bestRtt: number;
  browserListenersAttached: boolean;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  stagedDogRelay: DogRelayPrivateState | null;
  seenDogRelayRounds: Set<string>;
  latestCategoriesRequest: {
    requestId: string;
    lang: string;
    roomCode: string | null;
  } | null;
  clearAllActionTimeouts: () => void;
  clearClockSyncTimeouts: () => void;
  clearRoomSession: () => void;
  emitGameAction: (
    event: string,
    options?: {
      loading?: boolean;
      trackReceipt?: boolean;
      payload?: (room: RoomState) => Record<string, unknown>;
    },
  ) => boolean;
}
