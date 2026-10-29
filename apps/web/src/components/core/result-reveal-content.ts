import {
  BOT_PLAYER_NAME,
  BOT_SOCKET_ID,
  GameType,
  PlayingCard,
  Role,
  RoomState,
  RoomStatus,
  UserState,
} from '@repo/types';

type Translate = (key: string, params?: Record<string, string | number>) => string;
export interface RevealCardContent {
  label: string;
  details: string[];
  cards?: PlayingCard[];
}
export interface RevealOutcome {
  title: string;
  reason: string;
  winnerIds: string[];
  cooperative?: boolean;
}

export function revealPlayerName(room: RoomState, id?: string | null): string {
  if (id === BOT_SOCKET_ID) return BOT_PLAYER_NAME;
  return room.players.find((p) => p.socketId === id || p.id === id)?.name ?? '—';
}

export function getRevealCard(room: RoomState, player: UserState, t: Translate): RevealCardContent {
  const id = player.socketId;
  const details: string[] = [];
  const score = (value: number) =>
    value === 1 ? t('resultReveal.scoreOne') : t('resultReveal.score', { score: value });
  const vote = (target?: string | null) => {
    if (target) details.push(t('resultReveal.votedFor', { name: revealPlayerName(room, target) }));
  };
  let label = score(player.score);
  let cards: PlayingCard[] | undefined;
  switch (room.gameType) {
    case GameType.WHO_KNOW:
      label =
        player.role === Role.Know
          ? t('gameWhoKnow.insider')
          : t(`gameWhoKnow.roleCard.${player.role === Role.Host ? 'host' : 'seeker'}`);
      vote(room.votes?.[id]);
      break;
    case GameType.SOUNDS_FISHY: {
      const state = room.soundsFishyState!;
      label = t(
        `gameSoundsFishy.${id === state.pickerId ? 'pickerText' : id === state.blueFishId ? 'blueFishText' : 'redHerringText'}`,
      );
      if (state.playerAnswers[id]) details.push(state.playerAnswers[id].answer);
      break;
    }
    case GameType.DETECTIVE_CLUB: {
      const state = room.detectiveClubState!;
      const role = state.players[id]?.role;
      label = t(
        `gameDetectiveClub.${role === 'INFORMER' ? 'informer' : role === 'CONSPIRATOR' ? 'conspirator' : 'detective'}`,
      );
      vote(state.players[id]?.votedFor);
      break;
    }
    case GameType.BANANA_THIEF: {
      const state = room.bananaThiefState!;
      label = t(
        `gameBananaThief.${id === state.thiefId ? 'roleThief' : state.followerIds?.includes(id) ? 'roleFollower' : 'roleMouse'}`,
      );
      const special = state.specials?.[id];
      const specialKeys = {
        DETECTIVE: 'roleDetective',
        TWINS: 'roleTwins',
        SYCOPHANT: 'roleSycophant',
        SCAPEGOAT: 'roleScapegoat',
      };
      if (special) details.push(t(`gameBananaThief.${specialKeys[special]}`));
      vote(state.votes?.[id]);
      break;
    }
    case GameType.DOG_RELAY: {
      const state = room.dogRelayState!;
      label = t(`dogRelay.role${state.result!.roles[player.id]}`);
      vote(state.result!.ballots[player.id]);
      break;
    }
    case GameType.SABOTEUR: {
      const state = room.saboteurState!;
      label =
        state.currentPhase === 'GAME_OVER'
          ? score(state.finalResults?.scores[id] ?? 0)
          : t(`resultReveal.${state.players[id]?.role === 'SABOTEUR' ? 'saboteur' : 'miner'}`);
      break;
    }
    case GameType.COUP: {
      const influence = room.coupState!.influences[id];
      const keys = {
        DUKE: 'roleDuke',
        ASSASSIN: 'roleAssassin',
        CAPTAIN: 'roleCaptain',
        AMBASSADOR: 'roleAmbassador',
        CONTESSA: 'roleContessa',
      };
      label =
        (room.coupState!.finalHands?.[id] ?? influence?.revealed ?? [])
          .map((role) => t(`gameCoup.${keys[role]}`))
          .join(' · ') || t('resultReveal.cardsNotShown');
      details.push(t('resultReveal.influences', { count: influence?.count ?? 0 }));
      break;
    }
    case GameType.WHO_AM_I:
      label = room.whoAmIState?.revealedWords?.[id] ?? t('resultReveal.noAnswer');
      details.push(score(player.score));
      break;
    case GameType.RPS: {
      const choice = room.rpsState?.choices[id];
      label = choice ? t(`resultReveal.${choice}`) : t('resultReveal.noAnswer');
      details.push(score(room.rpsState?.scores[id] ?? 0));
      break;
    }
    case GameType.WHO_FIRST: {
      const press = room.whoFirstState?.presses.find((p) => p.socketId === id);
      label = press?.isPenalty
        ? t('resultReveal.tooEarly')
        : press?.reactionTimeMs !== undefined
          ? `${press.reactionTimeMs} ms`
          : t('resultReveal.noAnswer');
      details.push(score(player.score));
      break;
    }
    case GameType.MUSIC_TRIVIA:
      label = score(room.musicTriviaState?.scores[id] ?? 0);
      break;
    case GameType.CARD_GAME: {
      const state = room.cardGameState!;
      cards = state.result?.revealedHands[id];
      label =
        state.preset === 'SLAVE'
          ? t('resultReveal.placement', { rank: (state.result?.placements?.indexOf(id) ?? -1) + 1 })
          : score(state.result?.playerScores[id] ?? 0);
      const delta = state.result?.deltas?.[id];
      if (delta !== undefined)
        details.push(t('resultReveal.chips', { amount: delta > 0 ? `+${delta}` : delta }));
      break;
    }
    case GameType.POKER: {
      const state = room.pokerState!;
      if (room.status === RoomStatus.RESULT) {
        return {
          label: t('resultReveal.chips', { amount: state.seats[id]?.chips ?? 0 }),
          details: [],
        };
      }
      cards = state.showdown?.revealedCards[id];
      const category = state.seats[id]?.handCategory;
      label = category
        ? t(`poker.handNames.${category}`)
        : t(cards?.length ? 'resultReveal.hand' : 'resultReveal.cardsNotShown');
      details.push(t('resultReveal.chips', { amount: state.seats[id]?.chips ?? 0 }));
      break;
    }
  }
  return { label, details, cards };
}

export function getRevealEvidence(
  room: RoomState,
  t: Translate,
  secretWord?: string | null,
): string {
  switch (room.gameType) {
    case GameType.WHO_KNOW:
      return secretWord
        ? t('resultReveal.answer', { answer: secretWord })
        : t('resultReveal.rolesHint');
    case GameType.SOUNDS_FISHY:
      return t('resultReveal.answer', { answer: room.soundsFishyState?.question?.answer ?? '—' });
    case GameType.DETECTIVE_CLUB:
      return t('resultReveal.answer', { answer: room.detectiveClubState?.word ?? '—' });
    case GameType.MUSIC_TRIVIA: {
      const answer = room.musicTriviaState?.revealedAnswer;
      return answer ? `${answer.title} — ${answer.artist}` : t('resultReveal.scoresHint');
    }
    case GameType.WHO_AM_I:
      return t('resultReveal.wordsHint');
    case GameType.WHO_FIRST:
      return t('resultReveal.reactionHint');
    case GameType.RPS:
      return t('resultReveal.rpsHint');
    case GameType.CARD_GAME:
      return t('resultReveal.handsHint');
    case GameType.POKER:
      return t(
        room.status === RoomStatus.RESULT ? 'resultReveal.scoresHint' : 'resultReveal.handsHint',
      );
    case GameType.TIC_TAC_TOE:
      return t('resultReveal.boardHint');
    case GameType.CIPHER_GRID: {
      const card = room.cipherGridState?.history
        .filter((h) => h.kind === 'REVEAL' || h.kind === 'PENALTY_REVEAL')
        .at(-1);
      const revealedCard =
        card?.cardIndex !== undefined ? room.cipherGridState?.board[card.cardIndex] : undefined;
      return revealedCard?.kind === 'WORD'
        ? revealedCard.word
        : revealedCard?.kind === 'PICTURE'
          ? t('cipherGrid.pictureNumber', { number: (card!.cardIndex ?? 0) + 1 })
          : t('resultReveal.boardHint');
    }
    case GameType.THE_MIND:
      return t('resultReveal.mindEvidence', {
        level: room.theMindState?.level ?? 0,
        lives: room.theMindState?.lives ?? 0,
      });
    default:
      return t('resultReveal.rolesHint');
  }
}

export function getRevealOutcome(room: RoomState, t: Translate): RevealOutcome {
  let winnerIds: string[] = [];
  let title = '';
  let reason = t('resultReveal.scoresReason');
  const top = (scores: Record<string, number>) => {
    const max = Math.max(...Object.values(scores));
    return Object.keys(scores).filter((id) => scores[id] === max && max > 0);
  };
  switch (room.gameType) {
    case GameType.WHO_KNOW:
      title = t(
        `gameWhoKnow.${room.winner === 'TIMEOUT' ? 'timeoutTitle' : room.winner === 'INSIDER' ? 'insiderWinsTitle' : 'commonersWinTitle'}`,
      );
      reason = t(
        `gameWhoKnow.${room.winner === 'TIMEOUT' ? 'timeoutDesc' : room.winner === 'INSIDER' ? 'insiderWinsDesc' : 'commonersWinDesc'}`,
      );
      winnerIds = room.players
        .filter((p) =>
          room.winner === 'INSIDER'
            ? p.role === Role.Know
            : room.winner === 'COMMONERS' && (p.role === Role.Unknow || p.role === Role.Host),
        )
        .map((p) => p.socketId);
      break;
    case GameType.SOUNDS_FISHY: {
      const state = room.soundsFishyState!;
      winnerIds = Object.keys(state.roundPoints).filter((id) => state.roundPoints[id] > 0);
      reason = t(
        `gameSoundsFishy.${state.eliminatedPlayers.includes(state.blueFishId ?? '') ? 'outcomeBlueCaught' : state.redHerringIds.every((id) => state.eliminatedPlayers.includes(id)) ? 'outcomeAllRedEliminated' : 'outcomeBanked'}`,
      );
      break;
    }
    case GameType.DETECTIVE_CLUB: {
      const state = room.detectiveClubState!;
      const conspiratorEscaped = (state.scoreDeltas?.[state.conspiratorId ?? ''] ?? 0) > 0;
      winnerIds = Object.keys(state.scoreDeltas ?? {}).filter(
        (id) => (state.scoreDeltas?.[id] ?? 0) > 0,
      );
      title = conspiratorEscaped
        ? t('gameDetectiveClub.conspiratorWinTitle', {
            name: revealPlayerName(room, state.conspiratorId),
          })
        : t('gameDetectiveClub.detectivesWinTitle');
      reason = t(
        `gameDetectiveClub.${conspiratorEscaped ? 'conspiratorEscaped' : 'conspiratorCaught'}`,
      );
      break;
    }
    case GameType.BANANA_THIEF: {
      const state = room.bananaThiefState!;
      title = t(
        `gameBananaThief.${state.winner === 'SCAPEGOAT' ? 'goatWin' : state.winner === 'MICE' ? 'miceWin' : 'thiefWin'}`,
        { name: revealPlayerName(room, state.caughtId) },
      );
      winnerIds = Object.keys(state.scoreDeltas ?? {}).filter(
        (id) => (state.scoreDeltas?.[id] ?? 0) > 0,
      );
      reason = state.fledThief
        ? t('gameBananaThief.thiefFled')
        : state.caughtId
          ? t('resultReveal.accused', { name: revealPlayerName(room, state.caughtId) })
          : t('resultReveal.voteTied');
      break;
    }
    case GameType.DOG_RELAY: {
      const result = room.dogRelayState!.result!;
      title = t(`dogRelay.win${result.winningTeam}`);
      reason = t(`dogRelay.${result.reason}`);
      winnerIds = result.winnerIds;
      break;
    }
    case GameType.SABOTEUR: {
      const state = room.saboteurState!;
      if (state.currentPhase === 'GAME_OVER') winnerIds = state.finalResults?.winnerIds ?? [];
      else {
        title = t(
          `gameSaboteur.${state.roundResult?.winnerRole === 'MINER' ? 'minersWin' : 'saboteursWin'}`,
        );
        winnerIds = Object.keys(state.players).filter(
          (id) => state.players[id].role === state.roundResult?.winnerRole,
        );
        reason = t(
          `resultReveal.${state.roundResult?.winnerRole === 'MINER' ? 'goldFound' : 'goldMissed'}`,
        );
      }
      break;
    }
    case GameType.COUP:
      winnerIds = room.coupState?.winnerId ? [room.coupState.winnerId] : [];
      reason = t('resultReveal.lastStanding');
      break;
    case GameType.WHO_AM_I:
      winnerIds =
        room.whoAmIState?.winner && room.whoAmIState.winner !== 'DRAW'
          ? [room.whoAmIState.winner]
          : [];
      reason = t('resultReveal.wordReason');
      break;
    case GameType.RPS: {
      const winner = room.rpsState?.gameWinner ?? room.rpsState?.roundWinner;
      winnerIds = winner && winner !== 'DRAW' ? (Array.isArray(winner) ? winner : [winner]) : [];
      reason = t(room.rpsState?.gameWinner ? 'resultReveal.matchReason' : 'resultReveal.rpsReason');
      break;
    }
    case GameType.WHO_FIRST: {
      const topIds =
        room.whoFirstState?.phase === 'FINISHED'
          ? top(
              Object.fromEntries(
                room.players
                  .filter(
                    (p) =>
                      !p.isViewer &&
                      ((room.config.whoFirstHostPlays ?? false) || p.socketId !== room.roomHostId),
                  )
                  .map((p) => [p.socketId, p.score]),
              ),
            )
          : room.whoFirstState?.roundWinnerId
            ? [room.whoFirstState.roundWinnerId]
            : [];
      winnerIds = topIds;
      if (room.whoFirstState?.phase === 'FINISHED' && topIds.length > 1) {
        title = t('resultReveal.tieTitle', {
          names: topIds.map((id) => revealPlayerName(room, id)).join(', '),
        });
      }
      reason = t('resultReveal.reactionReason');
      break;
    }
    case GameType.MUSIC_TRIVIA: {
      const topIds =
        room.musicTriviaState?.phase === 'FINISHED'
          ? top(room.musicTriviaState.scores)
          : room.musicTriviaState?.currentRound?.winnerId
            ? [room.musicTriviaState.currentRound.winnerId]
            : [];
      winnerIds = topIds;
      if (room.musicTriviaState?.phase === 'FINISHED' && topIds.length > 1) {
        title = t('resultReveal.tieTitle', {
          names: topIds.map((id) => revealPlayerName(room, id)).join(', '),
        });
      }
      reason = t('resultReveal.musicReason');
      break;
    }
    case GameType.CARD_GAME:
      winnerIds = room.cardGameState?.result?.winnerIds ?? [];
      reason = t(
        room.cardGameState?.preset === 'SLAVE'
          ? 'resultReveal.slaveReason'
          : 'resultReveal.cardReason',
      );
      break;
    case GameType.POKER:
      if (room.status === RoomStatus.RESULT) {
        const state = room.pokerState!;
        const highest = Math.max(...state.playerOrder.map((id) => state.seats[id]?.chips ?? 0));
        winnerIds = state.playerOrder.filter((id) => state.seats[id]?.chips === highest);
        reason = t('resultReveal.pokerMatchReason');
      } else {
        winnerIds = Array.from(
          new Set(room.pokerState?.handResult?.pots.flatMap((p) => p.winnerIds) ?? []),
        );
        reason = t('resultReveal.pokerReason');
      }
      break;
    case GameType.TIC_TAC_TOE: {
      const state =
        room.config.ticTacToeMode === 'GOBBLER'
          ? room.gobblerState
          : room.config.ticTacToeMode === 'ULTIMATE'
            ? room.ultimateTicTacToeState
            : room.ticTacToeState;
      const id =
        state?.winner === 'X'
          ? state.playerXId
          : state?.winner === 'O'
            ? state.playerOId
            : undefined;
      winnerIds = id ? [id] : [];
      reason = t(
        room.config.ticTacToeMode === 'ULTIMATE'
          ? 'resultReveal.macroReason'
          : 'resultReveal.lineReason',
      );
      break;
    }
    case GameType.CIPHER_GRID: {
      const state = room.cipherGridState!;
      title = t(`cipherGrid.${state.winner === 'SOLAR' ? 'solarWon' : 'lunarWon'}`);
      winnerIds = Object.keys(state.teams).filter((id) => state.teams[id] === state.winner);
      reason = t(
        `cipherGrid.${state.winReason === 'VIRUS' ? 'winReasonVirus' : 'winReasonAllFound'}`,
      );
      break;
    }
    case GameType.THE_MIND: {
      const success = room.theMindState!.lives > 0 && !!room.theMindState!.result?.success;
      title = t(success ? 'resultReveal.teamWin' : 'resultReveal.teamLoss');
      reason = t(success ? 'resultReveal.mindWin' : 'resultReveal.mindLoss');
      winnerIds = success ? room.players.filter((p) => !p.isViewer).map((p) => p.id) : [];
      return { title, reason, winnerIds, cooperative: true };
    }
  }
  if (!title)
    title = winnerIds.length
      ? t('resultReveal.winners', {
          names: winnerIds.map((id) => revealPlayerName(room, id)).join(', '),
        })
      : t('resultReveal.noWinner');
  return { title, reason, winnerIds };
}
