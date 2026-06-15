'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, GameType, SoundsFishyPhase } from '@repo/types';
import { useState } from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export function SoundsFishyView() {
  const {
    room,
    socketId,
    soundsFishySubmitAnswer,
    soundsFishyTypeAnswer,
    soundsFishyRevealAnswer,
    soundsFishyEliminatePlayer,
    soundsFishyBankPoints,
    soundsFishyReset,
  } = useGameStore();
  const { t } = useTranslate();

  const [answerInput, setAnswerInput] = useState('');

  if (!room || room.gameType !== GameType.SOUNDS_FISHY) return null;

  const state = room.soundsFishyState;

  if (!state) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-600">
        {t('gameSoundsFishy.loading')}
      </div>
    );
  }

  const isPicker = state.pickerId === socketId;
  const isBlueFish = state.blueFishId === socketId;
  const myAnswer = state.playerAnswers[socketId];

  // Check if all players (excluding the Picker) have had their answers revealed
  const nonPickerPlayers = room.players.filter((p) => p.socketId !== state.pickerId);
  const allRevealed = nonPickerPlayers.every((p) => {
    const ans = state.playerAnswers[p.socketId];
    return ans && ans.isRevealed;
  });

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 overflow-y-auto max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center shadow-lg w-full gap-4">
        <div className="text-center sm:text-left">
          <p className="text-slate-600 uppercase tracking-widest text-xs font-bold mb-1">
            {t('gameSoundsFishy.yourRole')}
          </p>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span
              className={`text-xl font-black ${isPicker ? 'text-purple-400' : isBlueFish ? 'text-blue-400' : 'text-rose-400'}`}
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
          <p className="text-slate-600 uppercase tracking-widest text-xs font-bold mb-1">
            {t('gameSoundsFishy.currentPot')}
          </p>
          <span className="text-2xl font-black text-amber-400">
            {state.roundScorePool}{' '}
            <span className="text-sm text-slate-500">{t('gameSoundsFishy.pts')}</span>
          </span>
        </div>
      </div>

      {/* Main Game Area */}
      {state.currentPhase === SoundsFishyPhase.SETUP && (
        <div className="bg-white border border-amber-200 rounded-xl p-6 text-center w-full shadow-lg flex-1 flex flex-col items-center justify-center">
          <h2 className="text-2xl sm:text-3xl font-black text-indigo-400 mb-6">
            {t('gameSoundsFishy.setupPhase')}
          </h2>

          {/* Question Display */}
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 w-full mb-8">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              {t('gameSoundsFishy.theTopic')}
            </span>
            <p className="text-xl sm:text-2xl font-bold text-slate-800">
              {state.question?.question}
            </p>

            {!isPicker && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                  {t('gameSoundsFishy.trueAnswer')}
                </span>
                <p className="text-2xl font-black text-blue-400 bg-blue-500/10 inline-block px-4 py-2 rounded-lg border border-blue-500/20">
                  {state.question?.answer}
                </p>
              </div>
            )}
          </div>

          {/* Action Area */}
          {isPicker ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
              <p className="text-slate-700 font-medium animate-pulse">
                {t('gameSoundsFishy.waitingForFish')}
              </p>
            </div>
          ) : myAnswer ? (
            <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-900/50">
              <p className="text-emerald-400 font-bold mb-1">
                {t('gameSoundsFishy.answerSubmitted')}
              </p>
              <p className="text-sm text-slate-600">{t('gameSoundsFishy.waitingForOthers')}</p>
              <p className="text-lg font-bold text-slate-800 mt-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                {myAnswer.answer}
              </p>
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto space-y-4">
              <p className="text-slate-700 font-medium">
                {isBlueFish
                  ? t('gameSoundsFishy.mustEnterTrue')
                  : t('gameSoundsFishy.mustEnterFake')}
              </p>
              <input
                id="answerInput"
                name="answer"
                autoComplete="off"
                type="text"
                value={answerInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setAnswerInput(val);
                  soundsFishyTypeAnswer(val);
                }}
                placeholder={t('gameSoundsFishy.typeAnswerPlaceholder')}
                className="w-full bg-amber-50 border-2 border-amber-200 focus:border-indigo-500 text-slate-800 px-4 py-3 rounded-xl outline-none transition-all font-medium text-center"
                onKeyDown={(e) =>
                  e.key === 'Enter' && answerInput.trim() && soundsFishySubmitAnswer(answerInput)
                }
              />
              <button
                onClick={() => soundsFishySubmitAnswer(answerInput)}
                disabled={!answerInput.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-4 py-3 rounded-xl transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider"
              >
                {t('gameSoundsFishy.submitAnswer')}
              </button>
            </div>
          )}

          {/* Live typing display for non-pickers who are still answering */}
          {!isPicker && state.typingAnswers && Object.keys(state.typingAnswers).length > 0 && (
            <div className="w-full mt-8 max-w-2xl mx-auto border-t border-amber-200 pt-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                {t('gameSoundsFishy.otherFishesTyping')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {room.players.map((p) => {
                  if (p.socketId === socketId || p.socketId === state.pickerId) return null; // Don't show myself or the picker
                  if (state.playerAnswers[p.socketId]) return null; // Don't show if they already submitted

                  const typingText = state.typingAnswers?.[p.socketId];
                  if (!typingText) return null;

                  return (
                    <div
                      key={p.socketId}
                      className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 text-left"
                    >
                      <span className="text-xs font-bold text-indigo-400 block mb-1">{p.name}</span>
                      <p className="text-slate-700 break-words">{typingText}</p>
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
          <div className="bg-white border border-amber-200 rounded-xl p-6 text-center w-full shadow-lg">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              {t('gameSoundsFishy.theTopic')}
            </span>
            <p className="text-xl sm:text-2xl font-bold text-slate-800">
              {state.question?.question}
            </p>
            {isPicker ? (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <span className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-2 block">
                  {allRevealed
                    ? t('gameSoundsFishy.allRevealedEliminate')
                    : t('gameSoundsFishy.revealEveryoneFirst')}
                </span>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block flex items-center justify-center gap-2">
                  {t('gameSoundsFishy.trueAnswer')}{' '}
                  <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {state.question?.answer}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nonPickerPlayers.map((p) => {
              const ans = state.playerAnswers[p.socketId];
              const isRevealed = ans?.isRevealed;
              const isEliminated = state.eliminatedPlayers.includes(p.socketId);

              return (
                <div
                  key={p.socketId}
                  className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${isEliminated ? 'bg-rose-950/30 border-rose-900/50 opacity-50 grayscale' : isRevealed ? 'bg-indigo-950/30 border-indigo-500/30' : 'bg-white border-amber-200'}`}
                >
                  <span className="font-bold text-slate-600 mb-2">{p.name}</span>

                  {isRevealed ? (
                    <p className="text-2xl font-black text-white text-center break-words w-full">
                      {ans.answer}
                    </p>
                  ) : (
                    <div className="text-slate-600 font-black text-2xl tracking-widest py-2">
                      ???
                    </div>
                  )}

                  {isPicker &&
                    !isEliminated &&
                    !isRevealed &&
                    (state.currentPhase === SoundsFishyPhase.THE_PITCH ||
                      state.currentPhase === SoundsFishyPhase.THE_HUNT) && (
                      <button
                        onClick={() => soundsFishyRevealAnswer(p.socketId)}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-md"
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
                        onClick={() => soundsFishyEliminatePlayer(p.socketId)}
                        className="mt-4 bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-md"
                      >
                        {t('gameSoundsFishy.eliminateLooksFishy')}
                      </button>
                    )}

                  {isEliminated && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <span className="bg-rose-600 text-white font-black uppercase tracking-widest px-4 py-2 rounded-lg border-2 border-rose-400 rotate-[-15deg] text-xl shadow-2xl">
                        {t('gameSoundsFishy.eliminated')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isPicker &&
            state.currentPhase === SoundsFishyPhase.THE_HUNT &&
            state.roundScorePool > 0 && (
              <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-6 text-center shadow-lg mt-auto">
                <p className="text-slate-700 mb-4 font-medium">
                  {t('gameSoundsFishy.youHavePointsPrefix')}
                  <span className="text-amber-400 font-black">{state.roundScorePool}</span>
                  {t('gameSoundsFishy.youHavePointsSuffix')}
                </p>
                <button
                  onClick={() => soundsFishyBankPoints()}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black px-8 py-4 rounded-xl text-lg uppercase tracking-widest transition-all shadow-xl active:scale-[0.98]"
                >
                  {t('gameSoundsFishy.bankPointsAndEnd')}
                </button>
              </div>
            )}
        </div>
      )}

      {room.status === RoomStatus.RESULT && (
        <div className="bg-white border border-amber-200 rounded-xl p-8 text-center w-full shadow-lg flex-1 flex flex-col items-center justify-center">
          <h2 className="text-4xl font-black text-yellow-400 mb-2 tracking-wider">
            {t('gameSoundsFishy.roundOver')}
          </h2>
          <p className="text-slate-600 mb-8 font-medium">
            {t('gameSoundsFishy.howEveryoneScored')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-8">
            {room.players.map((p) => (
              <div
                key={p.socketId}
                className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center"
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-slate-800">
                    {p.name}{' '}
                    {p.socketId === socketId && (
                      <span className="text-slate-600 font-normal">({t('lobby.you')})</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {p.socketId === state.pickerId
                      ? t('gameSoundsFishy.pickerText')
                      : p.socketId === state.blueFishId
                        ? t('gameSoundsFishy.blueFishText')
                        : t('gameSoundsFishy.redHerringText')}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-black text-emerald-400">
                    {p.score}{' '}
                    <span className="text-sm font-bold text-emerald-500/50">
                      {t('gameSoundsFishy.pts')}
                    </span>
                  </span>
                  {state.roundPoints && state.roundPoints[p.socketId] > 0 && (
                    <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {t('gameSoundsFishy.plusPointsPrefix')}
                      {state.roundPoints[p.socketId]}
                      {t('gameSoundsFishy.plusPointsSuffix')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {socketId === room.roomHostId && (
            <button
              onClick={() => soundsFishyReset()}
              className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider text-lg"
            >
              {t('gameSoundsFishy.playNextRound')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
