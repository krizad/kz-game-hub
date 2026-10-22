'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, GameType, SoundsFishyPhase } from '@repo/types';
import { useEffect, useState } from 'react';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { audioManager } from '@/lib/audioManager';

export function SoundsFishyView() {
  const {
    room,
    socketId,
    privateState,
    soundsFishySubmitAnswer,
    soundsFishyTypeAnswer,
    soundsFishyRevealAnswer,
    soundsFishyEliminatePlayer,
    soundsFishyBankPoints,
    soundsFishyReset,
    actionLoading,
  } = useGameStore();
  const { t } = useTranslate();

  const [answerInput, setAnswerInput] = useState('');
  const currentPhase = room?.soundsFishyState?.currentPhase;
  const roomStatus = room?.status;

  useEffect(() => {
    setAnswerInput('');
  }, [currentPhase, roomStatus]);

  if (!room || room.gameType !== GameType.SOUNDS_FISHY) return null;

  const state = room.soundsFishyState;

  if (!state) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-600 font-mono">
        {t('gameSoundsFishy.loading')}
      </div>
    );
  }

  const isPicker = state.pickerId === socketId;
  const myRole = privateState.sfRole as string | undefined;
  const isBlueFish = myRole === 'BLUE_FISH';
  const trueAnswer = privateState.sfTrueAnswer as string | undefined;
  const myAnswer = privateState.sfMyAnswer as { playerId: string; answer: string } | undefined;
  const typingTexts = (privateState.sfTypingTexts || {}) as Record<string, string>;

  // Check if all non-picker players have had their answers revealed
  const nonPickerPlayers = room.players.filter((p) => p.socketId !== state.pickerId);
  const allRevealed = nonPickerPlayers.every((p) => state.playerAnswers[p.socketId]?.isRevealed);

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 overflow-y-auto max-w-4xl mx-auto space-y-6 relative font-mono">
      {actionLoading && <ActionLoadingOverlay />}

      {/* Header Info */}
      <div className="bg-white border-4 border-black p-4 flex flex-col sm:flex-row justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full gap-4">
        <div className="text-center sm:text-left">
          <p className="text-black uppercase tracking-widest text-xs font-black mb-1">
            {t('gameSoundsFishy.yourRole')}
          </p>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span
              className={`text-xl font-black border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                isPicker
                  ? 'bg-purple-300 text-black'
                  : isBlueFish
                    ? 'bg-amber-200 text-black'
                    : 'bg-teal-200 text-black'
              }`}
            >
              {isPicker
                ? t('gameSoundsFishy.rolePicker')
                : isBlueFish
                  ? t('gameSoundsFishy.roleBlueFish')
                  : t('gameSoundsFishy.roleRedHerring')}
            </span>
          </div>
        </div>

        <div className="text-center sm:text-right">
          <p className="text-black uppercase tracking-widest text-xs font-black mb-1">
            {t('gameSoundsFishy.currentPot')}
          </p>
          <span className="text-2xl font-black text-black bg-yellow-300 px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block">
            {state.roundScorePool}{' '}
            <span className="text-sm text-black font-bold uppercase">
              {t('gameSoundsFishy.pts')}
            </span>
          </span>
        </div>
      </div>

      {/* Main Game Area */}
      {state.currentPhase === SoundsFishyPhase.SETUP && (
        <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col items-center justify-center">
          <h2 className="text-2xl sm:text-3xl font-black text-black mb-6 uppercase tracking-widest bg-cyan-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {t('gameSoundsFishy.setupPhase')}
          </h2>

          {/* Question Display */}
          <div className="bg-yellow-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full mb-8">
            <span className="text-xs font-black text-black uppercase tracking-widest mb-2 block bg-white border-2 border-black px-2 py-1 inline-block">
              {t('gameSoundsFishy.theTopic')}
            </span>
            <p className="text-xl sm:text-2xl font-black text-black mt-2">
              {state.question?.question}
            </p>

            {!isPicker && (
              <div className="mt-6 pt-6 border-t-4 border-black border-dashed">
                <span className="text-xs font-black text-black uppercase tracking-widest mb-2 block">
                  {t('gameSoundsFishy.trueAnswer')}
                </span>
                <p className="text-2xl font-black text-black bg-white inline-block px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {trueAnswer}
                </p>
              </div>
            )}
          </div>

          {/* Action Area */}
          {isPicker ? (
            <div className="flex flex-col items-center justify-center space-y-4 bg-purple-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-md mx-auto">
              <div className="text-4xl animate-bounce">💬</div>
              <p className="text-black font-black uppercase tracking-widest">
                {t('gameSoundsFishy.waitingForFish')}
              </p>
            </div>
          ) : myAnswer ? (
            <div
              data-testid="fishy-answer-submitted"
              className="bg-emerald-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-md mx-auto"
            >
              <p className="text-black font-black uppercase mb-2 text-xl">
                {t('gameSoundsFishy.answerSubmitted')}
              </p>
              <p className="text-sm font-bold text-black mb-4">
                {t('gameSoundsFishy.waitingForOthers')}
              </p>
              <p className="text-xl font-black text-black bg-white px-4 py-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] break-words">
                {myAnswer.answer}
              </p>
            </div>
          ) : isBlueFish ? (
            <div className="w-full max-w-md mx-auto space-y-4 bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-black font-black uppercase text-center bg-amber-200 px-3 py-1 border-2 border-black inline-block mb-2 text-sm">
                {t('gameSoundsFishy.mustEnterTrue')}
              </p>
              <div className="bg-yellow-100 p-4 border-2 border-black text-center mb-2">
                <span className="text-xs uppercase font-black text-slate-700 block mb-1">
                  {t('gameSoundsFishy.trueAnswer')}
                </span>
                <p className="text-2xl font-black text-black break-words">{trueAnswer}</p>
              </div>
              <button
                data-testid="fishy-submit-true-answer"
                onClick={() => trueAnswer && soundsFishySubmitAnswer(trueAnswer)}
                disabled={!trueAnswer || actionLoading}
                className="w-full bg-amber-300 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-black font-black px-4 py-4 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-lg cursor-pointer"
              >
                {t('gameSoundsFishy.submitTrueAnswer')}
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto space-y-4 bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-black font-black uppercase text-center bg-yellow-300 px-2 py-1 border-2 border-black inline-block mb-2">
                {t('gameSoundsFishy.mustEnterFake')}
              </p>
              <div className="relative">
                <input
                  id="answerInput"
                  name="answer"
                  autoComplete="off"
                  type="text"
                  maxLength={200}
                  value={answerInput}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 200);
                    setAnswerInput(val);
                    soundsFishyTypeAnswer(val);
                  }}
                  placeholder={t('gameSoundsFishy.typeAnswerPlaceholder')}
                  className="w-full bg-white border-4 border-black text-black px-4 py-3 outline-none focus:ring-4 focus:ring-black font-black text-center text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && answerInput.trim()) {
                      soundsFishySubmitAnswer(answerInput.slice(0, 200));
                    }
                  }}
                />
                <span className="text-xs font-bold text-slate-500 block text-right mt-1">
                  {answerInput.length}/200
                </span>
              </div>
              <button
                onClick={() => soundsFishySubmitAnswer(answerInput.slice(0, 200))}
                disabled={!answerInput.trim() || actionLoading}
                className="w-full bg-cyan-300 hover:bg-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-black font-black px-4 py-4 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-lg cursor-pointer"
              >
                {t('gameSoundsFishy.submitAnswer')}
              </button>
            </div>
          )}

          {/* Live typing display for non-pickers who are still answering */}
          {!isPicker && Object.keys(typingTexts).length > 0 && (
            <div className="w-full mt-10 max-w-2xl mx-auto border-t-4 border-black border-dashed pt-8">
              <p className="text-xs font-black text-black uppercase tracking-widest mb-6 bg-pink-300 px-3 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {t('gameSoundsFishy.otherFishesTyping')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {room.players.map((p) => {
                  if (p.socketId === socketId || p.socketId === state.pickerId) return null;
                  if (state.answeredPlayerIds.includes(p.socketId)) return null;

                  const typingText = typingTexts[p.socketId];
                  if (!typingText) return null;

                  return (
                    <div
                      key={p.socketId}
                      className="bg-white p-4 border-4 border-black text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <span className="text-xs font-black text-black block mb-2 uppercase border-b-2 border-black pb-1">
                        {p.name}
                      </span>
                      <p className="text-black font-bold break-words">{typingText}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {(state.currentPhase === SoundsFishyPhase.THE_PITCH ||
        state.currentPhase === SoundsFishyPhase.THE_HUNT) && (
        <div className="flex-1 flex flex-col space-y-6">
          <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-xs font-black text-black uppercase tracking-widest mb-2 block bg-yellow-300 border-2 border-black px-2 py-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {t('gameSoundsFishy.theTopic')}
            </span>
            <p className="text-xl sm:text-2xl font-black text-black mt-2">
              {state.question?.question}
            </p>
            {isPicker ? (
              <div className="mt-6 pt-6 border-t-4 border-black border-dashed">
                <span className="text-sm font-black text-black bg-pink-300 px-3 py-1 border-2 border-black uppercase tracking-widest block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block">
                  {allRevealed
                    ? t('gameSoundsFishy.allRevealedEliminate')
                    : t('gameSoundsFishy.revealEveryoneFirst')}
                </span>
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t-4 border-black border-dashed flex flex-col items-center">
                <span className="text-xs font-black text-black uppercase tracking-widest mb-2 block">
                  {t('gameSoundsFishy.trueAnswer')}
                </span>
                <span className="text-xl font-black text-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {trueAnswer}
                </span>
              </div>
            )}
          </div>

          {/* Row-based answers display: Step 1 (Reveal) -> Step 2 (Eliminate) */}
          <div className="flex flex-col space-y-3 w-full">
            {nonPickerPlayers.map((p) => {
              const ans = state.playerAnswers[p.socketId];
              const isRevealed = ans?.isRevealed;
              const isEliminated = state.eliminatedPlayers.includes(p.socketId);

              return (
                <div
                  key={p.socketId}
                  data-testid={`fishy-row-${p.socketId}`}
                  className={`relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-3 ${
                    isEliminated
                      ? 'bg-gray-300 grayscale opacity-75'
                      : isRevealed
                        ? 'bg-cyan-100'
                        : 'bg-white'
                  }`}
                >
                  {/* Player Name & status badge */}
                  <div className="flex items-center gap-2 sm:w-1/4 min-w-[120px]">
                    <span className="font-black text-black uppercase tracking-wider text-base bg-white px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {p.name}
                    </span>
                    {isEliminated && (
                      <span className="text-xs font-black bg-rose-500 text-white px-2 py-0.5 border border-black uppercase tracking-wider">
                        {t('gameSoundsFishy.eliminated')}
                      </span>
                    )}
                  </div>

                  {/* Answer content */}
                  <div className="flex-1 min-w-0">
                    {isRevealed ? (
                      <p
                        data-testid={`fishy-answer-${p.socketId}`}
                        className="text-lg font-black text-black bg-white px-3 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] break-words"
                      >
                        {ans.answer}
                      </p>
                    ) : (
                      <div
                        data-testid={`fishy-hidden-${p.socketId}`}
                        className="text-slate-400 font-black text-xl tracking-widest py-2 bg-slate-100 border-2 border-dashed border-slate-400 text-center"
                      >
                        ???
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Step 1 = Reveal; Step 2 = Eliminate */}
                  <div className="flex sm:justify-end min-w-[170px]">
                    {isPicker &&
                      !isEliminated &&
                      !isRevealed &&
                      (state.currentPhase === SoundsFishyPhase.THE_PITCH ||
                        state.currentPhase === SoundsFishyPhase.THE_HUNT) && (
                        <button
                          data-testid={`fishy-reveal-${p.socketId}`}
                          onClick={() => {
                            soundsFishyRevealAnswer(p.socketId);
                            audioManager.playCardSnap();
                          }}
                          disabled={actionLoading}
                          className="w-full sm:w-auto bg-yellow-300 hover:bg-yellow-200 text-black font-black px-4 py-2.5 border-3 border-black transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm cursor-pointer"
                        >
                          {t('gameSoundsFishy.revealAnswer')}
                        </button>
                      )}

                    {isPicker &&
                      !isEliminated &&
                      isRevealed &&
                      allRevealed &&
                      state.currentPhase === SoundsFishyPhase.THE_HUNT && (
                        <button
                          data-testid={`fishy-eliminate-${p.socketId}`}
                          onClick={() => {
                            soundsFishyEliminatePlayer(p.socketId);
                            audioManager.playSplash();
                          }}
                          disabled={actionLoading}
                          className="w-full sm:w-auto bg-rose-400 hover:bg-rose-300 text-black font-black px-4 py-2.5 border-3 border-black transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm cursor-pointer"
                        >
                          {t('gameSoundsFishy.eliminateLooksFishy')}
                        </button>
                      )}

                    {isPicker && !isEliminated && isRevealed && !allRevealed && (
                      <span className="text-xs font-bold text-slate-500 italic py-2">
                        {t('gameSoundsFishy.revealOthersFirst')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Bank Summary Bar */}
          {isPicker && state.currentPhase === SoundsFishyPhase.THE_HUNT && (
            <div
              data-testid="fishy-bank-summary"
              className="sticky bottom-2 z-20 bg-amber-300 border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto"
            >
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-xs font-black uppercase tracking-widest bg-black text-amber-300 px-2 py-0.5">
                    {t('gameSoundsFishy.bankSummaryTitle')}
                  </span>
                  <span className="text-lg font-black text-black">
                    {state.roundScorePool}{' '}
                    <span className="text-sm font-bold uppercase">{t('gameSoundsFishy.pts')}</span>
                  </span>
                </div>
                <p className="text-xs font-bold text-black mt-1">
                  {t('gameSoundsFishy.bankSummaryRisk', { points: state.roundScorePool })}
                </p>
              </div>

              {state.roundScorePool > 0 ? (
                <button
                  data-testid="fishy-bank-button"
                  onClick={() => {
                    soundsFishyBankPoints();
                    audioManager.playChipClink();
                  }}
                  disabled={actionLoading}
                  className="w-full sm:w-auto bg-emerald-400 hover:bg-emerald-300 text-black font-black px-6 py-3 border-4 border-black text-base uppercase tracking-widest transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {t('gameSoundsFishy.bankPointsAndEnd')}
                </button>
              ) : (
                <span className="text-xs font-black text-slate-700 bg-white/80 px-3 py-1.5 border-2 border-black">
                  {t('gameSoundsFishy.eliminateFirstToScore')}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {room.status === RoomStatus.RESULT && (
        <div className="bg-white border-4 border-black p-6 sm:p-8 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col items-center justify-center space-y-6">
          <h2 className="text-4xl sm:text-5xl font-black text-black tracking-wider uppercase bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {t('gameSoundsFishy.roundOver')}
          </h2>

          {/* Outcome Announcement */}
          <div
            data-testid="fishy-result-outcome"
            className={`p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full text-center ${
              state.blueFishId && state.eliminatedPlayers.includes(state.blueFishId)
                ? 'bg-rose-200'
                : 'bg-emerald-200'
            }`}
          >
            <p className="text-base sm:text-lg font-black text-black">
              {state.blueFishId && state.eliminatedPlayers.includes(state.blueFishId)
                ? t('gameSoundsFishy.outcomeBlueCaught')
                : state.roundScorePool > 0 &&
                    state.redHerringIds.length > 0 &&
                    state.redHerringIds.every((id) => state.eliminatedPlayers.includes(id))
                  ? t('gameSoundsFishy.outcomeAllRedEliminated')
                  : t('gameSoundsFishy.outcomeBanked')}
            </p>
            {state.question?.answer && (
              <div className="mt-3 pt-3 border-t-2 border-black/30 flex items-center justify-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {t('gameSoundsFishy.trueAnswer')}:
                </span>
                <span className="text-base font-black text-black bg-white px-2 py-0.5 border border-black">
                  {state.question.answer}
                </span>
              </div>
            )}
          </div>

          {/* Detailed Score Breakdown */}
          <div
            data-testid="fishy-result-breakdown"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl text-left"
          >
            {room.players.map((p) => {
              const isPickerRole = p.socketId === state.pickerId;
              const isBlueFishRole = p.socketId === state.blueFishId;
              const isEliminated = state.eliminatedPlayers.includes(p.socketId);
              const ans = state.playerAnswers[p.socketId]?.answer;
              const roundPts = state.roundPoints?.[p.socketId] ?? 0;

              return (
                <div
                  key={p.socketId}
                  data-testid={`fishy-result-player-${p.socketId}`}
                  className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-black text-black text-base truncate">
                        {p.name}{' '}
                        {p.socketId === socketId && (
                          <span className="text-slate-600 font-bold">({t('lobby.you')})</span>
                        )}
                      </span>
                      {isEliminated ? (
                        <span
                          data-testid={`fishy-result-eliminated-${p.socketId}`}
                          className="text-xs font-black bg-rose-500 text-white px-2 py-0.5 border border-black uppercase tracking-wider shrink-0"
                        >
                          {t('gameSoundsFishy.resultEliminated')}
                        </span>
                      ) : !isPickerRole ? (
                        <span className="text-xs font-black bg-emerald-400 text-black px-2 py-0.5 border border-black uppercase tracking-wider shrink-0">
                          {t('gameSoundsFishy.resultSurvived')}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-black px-2 py-0.5 border border-black uppercase tracking-wider ${
                          isPickerRole
                            ? 'bg-purple-300 text-black'
                            : isBlueFishRole
                              ? 'bg-amber-200 text-black'
                              : 'bg-teal-200 text-black'
                        }`}
                      >
                        {isPickerRole
                          ? t('gameSoundsFishy.pickerText')
                          : isBlueFishRole
                            ? t('gameSoundsFishy.blueFishText')
                            : t('gameSoundsFishy.redHerringText')}
                      </span>
                    </div>

                    {ans && (
                      <div className="bg-slate-50 p-2 border border-black text-xs">
                        <span className="font-bold text-slate-500 uppercase block text-[10px]">
                          {t('gameSoundsFishy.resultAnswer')}
                        </span>
                        <p className="font-black text-black break-words mt-0.5">{ans}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t-2 border-black/20">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        {t('gameSoundsFishy.resultRoundScore')}
                      </span>
                      <span className="text-sm font-black text-emerald-600">
                        +{roundPts} {t('gameSoundsFishy.pts')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        {t('gameSoundsFishy.resultTotalScore')}
                      </span>
                      <span className="text-xl font-black text-black">
                        {p.score}{' '}
                        <span className="text-xs font-bold">{t('gameSoundsFishy.pts')}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {socketId === room.roomHostId && (
            <button
              onClick={() => soundsFishyReset()}
              disabled={actionLoading}
              className="w-full max-w-sm bg-purple-400 hover:bg-purple-300 text-black font-black px-6 py-4 border-4 border-black transition-transform shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-lg cursor-pointer"
            >
              {t('gameSoundsFishy.playNextRound')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
