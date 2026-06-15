"use client";

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, WhoAmIGameState } from '@repo/types';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarEmoji } from '@/components/core/utils';
import { useTranslate } from '@/hooks/useTranslate';

export function WhoAmIView() {
  const { room, socketId, submitPlayerWordWhoAmI, gameActionWhoAmI } = useGameStore();
  const { t } = useTranslate();
  
  const [playerWordInput, setPlayerWordInput] = useState('');
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessInput, setGuessInput] = useState('');

  if (!room || !room.whoAmIState) return null;
  const gameState = room.whoAmIState as WhoAmIGameState;
  
  const isSpectator = !room.players.find(p => p.socketId === socketId);
  const isMyTurn = !isSpectator && gameState.currentTurn === socketId && room.status === RoomStatus.PLAYING;

  // Handle END MATCH action
  const handleEndMatch = () => {
    gameActionWhoAmI({ type: 'END_MATCH' });
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-amber-200 rounded-2xl p-3 sm:p-4 shadow-xl min-h-[450px] relative overflow-hidden">
      {/* PLAYING STATUS */}
      {room.status === RoomStatus.PLAYING && (
        <div className="flex-1 flex flex-col h-full">

          {/* COLLECTING_WORDS PHASE */}
          {gameState.phase === 'COLLECTING_WORDS' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
              <h4 className="text-lg font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200 animate-pulse">
                ✍️ Submit Your Word
              </h4>
              {gameState.wordSubmissionCategory && (
                <p className="text-slate-600 text-sm font-medium">
                  Category: <span className="font-bold text-indigo-600">{gameState.wordSubmissionCategory}</span>
                </p>
              )}
              <p className="text-slate-500 text-sm text-center max-w-md">Each player writes a word. Words are shuffled so you won't get your own! Duplicates will be rejected.</p>

              {/* Input */}
              {gameState.wordSubmissions?.[socketId] ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center shadow-inner">
                  <span className="text-emerald-600 font-bold">✅ Word submitted!</span>
                  <p className="text-slate-500 text-sm mt-1">Waiting for others...</p>
                </div>
              ) : (
                <div className="w-full max-w-sm flex flex-col gap-3">
                  <input
                    type="text"
                    value={playerWordInput}
                    onChange={(e) => setPlayerWordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && playerWordInput.trim()) {
                        submitPlayerWordWhoAmI(playerWordInput.trim());
                        setPlayerWordInput('');
                      }
                    }}
                    className="w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 text-slate-800 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                    placeholder="Type your word..."
                    autoFocus
                  />
                  <button
                    onClick={() => { submitPlayerWordWhoAmI(playerWordInput.trim()); setPlayerWordInput(''); }}
                    disabled={!playerWordInput.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                  >Submit Word</button>
                </div>
              )}

              {/* Submission Status */}
              <div className="w-full max-w-sm mt-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 text-center">Submissions</label>
                <div className="flex flex-wrap justify-center gap-2">
                  {room.players.map(p => {
                    const hasSubmitted = !!gameState.wordSubmissions?.[p.socketId];
                    return (
                      <div key={p.id} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${hasSubmitted ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        <span className="text-sm">{hasSubmitted ? '✅' : '⏳'}</span>
                        {p.name}{p.socketId === socketId && ' (You)'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Normal game UI (ASKING / FINAL_GUESS phases) */}
          {gameState.phase !== 'COLLECTING_WORDS' && (<>
          
          {/* Status Bar */}
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div className="mb-3 flex items-center gap-2">
              {gameState.phase === 'FINAL_GUESS' ? (
                <span className="bg-amber-100 text-amber-600 text-xs font-black px-3 py-1 rounded-full border border-amber-300 animate-pulse uppercase tracking-wider">⚡ Final Guess!</span>
              ) : (
                <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full border border-indigo-200">Round {gameState.currentRound} / {gameState.maxRounds}</span>
              )}
            </div>
            {isSpectator ? (
              <span className="text-slate-500 font-medium bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">You are spectating. Current turn: <span className="font-bold text-indigo-500">{room.players.find(p => p.socketId === gameState.currentTurn)?.name}</span></span>
            ) : isMyTurn ? (
              <span className="text-emerald-600 animate-pulse font-black uppercase tracking-wider bg-emerald-50 px-6 py-2 rounded-full border border-emerald-200 shadow-md">It's Your Turn!</span>
            ) : (
              <span className="text-slate-600 font-medium bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 shadow-sm">Waiting for <span className="text-indigo-600 font-bold">{room.players.find(p => p.socketId === gameState.currentTurn)?.name}</span> to play...</span>
            )}
          </div>

          {/* Player Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <AnimatePresence>
              {room.players.map((player) => {
                const isActive = player.socketId === gameState.currentTurn;
                const isMe = player.socketId === socketId;
                const word = gameState.playerWords[player.socketId];
                const isEliminated = gameState.eliminatedPlayers?.includes(player.socketId);
                
                return (
                  <motion.div
                    key={player.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: isEliminated ? 0.5 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`relative flex flex-col items-center p-4 rounded-2xl border transition-all duration-300 ${isEliminated ? 'bg-rose-50 border-rose-200 grayscale' : isActive ? 'bg-indigo-50 border-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-white border-amber-200 shadow-sm hover:shadow-md'}`}
                  >
                    {isEliminated ? (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-rose-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-md">Eliminated</span>
                      </div>
                    ) : isActive && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-indigo-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-md">Active</span>
                      </div>
                    )}
                    
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-3xl shadow-inner border border-amber-300 mb-3 relative overflow-hidden">
                      {getAvatarEmoji(player.id)}
                      {isMe && <div className="absolute inset-0 bg-indigo-500/10 rounded-full"></div>}
                    </div>
                    <span className={`font-bold text-sm truncate w-full text-center ${isMe ? 'text-indigo-600' : 'text-slate-700'} mb-3`}>
                      {player.name} {isMe && '(You)'}
                    </span>

                    {/* 3D Flip Card for Word */}
                    <div className="w-full h-20 perspective-1000">
                      <motion.div
                        className="w-full h-full relative preserve-3d"
                        animate={{ rotateY: isMe ? 0 : 180 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      >
                        {/* Front of card (Hidden from player) */}
                        <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-xl border border-amber-300 flex items-center justify-center shadow-md">
                          <span className="text-3xl animate-pulse opacity-50">❓</span>
                        </div>
                        {/* Back of card (Visible to others) */}
                        <div className="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl border border-indigo-300 flex flex-col items-center justify-center shadow-md transform rotate-y-180 p-2">
                          <span className="text-xs text-indigo-100 font-medium mb-1 uppercase tracking-wider">They are</span>
                          <span className="text-white font-black text-center break-words leading-tight">{word}</span>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Interaction Panels */}
          <div className="mt-auto bg-amber-50/50 rounded-2xl p-4 sm:p-6 border border-amber-200 shadow-inner">
            
            {gameState.turnStatus === 'THINKING' && (
              <div className="text-center py-6 flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full border-t-2 border-indigo-500 animate-spin mb-3"></div>
                <p className="text-slate-500 font-medium text-center">Preparing next turn...</p>
              </div>
            )}

            {gameState.turnStatus === 'VOTING' && (
              <div className="text-center animate-in zoom-in-95 fade-in duration-300">
                <div className="mb-6">
                  {gameState.phase === 'FINAL_GUESS' ? (
                    <>
                      <h4 className="text-lg font-black text-amber-500">⚡ Final Guess Round</h4>
                      <p className="text-slate-500 text-sm mt-1">{isMyTurn ? "This is your last chance! Guess your word now!" : "Waiting for the player to guess their word..."}</p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-lg font-black text-indigo-600">Asking Phase</h4>
                      <p className="text-slate-500 text-sm mt-1">{isMyTurn ? "Ask the group a Yes/No question out loud!" : "Vote on the player's verbal question!"}</p>
                    </>
                  )}
                </div>

                {isMyTurn ? (
                  <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 fade-in">
                    <p className="text-slate-600 text-center text-sm font-medium mb-2">When you are satisfied with the answers, click below to end your turn.</p>
                    
                    {(() => {
                      const votes = Object.values(gameState.votes);
                      if (votes.length === 0) return <p className="text-slate-400 italic mt-2 mb-4 font-medium">Waiting for votes...</p>;
                      
                      const yesCount = votes.filter(v => v === 'YES').length;
                      const noCount = votes.filter(v => v === 'NO').length;
                      const maybeCount = votes.filter(v => v === 'MAYBE').length;
                      
                      const max = Math.max(yesCount, noCount, maybeCount);
                      let majority = 'Tied / Mixed';
                      let colorClass = 'text-slate-600 border-slate-300 bg-white shadow-sm';
                      
                      if (yesCount === max && yesCount > noCount && yesCount > maybeCount) {
                        majority = 'YES';
                        colorClass = 'text-emerald-600 border-emerald-300 bg-emerald-50 shadow-md shadow-emerald-500/10';
                      } else if (noCount === max && noCount > yesCount && noCount > maybeCount) {
                        majority = 'NO';
                        colorClass = 'text-rose-600 border-rose-300 bg-rose-50 shadow-md shadow-rose-500/10';
                      } else if (maybeCount === max && maybeCount > yesCount && maybeCount > noCount) {
                        majority = 'MAYBE';
                        colorClass = 'text-amber-600 border-amber-300 bg-amber-50 shadow-md shadow-amber-500/10';
                      }

                      return (
                        <div className={`mt-2 mb-4 p-4 border rounded-2xl flex flex-col items-center justify-center min-w-[240px] transition-all duration-300 ${colorClass}`}>
                          <span className="text-xs uppercase font-bold tracking-widest opacity-70 mb-1">Majority Answer</span>
                          <span className="text-4xl font-black">{majority}</span>
                          <div className="flex gap-4 mt-3 text-sm font-bold border-t border-current/10 pt-2 w-full justify-center">
                            <span className={yesCount > 0 ? "text-emerald-600" : "text-slate-400"}>Yes: {yesCount}</span>
                            <span className={noCount > 0 ? "text-rose-600" : "text-slate-400"}>No: {noCount}</span>
                            <span className={maybeCount > 0 ? "text-amber-600" : "text-slate-400"}>Maybe: {maybeCount}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full justify-center">
                      {gameState.phase !== 'FINAL_GUESS' && (
                        <button
                          onClick={() => {
                            gameActionWhoAmI({ type: 'END_TURN' });
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-4 rounded-xl transition-all shadow-md uppercase tracking-widest w-full sm:w-auto border border-slate-300 active:scale-95"
                        >
                          End Asking
                        </button>
                      )}
                      {gameState.eliminatedPlayers?.includes(socketId) ? (
                        <div className="bg-rose-50 text-rose-500 border border-rose-200 font-bold px-8 py-4 rounded-xl text-sm text-center w-full sm:w-auto shadow-sm">
                          ❌ You've used your guess
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setGuessInput('');
                            setShowGuessModal(true);
                          }}
                          className={`${gameState.phase === 'FINAL_GUESS' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 text-white'} active:scale-95 font-bold px-8 py-4 rounded-xl transition-all shadow-lg uppercase tracking-widest w-full sm:w-auto`}
                        >
                          Guess the Word!
                        </button>
                      )}
                    </div>
                    
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {Object.entries(gameState.votes).map(([voterId, vote]) => {
                        const voter = room.players.find(p => p.socketId === voterId);
                        return (
                          <div key={voterId} className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${vote === 'YES' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : vote === 'NO' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {voter?.name || 'Unknown'}: {vote}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : !isSpectator ? (
                  <div className="flex flex-col gap-3 max-w-lg mx-auto">
                    <p className="text-slate-600 font-medium text-sm mb-1">Cast your vote based on their word (you can change it until they end the turn):</p>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'NO' })}
                        className={`py-3 sm:py-4 rounded-xl font-bold transition-all shadow-sm ${gameState.votes[socketId] === 'NO' ? 'bg-rose-500 text-white ring-2 ring-rose-300 scale-105 shadow-rose-500/40 shadow-md' : 'bg-white text-rose-500 hover:bg-rose-50 border border-rose-200'}`}
                      >
                        NO
                      </button>
                      <button
                        onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'MAYBE' })}
                        className={`py-3 sm:py-4 rounded-xl font-bold transition-all shadow-sm ${gameState.votes[socketId] === 'MAYBE' ? 'bg-amber-500 text-white ring-2 ring-amber-300 scale-105 shadow-amber-500/40 shadow-md' : 'bg-white text-amber-500 hover:bg-amber-50 border border-amber-200'}`}
                      >
                        MAYBE
                      </button>
                      <button
                        onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'YES' })}
                        className={`py-3 sm:py-4 rounded-xl font-bold transition-all shadow-sm ${gameState.votes[socketId] === 'YES' ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 scale-105 shadow-emerald-500/40 shadow-md' : 'bg-white text-emerald-500 hover:bg-emerald-50 border border-emerald-200'}`}
                      >
                        YES
                      </button>
                    </div>
                    {gameState.votes[socketId] && <p className="text-emerald-500 text-sm font-medium mt-2">Vote cast! The asker can see your vote.</p>}
                  </div>
                ) : (
                  <div className="py-2">
                    <p className="text-slate-500 font-medium">Waiting for players to vote...</p>
                  </div>
                )}
              </div>
            )}

            {gameState.turnStatus === 'RESULT' && (
              <div className="text-center animate-in zoom-in-95 fade-in duration-300">
                <h3 className="text-xl font-black text-indigo-600 mb-4 uppercase tracking-widest bg-indigo-50 inline-block px-4 py-2 rounded-xl border border-indigo-200">Word Guess</h3>
                
                {/* Show the guessed word */}
                {gameState.guessedWord && (
                  <div className="my-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl shadow-sm max-w-sm mx-auto">
                    <span className="text-xs uppercase font-bold tracking-widest text-slate-500 block mb-1">{room.players.find(p => p.socketId === gameState.currentTurn)?.name} guesses:</span>
                    <span className="text-3xl font-black text-indigo-700">{gameState.guessedWord}</span>
                  </div>
                )}

                {/* Vote tallies */}
                <div className="flex justify-center gap-4 mb-6">
                  <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-xl border border-emerald-200 shadow-sm min-w-[80px]">
                    <span className="block text-3xl font-black">{Object.values(gameState.votes).filter(v => v === 'YES').length}</span>
                    <span className="text-xs uppercase font-bold">YES</span>
                  </div>
                  <div className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl border border-rose-200 shadow-sm min-w-[80px]">
                    <span className="block text-3xl font-black">{Object.values(gameState.votes).filter(v => v === 'NO').length}</span>
                    <span className="text-xs uppercase font-bold">NO</span>
                  </div>
                </div>

                {/* Voting buttons for non-active players */}
                {!isMyTurn && !isSpectator && (
                  <div className="mb-6">
                    <p className="text-slate-600 font-medium text-sm mb-3">Is their guess correct?</p>
                    <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                      <button
                        onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'YES' })}
                        className={`py-3 sm:py-4 rounded-xl font-bold transition-all shadow-sm ${gameState.votes[socketId] === 'YES' ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 scale-105 shadow-emerald-500/40 shadow-md' : 'bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200'}`}
                      >
                        ✅ YES
                      </button>
                      <button
                        onClick={() => gameActionWhoAmI({ type: 'VOTE_GUESS', vote: 'NO' })}
                        className={`py-3 sm:py-4 rounded-xl font-bold transition-all shadow-sm ${gameState.votes[socketId] === 'NO' ? 'bg-rose-500 text-white ring-2 ring-rose-300 scale-105 shadow-rose-500/40 shadow-md' : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'}`}
                      >
                        ❌ NO
                      </button>
                    </div>
                    {gameState.votes[socketId] && <p className="text-emerald-500 text-sm font-medium mt-2">Vote cast!</p>}
                  </div>
                )}

                {/* Active player waits */}
                {isMyTurn && (
                  <p className="text-slate-500 text-sm mb-4 animate-pulse font-medium">Waiting for other players to verify your guess...</p>
                )}

                {/* Vote chips */}
                <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md mx-auto">
                  {Object.entries(gameState.votes).map(([voterId, vote]) => {
                    const voter = room.players.find(p => p.socketId === voterId);
                    return (
                      <div key={voterId} className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${vote === 'YES' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                        {voter?.name || 'Unknown'}: {vote}
                      </div>
                    );
                  })}
                </div>
                
                {(socketId === room.roomHostId || isMyTurn) && (
                  <button
                    onClick={() => gameActionWhoAmI({ type: 'NEXT_TURN' })}
                    className="w-full sm:max-w-xs mx-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Continue
                  </button>
                )}
              </div>
            )}

          </div>
          </>)}
        </div>
      )}
      
      {/* FINISHED RESULT */}
      {room.status === RoomStatus.RESULT && gameState && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0 py-2 sm:py-4">
          <h4 className="text-base sm:text-lg font-black uppercase text-amber-500 tracking-widest bg-amber-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-amber-200 mb-2">Game Over</h4>
          
          <div className="text-center p-6 sm:p-8 border border-indigo-200 bg-white rounded-2xl shadow-xl animate-in zoom-in-95 duration-500 max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="text-5xl sm:text-7xl mb-4 sm:mb-6 animate-bounce drop-shadow-md">🎉</div>
            <h2 className="text-2xl sm:text-4xl font-black text-indigo-600 mb-2">{t('result.winners')}</h2>
            <div className="text-lg sm:text-xl font-bold text-slate-700 bg-amber-50 border border-amber-200 p-3 sm:p-4 rounded-xl">
              {gameState.winner ? (
                room.players.find(p => p.socketId === gameState.winner)?.name
              ) : (
                <span className="text-slate-500 italic">No winners this round</span>
              )}
            </div>
            
            {/* Show all words revealed */}
            <div className="mt-6 text-left">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">The Words Were</h4>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                {Object.entries(gameState.playerWords).map(([pId, word]) => {
                  const player = room.players.find(p => p.socketId === pId);
                  const isWinner = gameState.winner === pId;
                  return (
                    <div key={pId} className={`flex justify-between items-center p-2 rounded-lg border ${isWinner ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <span className="flex items-center gap-2">
                        <span>{getAvatarEmoji(pId)}</span>
                        <span>{player?.name}</span>
                      </span>
                      <span className="px-2 py-0.5 bg-white rounded shadow-sm text-sm font-bold border border-slate-100">{word}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {(socketId === room.roomHostId) && (
            <button 
              onClick={() => gameActionWhoAmI({ type: 'END_MATCH' })}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 sm:py-4 px-6 sm:px-10 rounded-xl transition-all shadow-lg active:scale-95 text-sm sm:text-lg uppercase tracking-widest mt-4"
            >
              {t('result.playAgain')}
            </button>
          )}
        </div>
      )}

      {/* GUESS MODAL */}
      <AnimatePresence>
        {showGuessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white border border-indigo-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              <div className="p-6 md:p-8 flex flex-col gap-4 text-center">
                <div className="text-4xl mb-2">🤔</div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest leading-tight">Who Are You?</h3>
                <p className="text-slate-600 font-medium text-sm mb-2">
                  Take a guess! If you're wrong, you might be eliminated or lose your chance to win.
                </p>

                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && guessInput.trim()) {
                      setShowGuessModal(false);
                      gameActionWhoAmI({ type: 'GUESS_WORD', guess: guessInput.trim() });
                    }
                  }}
                  className="w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center text-xl shadow-inner mb-2"
                  placeholder="Type your guess..."
                  autoFocus
                />

                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={() => setShowGuessModal(false)} 
                    className="flex-1 bg-amber-100 hover:bg-amber-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all border border-amber-300"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!guessInput.trim()}
                    onClick={() => {
                      setShowGuessModal(false);
                      gameActionWhoAmI({ type: 'GUESS_WORD', guess: guessInput.trim() });
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg"
                  >
                    Submit Guess
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
