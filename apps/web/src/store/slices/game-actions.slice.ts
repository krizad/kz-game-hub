import {
  CardGameAction,
  CipherAssignTeamPayload,
  CipherClueCount,
  CoupActionType,
  CoupRole,
  GameActionType,
  MusicTriviaAction,
  PokerAction,
  PokerV2Action,
  SOCKET_EVENTS,
  ShipPlacement,
  WerewolfNightActionKind,
  WhoFirstGameActionType,
} from '@repo/types';
import { useI18nStore } from '../useI18nStore';
import { GameActionsSlice, StoreGet, StoreSet, StoreSharedContext } from './types';

export function createGameActionsSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreSharedContext,
): GameActionsSlice {
  const { emitGameAction } = ctx;

  return {
    musicTriviaHostAnswer: null,
    musicTriviaTrackAnswer: null,
    musicTriviaSyncPlay: null,
    lastBananaThiefReaction: null,

    sendDogRelayAction: (action) => {
      emitGameAction(SOCKET_EVENTS.DOG_RELAY_ACTION, {
        trackReceipt: true,
        payload: (room) => ({
          action,
          roundId: room.dogRelayState?.roundId ?? null,
          expectedRevision: room.dogRelayState?.revision ?? 0,
        }),
      });
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

    cardGameAction: (action: CardGameAction) => {
      emitGameAction(SOCKET_EVENTS.CARD_GAME_ACTION, { payload: () => ({ action }) });
    },

    pokerAction: (action: PokerAction) => {
      emitGameAction(SOCKET_EVENTS.POKER_ACTION, { payload: () => ({ action }) });
    },

    pokerV2Action: (action: PokerV2Action) => {
      emitGameAction(SOCKET_EVENTS.POKER_V2_ACTION, { payload: () => ({ action }) });
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
      const { socket, room, categoriesLang } = get();
      if (!socket) return;
      const resolvedLang = lang || room?.config?.language || useI18nStore.getState().language;
      const requestId = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      ctx.latestCategoriesRequest = {
        requestId,
        lang: resolvedLang,
        roomCode: room?.code ?? null,
      };
      set({
        categoriesLoading: true,
        categoriesError: null,
        ...(categoriesLang !== resolvedLang ? { categories: [], categoriesLang: null } : {}),
      });
      socket.emit(SOCKET_EVENTS.WHO_AM_I_GET_CATEGORIES, {
        lang: resolvedLang,
        requestId,
      });
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

    cipherAssignTeam: (payload: CipherAssignTeamPayload) => {
      emitGameAction(SOCKET_EVENTS.CIPHER_ASSIGN_TEAM, { payload: () => ({ ...payload }) });
    },

    cipherRandomizeTeams: () => {
      emitGameAction(SOCKET_EVENTS.CIPHER_RANDOMIZE_TEAMS);
    },

    cipherStartMatch: () => {
      emitGameAction(SOCKET_EVENTS.CIPHER_START_MATCH);
    },

    cipherGiveClue: (word: string, count: CipherClueCount) => {
      emitGameAction(SOCKET_EVENTS.CIPHER_GIVE_CLUE, { payload: () => ({ word, count }) });
    },

    cipherPingCard: (cardIndex: number) => {
      emitGameAction(SOCKET_EVENTS.CIPHER_PING_CARD, {
        loading: false,
        payload: () => ({ cardIndex }),
      });
    },

    cipherRevealCard: (cardIndex: number) => {
      emitGameAction(SOCKET_EVENTS.CIPHER_REVEAL_CARD, { payload: () => ({ cardIndex }) });
    },

    cipherEndTurn: () => {
      emitGameAction(SOCKET_EVENTS.CIPHER_END_TURN);
    },

    cipherChallengeClue: () => {
      emitGameAction(SOCKET_EVENTS.CIPHER_CHALLENGE_CLUE);
    },

    cipherRespondChallenge: (clueId: string, accept: boolean) => {
      emitGameAction(SOCKET_EVENTS.CIPHER_RESPOND_CHALLENGE, {
        payload: () => ({ clueId, accept }),
      });
    },

    cipherNextRound: () => {
      emitGameAction(SOCKET_EVENTS.CIPHER_NEXT_ROUND);
    },

    cipherReset: () => {
      emitGameAction(SOCKET_EVENTS.CIPHER_RESET);
    },

    cipherCancelRound: (round: number) => {
      emitGameAction(SOCKET_EVENTS.CIPHER_CANCEL_ROUND, { payload: () => ({ round }) });
    },

    werewolfNightAction: (action: WerewolfNightActionKind, targetId: string) => {
      emitGameAction(SOCKET_EVENTS.WEREWOLF_NIGHT_ACTION, {
        payload: () => ({ action, targetId }),
      });
    },

    werewolfDayVote: (targetId: string) => {
      emitGameAction(SOCKET_EVENTS.WEREWOLF_DAY_VOTE, { payload: () => ({ targetId }) });
    },

    werewolfSkipDiscussion: () => {
      emitGameAction(SOCKET_EVENTS.WEREWOLF_SKIP_DISCUSSION);
    },

    battleshipPlaceShips: (ships: ShipPlacement[]) => {
      emitGameAction(SOCKET_EVENTS.BATTLESHIP_PLACE_SHIPS, {
        payload: () => ({ payload: { ships } }),
      });
    },

    battleshipFire: (targetId: string, x: number, y: number) => {
      emitGameAction(SOCKET_EVENTS.BATTLESHIP_FIRE, {
        payload: () => ({ payload: { targetId, x, y } }),
      });
    },

    battleshipPing: (x: number, y: number) => {
      emitGameAction(SOCKET_EVENTS.BATTLESHIP_PING, {
        payload: () => ({ payload: { x, y } }),
      });
    },

    battleshipReset: () => {
      emitGameAction(SOCKET_EVENTS.BATTLESHIP_RESET);
    },
  };
}
