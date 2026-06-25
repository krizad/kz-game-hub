import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { MusicTriviaActionType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function MusicTriviaView() {
  const { t } = useTranslate();
  const { room, myName, musicTriviaGameAction, musicTriviaSyncPlay, socketId, resetRoom } = useGameStore();
  const hostAnswer = useGameStore(s => s.musicTriviaHostAnswer);
  const state = room?.musicTriviaState;
  
  const isHost = socketId === room?.roomHostId;

  const [answerInput, setAnswerInput] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.5);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reactPlayerRef = useRef<any>(null);
  const [forcePlayToggle, setForcePlayToggle] = useState(true);

  // Handle audio playback based on syncPlay and phase
  useEffect(() => {
    if (!state || !musicTriviaSyncPlay) return;

    if (state.phase === 'PLAYING') {
      const now = Date.now();
      const elapsed = (now - musicTriviaSyncPlay.playStartTime) / 1000;
      const shouldPlay = room?.config.musicTriviaAudioPlayback === 'HOST_ONLY' ? isHost : true;

      // Handle HTML5 Audio (iTunes, Spotify)
      if (musicTriviaSyncPlay.sourceType !== 'YOUTUBE') {
        if (!audioRef.current) {
          audioRef.current = new Audio(musicTriviaSyncPlay.previewUrl);
        } else if (audioRef.current.src !== musicTriviaSyncPlay.previewUrl) {
          audioRef.current.src = musicTriviaSyncPlay.previewUrl;
        }
        audioRef.current.volume = volume;
        
        if (elapsed > 0 && elapsed < musicTriviaSyncPlay.durationMs / 1000) {
          audioRef.current.currentTime = elapsed;
          if (shouldPlay) {
            audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
          } else {
            audioRef.current.pause();
          }
        }
      } else {
        // Handle YouTube via ReactPlayer (seek on start if needed)
        // We do not manage the raw audioRef here.
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [state?.phase, musicTriviaSyncPlay, room?.config.musicTriviaAudioPlayback, isHost, volume]);

  // Auto-fetch tracks if we just started the game
  useEffect(() => {
    if (isHost && state?.phase === 'SETUP' && room?.config.musicTriviaQuery && !state.errorMessage) {
      handleAction('CONFIGURE_SOURCE', { 
        query: room.config.musicTriviaQuery, 
        sourceType: room.config.musicTriviaSource || 'ITUNES',
        searchOptions: {
          country: room.config.musicTriviaCountry || 'TH',
          attribute: room.config.musicTriviaAttribute
        }
      });
    }
  }, [isHost, state?.phase, room?.config.musicTriviaQuery, room?.config.musicTriviaCountry, room?.config.musicTriviaAttribute, state?.errorMessage]);

  // Auto-proceed to next round for fast-paced gameplay
  useEffect(() => {
    if (state?.phase === 'ANSWER_RESULT' || state?.phase === 'REVEAL' || state?.phase === 'ROUND_RESULT') {
      setCountdown(5);
      
      const interval = setInterval(() => {
        setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      let timer: NodeJS.Timeout;
      if (isHost) {
        timer = setTimeout(() => {
          handleAction('NEXT_ROUND');
        }, 5000); // 5 seconds delay before auto-proceeding
      }
      
      return () => {
        if (timer) clearTimeout(timer);
        clearInterval(interval);
        setCountdown(null);
      };
    } else {
      setCountdown(null);
    }
  }, [isHost, state?.phase, state?.currentRound?.roundNumber]);

  if (!state) return null;

  const handleAction = (type: MusicTriviaActionType, payload: any = {}) => {
    musicTriviaGameAction({ type, ...payload });
  };

  const handleBuzz = () => {
    handleAction('PRESS_BUZZER');
  };

  const submitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction('SUBMIT_ANSWER', { answer: answerInput });
    setAnswerInput('');
  };

  const amIStruckOut = state.currentRound?.struckOutIds.includes(
    room?.players.find(p => p.name === myName)?.id || ''
  );
  
  const amICurrentBuzzer = state.currentRound?.currentBuzzerId === 
    room?.players.find(p => p.name === myName)?.id;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm z-0 relative">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          🎵 <span className="hidden sm:inline">Music Trivia</span>
        </h2>
        <div className="flex gap-4 text-sm font-medium items-center">
          <div className="px-3 py-1 bg-slate-100 rounded-full text-slate-600 border">
            Round {state.currentRound?.roundNumber || 0} / {state.totalRounds}
          </div>
          {isHost && state.phase !== 'FINISHED' && (
            <Button size="sm" variant="outline" onClick={() => handleAction('END_GAME')} className="text-red-500 border-red-200 hover:bg-red-50">
              End Game
            </Button>
          )}
        </div>
      </div>

      {/* Sub-header for Category Info */}
      <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-indigo-800 font-medium z-0 relative shadow-inner">
        <span className="flex items-center gap-1.5 bg-white/60 px-2 py-0.5 rounded border border-indigo-200">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">Playlist:</span>
          <span className="font-bold text-sm">{room.config.musicTriviaQuery || 'Random'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">Region:</span>
          <span>{room.config.musicTriviaCountry === 'TH' ? t('gameMusicTrivia.lobby.regionTh') : t('gameMusicTrivia.lobby.regionIntl')}</span>
        </span>
        <span className="opacity-30">|</span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">Search By:</span>
          <span>{
            room.config.musicTriviaAttribute === 'artistTerm' ? t('gameMusicTrivia.lobby.searchArtist') :
            room.config.musicTriviaAttribute === 'songTerm' ? t('gameMusicTrivia.lobby.searchSong') :
            room.config.musicTriviaAttribute === 'albumTerm' ? t('gameMusicTrivia.lobby.searchAlbum') : t('gameMusicTrivia.lobby.searchAnything')
          }</span>
        </span>
        <span className="opacity-30">|</span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">Mode:</span>
          <span>{state.mode === 'GAME_MASTER' ? '🎤 Voice' : '⌨️ Typing'}</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 relative">
        {/* Hidden YouTube Player (Must not be display: none for autoplay to work, and must be at least 200x200 for YouTube API) */}
        {state.phase === 'PLAYING' && musicTriviaSyncPlay?.sourceType === 'YOUTUBE' && (
          <div className="absolute top-0 left-0 w-[300px] h-[300px] opacity-0 z-[-1] overflow-hidden pointer-events-none">
            <ReactPlayer
              ref={reactPlayerRef}
              url={`https://www.youtube.com/watch?v=${musicTriviaSyncPlay.previewUrl}`}
              playing={forcePlayToggle && (room?.config.musicTriviaAudioPlayback === 'HOST_ONLY' ? isHost : true)}
              volume={volume}
              width="100%"
              height="100%"
              config={{
                youtube: {
                  // @ts-expect-error Youtube config type mismatch
                  playerVars: { autoplay: 1, controls: 0, showinfo: 0, rel: 0, origin: typeof window !== 'undefined' ? window.location.origin : undefined }
                }
              }}
              onReady={() => {
                console.log('[ReactPlayer] Ready');
                if (reactPlayerRef.current && musicTriviaSyncPlay?.playStartTime) {
                  const now = Date.now();
                  const elapsed = (now - musicTriviaSyncPlay.playStartTime) / 1000;
                  if (elapsed > 0) {
                    reactPlayerRef.current.seekTo(elapsed, 'seconds');
                  }
                }
              }}
              onStart={() => console.log('[ReactPlayer] Started playing')}
              onPlay={() => console.log('[ReactPlayer] Playing')}
              onPause={() => console.log('[ReactPlayer] Paused')}
              onBuffer={() => console.log('[ReactPlayer] Buffering...')}
              onError={(e) => console.error('[ReactPlayer] Error:', e)}
            />
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* SETUP Phase */}
          {state.phase === 'SETUP' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-4 animate-pulse">
              <div className="text-4xl mb-2">🎶</div>
              <h3 className="text-xl font-bold text-slate-800">Preparing Music...</h3>
              <p className="text-slate-500">Searching for {room.config.musicTriviaQuery || 'songs'} on {room.config.musicTriviaSource === 'SPOTIFY' ? 'Spotify' : room.config.musicTriviaSource === 'YOUTUBE' ? 'YouTube' : 'iTunes'}</p>
            </div>
          )}

          {/* PLAYING Phase */}
          {state.phase === 'PLAYING' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 animate-spin-slow shadow-lg shadow-indigo-200 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <div className="flex items-end space-x-1 h-4">
                      <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite] h-full"></div>
                      <div className="w-1 bg-purple-500 animate-[bounce_0.8s_infinite] h-3/4"></div>
                      <div className="w-1 bg-indigo-400 animate-[bounce_1.2s_infinite] h-full"></div>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 border-4 border-white/20 rounded-full animate-ping"></div>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold text-slate-800 animate-pulse">Now Playing...</h3>
                <p className="text-slate-500 mt-2">Listen carefully!</p>
                <button 
                  onClick={() => {
                    if (audioRef.current) audioRef.current.play().catch(e => console.error(e));
                    
                    // Toggle playing state quickly to force ReactPlayer to send a new play command
                    // This leverages the current click user-interaction token
                    setForcePlayToggle(false);
                    setTimeout(() => setForcePlayToggle(true), 50);
                  }}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
                >
                  🔊 Click here if you can't hear music
                </button>
              </div>

              {/* Volume Control */}
              <div className="w-full max-w-xs flex items-center space-x-4 bg-slate-50 p-4 rounded-2xl border">
                <span className="text-slate-400 text-xl">🔉</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  aria-label="Volume control"
                />
                <span className="text-slate-500 text-xl">🔊</span>
              </div>
              
              {!isHost || state.hostPlays ? (
                <Button 
                  onClick={handleBuzz}
                  disabled={amIStruckOut}
                  className={`w-full max-w-xs h-32 rounded-3xl text-3xl font-bold transition-all shadow-xl active:scale-95 active:shadow-md ${amIStruckOut ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'}`}
                >
                  {amIStruckOut ? '❌ X' : '🚨 BUZZ!'}
                </Button>
              ) : (
                <div className="space-y-4 mt-6">
                  <p className="text-slate-500 font-medium">You are the host. You cannot buzz.</p>
                  {state.mode === 'GAME_MASTER' && (
                    <Button 
                      variant="outline" 
                      onClick={() => musicTriviaGameAction({ type: 'REVEAL_ANSWER' })}
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      💡 Nobody knows? Reveal Answer
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BUZZED / ANSWERING Phase */}
          {(state.phase === 'BUZZED' || state.phase === 'ANSWERING') && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border text-center space-y-6">
              <div className="text-5xl animate-bounce">🚨</div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {room?.players.find(p => p.socketId === state.currentRound?.currentBuzzerId)?.name} Buzzed!
                </h3>
                {state.currentRound?.buzzerPresses.find(p => p.playerId === state.currentRound?.currentBuzzerId) && (
                  <p className="text-sm font-mono text-slate-500 mt-2">
                    Reaction: {(state.currentRound.buzzerPresses.find(p => p.playerId === state.currentRound?.currentBuzzerId)!.reactionTimeMs / 1000).toFixed(2)}s ⚡️
                  </p>
                )}
              </div>

              {state.mode === 'GAME_MASTER' ? (
                <>
                  {isHost ? (
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border">
                      <p className="font-bold mb-3 text-slate-700">Is their answer correct?</p>
                      
                      {hostAnswer && (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-left">
                          <p className="text-sm text-indigo-500 font-bold uppercase mb-1">Actual Answer:</p>
                          <p className="text-xl font-bold text-slate-800">{hostAnswer.title}</p>
                          <p className="text-md text-slate-600">by {hostAnswer.artist}</p>
                          {hostAnswer.trackViewUrl && (
                            <a href={hostAnswer.trackViewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white/50 px-3 py-1 rounded-full shadow-sm">
                              {t('gameMusicTrivia.game.viewOnAppleMusic')}
                            </a>
                          )}
                        </div>
                      )}

                      <div className="flex gap-4 justify-center">
                        <Button onClick={() => musicTriviaGameAction({ type: 'HOST_JUDGE', correct: true })} className="bg-green-500 hover:bg-green-600 px-8 text-lg font-bold py-6 rounded-xl shadow-lg shadow-green-500/30">Yes (Correct)</Button>
                        <Button onClick={() => musicTriviaGameAction({ type: 'HOST_JUDGE', correct: false })} className="bg-red-500 hover:bg-red-600 px-8 text-lg font-bold py-6 rounded-xl shadow-lg shadow-red-500/30">No (Wrong)</Button>
                      </div>
                    </div>
                  ) : amICurrentBuzzer ? (
                    <div className="py-8 animate-pulse">
                      <p className="text-3xl font-black text-indigo-600 mb-2">Say your answer out loud!</p>
                      <p className="text-slate-500 font-medium">The host will judge if you are correct.</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 font-medium text-lg mt-4">Waiting for host to judge...</p>
                  )}
                </>
              ) : (
                <>
                  {amICurrentBuzzer ? (
                    <form onSubmit={submitAnswer} className="space-y-4 max-w-sm mx-auto">
                      <p className="text-slate-600 font-medium">What is the song or artist?</p>
                      <input
                        type="text"
                        className="w-full p-4 text-center text-xl font-bold border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                        placeholder="Type answer here..."
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        autoFocus
                      />
                      <Button type="submit" className="w-full py-6 text-lg rounded-xl shadow-lg shadow-indigo-500/30" disabled={!answerInput.trim()}>
                        Submit Answer
                      </Button>
                    </form>
                  ) : (
                    <p className="text-slate-500 font-medium text-lg mt-4">Waiting for their answer...</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ANSWER_RESULT Phase */}
          {state.phase === 'ANSWER_RESULT' && (
            <div className={`p-8 rounded-2xl shadow-sm border text-center space-y-4 ${state.currentRound?.answeredCorrectly ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-6xl mb-4">{state.currentRound?.answeredCorrectly ? '✅' : '❌'}</div>
              <h3 className="text-3xl font-bold text-slate-800">
                {state.currentRound?.answeredCorrectly ? 'Correct!' : 'Incorrect!'}
              </h3>
              <p className="text-slate-600 font-medium">
                {room?.players.find(p => p.socketId === state.currentRound?.currentBuzzerId)?.name} guessed {state.currentRound?.answeredCorrectly ? 'right' : 'wrong'}.
              </p>

              {state.revealedAnswer && (
                <div className="mt-6 p-6 bg-white/50 rounded-xl border border-slate-200 shadow-inner inline-block min-w-[250px]">
                  <p className="text-sm text-slate-500 font-bold uppercase mb-1">The Answer Was:</p>
                  <p className="text-2xl font-black text-indigo-600 mb-1">{state.revealedAnswer.title}</p>
                  <p className="text-lg font-medium text-slate-600">by {state.revealedAnswer.artist}</p>
                  {state.revealedAnswer.trackViewUrl && (
                    <a href={state.revealedAnswer.trackViewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white px-3 py-1.5 rounded-full shadow-sm border border-indigo-100">
                      {t('gameMusicTrivia.game.listenOnAppleMusic')}
                    </a>
                  )}
                </div>
              )}

              {isHost && (
                <div className="pt-6">
                  <Button onClick={() => musicTriviaGameAction({ type: 'NEXT_ROUND' })} className="px-8 py-6 text-lg rounded-xl font-bold shadow-lg shadow-indigo-500/30">
                    Next Round 🎵
                  </Button>
                </div>
              )}
              {countdown !== null && (
                <div className="pt-2 text-slate-500 font-medium animate-pulse">
                  Auto-proceeding in {countdown}s...
                </div>
              )}
            </div>
          )}

          {/* REVEAL / ROUND_RESULT Phase */}
          {(state.phase === 'REVEAL' || state.phase === 'ROUND_RESULT') && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border text-center space-y-6">
              <h3 className="text-2xl font-bold text-slate-800">The Answer Was:</h3>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                <p className="text-3xl font-black text-indigo-600 mb-2">{state.revealedAnswer?.title}</p>
                <p className="text-xl font-medium text-slate-600">by {state.revealedAnswer?.artist}</p>
                {state.revealedAnswer?.trackViewUrl && (
                  <a href={state.revealedAnswer.trackViewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-indigo-100 transition-transform hover:scale-105 active:scale-95">
                    {t('gameMusicTrivia.game.listenOnAppleMusic')}
                  </a>
                )}
              </div>

              {state.phase === 'ROUND_RESULT' && state.currentRound?.winnerId && (
                <div className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full font-bold">
                  {room?.players.find(p => p.socketId === state.currentRound?.winnerId)?.name} won the round! (+1 pt)
                </div>
              )}
              {state.phase === 'ROUND_RESULT' && !state.currentRound?.winnerId && (
                <div className="inline-block px-4 py-2 bg-slate-100 text-slate-600 rounded-full font-bold">
                  No one got it right!
                </div>
              )}

              {isHost && (
                <div className="pt-4">
                  <Button onClick={() => handleAction('NEXT_ROUND')} className="px-8 py-6 text-lg rounded-xl font-bold">
                    Next Round 🎵
                  </Button>
                </div>
              )}
              {countdown !== null && (
                <div className="pt-2 text-slate-500 font-medium animate-pulse">
                  Auto-proceeding in {countdown}s...
                </div>
              )}
            </div>
          )}

          {/* FINISHED Phase */}
          {state.phase === 'FINISHED' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-6">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-3xl font-bold text-slate-800">Game Over!</h3>
              
              <div className="space-y-3 pt-4 max-w-sm mx-auto">
                {Object.entries(state.scores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([playerId, score], index) => {
                    const p = room?.players.find(p => p.id === playerId);
                    if (!p) return null;
                    return (
                      <div key={playerId} className={`flex justify-between items-center p-4 rounded-xl font-bold ${index === 0 ? 'bg-amber-100 text-amber-900 border-2 border-amber-300' : 'bg-slate-50 text-slate-700 border'}`}>
                        <span className="flex items-center gap-2">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {p.name}
                        </span>
                        <span className="text-xl">{score} pts</span>
                      </div>
                    );
                  })}
              </div>

              {isHost && (
                <div className="pt-6">
                  <Button onClick={() => resetRoom()} variant="outline" className="w-full">
                    Return to Lobby
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
