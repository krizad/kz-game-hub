'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, GameType, SoundsFishyPhase } from '@repo/types';
import { useState } from 'react';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

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
  const myRole = privateState.sfRole as string | undefined;
  const isBlueFish = myRole === 'BLUE_FISH';
  const trueAnswer = privateState.sfTrueAnswer as string | undefined;
  const myAnswer = privateState.sfMyAnswer as { playerId: string; answer: string } | undefined;

  // Check if all players (excluding the Picker) have had their answers revealed
  const nonPickerPlayers = room.players.filter((p) => p.socketId !== state.pickerId);
  const allRevealed = nonPickerPlayers.every((p) => state.playerAnswers[p.socketId]?.isRevealed);

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 overflow-y-auto max-w-4xl mx-auto space-y-6 relative">
      {actionLoading && <ActionLoadingOverlay />}
      {/* Header Info */}
      <div className="bg-white border-4 border-black p-4 flex flex-col sm:flex-row justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full gap-4 font-mono">
        <div className="text-center sm:text-left">
          <p className="text-black uppercase tracking-widest text-xs font-black mb-1">
            {t('gameSoundsFishy.yourRole')}
          </p>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span
              className={`text-xl font-black border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isPicker ? 'bg-purple-300 text-black ' : isBlueFish ? 'bg-blue-300 text-black -' : 'bg-rose-300 text-black '}`}
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
          <span className="text-2xl font-black text-black bg-yellow-300 px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block -">
            {state.roundScorePool}{' '}
            <span className="text-sm text-black font-bold uppercase">
              {t('gameSoundsFishy.pts')}
            </span>
          </span>
        </div>
      </div>

      {/* Main Game Area */}
      {state.currentPhase === SoundsFishyPhase.SETUP && (
        <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col items-center justify-center font-mono">
          <h2 className="text-2xl sm:text-3xl font-black text-black mb-6 uppercase tracking-widest bg-cyan-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameSoundsFishy.setupPhase')}
          </h2>

          {/* Question Display */}
          <div className="bg-yellow-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full mb-8 ">
            <span className="text-xs font-black text-black uppercase tracking-widest mb-2 block bg-white border-2 border-black px-2 py-1 inline-block -">
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
                <p className="text-2xl font-black text-black bg-white inline-block px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                  {trueAnswer}
                </p>
              </div>
            )}
          </div>

          {/* Action Area */}
          {isPicker ? (
            <div className="flex flex-col items-center justify-center space-y-4 bg-purple-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
              <div className="text-4xl animate-bounce">🎣</div>
              <p className="text-black font-black uppercase tracking-widest">
                {t('gameSoundsFishy.waitingForFish')}
              </p>
            </div>
          ) : myAnswer ? (
            <div className="bg-emerald-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - w-full max-w-md mx-auto">
              <p className="text-black font-black uppercase mb-2 text-xl">
                {t('gameSoundsFishy.answerSubmitted')}
              </p>
              <p className="text-sm font-bold text-black mb-4">
                {t('gameSoundsFishy.waitingForOthers')}
              </p>
              <p className="text-xl font-black text-black bg-white px-4 py-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {myAnswer.answer}
              </p>
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto space-y-6 bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
              <p className="text-black font-black uppercase text-center bg-yellow-300 px-2 py-1 border-2 border-black inline-block mb-2">
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
                className="w-full bg-white border-4 border-black text-black px-4 py-3 outline-none focus:ring-4 focus:ring-black font-black text-center text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                onKeyDown={(e) =>
                  e.key === 'Enter' && answerInput.trim() && soundsFishySubmitAnswer(answerInput)
                }
              />
              <button
                onClick={() => soundsFishySubmitAnswer(answerInput)}
                disabled={!answerInput.trim() || actionLoading}
                className="w-full bg-cyan-300 hover:bg-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-black font-black px-4 py-4 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-lg"
              >
                {t('gameSoundsFishy.submitAnswer')}
              </button>
            </div>
          )}

          {/* Live typing display for non-pickers who are still answering */}
          {!isPicker && state.typingAnswers && Object.keys(state.typingAnswers).length > 0 && (
            <div className="w-full mt-10 max-w-2xl mx-auto border-t-4 border-black border-dashed pt-8">
              <p className="text-xs font-black text-black uppercase tracking-widest mb-6 bg-pink-300 px-3 py-1 border-2 border-black inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {t('gameSoundsFishy.otherFishesTyping')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {room.players.map((p) => {
                  if (p.socketId === socketId || p.socketId === state.pickerId) return null; // Don't show myself or the picker
                  if (state.answeredPlayerIds.includes(p.socketId)) return null; // Don't show if they already submitted

                  const typingText = state.typingAnswers?.[p.socketId];
                  if (!typingText) return null;

                  return (
                    <div
                      key={p.socketId}
                      className="bg-white p-4 border-4 border-black text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] "
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
        <div className="flex-1 flex flex-col space-y-6 font-mono">
          <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
            <span className="text-xs font-black text-black uppercase tracking-widest mb-2 block bg-yellow-300 border-2 border-black px-2 py-1 inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {t('gameSoundsFishy.theTopic')}
            </span>
            <p className="text-xl sm:text-2xl font-black text-black mt-2">
              {state.question?.question}
            </p>
            {isPicker ? (
              <div className="mt-6 pt-6 border-t-4 border-black border-dashed">
                <span className="text-sm font-black text-black bg-pink-300 px-3 py-1 border-2 border-black uppercase tracking-widest block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block">
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
                <span className="text-xl font-black text-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  {trueAnswer}
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
                  className={`relative flex flex-col items-center justify-center p-6 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isEliminated ? 'bg-gray-400 grayscale opacity-75' : isRevealed ? 'bg-cyan-300 -' : 'bg-white '}`}
                >
                  <span className="font-black text-black uppercase tracking-widest mb-4 border-b-4 border-black w-full text-center pb-2 bg-white">
                    {p.name}
                  </span>

                  {isRevealed ? (
                    <p className="text-2xl font-black text-black text-center break-words w-full bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                      {ans.answer}
                    </p>
                  ) : (
                    <div className="text-black font-black text-4xl tracking-widest py-4 bg-gray-200 border-4 border-black shadow-[inset_4px_4px_0px_rgba(0,0,0,0.2)] w-full text-center">
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
                        disabled={actionLoading}
                        className="mt-6 bg-yellow-300 hover:bg-yellow-200 text-black font-black px-4 py-3 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
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
                        disabled={actionLoading}
                        className="mt-6 bg-rose-400 hover:bg-rose-300 text-black font-black px-4 py-3 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                      >
                        {t('gameSoundsFishy.eliminateLooksFishy')}
                      </button>
                    )}

                  {isEliminated && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/10 -[2px]">
                      <span className="bg-rose-500 text-white font-black uppercase tracking-widest px-6 py-3 border-4 border-black rotate-[-15deg] text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
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
              <div className="bg-amber-300 border-4 border-black p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mt-auto -">
                <p className="text-black mb-6 font-black text-xl bg-white inline-block px-4 py-2 border-4 border-black ">
                  {t('gameSoundsFishy.youHavePointsPrefix')}
                  <span className="text-pink-500 mx-2 text-2xl">{state.roundScorePool}</span>
                  {t('gameSoundsFishy.youHavePointsSuffix')}
                </p>
                <button
                  onClick={() => soundsFishyBankPoints()}
                  disabled={actionLoading}
                  className="w-full sm:w-auto bg-emerald-400 hover:bg-emerald-300 text-black font-black px-8 py-5 border-4 border-black text-xl uppercase tracking-widest transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed block mx-auto"
                >
                  {t('gameSoundsFishy.bankPointsAndEnd')}
                </button>
              </div>
            )}
        </div>
      )}

      {room.status === RoomStatus.RESULT && (
        <div className="bg-white border-4 border-black p-8 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col items-center justify-center font-mono">
          <h2 className="text-5xl font-black text-black mb-4 tracking-wider uppercase bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameSoundsFishy.roundOver')}
          </h2>
          <p className="text-black mb-10 font-black text-xl bg-cyan-300 px-4 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {t('gameSoundsFishy.howEveryoneScored')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mb-12">
            {room.players.map((p) => (
              <div
                key={p.socketId}
                className="bg-white p-4 border-4 border-black flex flex-col sm:flex-row justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4 "
              >
                <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
                  <span className="font-black text-black text-lg bg-pink-300 px-2 py-1 border-2 border-black w-full text-center sm:text-left mb-1">
                    {p.name}{' '}
                    {p.socketId === socketId && (
                      <span className="text-black font-bold">({t('lobby.you')})</span>
                    )}
                  </span>
                  <span className="text-sm text-black font-bold uppercase tracking-widest">
                    {p.socketId === state.pickerId
                      ? t('gameSoundsFishy.pickerText')
                      : p.socketId === state.blueFishId
                        ? t('gameSoundsFishy.blueFishText')
                        : t('gameSoundsFishy.redHerringText')}
                  </span>
                </div>
                <div className="flex flex-col items-center sm:items-end w-full sm:w-auto bg-gray-100 p-2 border-4 border-black shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)]">
                  <span className="text-3xl font-black text-black">
                    {p.score}{' '}
                    <span className="text-sm font-black text-black uppercase">
                      {t('gameSoundsFishy.pts')}
                    </span>
                  </span>
                  {state.roundPoints && state.roundPoints[p.socketId] > 0 && (
                    <span className="text-sm font-black text-black bg-emerald-300 px-2 py-1 border-2 border-black mt-2 inline-block -">
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
              disabled={actionLoading}
              className="w-full max-w-sm bg-purple-400 hover:bg-purple-300 text-black font-black px-6 py-5 border-4 border-black transition-transform shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xl "
            >
              {t('gameSoundsFishy.playNextRound')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
