'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { GameActionArea } from '@/components/core/GameActionArea';
import { motion, useReducedMotion } from 'framer-motion';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';

export function RPSView() {
  const {
    room,
    socketId,
    privateState,
    rpsMakeChoice,
    rpsNextRound,
    actionLoading,
    pendingActions,
    dismissPendingAction,
  } = useGameStore();
  const { t } = useTranslate();
  const prefersReducedMotion = useReducedMotion();

  const [unknownActionId, unknownPendingAction] =
    Object.entries(pendingActions).find(([, a]) => a.status === 'unknown') ?? [];
  const showActionOverlay = actionLoading || !!unknownPendingAction;

  if (!room || !room.rpsState) return null;
  const rps = room.rpsState;

  const prevStatusRef = useRef(room.status);
  useEffect(() => {
    if (prevStatusRef.current !== RoomStatus.RESULT && room.status === RoomStatus.RESULT) {
      audioManager.playClash();
      const isWinner =
        isWinnerId(rps.gameWinner, socketId) || isWinnerId(rps.roundWinner, socketId);
      if (isWinner) {
        void gameFeel.celebrate();
        gameFeel.flash('gold');
        gameFeel.haptic([100, 50, 150]);
      } else if (rps.roundWinner || rps.gameWinner) {
        gameFeel.shake(0.35);
        gameFeel.flash('white');
        gameFeel.haptic([60]);
      }
    }
    prevStatusRef.current = room.status;
  }, [room.status, rps.gameWinner, rps.roundWinner, socketId]);

  const isMyTurn = rps.activePlayers.includes(socketId);
  const mySideIndex = rps.activePlayers.indexOf(socketId);
  const myChoice = privateState.rpsChoice as string | undefined;
  const isMyChoiceLocked = !!myChoice || (isMyTurn && rps.choicesMade.includes(socketId));
  const isHost = room.roomHostId === socketId;
  const myQueueIndex = rps.queue.indexOf(socketId);
  const canMakeChoice =
    room.status === RoomStatus.PLAYING && isMyTurn && !isMyChoiceLocked && !actionLoading;

  useEffect(() => {
    if (!canMakeChoice) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === '1' || key === 'r') {
        e.preventDefault();
        rpsMakeChoice('ROCK');
        audioManager.playCardSnap();
      } else if (key === '2' || key === 'p') {
        e.preventDefault();
        rpsMakeChoice('PAPER');
        audioManager.playCardSnap();
      } else if (key === '3' || key === 's') {
        e.preventDefault();
        rpsMakeChoice('SCISSORS');
        audioManager.playCardSnap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canMakeChoice, rpsMakeChoice]);

  const roundKey =
    room.status === RoomStatus.RESULT
      ? `${rps.activePlayers.join('-')}:${Object.entries(rps.choices)
          .sort()
          .map(([k, v]) => `${k}:${v}`)
          .join('-')}:${JSON.stringify(rps.scores)}`
      : 'playing';

  const bestOf = room.config.rpsBestOf || 3;
  const targetScore = Math.floor(bestOf / 2) + 1;

  const getEmoji = (choice: string | null) => {
    if (choice === 'ROCK') return '✊';
    if (choice === 'PAPER') return '✋';
    if (choice === 'SCISSORS') return '✌️';
    return '?';
  };

  const getChoiceLabel = (choice: string | null) => {
    if (choice === 'ROCK') return t('gameRps.rock');
    if (choice === 'PAPER') return t('gameRps.paper');
    if (choice === 'SCISSORS') return t('gameRps.scissors');
    return '';
  };

  const waitingPlayers = rps.activePlayers
    .filter((id) => !rps.choicesMade.includes(id))
    .map((id) => room.players.find((p) => p.socketId === id)?.name)
    .filter(Boolean) as string[];

  const isWinnerId = (winner: string | string[] | undefined, playerId: string): boolean => {
    if (!winner) return false;
    if (Array.isArray(winner)) return winner.includes(playerId);
    return winner === playerId;
  };

  const getWinnerNames = (winnerIds: string | string[] | undefined): string => {
    if (!winnerIds) return '';
    if (Array.isArray(winnerIds)) {
      return winnerIds
        .map((id) => room.players.find((p) => p.socketId === id)?.name)
        .filter(Boolean)
        .join(', ');
    }
    return room.players.find((p) => p.socketId === winnerIds)?.name || '';
  };

  const renderActivePlayer = (playerId: string | undefined, index: number) => {
    if (!playerId) return null;
    const player = room.players.find((p) => p.socketId === playerId);
    if (!player) return null;

    const choice = rps.choices[playerId];
    const score = rps.scores[playerId] || 0;
    const isWinner =
      room.status === RoomStatus.RESULT &&
      (isWinnerId(rps.gameWinner, playerId) || isWinnerId(rps.roundWinner, playerId));

    const colors = ['bg-cyan-300', 'bg-pink-300', 'bg-emerald-300', 'bg-purple-300'];
    const bgColor = colors[index % colors.length];

    return (
      <div
        key={`active-${playerId}`}
        className={`flex flex-col items-center transition-all ${mySideIndex !== -1 && mySideIndex !== index ? 'opacity-70' : ''} ${isWinner ? 'scale-110 motion-reduce:transform-none z-10' : ''}`}
      >
        <div
          className={`flex flex-col items-center border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${bgColor} ${index % 2 === 0 ? '' : '-'}`}
        >
          <span className="font-black text-2xl text-black">P{index + 1}</span>
          <span className="text-black font-bold text-sm text-center truncate max-w-[100px]">
            {player.name}
          </span>
          <span className="text-black text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
            {score} / {targetScore}
          </span>
          {room.status === RoomStatus.PLAYING && (
            <span
              data-testid={`rps-player-status-${playerId}`}
              className={`text-[10px] sm:text-xs font-black px-2 py-0.5 border-2 border-black mt-1 ${
                rps.choicesMade.includes(playerId)
                  ? 'bg-emerald-300 text-black'
                  : 'bg-yellow-200 text-black'
              }`}
            >
              {rps.choicesMade.includes(playerId)
                ? `✓ ${t('gameRps.ready')}`
                : `⏳ ${t('gameRps.choosing')}`}
            </span>
          )}
        </div>

        {room.status === RoomStatus.RESULT && choice && (
          <motion.div
            key={`choice-${playerId}-${roundKey}`}
            data-testid={`rps-revealed-choice-${playerId}`}
            initial={prefersReducedMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={
              prefersReducedMotion
                ? { scale: 1, opacity: 1 }
                : isWinner
                  ? { scale: [0.6, 1.15, 1], y: [0, -10, 0], opacity: 1 }
                  : { scale: [0.6, 1], opacity: 1 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
            className={`mt-4 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
              isWinner
                ? 'bg-yellow-300'
                : rps.roundWinner === 'DRAW'
                  ? 'bg-gray-300'
                  : 'bg-white opacity-50'
            } ${index % 2 === 0 ? '-' : ''}`}
          >
            <span className="text-5xl sm:text-7xl drop-">{getEmoji(choice)}</span>
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative font-mono h-full overflow-y-auto overflow-x-hidden w-full">
      {showActionOverlay && (
        <ActionLoadingOverlay
          status={unknownPendingAction ? 'unknown' : 'pending'}
          onDismiss={unknownActionId ? () => dismissPendingAction(unknownActionId) : undefined}
        />
      )}
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-6 relative my-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-center w-full items-center gap-4 mb-4">
          <div className="text-xs font-black text-black bg-cyan-300 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
            {room.config.rpsMode === 'ALL_AT_ONCE'
              ? t('gameRps.allAtOnce')
              : t('gameRps.oneVOneRoundRobin')}
          </div>
          <div className="text-sm font-black tracking-widest uppercase text-black bg-yellow-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10 ">
            {room.status === RoomStatus.RESULT
              ? rps.gameWinner
                ? t('gameRps.matchOver')
                : t('gameRps.roundOver')
              : t('gameRps.playing')}
          </div>
          <div className="text-xs font-black text-black bg-pink-300 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameRps.firstTo', { score: targetScore })}
          </div>
        </div>

        {/* Players / Arena */}
        {room.config.rpsMode === 'ALL_AT_ONCE' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full items-end justify-center min-h-[150px] mt-4">
            {rps.activePlayers.map((id, idx) => renderActivePlayer(id, idx))}
          </div>
        ) : (
          <div className="flex justify-between w-full items-end min-h-[150px] px-2 sm:px-10 mt-4">
            {renderActivePlayer(rps.activePlayers[0], 0)}
            {room.status === RoomStatus.RESULT && (
              <div className="hidden sm:block text-5xl font-black text-black px-4 pb-10 ">
                {t('gameRps.vs')}
              </div>
            )}
            {renderActivePlayer(rps.activePlayers[1], 1)}
          </div>
        )}

        {/* Playing Controls */}
        {room.status === RoomStatus.PLAYING && (
          <div className="w-full flex flex-col items-center gap-6 mt-8">
            {!isMyTurn ? (
              <div className="flex flex-col items-center gap-2 max-w-sm w-full">
                <div className="text-xl sm:text-2xl font-black text-black uppercase tracking-widest bg-gray-300 px-8 py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {t('gameRps.spectating')}
                </div>
                {waitingPlayers.length > 0 && (
                  <span
                    data-testid="rps-spectator-waiting"
                    className="text-xs sm:text-sm font-bold bg-white border-2 border-black px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center"
                  >
                    {t('gameRps.waitingFor', { names: waitingPlayers.join(', ') })}
                  </span>
                )}
              </div>
            ) : isMyChoiceLocked ? (
              <div
                data-testid="rps-choice-locked"
                className="text-lg sm:text-xl font-black text-black text-center bg-yellow-300 px-6 sm:px-8 py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center gap-2 max-w-sm w-full"
              >
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span>{t('gameRps.choiceLocked')}</span>
                  {myChoice && (
                    <span className="bg-white border-2 border-black px-2 py-0.5 text-sm sm:text-base font-black">
                      {getEmoji(myChoice)} {getChoiceLabel(myChoice)}
                    </span>
                  )}
                </div>
                <span
                  data-testid="rps-waiting-status"
                  className="text-xs sm:text-sm font-bold block bg-white border-2 border-black px-3 py-1.5 w-full"
                >
                  {waitingPlayers.length > 0
                    ? t('gameRps.waitingFor', { names: waitingPlayers.join(', ') })
                    : t('gameRps.waitingOpponent')}
                </span>
              </div>
            ) : (
              <GameActionArea docked={false} ariaLabel={t('lobby.gameNames.handDuel')}>
                {(
                  [
                    { id: 'ROCK', label: t('gameRps.rock') },
                    { id: 'PAPER', label: t('gameRps.paper') },
                    { id: 'SCISSORS', label: t('gameRps.scissors') },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    data-testid={`rps-choice-${id.toLowerCase()}`}
                    aria-label={label}
                    disabled={actionLoading}
                    onClick={() => {
                      rpsMakeChoice(id);
                      audioManager.playCardSnap();
                    }}
                    className="w-24 h-28 sm:w-32 sm:h-36 bg-white hover:bg-yellow-200 flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:translate-y-1 active:shadow-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <span className="text-4xl sm:text-5xl drop-">{getEmoji(id)}</span>
                    <span className="text-xs sm:text-sm font-black text-black uppercase tracking-wider group-hover:text-indigo-600">
                      {label}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 font-bold border border-zinc-300 px-1 rounded bg-zinc-100 group-hover:border-black">
                      {id === 'ROCK' ? '1 / R' : id === 'PAPER' ? '2 / P' : '3 / S'}
                    </span>
                  </button>
                ))}
              </GameActionArea>
            )}
          </div>
        )}

        {/* Results & Transitions */}
        {room.status === RoomStatus.RESULT && (
          <motion.div
            key={`outcome-${roundKey}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
            className="flex flex-col items-center gap-6 w-full mt-8"
          >
            <div
              data-testid="rps-round-outcome"
              className="w-full flex flex-col items-center gap-2"
            >
              {rps.roundWinner === 'DRAW' ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="text-2xl sm:text-3xl font-black text-black bg-gray-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {t('gameRps.draw')}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-800 bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {t('gameRps.drawExplanation')}
                  </p>
                </div>
              ) : rps.gameWinner ? (
                <div className="text-xl sm:text-3xl text-center font-black px-4 sm:px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black bg-yellow-300 - w-full break-words">
                  🏆 {t('gameRps.winsMatch', { winner: getWinnerNames(rps.gameWinner) })} 🏆
                </div>
              ) : (
                <div className="text-lg sm:text-2xl text-center font-black px-4 sm:px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black bg-cyan-300 w-full break-words">
                  {t('gameRps.winsRound', { winner: getWinnerNames(rps.roundWinner) })}
                </div>
              )}
            </div>

            {isHost ? (
              <button
                data-testid="rps-next-round-btn"
                onClick={rpsNextRound}
                disabled={actionLoading}
                className={`font-black px-10 py-4 border-4 border-black mt-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${rps.gameWinner ? 'bg-pink-300 hover:bg-pink-400 text-black -' : 'bg-emerald-300 hover:bg-emerald-400 text-black '}`}
              >
                {rps.gameWinner ? t('gameRps.playAgain') : t('gameRps.nextRound')}
              </button>
            ) : (
              <div
                data-testid="rps-guest-waiting"
                className="text-xs sm:text-sm font-bold text-black bg-amber-100 border-2 border-black px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center mt-2"
              >
                {rps.gameWinner
                  ? t('gameRps.waitingHostPlayAgain')
                  : t('gameRps.waitingHostNextRound')}
              </div>
            )}
          </motion.div>
        )}

        {/* 1V1 Queue Display (Responsive) */}
        {room.config.rpsMode === '1V1_ROUND_ROBIN' && rps.queue.length > 0 && (
          <div
            data-testid="rps-queue-banner"
            className="w-full flex flex-col items-center gap-2 mt-6 bg-amber-50/80 p-3 border-2 border-black"
          >
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-xs font-black uppercase tracking-wider text-black bg-yellow-300 px-2.5 py-0.5 border border-black">
                {t('gameRps.queue')}
              </span>
              {myQueueIndex !== -1 && (
                <span
                  data-testid="rps-queue-turn-notice"
                  className="text-xs font-bold text-indigo-700 bg-white border border-indigo-400 px-2 py-0.5"
                >
                  {t('gameRps.yourTurnIn', { count: myQueueIndex + 1 })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {rps.queue.map((id, idx) => {
                const p = room.players.find((candidate) => candidate.socketId === id);
                if (!p) return null;
                const isMe = id === socketId;
                return (
                  <span
                    key={`queue-chip-${id}`}
                    data-testid={`rps-queue-item-${id}`}
                    className={`text-xs px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 ${
                      isMe
                        ? 'bg-indigo-200 text-indigo-950 font-black'
                        : 'bg-white text-black font-bold'
                    }`}
                  >
                    <span className="font-mono text-[10px] bg-black text-white px-1 rounded-sm">
                      #{idx + 1}
                    </span>
                    <span className="truncate max-w-[90px]">
                      {p.name}
                      {isMe ? ` (${t('gameRps.you')})` : ''}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 1V1 Queue Display (Desktop Floating) */}
        {room.config.rpsMode === '1V1_ROUND_ROBIN' && rps.queue.length > 0 && (
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 -translate-x-full hidden xl:flex flex-col gap-2">
            <h4 className="text-sm font-black text-black bg-white border-2 border-black px-2 py-1 uppercase tracking-widest inline-block self-end">
              {t('gameRps.queue')}
            </h4>
            {rps.queue.map((id, idx) => {
              const p = room.players.find((candidate) => candidate.socketId === id);
              if (!p) return null;
              return (
                <div
                  key={`queue-desktop-${id}`}
                  className="bg-yellow-300 border-4 border-black px-4 py-2 text-sm font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between min-w-[120px] "
                >
                  <span className="truncate max-w-[80px]">{p.name}</span>
                  <span className="text-xs text-black bg-white border-2 border-black px-1.5 py-0.5 ml-2">
                    #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
