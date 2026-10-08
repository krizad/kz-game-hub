'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, Role, GameType } from '@repo/types';
import { CountdownTimer } from '@/components/core/CountdownTimer';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { useTranslate } from '@/hooks/useTranslate';
import { celebrateWin } from '@/lib/celebrateWin';

const PHASES = [
  { status: RoomStatus.WORD_SETTING, label: 'gameWhoKnow.phaseSteps.word' },
  { status: RoomStatus.QUESTIONING, label: 'gameWhoKnow.phaseSteps.questions' },
  { status: RoomStatus.VOTING, label: 'gameWhoKnow.phaseSteps.vote' },
  { status: RoomStatus.RESULT, label: 'gameWhoKnow.phaseSteps.reveal' },
] as const;

const phaseMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function WhoKnowView() {
  const { room, socketId, myRole, privateState, actionLoading, secretWord } = useGameStore();
  const { t } = useTranslate();
  const prefersReducedMotion = useReducedMotion();
  const hasCelebrated = useRef(false);

  useEffect(() => {
    if (!room || room.gameType !== GameType.WHO_KNOW || room.status !== RoomStatus.RESULT) {
      hasCelebrated.current = false;
      return;
    }
    if (hasCelebrated.current || !room.winner || room.winner === 'TIMEOUT') return;

    hasCelebrated.current = true;
    void celebrateWin().catch(() => undefined);
  }, [room?.gameType, room?.status, room?.winner]);

  if (!room || room.gameType !== GameType.WHO_KNOW) return null;

  const myVote = privateState.wkVote as string | undefined;
  const activeStep = PHASES.findIndex((phase) => phase.status === room.status);
  const resultVotes = room.votes ?? {};
  const targetToVoters: Record<string, string[]> = {};

  Object.entries(resultVotes).forEach(([voterId, targetId]) => {
    (targetToVoters[targetId] ??= []).push(voterId);
  });

  const sortedTargets = Object.entries(targetToVoters).sort((a, b) => b[1].length - a[1].length);
  const maxVotes = sortedTargets[0]?.[1].length ?? 0;
  const animation = prefersReducedMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : phaseMotion;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {actionLoading && <ActionLoadingOverlay />}

      <nav aria-label={t('gameWhoKnow.phaseSteps.label')} className="mb-4">
        <ol className="grid grid-cols-4 gap-1 sm:gap-2">
          {PHASES.map((phase, index) => {
            const isCurrent = index === activeStep;
            const isComplete = activeStep >= 0 && index < activeStep;

            return (
              <li
                key={phase.status}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-w-0 items-center gap-1 border-2 border-black px-1.5 py-2 text-[10px] font-black leading-tight sm:gap-2 sm:px-3 sm:text-xs ${
                  isCurrent
                    ? 'bg-indigo-500 text-white shadow-[3px_3px_0_0_#000]'
                    : isComplete
                      ? 'bg-emerald-200 text-black'
                      : 'bg-white text-slate-500'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 shrink-0 place-items-center border-2 border-black text-[10px] ${
                    isCurrent ? 'bg-yellow-300 text-black' : 'bg-white text-black'
                  }`}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
                <span className="min-w-0">{t(phase.label)}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {room.status === RoomStatus.WORD_SETTING && (
          <motion.section
            key="word-setting"
            {...animation}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            aria-labelledby="who-know-word-setting"
            className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-5 py-6"
          >
            <div className="w-full max-w-xl border-4 border-black bg-white p-5 text-center shadow-[6px_6px_0_0_#000] sm:p-7">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
                {t('gameWhoKnow.phaseSteps.word')}
              </p>
              <h2 id="who-know-word-setting" className="text-2xl font-black text-black sm:text-3xl">
                {myRole === Role.Host
                  ? t('gameWhoKnow.wordSettingHost')
                  : t('gameWhoKnow.wordSettingWaiting')}
              </h2>
              {myRole !== Role.Host && (
                <div className="mt-5 flex items-center justify-center gap-3 text-sm font-bold text-slate-700">
                  <span className="text-2xl" aria-hidden="true">
                    ⏳
                  </span>
                  <span>{t('gameWhoKnow.privateRoleReminder')}</span>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {room.status === RoomStatus.QUESTIONING && (
          <motion.section
            key="questioning"
            {...animation}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            aria-labelledby="who-know-questioning"
            className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-5 py-5"
          >
            <div className="w-full max-w-2xl text-center">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
                {t('gameWhoKnow.phaseSteps.questions')}
              </p>
              <h2
                id="who-know-questioning"
                className="mx-auto inline-block max-w-full border-4 border-black bg-emerald-300 px-4 py-3 text-xl font-black text-black shadow-[4px_4px_0_0_#000] sm:px-6 sm:text-2xl"
              >
                {myRole === Role.Host
                  ? t('gameWhoKnow.questioningHost')
                  : t('gameWhoKnow.questioningPlayers')}
              </h2>
            </div>

            <div
              className="w-full max-w-sm border-8 border-black bg-pink-300 px-4 py-5 text-center text-5xl font-black tracking-wider text-black shadow-[7px_7px_0_0_#000] sm:px-8 sm:py-6 sm:text-7xl"
              aria-label={t('gameWhoKnow.timeRemaining')}
            >
              {room.endTime ? <CountdownTimer endTime={room.endTime} /> : <span>--:--</span>}
            </div>

            {myRole === Role.Host && (
              <div className="mt-1 flex w-full max-w-2xl flex-col gap-3">
                <p className="text-center text-sm font-bold text-slate-700">
                  {t('gameWhoKnow.hostQuestioningHint')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => useGameStore.getState().endQuestioning(false)}
                    disabled={actionLoading}
                    className="min-h-14 border-4 border-black bg-emerald-300 px-4 py-4 text-base font-black text-black shadow-[4px_4px_0_0_#000] transition hover:bg-emerald-200 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
                  >
                    {t('gameWhoKnow.wordGuessedVote')}
                  </button>
                  <button
                    onClick={() => useGameStore.getState().endQuestioning(true)}
                    disabled={actionLoading}
                    className="min-h-14 border-4 border-black bg-rose-300 px-4 py-4 text-base font-black text-black shadow-[4px_4px_0_0_#000] transition hover:bg-rose-200 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
                  >
                    {t('gameWhoKnow.timesUpFail')}
                  </button>
                </div>
                {room.endTime && (
                  <button
                    onClick={() => useGameStore.getState().stopTimer()}
                    disabled={actionLoading}
                    className="min-h-12 border-2 border-black bg-yellow-200 px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('gameWhoKnow.stopTimer')}
                  </button>
                )}
              </div>
            )}
          </motion.section>
        )}

        {room.status === RoomStatus.VOTING && (
          <motion.section
            key="voting"
            {...animation}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            aria-labelledby="who-know-voting"
            className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-5 py-5"
          >
            <div className="w-full max-w-2xl text-center">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
                {t('gameWhoKnow.phaseSteps.vote')}
              </p>
              <h2
                id="who-know-voting"
                className="mx-auto inline-block max-w-full border-4 border-black bg-yellow-200 px-4 py-3 text-xl font-black text-black shadow-[4px_4px_0_0_#000] sm:px-6 sm:text-2xl"
              >
                {myRole === Role.Host
                  ? t('gameWhoKnow.votingHostWait')
                  : myVote
                    ? t('gameWhoKnow.voteSubmittedStatus')
                    : t('gameWhoKnow.votingPrompt')}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-slate-700">
                {myRole === Role.Host
                  ? t('gameWhoKnow.sealedVoteHostHint')
                  : myVote
                    ? t('gameWhoKnow.sealedVoteWaitingHint')
                    : t('gameWhoKnow.sealedVoteHint')}
              </p>
            </div>

            {myRole !== Role.Host && !myVote && (
              <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {room.players.map((player) => {
                  if (
                    player.socketId === room.hostPlayerId ||
                    player.socketId === socketId ||
                    player.isViewer ||
                    player.connected === false
                  ) {
                    return null;
                  }

                  return (
                    <button
                      key={player.id}
                      onClick={() => useGameStore.getState().submitVote(player.socketId)}
                      disabled={actionLoading}
                      className="min-h-14 border-4 border-black bg-white px-5 py-4 text-left text-lg font-black text-black shadow-[4px_4px_0_0_#000] transition hover:-translate-y-0.5 hover:bg-cyan-200 active:translate-y-1 active:shadow-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="mr-3 inline-grid h-7 w-7 place-items-center border-2 border-black bg-yellow-200 text-sm">
                        ?
                      </span>
                      {player.name}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

        {room.status === RoomStatus.RESULT && (
          <motion.section
            key="result"
            {...animation}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            aria-labelledby="who-know-results"
            className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-1 py-4 sm:px-3"
          >
            <h2
              id="who-know-results"
              className="border-4 border-black bg-emerald-300 px-5 py-3 text-center text-2xl font-black uppercase tracking-wide text-black shadow-[5px_5px_0_0_#000] sm:text-3xl"
            >
              {t('gameWhoKnow.resultsTitle')}
            </h2>

            {room.winner === 'TIMEOUT' ? (
              <div className="w-full max-w-2xl border-4 border-black bg-rose-300 p-5 text-center shadow-[5px_5px_0_0_#000] sm:p-7">
                <h3 className="text-2xl font-black text-black sm:text-3xl">
                  {t('gameWhoKnow.timeoutTitle')}
                </h3>
                <p className="mt-2 text-base font-bold text-black">
                  {t('gameWhoKnow.timeoutDesc')}
                </p>
              </div>
            ) : room.winner === 'INSIDER' ? (
              <div className="w-full max-w-2xl border-4 border-black bg-rose-300 p-5 text-center shadow-[5px_5px_0_0_#000] sm:p-7">
                <h3 className="text-2xl font-black text-black sm:text-3xl">
                  {t('gameWhoKnow.insiderWinsTitle')}
                </h3>
                <p className="mt-2 text-base font-bold text-black">
                  {t('gameWhoKnow.insiderWinsDesc')}
                </p>
              </div>
            ) : room.winner === 'COMMONERS' ? (
              <div className="w-full max-w-2xl border-4 border-black bg-cyan-200 p-5 text-center shadow-[5px_5px_0_0_#000] sm:p-7">
                <h3 className="text-2xl font-black text-black sm:text-3xl">
                  {t('gameWhoKnow.commonersWinTitle')}
                </h3>
                <p className="mt-2 text-base font-bold text-black">
                  {t('gameWhoKnow.commonersWinDesc')}
                </p>
              </div>
            ) : null}

            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
              <div className="border-4 border-black bg-yellow-200 p-4 shadow-[4px_4px_0_0_#000]">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">
                  {t('gameWhoKnow.secretWordWas')}
                </p>
                <p className="mt-2 break-words text-2xl font-black text-black sm:text-3xl">
                  {secretWord || t('lobby.unknownHost')}
                </p>
              </div>
              <div className="border-4 border-black bg-pink-200 p-4 shadow-[4px_4px_0_0_#000]">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">
                  {t('gameWhoKnow.insiderWas')}
                </p>
                <p className="mt-2 break-words text-2xl font-black text-black sm:text-3xl">
                  {room.players.find((player) => player.role === Role.Know)?.name ??
                    t('lobby.unknownHost')}
                </p>
              </div>
            </div>

            {sortedTargets.length > 0 && (
              <div className="w-full max-w-2xl border-4 border-black bg-white p-4 shadow-[5px_5px_0_0_#000] sm:p-5">
                <h3 className="mb-3 text-lg font-black text-black">
                  {t('gameWhoKnow.votingResults')}
                </h3>
                <ol className="space-y-2">
                  {sortedTargets.map(([targetId, voterIds]) => {
                    const target = room.players.find((player) => player.socketId === targetId);
                    if (!target) return null;
                    const isMostVoted = voterIds.length === maxVotes && maxVotes > 0;

                    return (
                      <li
                        key={targetId}
                        className={`border-2 border-black p-3 ${isMostVoted ? 'bg-cyan-200' : 'bg-slate-50'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-black text-black">
                            {target.name}
                            {isMostVoted && (
                              <span className="ml-2 inline-block border-2 border-black bg-yellow-200 px-2 py-0.5 text-[10px] font-black uppercase">
                                {t('gameWhoKnow.mostVoted')}
                              </span>
                            )}
                          </span>
                          <span className="border-2 border-black bg-white px-2 py-1 text-xs font-black text-black">
                            {voterIds.length}{' '}
                            {voterIds.length === 1
                              ? t('gameWhoKnow.vote')
                              : t('gameWhoKnow.votes')}
                          </span>
                        </div>
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          {voterIds.map((voterId) => {
                            const voter = room.players.find((player) => player.socketId === voterId);
                            return voter ? (
                              <span
                                key={voterId}
                                className="border border-black bg-white px-2 py-1 text-xs font-semibold text-black"
                              >
                                {voter.name}
                              </span>
                            ) : null;
                          })}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="w-full max-w-2xl overflow-hidden border-4 border-black bg-white shadow-[5px_5px_0_0_#000]">
              <h3 className="border-b-4 border-black bg-indigo-100 px-4 py-3 text-lg font-black text-black">
                {t('gameWhoKnow.roleAndScoreReveal')}
              </h3>
              <ul className="divide-y-2 divide-black">
                {room.players
                  .filter((player) => !player.isViewer)
                  .map((player) => (
                    <li
                      key={player.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-black text-black">{player.name}</p>
                        <p className="text-xs font-bold text-slate-600">
                          {player.role === Role.Host
                            ? t('gameWhoKnow.roleCard.host')
                            : player.role === Role.Know
                              ? t('gameWhoKnow.insider')
                              : t('gameWhoKnow.roleCard.seeker')}
                        </p>
                      </div>
                      <span className="shrink-0 border-2 border-black bg-yellow-100 px-3 py-1 text-sm font-black text-black">
                        {t('lobby.score')}: {player.score}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            {socketId === room.roomHostId && (
              <button
                onClick={() => useGameStore.getState().resetRoom()}
                disabled={actionLoading}
                className="min-h-14 w-full max-w-2xl border-4 border-black bg-emerald-300 px-5 py-4 text-xl font-black text-black shadow-[5px_5px_0_0_#000] transition hover:bg-emerald-200 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('gameWhoKnow.playAgain')}
              </button>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
