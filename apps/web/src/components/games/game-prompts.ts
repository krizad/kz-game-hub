import { GameType, RoomState, RoomStatus, SoundsFishyPhase } from '@repo/types';

export interface GamePromptResult {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Returns the contextual prompt key and params for a player in a room.
 * Mapped across all 14 GameTypes: actor, responder, waiting, spectator/viewer.
 *
 * Privacy guarantee: Never leaks private fields (roles, secret words, hidden cards)
 * to non-owners or spectators.
 */
export function getGamePrompt(
  room: RoomState,
  socketId: string,
  privateState: Record<string, unknown> = {},
): GamePromptResult {
  if (room.status === RoomStatus.LOBBY) {
    return { key: 'gamePrompts.lobbyWaiting' };
  }

  const me = room.players.find((p) => p.socketId === socketId);
  const isSpectator = !me || !!me.isViewer;

  switch (room.gameType) {
    case GameType.WHO_KNOW: {
      if (room.status === RoomStatus.WORD_SETTING) {
        if (socketId === room.hostPlayerId) return { key: 'gameWhoKnow.wordSettingHost' };
        if (isSpectator) return { key: 'gamePrompts.spectating' };
        return { key: 'gameWhoKnow.wordSettingWaiting' };
      }
      if (room.status === RoomStatus.QUESTIONING) {
        if (socketId === room.hostPlayerId) return { key: 'gameWhoKnow.questioningHost' };
        if (isSpectator) return { key: 'gamePrompts.spectating' };
        return { key: 'gameWhoKnow.questioningPlayers' };
      }
      if (room.status === RoomStatus.VOTING) {
        if (socketId === room.hostPlayerId) return { key: 'gameWhoKnow.votingHostWait' };
        if (isSpectator) return { key: 'gamePrompts.spectating' };
        return { key: 'gameWhoKnow.votingPrompt' };
      }
      if (room.status === RoomStatus.RESULT) {
        return { key: 'gameWhoKnow.resultPrompt' };
      }
      break;
    }

    case GameType.TIC_TAC_TOE: {
      const mode = room.config.ticTacToeMode;
      const state =
        mode === 'GOBBLER'
          ? room.gobblerState
          : mode === 'ULTIMATE'
            ? room.ultimateTicTacToeState
            : room.ticTacToeState;

      if (state?.winner !== undefined) {
        return { key: 'gamePrompts.ttt.gameOver' };
      }

      const playerXName = room.players.find((p) => p.socketId === state?.playerXId)?.name || 'X';
      const playerOName = room.players.find((p) => p.socketId === state?.playerOId)?.name || 'O';

      const isX = state?.playerXId === socketId;
      const isO = state?.playerOId === socketId;

      if (!isX && !isO) {
        return {
          key: 'gamePrompts.ttt.spectating',
          params: {
            playerX: playerXName,
            playerO: playerOName,
          },
        };
      }

      const isMyTurn = (state?.currentTurn === 'X' && isX) || (state?.currentTurn === 'O' && isO);
      if (isMyTurn) {
        return { key: 'gamePrompts.ttt.yourTurn' };
      }
      const opponentName = isX ? playerOName : playerXName;
      return { key: 'gamePrompts.ttt.waitingOpponent', params: { name: opponentName } };
    }

    case GameType.RPS: {
      const state = room.rpsState;
      if (state?.gameWinner) {
        return { key: 'gamePrompts.rps.matchOver' };
      }
      if (state?.roundWinner) {
        return { key: 'gamePrompts.rps.roundResult' };
      }
      const isPlayer = !!state?.activePlayers?.includes(socketId);
      if (!isPlayer || isSpectator) {
        return { key: 'gamePrompts.spectating' };
      }

      const hasChosen = !!state?.choicesMade?.includes(socketId);
      if (hasChosen) {
        return { key: 'gamePrompts.rps.waitingOpponent' };
      }
      return { key: 'gamePrompts.rps.choose' };
    }

    case GameType.SOUNDS_FISHY: {
      const state = room.soundsFishyState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.currentPhase;

      if (phase === SoundsFishyPhase.SETUP || phase === SoundsFishyPhase.THE_PITCH) {
        if (socketId === state?.pickerId) {
          return { key: 'gamePrompts.soundsFishy.guesserWaiting' };
        }
        const hasAnswered =
          !!state?.answeredPlayerIds?.includes(socketId) || !!privateState.hasAnswered;
        if (hasAnswered) {
          return { key: 'gamePrompts.soundsFishy.waitingAnswers' };
        }
        return { key: 'gamePrompts.soundsFishy.giveAnswer' };
      }

      if (phase === SoundsFishyPhase.THE_HUNT) {
        if (socketId === state?.pickerId) {
          return { key: 'gamePrompts.soundsFishy.guesserChoose' };
        }
        return { key: 'gamePrompts.soundsFishy.othersWait' };
      }

      if (phase === SoundsFishyPhase.SCORING) {
        return { key: 'gamePrompts.soundsFishy.roundResult' };
      }
      break;
    }

    case GameType.DETECTIVE_CLUB: {
      const state = room.detectiveClubState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.currentPhase;

      if (phase === 'SETUP') {
        if (socketId === state?.informerId) {
          return { key: 'gamePrompts.detectiveClub.leaderWord' };
        }
        return { key: 'gamePrompts.detectiveClub.othersWaitWord' };
      }

      if (phase === 'PLAYING_ROUND_1' || phase === 'PLAYING_ROUND_2') {
        if (socketId === state?.activePlayerId) {
          return { key: 'gamePrompts.detectiveClub.playCardTurn' };
        }
        const activeName =
          room.players.find((p) => p.socketId === state?.activePlayerId)?.name || 'Player';
        return { key: 'gamePrompts.detectiveClub.waitingCard', params: { name: activeName } };
      }

      if (phase === 'DISCUSSION') {
        return { key: 'gamePrompts.detectiveClub.explainCards' };
      }

      if (phase === 'VOTING') {
        if (socketId === state?.informerId) {
          return { key: 'gamePrompts.detectiveClub.leaderWaitVote' };
        }
        return { key: 'gamePrompts.detectiveClub.voteConspirator' };
      }

      if (phase === 'SCORING') {
        return { key: 'gamePrompts.detectiveClub.roundResult' };
      }
      break;
    }

    case GameType.WHO_AM_I: {
      const state = room.whoAmIState;
      if (state?.winner) {
        return { key: 'gamePrompts.whoAmI.gameOver' };
      }
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'AWAITING_HOST_INPUT') {
        if (socketId === state?.hostSocketId || socketId === room.hostPlayerId) {
          return { key: 'gamePrompts.whoAmI.hostSettingWords' };
        }
        return { key: 'gamePrompts.whoAmI.waitWords' };
      }

      if (phase === 'COLLECTING_WORDS') {
        if (state?.wordSubmittedIds?.includes(socketId)) {
          return { key: 'gamePrompts.whoAmI.waitingOtherWords' };
        }
        return { key: 'gamePrompts.whoAmI.inputWord' };
      }

      if (phase === 'ASKING' || phase === 'FINAL_GUESS') {
        if (state?.currentTurn === socketId) {
          return { key: 'gamePrompts.whoAmI.askQuestion' };
        }
        if (state?.turnStatus === 'VOTING') {
          const turnName =
            room.players.find((p) => p.socketId === state?.currentTurn)?.name || 'Player';
          return { key: 'gamePrompts.whoAmI.answerQuestion', params: { name: turnName } };
        }
        return { key: 'gamePrompts.whoAmI.voting' };
      }
      break;
    }

    case GameType.WHO_FIRST: {
      const state = room.whoFirstState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'COUNTDOWN') {
        return { key: 'gamePrompts.whoFirst.getReady' };
      }
      if (phase === 'ACTIVE') {
        return { key: 'gamePrompts.whoFirst.pressButton' };
      }
      if (phase === 'ROUND_RESULT' || phase === 'FINISHED') {
        return { key: 'gamePrompts.whoFirst.roundResult' };
      }
      break;
    }

    case GameType.MUSIC_TRIVIA: {
      const state = room.musicTriviaState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'SETUP' || phase === 'LOADING' || phase === 'GET_READY') {
        return { key: 'gamePrompts.musicTrivia.preparing' };
      }
      if (phase === 'COUNTDOWN') {
        return { key: 'gamePrompts.musicTrivia.countdown' };
      }
      if (phase === 'PLAYING') {
        if (room.config.musicTriviaMode === 'TYPING') {
          return { key: 'gamePrompts.musicTrivia.typeGuess' };
        }
        return { key: 'gamePrompts.musicTrivia.pressBuzzer' };
      }
      if (phase === 'BUZZED' || phase === 'ANSWERING') {
        const buzzerId = state?.currentRound?.currentBuzzerId;
        if (buzzerId === socketId) {
          return { key: 'gamePrompts.musicTrivia.youBuzzed' };
        }
        if (socketId === room.hostPlayerId && room.config.musicTriviaMode === 'GAME_MASTER') {
          return { key: 'gamePrompts.musicTrivia.hostJudging' };
        }
        const buzzerName = room.players.find((p) => p.socketId === buzzerId)?.name || 'Player';
        return { key: 'gamePrompts.musicTrivia.otherBuzzed', params: { name: buzzerName } };
      }
      if (phase === 'ANSWER_RESULT' || phase === 'REVEAL' || phase === 'ROUND_RESULT') {
        return { key: 'gamePrompts.musicTrivia.roundResult' };
      }
      if (phase === 'FINISHED') {
        return { key: 'gamePrompts.gameOver' };
      }
      break;
    }

    case GameType.THE_MIND: {
      const state = room.theMindState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'SETUP') {
        if (state?.readyPlayers?.includes(socketId)) {
          return { key: 'gamePrompts.theMind.waitingReady' };
        }
        return { key: 'gamePrompts.theMind.getReady' };
      }
      if (phase === 'PLAYING') {
        return { key: 'gamePrompts.theMind.playCard' };
      }
      if (phase === 'SHURIKEN_VOTE') {
        const hasVoted = !!state?.shurikenVotes && state.shurikenVotes[socketId] !== undefined;
        if (hasVoted) {
          return { key: 'gamePrompts.theMind.waitingShurikenVotes' };
        }
        return { key: 'gamePrompts.theMind.voteShuriken' };
      }
      if (phase === 'LEVEL_RESULT' || phase === 'SHURIKEN_RESULT') {
        return { key: 'gamePrompts.theMind.roundResult' };
      }
      if (phase === 'GAME_OVER') {
        return { key: 'gamePrompts.theMind.gameOver' };
      }
      break;
    }

    case GameType.SABOTEUR: {
      const state = room.saboteurState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.currentPhase;

      if (phase === 'PLAYING') {
        if (socketId === state?.activePlayerId) {
          return { key: 'gamePrompts.saboteur.yourTurn' };
        }
        const activeName =
          room.players.find((p) => p.socketId === state?.activePlayerId)?.name || 'Player';
        return { key: 'gamePrompts.saboteur.waitingFor', params: { name: activeName } };
      }
      if (phase === 'GOLD_PICK') {
        const pickerId = state?.roundResult?.currentPickerId ?? state?.activePlayerId;
        if (socketId === pickerId) {
          return { key: 'gamePrompts.saboteur.pickGold' };
        }
        const activeName = room.players.find((p) => p.socketId === pickerId)?.name || 'Player';
        return { key: 'gamePrompts.saboteur.waitingGoldPick', params: { name: activeName } };
      }
      if (phase === 'ROUND_END') {
        return { key: 'gamePrompts.saboteur.roundResult' };
      }
      if (phase === 'GAME_OVER') {
        return { key: 'gamePrompts.gameOver' };
      }
      break;
    }

    case GameType.COUP: {
      const state = room.coupState;
      if (state?.winnerId) {
        return { key: 'gamePrompts.gameOver' };
      }
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'PLAYING') {
        if (socketId === state?.currentTurn) {
          return { key: 'gamePrompts.coup.yourTurn' };
        }
        const turnName =
          room.players.find((p) => p.socketId === state?.currentTurn)?.name || 'Player';
        return { key: 'gamePrompts.coup.waitingTurn', params: { name: turnName } };
      }
      if (phase === 'AWAITING_CHALLENGE' || phase === 'AWAITING_BLOCK') {
        return { key: 'gamePrompts.coup.respondAction' };
      }
      if (phase === 'AWAITING_EXCHANGE') {
        if (socketId === state?.currentTurn) {
          return { key: 'gamePrompts.coup.chooseCards' };
        }
        const turnName =
          room.players.find((p) => p.socketId === state?.currentTurn)?.name || 'Player';
        return { key: 'gamePrompts.coup.waitingExchange', params: { name: turnName } };
      }
      if (phase === 'AWAITING_REVEAL') {
        return { key: 'gamePrompts.coup.loseInfluence' };
      }
      if (phase === 'RESULT') {
        return { key: 'gamePrompts.gameOver' };
      }
      break;
    }

    case GameType.CARD_GAME: {
      const state = room.cardGameState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'PLAYER_TURNS') {
        if (socketId === state?.activePlayerId) {
          return { key: 'gamePrompts.cardGame.yourTurn' };
        }
        const activeName =
          room.players.find((p) => p.socketId === state?.activePlayerId)?.name || 'Player';
        return { key: 'gamePrompts.cardGame.waitingTurn', params: { name: activeName } };
      }
      if (phase === 'RESULT') {
        return { key: 'gamePrompts.cardGame.showdown' };
      }
      break;
    }

    case GameType.POKER: {
      const state = room.pokerState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase && ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(phase)) {
        if (socketId === state?.activePlayerId) {
          return { key: 'gamePrompts.poker.yourTurn' };
        }
        const activeName =
          room.players.find((p) => p.socketId === state?.activePlayerId)?.name || 'Player';
        return { key: 'gamePrompts.poker.waitingTurn', params: { name: activeName } };
      }
      if (phase === 'SHOWDOWN') {
        return { key: 'gamePrompts.poker.showdown' };
      }
      if (phase === 'HAND_RESULT') {
        return { key: 'gamePrompts.poker.handResult' };
      }
      break;
    }

    case GameType.BANANA_THIEF: {
      const state = room.bananaThiefState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      const phase = state?.phase;

      if (phase === 'SETUP') {
        if (state?.readyIds?.includes(socketId)) {
          return { key: 'gamePrompts.bananaThief.waitingOthersReady' };
        }
        return { key: 'gamePrompts.bananaThief.tapReady' };
      }
      if (phase === 'CHOOSE_FOLLOWER') {
        const isThief = privateState.role === 'THIEF' || privateState.bananaThiefRole === 'THIEF';
        if (isThief) {
          return { key: 'gamePrompts.bananaThief.chooseFollower' };
        }
        return { key: 'gamePrompts.bananaThief.waitingFollowerChoice' };
      }
      if (phase === 'NIGHT') {
        return { key: 'gamePrompts.bananaThief.nightAction' };
      }
      if (phase === 'DISCUSSION') {
        return { key: 'gamePrompts.bananaThief.dayDiscussion' };
      }
      if (phase === 'VOTING') {
        const hasVoted = Boolean(privateState.hasVoted ?? privateState.votedFor);
        if (hasVoted) {
          return { key: 'gamePrompts.bananaThief.waitingVotes' };
        }
        return { key: 'gamePrompts.bananaThief.votePrompt' };
      }
      if (phase === 'RESULT') {
        return { key: 'gamePrompts.bananaThief.roundResult' };
      }
      break;
    }

    case GameType.CIPHER_GRID: {
      const state = room.cipherGridState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      if (!state) return { key: 'gamePrompts.spectating' };
      if (state.phase === 'TEAM_SETUP') {
        return { key: 'gamePrompts.cipherGrid.teamSetup' };
      }
      if (state.phase === 'CLUE_GIVING') {
        const isMyTeam = state.teams[socketId] === state.currentTeam;
        const isLead = state.cipherLeads[state.currentTeam ?? 'SOLAR'] === socketId;
        if (isLead) return { key: 'gamePrompts.cipherGrid.giveClue' };
        if (isMyTeam) return { key: 'gamePrompts.cipherGrid.waitClueMyTeam' };
        return { key: 'gamePrompts.cipherGrid.waitClueEnemy' };
      }
      if (state.phase === 'DECODING') {
        const isMyTeam = state.teams[socketId] === state.currentTeam;
        const isLead = state.cipherLeads[state.teams[socketId] ?? 'SOLAR'] === socketId;
        if (isMyTeam && !isLead) return { key: 'gamePrompts.cipherGrid.decodeCards' };
        if (isMyTeam && isLead) return { key: 'gamePrompts.cipherGrid.watchTrackers' };
        return { key: 'gamePrompts.cipherGrid.challengeOpportunity' };
      }
      if (state.phase === 'ROUND_END') {
        return { key: 'gamePrompts.cipherGrid.roundEnd' };
      }
      break;
    }

    case GameType.WEREWOLF: {
      const state = room.werewolfState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      if (!state) return { key: 'gamePrompts.spectating' };
      if (state.paused) return { key: 'gamePrompts.werewolf.sleeping' };
      if (state.phase === 'NIGHT') {
        const night = privateState.wwNight as { kind: string } | null | undefined;
        const slot = state.nightSlots[state.nightSlotIndex];
        if (night && slot) {
          if (night.kind === 'KILL') return { key: 'gamePrompts.werewolf.wolvesWake' };
          if (night.kind === 'CHECK') return { key: 'gamePrompts.werewolf.sleeping' };
        }
        return { key: 'gamePrompts.werewolf.sleeping' };
      }
      if (state.phase === 'DAY_DISCUSSION') {
        return { key: 'gamePrompts.werewolf.discussion' };
      }
      if (state.phase === 'DAY_VOTE') {
        return privateState.wwDayVote
          ? { key: 'gamePrompts.werewolf.voteWaiting' }
          : { key: 'gamePrompts.werewolf.votePrompt' };
      }
      if (state.phase === 'DAY_RESULT') {
        return { key: 'gamePrompts.werewolf.result' };
      }
      if (state.phase === 'DAY_HUNTER_SHOT') {
        return state.hunterShot?.hunterId === socketId
          ? { key: 'gamePrompts.werewolf.hunterShotYou' }
          : { key: 'gamePrompts.werewolf.hunterShotWaiting' };
      }
      if (state.phase === 'GAME_OVER') {
        return { key: 'gamePrompts.werewolf.gameOver' };
      }
      break;
    }

    case GameType.BATTLESHIP: {
      const state = room.battleshipState;
      if (isSpectator) return { key: 'gamePrompts.spectating' };
      if (!state) return { key: 'gamePrompts.spectating' };
      if (state.phase === 'PLACEMENT') return { key: 'battleship.placementTitle' };
      if (state.phase === 'PLAYING') {
        if (state.mode === 'FREE_FOR_ALL') return { key: 'battleship.simultaneousPrompt' };
        return state.turnPlayerId === socketId
          ? { key: 'battleship.yourTurnToFire' }
          : { key: 'battleship.waitingEnemyTurn' };
      }
      if (state.phase === 'RESULT') return { key: 'battleship.victory' };
      break;
    }
  }

  return { key: 'gameStatus.groupAction' };
}
