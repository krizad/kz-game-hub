import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useGameStore } from '@/store/useGameStore';

import { MusicTriviaActionType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function MusicTriviaView() {
  const { t } = useTranslate();
  const { room, musicTriviaGameAction, musicTriviaSyncPlay, socketId, resetRoom } = useGameStore();
  const hostAnswer = useGameStore((s) => s.musicTriviaHostAnswer);
  const state = room?.musicTriviaState;

  const isHost = socketId === room?.roomHostId;

  const [answerInput, setAnswerInput] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [isLocalPaused, setIsLocalPaused] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reactPlayerRef = useRef<any>(null);
  const [hasTestedAudio, setHasTestedAudio] = useState(false);

  // Reset local pause when round changes
  useEffect(() => {
    setIsLocalPaused(false);
  }, [state?.currentRound?.roundNumber]);

  // Auto-ready for subsequent rounds if audio was already unlocked
  useEffect(() => {
    if (
      state?.phase === 'GET_READY' &&
      hasTestedAudio &&
      socketId &&
      !state.readyPlayerIds?.includes(socketId)
    ) {
      musicTriviaGameAction({ type: 'PLAYER_READY' });
    }
  }, [state?.phase, hasTestedAudio, state?.readyPlayerIds, socketId, musicTriviaGameAction]);

  // Handle audio playback based on syncPlay and phase
  useEffect(() => {
    if (!state || !musicTriviaSyncPlay) return;

    if (state.phase === 'PLAYING') {
      const shouldPlay = room?.config.musicTriviaAudioPlayback === 'HOST_ONLY' ? isHost : true;

      // Handle HTML5 Audio (iTunes, Spotify, Deezer)
      if (
        musicTriviaSyncPlay.sourceType !== 'YOUTUBE' &&
        musicTriviaSyncPlay.sourceType !== 'SOUNDCLOUD'
      ) {
        if (!audioRef.current) {
          audioRef.current = new Audio(musicTriviaSyncPlay.previewUrl);
        } else if (audioRef.current.src !== musicTriviaSyncPlay.previewUrl) {
          audioRef.current.src = musicTriviaSyncPlay.previewUrl;
          // Only seek to elapsed time when track changes
          const now = Date.now();
          const elapsed = (now - musicTriviaSyncPlay.playStartTime) / 1000;
          if (elapsed > 0 && elapsed < musicTriviaSyncPlay.durationMs / 1000) {
            audioRef.current.currentTime = elapsed;
          }
        }
        audioRef.current.volume = volume;

        if (shouldPlay && !isLocalPaused) {
          audioRef.current.play().catch((e) => {
            console.error('Audio playback failed:', e);
          });
        } else {
          audioRef.current.pause();
        }
      } else {
        // Handle YouTube via ReactPlayer
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [
    state?.phase,
    musicTriviaSyncPlay,
    room?.config.musicTriviaAudioPlayback,
    isHost,
    volume,
    isLocalPaused,
  ]);

  // Handle countdown calculation for COUNTDOWN phase
  useEffect(() => {
    if (state?.phase === 'COUNTDOWN' && state.countdownEndsAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((state.countdownEndsAt! - Date.now()) / 1000));
        setCountdown(remaining);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [state?.phase, state?.countdownEndsAt]);

  // Auto-fetch tracks if we just started the game
  useEffect(() => {
    if (isHost && state?.phase === 'SETUP' && !state.errorMessage) {
      handleAction('CONFIGURE_SOURCE', {
        query: room?.config.musicTriviaQuery || 'Thai Pop',
        sourceType: room?.config.musicTriviaSource || 'ITUNES',
        searchOptions: {
          country: room?.config.musicTriviaCountry || 'TH',
          attribute: room?.config.musicTriviaAttribute,
          yearStart: room?.config.musicTriviaYearStart,
          yearEnd: room?.config.musicTriviaYearEnd,
        },
      });
    }
  }, [
    isHost,
    state?.phase,
    room?.config.musicTriviaQuery,
    room?.config.musicTriviaSource,
    room?.config.musicTriviaCountry,
    room?.config.musicTriviaAttribute,
    room?.config.musicTriviaYearStart,
    room?.config.musicTriviaYearEnd,
    state?.errorMessage,
  ]);

  // Auto-proceed to next round for fast-paced gameplay
  useEffect(() => {
    if (
      state?.phase === 'ANSWER_RESULT' ||
      state?.phase === 'REVEAL' ||
      state?.phase === 'ROUND_RESULT'
    ) {
      setCountdown(10);

      const interval = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      let timer: NodeJS.Timeout;
      if (isHost) {
        timer = setTimeout(() => {
          handleAction('NEXT_ROUND');
        }, 10000); // 10 seconds delay before auto-proceeding
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

  const amICurrentBuzzer = state?.currentRound?.currentBuzzerId === socketId;

  // Countdown timer for answering phase
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (state?.phase === 'ANSWERING' && amICurrentBuzzer) {
      const timeoutMs = room?.config.musicTriviaAnswerTimeoutMs || 15000;
      const pausedAt = state.pausedAtMs || Date.now();

      const checkTimer = () => {
        const remaining = Math.max(0, timeoutMs - (Date.now() - pausedAt));
        setAnswerTimeLeft(Math.ceil(remaining / 1000));

        if (remaining <= 0) {
          musicTriviaGameAction({ type: 'SUBMIT_ANSWER', answer: '' });
          setAnswerTimeLeft(null);
        } else {
          timer = setTimeout(checkTimer, 100);
        }
      };
      checkTimer();
    } else {
      setAnswerTimeLeft(null);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    state?.phase,
    amICurrentBuzzer,
    room?.config.musicTriviaAnswerTimeoutMs,
    state?.pausedAtMs,
    musicTriviaGameAction,
  ]);

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

  const amIStruckOut = state.currentRound?.struckOutIds.includes(socketId || '');

  return (
    <div className="flex flex-col h-full bg-yellow-300 relative overflow-hidden font-mono">
      {/* Header */}
      <div className="p-4 bg-white border-b-8 border-black flex justify-between items-center z-10 relative">
        <h2 className="text-2xl font-black text-black flex items-center gap-3 uppercase tracking-widest bg-emerald-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          <span className="text-3xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">🎵</span>{' '}
          <span className="hidden sm:inline">
            {t('rules.modal.tabs.musicTrivia') || 'Music Trivia'}
          </span>
        </h2>
        <div className="flex gap-4 font-bold items-center">
          <div className="px-4 py-2 bg-white border-4 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-lg">
            {t('gameMusicTrivia.game.roundLabel')}{' '}
            <span className="text-2xl font-black">{state.currentRound?.roundNumber || 0}</span> /{' '}
            {state.totalRounds}
          </div>
          {isHost && state.phase !== 'FINISHED' && (
            <button
              onClick={() => handleAction('END_GAME')}
              className="px-4 py-2 bg-rose-400 border-4 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:bg-rose-300 uppercase tracking-widest text-sm"
            >
              {t('gameMusicTrivia.game.endGame')}
            </button>
          )}
        </div>
      </div>

      {/* Sub-header for Category Info */}
      <div className="px-4 py-3 bg-pink-300 border-b-8 border-black flex flex-wrap gap-x-6 gap-y-3 items-center text-black font-bold z-0 relative ">
        <span className="flex items-center gap-2 bg-white px-3 py-1 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
          <span className="uppercase tracking-widest text-xs bg-black text-white px-1">
            {t('gameMusicTrivia.game.playlist')}
          </span>
          <span className="font-black text-base uppercase">
            {room.config.musicTriviaQuery || 'Thai Pop'}
          </span>
        </span>
        <span className="flex items-center gap-2 bg-white px-3 py-1 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
          <span className="uppercase tracking-widest text-xs bg-black text-white px-1">
            {t('gameMusicTrivia.game.regionLabel')}
          </span>
          <span className="font-black text-base uppercase">
            {(room.config.musicTriviaCountry || 'TH') === 'TH'
              ? t('gameMusicTrivia.lobby.regionTh')
              : t('gameMusicTrivia.lobby.regionIntl')}
          </span>
        </span>
        <span className="flex items-center gap-2 bg-white px-3 py-1 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
          <span className="uppercase tracking-widest text-xs bg-black text-white px-1">
            {t('gameMusicTrivia.game.searchByLabel')}
          </span>
          <span className="font-black text-base uppercase">
            {room.config.musicTriviaAttribute === 'artistTerm'
              ? t('gameMusicTrivia.lobby.searchArtist')
              : room.config.musicTriviaAttribute === 'songTerm'
                ? t('gameMusicTrivia.lobby.searchSong')
                : room.config.musicTriviaAttribute === 'albumTerm'
                  ? t('gameMusicTrivia.lobby.searchAlbum')
                  : ['YOUTUBE', 'SOUNDCLOUD'].includes(room.config.musicTriviaSource || '')
                    ? t('gameMusicTrivia.lobby.sourceProvidesVideo')
                    : t('gameMusicTrivia.lobby.sourceProvidesPreview')}
          </span>
        </span>
        <span className="flex items-center gap-2 bg-white px-3 py-1 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
          <span className="uppercase tracking-widest text-xs bg-black text-white px-1">
            {t('gameMusicTrivia.game.yearsLabel')}
          </span>
          <span className="font-black text-base uppercase">
            {room.config.musicTriviaYearStart || room.config.musicTriviaYearEnd
              ? `${room.config.musicTriviaYearStart || 'Any'} - ${room.config.musicTriviaYearEnd || 'Any'}`
              : 'All'}
          </span>
        </span>
        <span className="flex items-center gap-2 bg-white px-3 py-1 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
          <span className="uppercase tracking-widest text-xs bg-black text-white px-1">
            {t('gameMusicTrivia.game.modeLabel')}
          </span>
          <span className="font-black text-base uppercase">
            {state.mode === 'GAME_MASTER'
              ? t('gameMusicTrivia.game.modeVoice')
              : t('gameMusicTrivia.game.modeTyping')}
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 relative">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* SETUP Phase */}
          {state.phase === 'SETUP' && (
            <div
              className={`bg-white p-8 border-8 border-black text-center space-y-6 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] ${state.errorMessage ? '' : 'animate-pulse'}`}
            >
              <div className="text-6xl mb-4 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                {state.errorMessage ? '❌' : '🎶'}
              </div>
              <h3 className="text-3xl font-black text-black uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block - shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {state.errorMessage ? 'Setup Failed' : t('gameMusicTrivia.game.preparingMusic')}
              </h3>
              {state.errorMessage ? (
                <div className="text-black font-bold bg-rose-400 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xl">
                  <p>{state.errorMessage}</p>
                </div>
              ) : (
                <p className="text-black font-bold text-xl bg-cyan-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  {t('gameMusicTrivia.game.searchingFor')}{' '}
                  <span className="bg-white px-2 uppercase tracking-widest">
                    {room.config.musicTriviaQuery || 'songs'}
                  </span>{' '}
                  {t('gameMusicTrivia.game.on')}{' '}
                  <span className="bg-white px-2 uppercase tracking-widest">
                    {room.config.musicTriviaSource === 'SPOTIFY'
                      ? 'Spotify'
                      : room.config.musicTriviaSource === 'YOUTUBE'
                        ? 'YouTube'
                        : 'iTunes'}
                  </span>
                </p>
              )}
              {state.errorMessage && isHost && (
                <div className="pt-6 flex gap-4 justify-center">
                  <button
                    onClick={() => {
                      handleAction('CONFIGURE_SOURCE', {
                        query: room.config.musicTriviaQuery || 'Thai Pop',
                        sourceType: room.config.musicTriviaSource || 'ITUNES',
                        searchOptions: {
                          country: room.config.musicTriviaCountry || 'TH',
                          attribute: room.config.musicTriviaAttribute,
                          yearStart: room.config.musicTriviaYearStart,
                          yearEnd: room.config.musicTriviaYearEnd,
                        },
                      });
                    }}
                    className="bg-indigo-400 hover:bg-indigo-300 text-black font-black px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest text-lg "
                  >
                    Retry Setup
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GET_READY Phase */}
          {state.phase === 'GET_READY' && (
            <div className="bg-white p-8 border-8 border-black text-center space-y-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] - animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 bg-pink-300 border-4 border-black flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                <span className="text-5xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">🎵</span>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-black uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                  {t('gameMusicTrivia.game.getReadyTitle')}
                </h3>
                <p className="text-black font-bold text-xl bg-cyan-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {state.readyPlayerIds?.includes(socketId)
                    ? t('gameMusicTrivia.game.getReadyHostWait')
                    : t('gameMusicTrivia.game.getReadyUnlock')}
                </p>
              </div>

              {!state.readyPlayerIds?.includes(socketId) && (
                <button
                  onClick={() => {
                    // Unlock audio element with a silent play/pause if not youtube
                    if (audioRef.current) {
                      audioRef.current
                        .play()
                        .catch(() => {})
                        .finally(() => {
                          audioRef.current?.pause();
                        });
                    }
                    setHasTestedAudio(true);
                    musicTriviaGameAction({ type: 'PLAYER_READY' });
                  }}
                  className="w-full max-w-xs mx-auto h-20 text-2xl font-black bg-emerald-400 hover:bg-emerald-300 text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none uppercase tracking-widest "
                >
                  {t('gameMusicTrivia.game.getReadyBtn')}
                </button>
              )}

              {isHost && (
                <div className="pt-8 border-t-8 border-black mt-8 space-y-6">
                  <div className="flex justify-between items-center text-xl font-black text-black bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                    <span className="uppercase tracking-widest">
                      {t('gameMusicTrivia.game.getReadyPlayers')}
                    </span>
                    <span className="text-black bg-yellow-300 px-3 py-1 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
                      {state.readyPlayerIds?.length || 0} / {room.players.length}
                    </span>
                  </div>
                  <button
                    onClick={() => musicTriviaGameAction({ type: 'START_COUNTDOWN' })}
                    className="w-full h-20 text-2xl font-black bg-rose-400 hover:bg-rose-300 text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none uppercase tracking-widest "
                  >
                    {t('gameMusicTrivia.game.getReadyStartBtn')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* COUNTDOWN Phase */}
          {state.phase === 'COUNTDOWN' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in">
              <h3 className="text-4xl font-black text-black bg-yellow-300 px-6 py-3 border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest animate-pulse ">
                {t('gameMusicTrivia.game.countdownTitle')}
              </h3>
              <div className="relative">
                <div className="text-[12rem] leading-none font-black text-black drop-shadow-[8px_8px_0px_rgba(0,0,0,1)] animate-bounce -">
                  {countdown}
                </div>
              </div>
            </div>
          )}

          {/* PLAYING Phase */}
          {state.phase === 'PLAYING' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-8">
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-cyan-300 border-8 border-black animate-spin-slow shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
                  <div className="w-16 h-16 bg-white border-4 border-black rounded-full flex items-center justify-center">
                    <div className="flex items-end space-x-1 h-6">
                      <div className="w-2 bg-pink-400 animate-[bounce_1s_infinite] h-full border-2 border-black"></div>
                      <div className="w-2 bg-yellow-400 animate-[bounce_0.8s_infinite] h-3/4 border-2 border-black"></div>
                      <div className="w-2 bg-emerald-400 animate-[bounce_1.2s_infinite] h-full border-2 border-black"></div>
                    </div>
                  </div>
                </div>
                {['YOUTUBE', 'SOUNDCLOUD'].includes(musicTriviaSyncPlay?.sourceType || '') && (
                  <div className="hidden">
                    <ReactPlayer
                      ref={reactPlayerRef}
                      url={
                        musicTriviaSyncPlay?.sourceType === 'YOUTUBE'
                          ? `https://www.youtube.com/watch?v=${musicTriviaSyncPlay.previewUrl}`
                          : musicTriviaSyncPlay?.previewUrl
                      }
                      playing={
                        room?.config.musicTriviaAudioPlayback === 'HOST_ONLY'
                          ? isHost && !isLocalPaused
                          : !isLocalPaused
                      }
                      volume={volume}
                      width="0"
                      height="0"
                      config={{
                        youtube: {
                          playerVars: {
                            autoplay: 1,
                            origin:
                              typeof window !== 'undefined' ? window.location.origin : undefined,
                          },
                        },
                        soundcloud: { options: { auto_play: true } },
                      }}
                      onError={(e) =>
                        console.error(`ReactPlayer error (${musicTriviaSyncPlay?.sourceType}):`, e)
                      }
                    />
                  </div>
                )}
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-black text-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest animate-pulse -">
                  {t('gameMusicTrivia.game.nowPlaying')}
                </h3>
                <p className="text-black font-bold text-xl bg-yellow-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  {t('gameMusicTrivia.game.listenCarefully')}
                </p>
                {musicTriviaSyncPlay?.sourceType === 'SOUNDCLOUD' && (
                  <div className="bg-rose-300 border-4 border-black text-black px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-sm mx-auto text-lg font-black uppercase mb-4 ">
                    <p>⚠️ SoundCloud กำลังโหลด (Loading SoundCloud)</p>
                  </div>
                )}
                {musicTriviaSyncPlay?.sourceType === 'YOUTUBE' && (
                  <div className="bg-rose-300 border-4 border-black text-black px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-sm mx-auto text-lg font-black uppercase mb-4 -">
                    <p>⚠️ YouTube กำลังโหลด (Loading YouTube)</p>
                  </div>
                )}
                <div>
                  <button
                    onClick={() => {
                      if (
                        ['YOUTUBE', 'SOUNDCLOUD'].includes(musicTriviaSyncPlay?.sourceType || '')
                      ) {
                        setIsLocalPaused(false);
                      } else if (audioRef.current) {
                        audioRef.current.play().catch((e) => console.error(e));
                      }
                    }}
                    className="px-6 py-3 bg-white text-black border-4 border-black font-black uppercase tracking-widest hover:bg-slate-200 active:translate-y-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform"
                  >
                    {t('gameMusicTrivia.game.cantHearMusic')}
                  </button>
                </div>
              </div>

              {/* Enhanced Audio Controls */}
              <div className="w-full max-w-sm flex flex-col gap-3 bg-pink-300 p-5 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsLocalPaused(!isLocalPaused)}
                      className={`h-12 w-12 flex items-center justify-center font-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none ${isLocalPaused ? 'bg-yellow-300 text-black' : 'bg-white text-black'}`}
                      title={isLocalPaused ? 'Play' : 'Pause'}
                    >
                      {isLocalPaused ? '▶️' : '⏸️'}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          ['YOUTUBE', 'SOUNDCLOUD'].includes(
                            musicTriviaSyncPlay?.sourceType || '',
                          ) &&
                          reactPlayerRef.current
                        ) {
                          reactPlayerRef.current.seekTo(0, 'seconds');
                          setIsLocalPaused(false);
                        } else if (audioRef.current) {
                          audioRef.current.currentTime = 0;
                          audioRef.current.play();
                          setIsLocalPaused(false);
                        }
                      }}
                      className="h-12 w-12 flex items-center justify-center bg-white font-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-black hover:bg-slate-200"
                      title="Listen Again"
                    >
                      🔄
                    </button>
                  </div>
                  <div className="flex items-center space-x-3 flex-1 ml-4 bg-white p-2 border-4 border-black">
                    <span className="text-black font-black">🔉</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full h-3 bg-black appearance-none cursor-pointer accent-yellow-400 border-2 border-black"
                      aria-label="Volume control"
                    />
                    <span className="text-black font-black">🔊</span>
                  </div>
                </div>
              </div>

              {!isHost || state.hostPlays ? (
                <div className="w-full max-w-xs flex flex-col items-center gap-4 mt-8">
                  <button
                    onClick={handleBuzz}
                    disabled={amIStruckOut}
                    className={`w-full h-32 text-5xl font-black uppercase tracking-widest border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all ${amIStruckOut ? 'bg-slate-400 text-slate-800 cursor-not-allowed opacity-50' : 'bg-rose-500 hover:bg-rose-400 text-white active:translate-y-2 active:shadow-none '}`}
                  >
                    {amIStruckOut ? '❌ X' : '🚨 BUZZ!'}
                  </button>
                  <button
                    onClick={() => handleAction('GIVE_UP')}
                    disabled={amIStruckOut}
                    className="w-full h-14 bg-white font-black uppercase tracking-widest text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-200 active:translate-y-1 active:shadow-none - mt-4"
                  >
                    {t('gameMusicTrivia.game.giveUp')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 mt-8">
                  <p className="text-black font-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase -">
                    {t('gameMusicTrivia.game.hostCannotBuzz')}
                  </p>
                </div>
              )}

              {isHost && (
                <div className="mt-8">
                  <button
                    onClick={() => musicTriviaGameAction({ type: 'REVEAL_ANSWER' })}
                    className="px-4 py-2 bg-slate-800 text-white font-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:bg-slate-700 uppercase"
                  >
                    {t('gameMusicTrivia.game.skipQuestion')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BUZZED / ANSWERING Phase */}
          {(state.phase === 'BUZZED' || state.phase === 'ANSWERING') && (
            <div className="bg-white p-8 border-8 border-black text-center space-y-6 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] - max-w-2xl mx-auto mt-8">
              <div className="text-6xl animate-bounce drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                🚨
              </div>
              <div>
                <h3 className="text-3xl font-black text-black uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  {
                    room?.players.find((p) => p.socketId === state.currentRound?.currentBuzzerId)
                      ?.name
                  }{' '}
                  {t('gameMusicTrivia.game.buzzed')}
                </h3>
                {state.currentRound?.buzzerPresses.find(
                  (p) => p.playerId === state.currentRound?.currentBuzzerId,
                ) && (
                  <p className="text-xl font-black text-white bg-black px-3 py-1 inline-block mt-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                    {t('gameMusicTrivia.game.reaction')}{' '}
                    {(
                      state.currentRound.buzzerPresses.find(
                        (p) => p.playerId === state.currentRound?.currentBuzzerId,
                      )!.reactionTimeMs / 1000
                    ).toFixed(2)}
                    s ⚡️
                  </p>
                )}
              </div>

              {state.mode === 'GAME_MASTER' ? (
                <>
                  {isHost ? (
                    <div className="mt-8 p-6 bg-cyan-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
                      <p className="text-2xl font-black uppercase tracking-widest text-black mb-4 bg-white border-4 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                        {t('gameMusicTrivia.game.isAnswerCorrect')}
                      </p>

                      {hostAnswer && (
                        <div className="mb-8 p-6 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-left flex flex-col sm:flex-row gap-6 items-center sm:items-start ">
                          {hostAnswer.artworkUrl && (
                            <img
                              src={hostAnswer.artworkUrl}
                              alt="Album Art"
                              className="w-32 h-32 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 text-center sm:text-left">
                            <p className="text-sm text-white bg-black px-2 py-1 font-black uppercase mb-2 inline-block">
                              {t('gameMusicTrivia.game.actualAnswer')}
                            </p>
                            <p className="text-3xl font-black text-black uppercase">
                              {hostAnswer.title}
                            </p>
                            <p className="text-xl font-bold text-slate-800">
                              {t('gameMusicTrivia.game.by')} {hostAnswer.artist}
                            </p>
                            {hostAnswer.trackViewUrl && (
                              <a
                                href={hostAnswer.trackViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-4 text-sm text-black font-black bg-pink-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-pink-400 active:translate-y-1 active:shadow-none uppercase tracking-widest"
                              >
                                {t('gameMusicTrivia.game.viewOnAppleMusic')}
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                        <button
                          onClick={() =>
                            musicTriviaGameAction({ type: 'HOST_JUDGE', correct: true })
                          }
                          className="bg-emerald-400 hover:bg-emerald-300 text-black px-8 py-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none text-2xl font-black uppercase tracking-widest -"
                        >
                          {t('gameMusicTrivia.game.yesCorrect')}
                        </button>
                        <button
                          onClick={() =>
                            musicTriviaGameAction({ type: 'HOST_JUDGE', correct: false })
                          }
                          className="bg-rose-400 hover:bg-rose-300 text-black px-8 py-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none text-2xl font-black uppercase tracking-widest "
                        >
                          {t('gameMusicTrivia.game.noWrong')}
                        </button>
                      </div>
                    </div>
                  ) : amICurrentBuzzer ? (
                    <div className="py-8 animate-pulse">
                      <p className="text-4xl font-black text-black bg-yellow-300 px-6 py-3 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest mb-6">
                        {t('gameMusicTrivia.game.sayAnswerOutLoud')}
                      </p>
                      <p className="text-xl font-bold text-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block -">
                        {t('gameMusicTrivia.game.hostWillJudge')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-black font-black text-xl bg-slate-200 px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-8 inline-block ">
                      {t('gameMusicTrivia.game.waitingForHostToJudge')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {amICurrentBuzzer ? (
                    <form onSubmit={submitAnswer} className="space-y-6 max-w-sm mx-auto mt-8">
                      <p className="text-xl font-black text-black bg-yellow-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                        {t('gameMusicTrivia.game.whatIsSongOrArtist')}
                      </p>
                      <input
                        type="text"
                        className="w-full p-6 text-center text-3xl font-black text-black border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 uppercase placeholder:text-slate-400 placeholder:normal-case placeholder:text-xl"
                        placeholder={
                          t('gameMusicTrivia.game.typeAnswerHere') || 'Type answer here...'
                        }
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        autoFocus
                      />
                      {answerTimeLeft !== null && (
                        <div className="flex justify-center mt-4">
                          <p
                            className={`text-3xl font-black border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${answerTimeLeft <= 5 ? 'bg-rose-400 text-black animate-pulse' : 'bg-white text-black'}`}
                          >
                            ⏳ {answerTimeLeft}s
                          </p>
                        </div>
                      )}
                      <div className="flex flex-col gap-6 w-full max-w-sm mx-auto mt-8">
                        <button
                          type="submit"
                          className="w-full py-6 text-2xl font-black bg-emerald-400 hover:bg-emerald-300 text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none uppercase tracking-widest -"
                          disabled={!answerInput.trim()}
                        >
                          {t('gameMusicTrivia.game.submitAnswer')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAnswerInput('');
                            handleAction('SUBMIT_ANSWER', { answer: '' });
                          }}
                          className="w-full py-4 text-xl font-black bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-200 active:translate-y-1 active:shadow-none uppercase tracking-widest "
                        >
                          {t('gameMusicTrivia.game.giveUp')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-black font-black text-xl bg-slate-200 px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-8 inline-block -">
                      {t('gameMusicTrivia.game.waitingForTheirAnswer')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ANSWER_RESULT Phase */}
          {state.phase === 'ANSWER_RESULT' && (
            <div
              className={`p-8 border-8 border-black text-center space-y-6 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-2xl mx-auto mt-8 ${state.currentRound?.answeredCorrectly ? 'bg-emerald-300' : 'bg-rose-400'}`}
            >
              <div className="text-6xl mb-4 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                {state.currentRound?.answeredCorrectly ? '✅' : '❌'}
              </div>
              <h3 className="text-4xl font-black text-black uppercase tracking-widest bg-white px-6 py-3 border-4 border-black inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
                {state.currentRound?.answeredCorrectly
                  ? t('gameMusicTrivia.game.correct')
                  : t('gameMusicTrivia.game.incorrect')}
              </h3>
              <p className="text-xl font-bold text-black bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {
                  room?.players.find((p) => p.socketId === state.currentRound?.currentBuzzerId)
                    ?.name
                }{' '}
                {state.currentRound?.answeredCorrectly
                  ? t('gameMusicTrivia.game.guessedRight')
                  : t('gameMusicTrivia.game.guessedWrong')}
                .
              </p>

              {state.revealedAnswer?.successfulAnswerText && (
                <div className="bg-yellow-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md mx-auto my-6 -">
                  <p className="text-lg font-black text-black uppercase tracking-widest bg-white border-4 border-black px-2 py-1 inline-block mb-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                    {t('gameMusicTrivia.game.playerAnswered')}
                  </p>
                  <p className="text-3xl font-black text-black mt-2">
                    "{state.revealedAnswer.successfulAnswerText}"
                  </p>
                </div>
              )}

              {state.revealedAnswer && (
                <div className="mt-8 p-8 bg-white border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block min-w-[250px] ">
                  {state.revealedAnswer.artworkUrl && (
                    <img
                      src={state.revealedAnswer.artworkUrl.replace(
                        '100x100bb.jpg',
                        '300x300bb.jpg',
                      )}
                      alt="Album Art"
                      className="w-40 h-40 mx-auto border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-6 -"
                    />
                  )}
                  <p className="text-lg font-black text-white bg-black px-3 py-1 uppercase tracking-widest inline-block mb-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                    {t('gameMusicTrivia.game.theAnswerWas')}
                  </p>
                  <p className="text-4xl font-black text-black uppercase mb-2">
                    {state.revealedAnswer.title}
                  </p>
                  <p className="text-2xl font-bold text-black bg-pink-300 border-4 border-black px-2 py-1 inline-block -">
                    {t('gameMusicTrivia.game.by')} {state.revealedAnswer.artist}
                  </p>
                  {(state.revealedAnswer.album || state.revealedAnswer.releaseYear) && (
                    <p className="text-lg font-bold text-black mt-4">
                      {state.revealedAnswer.album && <span>{state.revealedAnswer.album}</span>}
                      {state.revealedAnswer.album && state.revealedAnswer.releaseYear && (
                        <span> • </span>
                      )}
                      {state.revealedAnswer.releaseYear && (
                        <span>{state.revealedAnswer.releaseYear}</span>
                      )}
                    </p>
                  )}
                  {state.revealedAnswer.trackViewUrl && (
                    <div className="mt-6">
                      <a
                        href={state.revealedAnswer.trackViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-black font-black uppercase tracking-widest bg-cyan-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 active:translate-y-1 active:shadow-none transition-transform "
                      >
                        {t('gameMusicTrivia.game.listenOnAppleMusic')}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {isHost && (
                <div className="pt-8">
                  <button
                    onClick={() => musicTriviaGameAction({ type: 'NEXT_ROUND' })}
                    className="px-8 py-6 text-2xl font-black uppercase tracking-widest text-black bg-yellow-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none hover:bg-yellow-400 -"
                  >
                    Next Round 🎵
                  </button>
                </div>
              )}
              {countdown !== null && (
                <div className="pt-4 text-black font-black text-xl animate-pulse">
                  {t('gameMusicTrivia.game.autoProceedingIn', { count: countdown }) ||
                    `Auto-proceeding in ${countdown}s...`}
                </div>
              )}
            </div>
          )}

          {/* REVEAL / ROUND_RESULT Phase */}
          {(state.phase === 'REVEAL' || state.phase === 'ROUND_RESULT') && (
            <div className="bg-white p-8 border-8 border-black text-center space-y-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] - max-w-2xl mx-auto mt-8">
              <h3 className="text-4xl font-black text-black uppercase tracking-widest bg-cyan-300 px-6 py-3 border-4 border-black inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
                {t('gameMusicTrivia.game.theAnswerWas')}
              </h3>
              <div className="p-8 bg-pink-300 border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
                {state.revealedAnswer?.artworkUrl && (
                  <img
                    src={state.revealedAnswer.artworkUrl.replace('100x100bb.jpg', '400x400bb.jpg')}
                    alt="Album Art"
                    className="w-48 h-48 mx-auto border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-6 "
                  />
                )}
                <p className="text-4xl font-black text-black uppercase bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - mb-4">
                  {state.revealedAnswer?.title}
                </p>
                <p className="text-2xl font-bold text-black bg-yellow-300 border-4 border-black inline-block px-3 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  {t('gameMusicTrivia.game.by')} {state.revealedAnswer?.artist}
                </p>
                {(state.revealedAnswer?.album || state.revealedAnswer?.releaseYear) && (
                  <p className="text-xl font-bold text-black mt-4">
                    {state.revealedAnswer?.album && <span>{state.revealedAnswer.album}</span>}
                    {state.revealedAnswer?.album && state.revealedAnswer?.releaseYear && (
                      <span> • </span>
                    )}
                    {state.revealedAnswer?.releaseYear && (
                      <span>{state.revealedAnswer.releaseYear}</span>
                    )}
                  </p>
                )}
                {state.revealedAnswer?.trackViewUrl && (
                  <div className="mt-6">
                    <a
                      href={state.revealedAnswer.trackViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-black font-black uppercase tracking-widest bg-emerald-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-400 active:translate-y-1 active:shadow-none transition-transform -"
                    >
                      {t('gameMusicTrivia.game.listenOnAppleMusic')}
                    </a>
                  </div>
                )}
              </div>

              {state.phase === 'ROUND_RESULT' && state.currentRound?.winnerId && (
                <div className="inline-block px-6 py-3 bg-emerald-400 text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-2xl font-black uppercase tracking-widest ">
                  {t('gameMusicTrivia.game.wonTheRound', {
                    name:
                      room?.players.find((p) => p.socketId === state.currentRound?.winnerId)
                        ?.name || 'Someone',
                  }) ||
                    `${room?.players.find((p) => p.socketId === state.currentRound?.winnerId)?.name} won the round! (+1 pt)`}
                </div>
              )}
              {state.phase === 'ROUND_RESULT' && !state.currentRound?.winnerId && (
                <div className="inline-block px-6 py-3 bg-slate-300 text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-2xl font-black uppercase tracking-widest -">
                  {t('gameMusicTrivia.game.noOneGotItRight')}
                </div>
              )}

              {isHost && (
                <div className="pt-8">
                  <button
                    onClick={() => handleAction('NEXT_ROUND')}
                    className="px-8 py-6 text-2xl font-black uppercase tracking-widest text-black bg-yellow-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none hover:bg-yellow-400 "
                  >
                    {t('gameMusicTrivia.game.nextRound')}
                  </button>
                </div>
              )}
              {countdown !== null && (
                <div className="pt-4 text-black font-black text-xl animate-pulse">
                  {t('gameMusicTrivia.game.autoProceedingIn', { count: countdown }) ||
                    `Auto-proceeding in ${countdown}s...`}
                </div>
              )}
            </div>
          )}

          {/* FINISHED Phase */}
          {state.phase === 'FINISHED' && (
            <div className="bg-white p-8 border-8 border-black text-center space-y-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-3xl mx-auto mt-8 ">
              <div className="text-[6rem] mb-4 drop-shadow-[8px_8px_0px_rgba(0,0,0,1)] animate-bounce">
                🏆
              </div>
              <h3 className="text-5xl font-black text-black uppercase tracking-widest bg-yellow-300 px-6 py-3 border-4 border-black inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
                {t('gameMusicTrivia.game.gameOver')}
              </h3>

              <div className="space-y-4 pt-6 max-w-md mx-auto">
                {Object.entries(state.scores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([playerId, score], index) => {
                    const p = room?.players.find((p) => p.socketId === playerId);
                    if (!p) return null;
                    return (
                      <div
                        key={playerId}
                        className={`flex justify-between items-center p-4 border-4 border-black font-black text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${index === 0 ? 'bg-cyan-300 text-black text-2xl' : index === 1 ? 'bg-emerald-300 text-black -' : index === 2 ? 'bg-pink-300 text-black ' : 'bg-white text-black -'}`}
                      >
                        <span className="flex items-center gap-3">
                          {index === 0 && <span className="text-3xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          <span className="uppercase">{p.name}</span>
                        </span>
                        <span className="bg-white px-2 py-1 border-2 border-black">
                          {score} pts
                        </span>
                      </div>
                    );
                  })}
              </div>

              {state.roundHistory && state.roundHistory.length > 0 && (
                <div className="mt-12 text-left max-w-2xl mx-auto p-6 bg-pink-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
                  <h4 className="text-2xl font-black text-black uppercase tracking-widest bg-white border-4 border-black px-4 py-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 ">
                    {t('gameMusicTrivia.game.playedSongs') || 'Played Songs'}
                  </h4>
                  <div className="space-y-4">
                    {state.roundHistory.map((history) => {
                      const winner = history.winnerId
                        ? room?.players.find((p) => p.socketId === history.winnerId)
                        : null;
                      return (
                        <div
                          key={history.roundNumber}
                          className="bg-white border-4 border-black p-4 flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        >
                          {history.artworkUrl ? (
                            <img
                              src={history.artworkUrl}
                              alt={history.trackTitle}
                              className="w-16 h-16 object-cover border-2 border-black"
                            />
                          ) : (
                            <div className="w-16 h-16 border-2 border-black bg-yellow-300 flex items-center justify-center text-black text-2xl">
                              🎵
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-xl text-black truncate uppercase">
                              {history.trackTitle}
                            </p>
                            <p className="text-lg font-bold text-slate-700 truncate">
                              {history.artistName}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {winner ? (
                              <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-300 border-2 border-black text-black text-lg font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
                                <span className="text-sm">🏆</span> {winner.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 bg-slate-300 border-2 border-black text-black text-lg font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
                                ❌ {t('gameMusicTrivia.game.noWinner') || 'No winner'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isHost && (
                <div className="pt-8">
                  <button
                    onClick={() => resetRoom()}
                    className="w-full py-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none text-2xl font-black text-black uppercase tracking-widest hover:bg-slate-200 "
                  >
                    {t('gameMusicTrivia.game.returnToLobby')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
