'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, WhoAmIGameState } from '@repo/types';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarEmoji } from '@/components/core/utils';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function WhoAmIView() {
  const { room, socketId, submitPlayerWordWhoAmI, gameActionWhoAmI, actionLoading } =
    useGameStore();
  const { t } = useTranslate();

  const [playerWordInput, setPlayerWordInput] = useState('');
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [hostWords, setHostWords] = useState<Record<string, string>>({});

  if (!room || !room.whoAmIState) return null;
  const gameState = room.whoAmIState as WhoAmIGameState;

  const isSpectator = !room.players.find((p) => p.socketId === socketId);
  const isMyTurn =
    !isSpectator && gameState.currentTurn === socketId && room.status === RoomStatus.PLAYING;

  return (
    <div className="flex-1 flex flex-col bg-[#fdf8e6] border-4 border-black p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] h-full overflow-y-auto overflow-x-hidden font-mono w-full">
      {actionLoading && <ActionLoadingOverlay />}
      {/* PLAYING STATUS */}
      {room.status === RoomStatus.PLAYING && (
        <div className="flex-1 flex flex-col h-full">
          {/* COLLECTING_WORDS PHASE */}
          {gameState.phase === 'COLLECTING_WORDS' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
              <h4 className="text-xl sm:text-2xl font-black uppercase text-black bg-yellow-300 px-6 py-3 border-4 border-black rotate-[-2deg] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-auto self-start">
                ✍️ {t('gameWhoAmI.submitYourWord')}
              </h4>
              {gameState.wordSubmissionCategory && (
                <p className="text-slate-600 text-sm font-medium">
                  {t('gameWhoAmI.category')}:{' '}
                  <span className="font-bold text-indigo-600">
                    {gameState.wordSubmissionCategory}
                  </span>
                </p>
              )}
              <p className="text-slate-500 text-sm text-center max-w-md">
                {t('gameWhoAmI.wordSubmissionDesc')}
              </p>

              {/* Input */}
              {gameState.wordSubmittedIds?.includes(socketId) ? (
                <div className="bg-emerald-300 border-4 border-black p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  <span className="text-black font-black text-xl">
                    ✅ {t('gameWhoAmI.wordSubmitted')}
                  </span>
                  <p className="text-black/80 font-bold mt-1">{t('gameWhoAmI.waitingForOthers')}</p>
                </div>
              ) : (
                <div className="w-full max-w-sm flex flex-col gap-3">
                  <input
                    id="playerWordInput"
                    name="playerWord"
                    autoComplete="off"
                    type="text"
                    value={playerWordInput}
                    onChange={(e) => setPlayerWordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && playerWordInput.trim()) {
                        submitPlayerWordWhoAmI(playerWordInput.trim());
                        setPlayerWordInput('');
                      }
                    }}
                    className="w-full bg-white border-b-4 border-black border-dashed px-4 py-4 text-black text-center text-3xl font-black focus:outline-none focus:border-solid transition-all placeholder:text-black/30 placeholder:text-xl placeholder:font-bold"
                    placeholder={t('gameWhoAmI.typeYourWord')}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      submitPlayerWordWhoAmI(playerWordInput.trim());
                      setPlayerWordInput('');
                    }}
                    disabled={!playerWordInput.trim() || actionLoading}
                    className="w-full bg-blue-500 hover:bg-blue-400 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-widest mt-4"
                  >
                    {t('gameWhoAmI.submitWord')}
                  </button>
                </div>
              )}

              <div className="w-full max-w-sm mt-8">
                <label className="text-lg font-black text-black uppercase tracking-widest block mb-4 text-center border-b-4 border-black border-dashed pb-2">
                  {t('gameWhoAmI.submissions')}
                </label>
                <div className="flex flex-wrap justify-center gap-3">
                  {room.players.map((p) => {
                    const hasSubmitted = !!gameState.wordSubmittedIds?.includes(p.socketId);
                    return (
                      <div
                        key={p.id}
                        className={`px-4 py-2 font-bold border-2 border-black flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${hasSubmitted ? 'bg-emerald-300 text-black -' : 'bg-gray-200 text-black/50 '}`}
                      >
                        <span className="text-lg">{hasSubmitted ? '✅' : '⏳'}</span>
                        <span>{p.name}</span>
                        {p.socketId === socketId && (
                          <span className="opacity-70 text-sm">({t('lobby.you')})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* AWAITING_HOST_INPUT PHASE - host submits words for all players */}
          {gameState.phase === 'AWAITING_HOST_INPUT' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
              <h4 className="text-xl sm:text-2xl font-black uppercase text-black bg-pink-300 px-6 py-3 border-4 border-black rotate-[2deg] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-auto self-start">
                Secret Word Selection
              </h4>
              {socketId === room.roomHostId ? (
                <div className="w-full max-w-md space-y-8">
                  <p className="text-black font-bold text-center bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                    Enter a secret word for each player. They will NOT see their own word.
                  </p>
                  {/* Input for each non-host player */}
                  {room.players
                    .filter((p) => p.socketId !== room.roomHostId)
                    .map((p) => (
                      <div key={p.socketId} className="space-y-2">
                        <label className="text-xl font-black text-black uppercase tracking-wider block bg-yellow-300 border-2 border-black px-3 py-1 inline-block -">
                          {p.name}
                        </label>
                        <input
                          type="text"
                          value={hostWords[p.socketId] || ''}
                          onChange={(e) =>
                            setHostWords((prev) => ({
                              ...prev,
                              [p.socketId]: e.target.value,
                            }))
                          }
                          placeholder={t('gameWhoAmI.typeYourWord')}
                          className="w-full bg-white border-b-4 border-black border-dashed px-4 py-4 text-black text-center text-3xl font-black focus:outline-none focus:border-solid transition-all placeholder:text-black/30 placeholder:text-xl placeholder:font-bold"
                        />
                      </div>
                    ))}
                  <button
                    onClick={() => {
                      if (
                        Object.keys(hostWords).length <
                        room.players.filter((p) => p.socketId !== room.roomHostId).length
                      )
                        return;
                      useGameStore.getState().submitWordsWhoAmI(hostWords);
                    }}
                    disabled={
                      Object.keys(hostWords).length <
                        room.players.filter((p) => p.socketId !== room.roomHostId).length ||
                      Object.values(hostWords).some((w) => !w.trim()) ||
                      actionLoading
                    }
                    className="w-full bg-blue-500 hover:bg-blue-400 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-widest mt-4"
                  >
                    {t('gameWhoAmI.submitWord')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 py-6">
                  <div className="w-12 h-12 rounded-full border border-indigo-500 border-t-transparent animate-spin"></div>
                  <p className="text-slate-500 font-medium animate-pulse">
                    Waiting for Host to submit secret words...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Normal game UI (ASKING / FINAL_GUESS phases) */}
          {gameState.phase !== 'COLLECTING_WORDS' && gameState.phase !== 'AWAITING_HOST_INPUT' && (
            <>
              {/* Status Bar */}
              <div className="flex flex-col items-center justify-center text-center mb-10 mt-2">
                <div className="mb-4 flex items-center gap-2">
                  {gameState.phase === 'FINAL_GUESS' ? (
                    <span className="bg-pink-400 text-black text-xl font-black px-4 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - uppercase tracking-widest">
                      ⚡ {t('gameWhoAmI.finalGuessRound')}
                    </span>
                  ) : (
                    <span className="bg-white text-black text-lg font-black px-4 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                      {t('gameWhoAmI.round')} {gameState.currentRound} / {gameState.maxRounds}
                    </span>
                  )}
                </div>
                {isSpectator ? (
                  <span className="text-black font-bold bg-gray-200 px-4 py-2 border-2 border-black">
                    {t('gameWhoAmI.spectating')}{' '}
                    <span className="font-black">
                      {room.players.find((p) => p.socketId === gameState.currentTurn)?.name}
                    </span>
                  </span>
                ) : isMyTurn ? (
                  <span className="text-black font-black uppercase tracking-widest bg-yellow-300 px-8 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl -">
                    👉 {t('gameWhoAmI.yourTurn')} 👈
                  </span>
                ) : (
                  <span className="text-black font-bold bg-white px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-lg ">
                    {t('gameWhoAmI.waitingFor')}{' '}
                    <span className="font-black bg-yellow-300 px-2 py-0.5 border border-black inline-block -">
                      {room.players.find((p) => p.socketId === gameState.currentTurn)?.name}
                    </span>{' '}
                    {t('gameWhoAmI.toPlay')}
                  </span>
                )}
              </div>

              {/* Player Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                <AnimatePresence>
                  {room.players.map((player) => {
                    const isActive = player.socketId === gameState.currentTurn;
                    const isMe = player.socketId === socketId;
                    const word = (gameState.revealedWords || ({} as Record<string, string>))[
                      player.socketId
                    ];
                    const isEliminated = gameState.eliminatedPlayers?.includes(player.socketId);

                    return (
                      <motion.div
                        key={player.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: isEliminated ? 0.5 : 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={`relative flex flex-col items-center p-4 border-4 transition-all duration-300 ${isEliminated ? 'bg-gray-300 border-black grayscale ' : isActive ? 'bg-cyan-200 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] scale-105 z-10' : 'bg-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1'}`}
                      >
                        {isEliminated ? (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-rose-500 text-white text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
                              {t('gameWhoAmI.eliminated')}
                            </span>
                          </div>
                        ) : (
                          isActive && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className="bg-yellow-300 text-black text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
                                {t('gameWhoAmI.active')}
                              </span>
                            </div>
                          )
                        )}

                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 border-black mb-3 relative overflow-hidden bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          {player.avatar || getAvatarEmoji(player.id)}
                          {isMe && <div className="absolute inset-0 bg-black/5 rounded-full"></div>}
                        </div>
                        <span
                          className={`font-black text-sm truncate w-full text-center ${isMe ? 'text-blue-600' : 'text-black'} mb-3 uppercase`}
                        >
                          {player.name} {isMe && `(${t('lobby.you')})`}
                        </span>

                        {/* 3D Flip Card for Word */}
                        <div className="w-full h-24 perspective-1000">
                          <motion.div
                            className="w-full h-full relative preserve-3d"
                            animate={{ rotateY: isMe ? 0 : 180 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                          >
                            {/* Front of card (Hidden from player) */}
                            <div className="absolute inset-0 w-full h-full backface-hidden bg-white border-2 border-black border-dashed flex items-center justify-center">
                              <span className="text-3xl text-black animate-pulse">❓</span>
                            </div>
                            {/* Back of card (Visible to others) */}
                            <div className="absolute inset-0 w-full h-full backface-hidden bg-yellow-300 border-2 border-black flex flex-col items-center justify-center transform rotate-y-180 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
                              <span className="text-xs text-black/60 font-black mb-1 uppercase tracking-wider">
                                {t('gameWhoAmI.theyAre')}
                              </span>
                              <span className="text-black font-black text-center break-words leading-tight text-lg">
                                {word}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Interaction Panels */}
              <div className="mt-auto ">
                {gameState.turnStatus === 'VOTING' && (
                  <div className="text-center animate-in zoom-in-95 fade-in duration-300">
                    <div className="text-center mb-8">
                      {gameState.phase === 'FINAL_GUESS' ? (
                        <>
                          <h4 className="text-2xl font-black text-black bg-pink-300 px-6 py-2 border-4 border-black inline-block - shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 mt-2">
                            ⚡ Final Guess Round
                          </h4>
                          <p className="text-black font-bold text-lg bg-white inline-block px-4 py-1 border-2 border-black ">
                            {isMyTurn
                              ? t('gameWhoAmI.finalGuessDescActive')
                              : t('gameWhoAmI.finalGuessDescWait')}
                          </p>
                        </>
                      ) : (
                        <>
                          <h4 className="text-2xl font-black text-black bg-cyan-300 px-6 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 mt-2">
                            {t('gameWhoAmI.askingPhase')}
                          </h4>
                          <p className="text-black font-bold text-lg bg-white inline-block px-4 py-1 border-2 border-black -">
                            {isMyTurn
                              ? t('gameWhoAmI.askingPhaseDescActive')
                              : t('gameWhoAmI.askingPhaseDescWait')}
                          </p>
                        </>
                      )}
                    </div>

                    {isMyTurn ? (
                      <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 fade-in">
                        <p className="text-slate-600 text-center text-sm font-medium mb-2">
                          {t('gameWhoAmI.endTurnHint')}
                        </p>

                        {(() => {
                          const votes = Object.values(gameState.votes);
                          if (votes.length === 0)
                            return (
                              <p className="text-slate-400 italic mt-2 mb-4 font-medium">
                                {t('gameWhoAmI.waitingForVotes')}
                              </p>
                            );

                          const yesCount = votes.filter((v) => v === 'YES').length;
                          const noCount = votes.filter((v) => v === 'NO').length;
                          const maybeCount = votes.filter((v) => v === 'MAYBE').length;

                          const max = Math.max(yesCount, noCount, maybeCount);
                          let majority = t('gameWhoAmI.unknown');
                          let colorClass = 'text-slate-600 border-slate-300 bg-white ';

                          if (yesCount === max && yesCount > noCount && yesCount > maybeCount) {
                            majority = t('gameWhoAmI.yes');
                            colorClass =
                              'text-emerald-600 border-emerald-300 bg-emerald-50 shadow-emerald-500/10';
                          } else if (
                            noCount === max &&
                            noCount > yesCount &&
                            noCount > maybeCount
                          ) {
                            majority = t('gameWhoAmI.no');
                            colorClass =
                              'text-rose-600 border-rose-300 bg-rose-50 shadow-rose-500/10';
                          } else if (
                            maybeCount === max &&
                            maybeCount > yesCount &&
                            maybeCount > noCount
                          ) {
                            majority = t('gameWhoAmI.maybe');
                            colorClass =
                              'text-amber-600 border-amber-300 bg-amber-50 shadow-amber-500/10';
                          }

                          return (
                            <div
                              className={`mt-2 mb-4 p-4 border flex flex-col items-center justify-center min-w-[240px] transition-all duration-300 ${colorClass}`}
                            >
                              <span className="text-xs uppercase font-bold tracking-widest opacity-70 mb-1">
                                {t('gameWhoAmI.majorityAnswer')}
                              </span>
                              <span className="text-4xl font-black">{majority}</span>
                              <div className="flex gap-4 mt-3 text-sm font-bold border-t border-current/10 pt-2 w-full justify-center">
                                <span
                                  className={yesCount > 0 ? 'text-emerald-600' : 'text-slate-400'}
                                >
                                  Yes: {yesCount}
                                </span>
                                <span className={noCount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                                  No: {noCount}
                                </span>
                                <span
                                  className={maybeCount > 0 ? 'text-amber-600' : 'text-slate-400'}
                                >
                                  Maybe: {maybeCount}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full justify-center">
                          {gameState.phase !== 'FINAL_GUESS' && (
                            <button
                              onClick={() => {
                                gameActionWhoAmI({ type: 'END_TURN' });
                              }}
                              disabled={actionLoading}
                              className="bg-white hover:bg-gray-100 text-black font-black px-6 py-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest w-full sm:w-auto active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t('gameWhoAmI.endAsking')}
                            </button>
                          )}
                          {gameState.eliminatedPlayers?.includes(socketId) ? (
                            <div className="bg-rose-300 text-black border-4 border-black font-black px-8 py-4 text-center w-full sm:w-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                              ❌ {t('gameWhoAmI.usedGuess')}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setGuessInput('');
                                setShowGuessModal(true);
                              }}
                              disabled={actionLoading}
                              className={`${gameState.phase === 'FINAL_GUESS' ? 'bg-pink-400 hover:bg-pink-300' : 'bg-blue-500 hover:bg-blue-400'} text-black font-black px-8 py-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest w-full sm:w-auto active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {t('gameWhoAmI.guessTheWord')}
                            </button>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {Object.entries(gameState.votes).map(([voterId, vote]) => {
                            const voter = room.players.find((p) => p.socketId === voterId);
                            return (
                              <div
                                key={voterId}
                                className={`px-3 py-1 rounded-full text-xs font-bold border ${vote === 'YES' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : vote === 'NO' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}
                              >
                                {voter?.name || t('gameWhoAmI.unknown')}:{' '}
                                {vote === 'YES'
                                  ? t('gameWhoAmI.yes')
                                  : vote === 'NO'
                                    ? t('gameWhoAmI.no')
                                    : t('gameWhoAmI.maybe')}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : !isSpectator ? (
                      <div className="flex flex-col gap-4 max-w-lg mx-auto">
                        <p className="text-black font-black text-lg mb-1 uppercase bg-white border-2 border-black px-4 py-1 inline-block - self-center">
                          {t('gameWhoAmI.castVoteHint')}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <button
                            onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'NO' })}
                            disabled={actionLoading}
                            className={`py-3 sm:py-4 font-black transition-all border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed ${gameState.votes[socketId] === 'NO' ? 'bg-rose-400 text-black shadow-none translate-y-1' : 'bg-white text-black hover:bg-rose-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                          >
                            ❌ {t('gameWhoAmI.no')}
                          </button>
                          <button
                            onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'MAYBE' })}
                            disabled={actionLoading}
                            className={`py-3 sm:py-4 font-black transition-all border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed ${gameState.votes[socketId] === 'MAYBE' ? 'bg-yellow-400 text-black shadow-none translate-y-1' : 'bg-white text-black hover:bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                          >
                            🤷 {t('gameWhoAmI.maybe')}
                          </button>
                          <button
                            onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'YES' })}
                            disabled={actionLoading}
                            className={`py-3 sm:py-4 font-black transition-all border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed ${gameState.votes[socketId] === 'YES' ? 'bg-emerald-400 text-black shadow-none translate-y-1' : 'bg-white text-black hover:bg-emerald-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                          >
                            ✅ {t('gameWhoAmI.yes')}
                          </button>
                        </div>
                        {gameState.votes[socketId] && (
                          <p className="text-emerald-600 bg-emerald-200 border-2 border-black px-4 py-1 font-black text-center mt-2">
                            ✅ {t('gameWhoAmI.voteCastHint')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="py-2">
                        <p className="text-slate-500 font-medium">
                          {t('gameWhoAmI.waitingForPlayersToVote')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {gameState.turnStatus === 'RESULT' && (
                  <div className="text-center animate-in zoom-in-95 fade-in duration-300">
                    <h3 className="text-xl font-black text-black mb-4 uppercase tracking-widest bg-yellow-300 inline-block px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                      {t('gameWhoAmI.wordGuess')}
                    </h3>

                    {/* Show the guessed word */}
                    {gameState.guessedWord && (
                      <div className="my-4 p-4 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-sm mx-auto ">
                        <span className="text-xs uppercase font-black tracking-widest text-black/60 block mb-1">
                          {room.players.find((p) => p.socketId === gameState.currentTurn)?.name}{' '}
                          {t('gameWhoAmI.guesses')}
                        </span>
                        <span className="text-4xl font-black text-black">
                          {gameState.guessedWord}
                        </span>
                      </div>
                    )}

                    {/* Vote tallies */}
                    <div className="flex justify-center gap-4 mb-6">
                      <div className="bg-emerald-300 text-black px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[80px] -">
                        <span className="block text-3xl font-black">
                          {Object.values(gameState.votes).filter((v) => v === 'YES').length}
                        </span>
                        <span className="text-xs uppercase font-black">YES</span>
                      </div>
                      <div className="bg-rose-300 text-black px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[80px] ">
                        <span className="block text-3xl font-black">
                          {Object.values(gameState.votes).filter((v) => v === 'NO').length}
                        </span>
                        <span className="text-xs uppercase font-black">NO</span>
                      </div>
                    </div>

                    {/* Voting buttons for non-active players */}
                    {!isMyTurn && !isSpectator && (
                      <div className="mb-6">
                        <p className="text-black font-black text-lg mb-3 bg-white border-2 border-black px-4 py-1 inline-block -">
                          {t('gameWhoAmI.isGuessCorrect')}
                        </p>
                        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                          <button
                            onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'YES' })}
                            disabled={actionLoading}
                            className={`py-3 sm:py-4 font-black transition-all border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed ${gameState.votes[socketId] === 'YES' ? 'bg-emerald-400 text-black shadow-none translate-y-1' : 'bg-white text-black hover:bg-emerald-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                          >
                            ✅ YES
                          </button>
                          <button
                            onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'NO' })}
                            disabled={actionLoading}
                            className={`py-3 sm:py-4 font-black transition-all border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed ${gameState.votes[socketId] === 'NO' ? 'bg-rose-400 text-black shadow-none translate-y-1' : 'bg-white text-black hover:bg-rose-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                          >
                            ❌ NO
                          </button>
                        </div>
                        {gameState.votes[socketId] && (
                          <p className="text-emerald-600 bg-emerald-200 border-2 border-black px-4 py-1 font-black text-center mt-4 max-w-xs mx-auto">
                            {t('gameWhoAmI.voteCast')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Active player waits */}
                    {isMyTurn && (
                      <p className="text-black bg-white border-2 border-black px-4 py-2 text-sm mb-4 animate-pulse font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-xs mx-auto ">
                        {t('gameWhoAmI.waitingForVerify')}
                      </p>
                    )}

                    {/* Vote chips */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md mx-auto">
                      {Object.entries(gameState.votes).map(([voterId, vote]) => {
                        const voter = room.players.find((p) => p.socketId === voterId);
                        return (
                          <div
                            key={voterId}
                            className={`px-3 py-1 font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${vote === 'YES' ? 'bg-emerald-300 text-black ' : 'bg-rose-300 text-black -'}`}
                          >
                            {voter?.name || 'Unknown'}: {vote}
                          </div>
                        );
                      })}
                    </div>

                    {(socketId === room.roomHostId || isMyTurn) && (
                      <button
                        onClick={() => gameActionWhoAmI({ type: 'NEXT_TURN' })}
                        disabled={actionLoading}
                        className="w-full sm:max-w-xs mx-auto bg-blue-500 hover:bg-blue-400 text-black font-black py-4 px-6 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest mt-4"
                      >
                        {t('gameWhoAmI.continueBtn')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* FINISHED RESULT */}
      {room.status === RoomStatus.RESULT && gameState && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0 py-2 sm:py-4">
          <h4 className="text-xl sm:text-2xl font-black uppercase text-black tracking-widest bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - mb-2">
            {t('gameWhoAmI.gameOver')}
          </h4>

          <div className="text-center p-6 sm:p-8 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 max-w-md w-full relative">
            {gameState.winner ? (
              <>
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4 animate-bounce">👑</div>
                <h2 className="text-2xl sm:text-4xl font-black text-black bg-white inline-block px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  {room.players.find((p) => p.socketId === gameState.winner)?.name}{' '}
                  {t('gameWhoAmI.wins')}
                </h2>
                <br />
                <p className="text-black font-bold mt-4 text-sm sm:text-base border-2 border-black inline-block px-4 py-1 - bg-yellow-300">
                  {t('gameWhoAmI.theyGuessedCorrectly')}
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl sm:text-6xl mb-2 sm:mb-4 opacity-50 grayscale">🤷</div>
                <h2 className="text-2xl sm:text-4xl font-black text-black bg-gray-300 inline-block px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                  {t('gameWhoAmI.noWinner')}
                </h2>
                <br />
                <p className="text-black font-bold mt-4 text-sm sm:text-base border-2 border-black inline-block px-4 py-1 bg-yellow-300">
                  {t('gameWhoAmI.everyoneUsedGuesses')}
                </p>
              </>
            )}
          </div>

          <div className="w-full max-w-md bg-white p-4 sm:p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mt-4">
            <div className="flex flex-col items-center">
              <h4 className="text-sm font-black text-black uppercase tracking-widest border-b-4 border-black border-dashed pb-2 mb-4">
                {t('gameWhoAmI.theWordsWere')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
                {Object.entries(gameState.revealedWords || ({} as Record<string, string>)).map(
                  ([pId, word]) => {
                    const player = room.players.find((p) => p.socketId === pId);
                    const isWinner = gameState.winner === pId;
                    return (
                      <div
                        key={pId}
                        className={`flex justify-between items-center p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isWinner ? 'bg-yellow-300 text-black font-black -' : 'bg-white text-black '}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-xs">{player?.avatar || getAvatarEmoji(pId)}</span>
                          <span className="font-bold truncate max-w-[80px]">{player?.name}</span>
                        </span>
                        <span className="px-2 py-0.5 bg-white border-2 border-black text-sm font-black -">
                          {word}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          {socketId === room.roomHostId && (
            <button
              onClick={() => gameActionWhoAmI({ type: 'END_MATCH' })}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 sm:py-4 px-6 sm:px-10 transition-all active:scale-95 text-sm sm:text-lg uppercase tracking-widest mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('result.playAgain')}
            </button>
          )}
        </div>
      )}

      {/* GUESS MODAL */}
      <AnimatePresence>
        {showGuessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-yellow-300 border-4 border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative "
            >
              <div className="p-6 md:p-8 flex flex-col gap-4 text-center">
                <div className="text-5xl mb-2">🤔</div>
                <h3 className="text-2xl font-black text-black uppercase tracking-widest leading-tight border-b-4 border-black border-dashed pb-2">
                  {t('gameWhoAmI.whoAreYou')}
                </h3>
                <p className="text-black font-bold text-sm mb-2">
                  {t('gameWhoAmI.takeAGuessDesc')}
                </p>

                <input
                  id="guessWordInput"
                  name="guessWord"
                  autoComplete="off"
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && guessInput.trim()) {
                      setShowGuessModal(false);
                      gameActionWhoAmI({ type: 'GUESS_WORD', guess: guessInput.trim() });
                    }
                  }}
                  className="w-full bg-white border-4 border-black px-4 py-4 text-black focus:outline-none transition-all font-black text-center text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 -"
                  placeholder={t('gameWhoAmI.typeYourGuess')}
                  autoFocus
                />

                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => setShowGuessModal(false)}
                    className="flex-1 bg-white hover:bg-gray-200 text-black font-black py-3 px-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                  >
                    {t('gameWhoAmI.cancel')}
                  </button>
                  <button
                    disabled={!guessInput.trim() || actionLoading}
                    onClick={() => {
                      setShowGuessModal(false);
                      gameActionWhoAmI({ type: 'GUESS_WORD', guess: guessInput.trim() });
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-black py-3 px-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                  >
                    {t('gameWhoAmI.submitGuess')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
