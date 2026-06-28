import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { MusicTriviaActionType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function MusicTriviaView() {
  const { t } = useTranslate();
  const { room, myName, musicTriviaGameAction, musicTriviaSyncPlay, socketId, resetRoom } =
    useGameStore();
  const hostAnswer = useGameStore((s) => s.musicTriviaHostAnswer);
  const state = room?.musicTriviaState;

  const isHost = socketId === room?.roomHostId;

  const [answerInput, setAnswerInput] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number | null>(null);
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
            audioRef.current.play().catch((e) => console.error('Audio playback failed:', e));
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
    room?.config.musicTriviaCountry,
    room?.config.musicTriviaAttribute,
    state?.errorMessage,
  ]);

  // Auto-proceed to next round for fast-paced gameplay
  useEffect(() => {
    if (
      state?.phase === 'ANSWER_RESULT' ||
      state?.phase === 'REVEAL' ||
      state?.phase === 'ROUND_RESULT'
    ) {
      setCountdown(15);

      const interval = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      let timer: NodeJS.Timeout;
      if (isHost) {
        timer = setTimeout(() => {
          handleAction('NEXT_ROUND');
        }, 15000); // 15 seconds delay before auto-proceeding
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
    room?.players.find((p) => p.name === myName)?.socketId || '',
  );

  const amICurrentBuzzer = state.currentRound?.currentBuzzerId === socketId;

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
          handleAction('SUBMIT_ANSWER', { answer: '' });
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
  }, [state?.phase, amICurrentBuzzer, room?.config.musicTriviaAnswerTimeoutMs, state?.pausedAtMs]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm z-0 relative">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          🎵{' '}
          <span className="hidden sm:inline">
            {t('rules.modal.tabs.musicTrivia') || 'Music Trivia'}
          </span>
        </h2>
        <div className="flex gap-4 text-sm font-medium items-center">
          <div className="px-3 py-1 bg-slate-100 rounded-full text-slate-600 border">
            {t('gameMusicTrivia.game.roundLabel')} {state.currentRound?.roundNumber || 0} /{' '}
            {state.totalRounds}
          </div>
          {isHost && state.phase !== 'FINISHED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('END_GAME')}
              className="text-red-500 border-red-200 hover:bg-red-50"
            >
              {t('gameMusicTrivia.game.endGame')}
            </Button>
          )}
        </div>
      </div>

      {/* Sub-header for Category Info */}
      <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-indigo-800 font-medium z-0 relative shadow-inner">
        <span className="flex items-center gap-1.5 bg-white/60 px-2 py-0.5 rounded border border-indigo-200">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">
            {t('gameMusicTrivia.game.playlist')}
          </span>
          <span className="font-bold text-sm">{room.config.musicTriviaQuery || 'Thai Pop'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">
            {t('gameMusicTrivia.game.regionLabel')}
          </span>
          <span>
            {(room.config.musicTriviaCountry || 'TH') === 'TH'
              ? t('gameMusicTrivia.lobby.regionTh')
              : t('gameMusicTrivia.lobby.regionIntl')}
          </span>
        </span>
        <span className="opacity-30">|</span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">
            {t('gameMusicTrivia.game.searchByLabel')}
          </span>
          <span>
            {room.config.musicTriviaAttribute === 'artistTerm'
              ? t('gameMusicTrivia.lobby.searchArtist')
              : room.config.musicTriviaAttribute === 'songTerm'
                ? t('gameMusicTrivia.lobby.searchSong')
                : room.config.musicTriviaAttribute === 'albumTerm'
                  ? t('gameMusicTrivia.lobby.searchAlbum')
                  : t('gameMusicTrivia.lobby.searchAnything')}
          </span>
        </span>
        <span className="opacity-30">|</span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">
            {t('gameMusicTrivia.game.yearsLabel')}
          </span>
          <span>
            {room.config.musicTriviaYearStart || room.config.musicTriviaYearEnd
              ? `${room.config.musicTriviaYearStart || 'Any'} - ${room.config.musicTriviaYearEnd || 'Any'}`
              : 'All'}
          </span>
        </span>
        <span className="opacity-30">|</span>
        <span className="flex items-center gap-1.5">
          <span className="opacity-70 uppercase tracking-wider text-[10px] font-bold">
            {t('gameMusicTrivia.game.modeLabel')}
          </span>
          <span>
            {state.mode === 'GAME_MASTER'
              ? t('gameMusicTrivia.game.modeVoice')
              : t('gameMusicTrivia.game.modeTyping')}
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 relative">
        {/* YouTube Player is now rendered inside the PLAYING phase */}

        <div className="max-w-2xl mx-auto space-y-6">
          {/* SETUP Phase */}
          {state.phase === 'SETUP' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-4 animate-pulse">
              <div className="text-4xl mb-2">🎶</div>
              <h3 className="text-xl font-bold text-slate-800">
                {t('gameMusicTrivia.game.preparingMusic')}
              </h3>
              <p className="text-slate-500">
                {t('gameMusicTrivia.game.searchingFor')} {room.config.musicTriviaQuery || 'songs'}{' '}
                {t('gameMusicTrivia.game.on')}{' '}
                {room.config.musicTriviaSource === 'SPOTIFY'
                  ? 'Spotify'
                  : room.config.musicTriviaSource === 'YOUTUBE'
                    ? 'YouTube'
                    : 'iTunes'}
              </p>
            </div>
          )}

          {/* PLAYING Phase */}
          {state.phase === 'PLAYING' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-8">
              {musicTriviaSyncPlay?.sourceType === 'YOUTUBE' ? (
                <div className="w-full max-w-sm aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-indigo-100 bg-black">
                  <ReactPlayer
                    ref={reactPlayerRef}
                    url={`https://www.youtube.com/watch?v=${musicTriviaSyncPlay.previewUrl}`}
                    playing={
                      forcePlayToggle &&
                      (room?.config.musicTriviaAudioPlayback === 'HOST_ONLY' ? isHost : true)
                    }
                    volume={volume}
                    width="100%"
                    height="100%"
                    config={{
                      youtube: {
                        // @ts-expect-error Youtube config type mismatch
                        playerVars: {
                          autoplay: 1,
                          controls: 1,
                          showinfo: 0,
                          rel: 0,
                          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                        },
                      },
                    }}
                    onReady={() => {
                      if (reactPlayerRef.current && musicTriviaSyncPlay?.playStartTime) {
                        const elapsed = (Date.now() - musicTriviaSyncPlay.playStartTime) / 1000;
                        if (elapsed > 0) reactPlayerRef.current.seekTo(elapsed, 'seconds');
                      }
                    }}
                  />
                </div>
              ) : (
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
              )}
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold text-slate-800 animate-pulse">
                  {t('gameMusicTrivia.game.nowPlaying')}
                </h3>
                <p className="text-slate-500 mt-2">{t('gameMusicTrivia.game.listenCarefully')}</p>
                <button
                  onClick={() => {
                    if (musicTriviaSyncPlay?.sourceType !== 'YOUTUBE') {
                      if (audioRef.current) audioRef.current.play().catch((e) => console.error(e));
                    }

                    if (musicTriviaSyncPlay?.sourceType === 'YOUTUBE') {
                      if (reactPlayerRef.current && typeof reactPlayerRef.current.getInternalPlayer === 'function') {
                        const internalPlayer = reactPlayerRef.current.getInternalPlayer();
                        if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
                          internalPlayer.playVideo();
                        }
                        if (internalPlayer && typeof internalPlayer.unMute === 'function') {
                          internalPlayer.unMute();
                        }
                      }

                      // Toggle playing state quickly to force ReactPlayer to send a new play command
                      setForcePlayToggle(false);
                      setTimeout(() => setForcePlayToggle(true), 50);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-sm"
                >
                  {t('gameMusicTrivia.game.cantHearMusic')}
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
                <div className="w-full max-w-xs flex flex-col items-center gap-3">
                  <Button
                    onClick={handleBuzz}
                    disabled={amIStruckOut}
                    className={`w-full h-32 rounded-3xl text-3xl font-bold transition-all shadow-xl active:scale-95 active:shadow-md ${amIStruckOut ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'}`}
                  >
                    {amIStruckOut ? '❌ X' : '🚨 BUZZ!'}
                  </Button>
                  <Button
                    onClick={() => handleAction('GIVE_UP')}
                    disabled={amIStruckOut}
                    variant="outline"
                    className="w-full h-12 rounded-xl font-bold text-slate-500 border-slate-300 hover:bg-slate-100"
                  >
                    {t('gameMusicTrivia.game.giveUp')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 mt-6">
                  <p className="text-slate-500 font-medium">
                    {t('gameMusicTrivia.game.hostCannotBuzz')}
                  </p>
                </div>
              )}

              {isHost && (
                <div className="mt-4">
                  <Button
                    variant="ghost"
                    onClick={() => musicTriviaGameAction({ type: 'REVEAL_ANSWER' })}
                    className="text-slate-400 hover:text-indigo-600"
                  >
                    {t('gameMusicTrivia.game.skipQuestion')}
                  </Button>
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
                  {
                    room?.players.find((p) => p.socketId === state.currentRound?.currentBuzzerId)
                      ?.name
                  }{' '}
                  {t('gameMusicTrivia.game.buzzed')}
                </h3>
                {state.currentRound?.buzzerPresses.find(
                  (p) => p.playerId === state.currentRound?.currentBuzzerId,
                ) && (
                  <p className="text-sm font-mono text-slate-500 mt-2">
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
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border">
                      <p className="font-bold mb-3 text-slate-700">
                        {t('gameMusicTrivia.game.isAnswerCorrect')}
                      </p>

                      {hostAnswer && (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-left flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                          {hostAnswer.artworkUrl && (
                            <img src={hostAnswer.artworkUrl} alt="Album Art" className="w-24 h-24 rounded-lg shadow-md flex-shrink-0" />
                          )}
                          <div className="flex-1 text-center sm:text-left">
                            <p className="text-sm text-indigo-500 font-bold uppercase mb-1">
                              {t('gameMusicTrivia.game.actualAnswer')}
                            </p>
                            <p className="text-xl font-bold text-slate-800">{hostAnswer.title}</p>
                            <p className="text-md text-slate-600">
                              {t('gameMusicTrivia.game.by')} {hostAnswer.artist}
                            </p>
                            {hostAnswer.trackViewUrl && (
                              <a
                                href={hostAnswer.trackViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white/50 px-3 py-1 rounded-full shadow-sm"
                              >
                                {t('gameMusicTrivia.game.viewOnAppleMusic')}
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-4 justify-center">
                        <Button
                          onClick={() =>
                            musicTriviaGameAction({ type: 'HOST_JUDGE', correct: true })
                          }
                          className="bg-green-500 hover:bg-green-600 px-8 text-lg font-bold py-6 rounded-xl shadow-lg shadow-green-500/30"
                        >
                          {t('gameMusicTrivia.game.yesCorrect')}
                        </Button>
                        <Button
                          onClick={() =>
                            musicTriviaGameAction({ type: 'HOST_JUDGE', correct: false })
                          }
                          className="bg-red-500 hover:bg-red-600 px-8 text-lg font-bold py-6 rounded-xl shadow-lg shadow-red-500/30"
                        >
                          {t('gameMusicTrivia.game.noWrong')}
                        </Button>
                      </div>
                    </div>
                  ) : amICurrentBuzzer ? (
                    <div className="py-8 animate-pulse">
                      <p className="text-3xl font-black text-indigo-600 mb-2">
                        {t('gameMusicTrivia.game.sayAnswerOutLoud')}
                      </p>
                      <p className="text-slate-500 font-medium">
                        {t('gameMusicTrivia.game.hostWillJudge')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500 font-medium text-lg mt-4">
                      {t('gameMusicTrivia.game.waitingForHostToJudge')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {amICurrentBuzzer ? (
                    <form onSubmit={submitAnswer} className="space-y-4 max-w-sm mx-auto">
                      <p className="text-slate-600 font-medium">
                        {t('gameMusicTrivia.game.whatIsSongOrArtist')}
                      </p>
                      <input
                        type="text"
                        className="w-full p-4 text-center text-xl font-bold border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                        placeholder={
                          t('gameMusicTrivia.game.typeAnswerHere') || 'Type answer here...'
                        }
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        autoFocus
                      />
                      {answerTimeLeft !== null && (
                        <p className={`text-xl font-black ${answerTimeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`}>
                          ⏳ {answerTimeLeft}s
                        </p>
                      )}
                      <div className="flex flex-col gap-4 w-full max-w-sm mx-auto mt-6">
                        <Button
                          type="submit"
                          className="w-full py-6 text-lg rounded-xl shadow-lg shadow-indigo-500/30"
                          disabled={!answerInput.trim()}
                        >
                          {t('gameMusicTrivia.game.submitAnswer')}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setAnswerInput('');
                            handleAction('SUBMIT_ANSWER', { answer: '' });
                          }}
                          variant="outline"
                          className="w-full py-4 text-lg rounded-xl text-red-500 border-red-200 hover:bg-red-50"
                        >
                          {t('gameMusicTrivia.game.giveUp')}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-slate-500 font-medium text-lg mt-4">
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
              className={`p-8 rounded-2xl shadow-sm border text-center space-y-4 ${state.currentRound?.answeredCorrectly ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <div className="text-6xl mb-4">
                {state.currentRound?.answeredCorrectly ? '✅' : '❌'}
              </div>
              <h3 className="text-3xl font-bold text-slate-800">
                {state.currentRound?.answeredCorrectly
                  ? t('gameMusicTrivia.game.correct')
                  : t('gameMusicTrivia.game.incorrect')}
              </h3>
              <p className="text-slate-600 font-medium">
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
                <div className="bg-white/80 rounded-xl p-4 border border-slate-200 shadow-sm max-w-md mx-auto my-4">
                  <p className="text-sm font-bold text-slate-500 uppercase">
                    {t('gameMusicTrivia.game.playerAnswered')}
                  </p>
                  <p className="text-xl font-black text-indigo-700 mt-1">
                    "{state.revealedAnswer.successfulAnswerText}"
                  </p>
                </div>
              )}

              {state.revealedAnswer && (
                <div className="mt-6 p-6 bg-white/50 rounded-xl border border-slate-200 shadow-inner inline-block min-w-[250px]">
                  {state.revealedAnswer.artworkUrl && (
                    <img src={state.revealedAnswer.artworkUrl.replace('100x100bb.jpg', '300x300bb.jpg')} alt="Album Art" className="w-32 h-32 mx-auto rounded-lg shadow-md mb-4" />
                  )}
                  <p className="text-sm text-slate-500 font-bold uppercase mb-1">
                    {t('gameMusicTrivia.game.theAnswerWas')}
                  </p>
                  <p className="text-2xl font-black text-indigo-600 mb-1">
                    {state.revealedAnswer.title}
                  </p>
                  <p className="text-lg font-medium text-slate-600">
                    {t('gameMusicTrivia.game.by')} {state.revealedAnswer.artist}
                  </p>
                  {(state.revealedAnswer.album || state.revealedAnswer.releaseYear) && (
                    <p className="text-sm font-medium text-slate-500 mt-1">
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
                    <a
                      href={state.revealedAnswer.trackViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white px-3 py-1.5 rounded-full shadow-sm border border-indigo-100"
                    >
                      {t('gameMusicTrivia.game.listenOnAppleMusic')}
                    </a>
                  )}
                </div>
              )}

              {isHost && (
                <div className="pt-6">
                  <Button
                    onClick={() => musicTriviaGameAction({ type: 'NEXT_ROUND' })}
                    className="px-8 py-6 text-lg rounded-xl font-bold shadow-lg shadow-indigo-500/30"
                  >
                    Next Round 🎵
                  </Button>
                </div>
              )}
              {countdown !== null && (
                <div className="pt-2 text-slate-500 font-medium animate-pulse">
                  {t('gameMusicTrivia.game.autoProceedingIn', { count: countdown }) ||
                    `Auto-proceeding in ${countdown}s...`}
                </div>
              )}
            </div>
          )}

          {/* REVEAL / ROUND_RESULT Phase */}
          {(state.phase === 'REVEAL' || state.phase === 'ROUND_RESULT') && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border text-center space-y-6">
              <h3 className="text-2xl font-bold text-slate-800">
                {t('gameMusicTrivia.game.theAnswerWas')}
              </h3>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                {state.revealedAnswer?.artworkUrl && (
                  <img src={state.revealedAnswer.artworkUrl.replace('100x100bb.jpg', '400x400bb.jpg')} alt="Album Art" className="w-40 h-40 mx-auto rounded-xl shadow-lg mb-4" />
                )}
                <p className="text-3xl font-black text-indigo-600 mb-2">
                  {state.revealedAnswer?.title}
                </p>
                <p className="text-xl font-medium text-slate-600">
                  {t('gameMusicTrivia.game.by')} {state.revealedAnswer?.artist}
                </p>
                {(state.revealedAnswer?.album || state.revealedAnswer?.releaseYear) && (
                  <p className="text-base font-medium text-slate-500 mt-2">
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
                  <a
                    href={state.revealedAnswer.trackViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-indigo-100 transition-transform hover:scale-105 active:scale-95"
                  >
                    {t('gameMusicTrivia.game.listenOnAppleMusic')}
                  </a>
                )}
              </div>

              {state.phase === 'ROUND_RESULT' && state.currentRound?.winnerId && (
                <div className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full font-bold">
                  {t('gameMusicTrivia.game.wonTheRound', {
                    name:
                      room?.players.find((p) => p.socketId === state.currentRound?.winnerId)
                        ?.name || 'Someone',
                  }) ||
                    `${room?.players.find((p) => p.socketId === state.currentRound?.winnerId)?.name} won the round! (+1 pt)`}
                </div>
              )}
              {state.phase === 'ROUND_RESULT' && !state.currentRound?.winnerId && (
                <div className="inline-block px-4 py-2 bg-slate-100 text-slate-600 rounded-full font-bold">
                  {t('gameMusicTrivia.game.noOneGotItRight')}
                </div>
              )}

              {isHost && (
                <div className="pt-4">
                  <Button
                    onClick={() => handleAction('NEXT_ROUND')}
                    className="px-8 py-6 text-lg rounded-xl font-bold"
                  >
                    {t('gameMusicTrivia.game.nextRound')}
                  </Button>
                </div>
              )}
              {countdown !== null && (
                <div className="pt-2 text-slate-500 font-medium animate-pulse">
                  {t('gameMusicTrivia.game.autoProceedingIn', { count: countdown }) ||
                    `Auto-proceeding in ${countdown}s...`}
                </div>
              )}
            </div>
          )}

          {/* FINISHED Phase */}
          {state.phase === 'FINISHED' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-6">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-3xl font-bold text-slate-800">
                {t('gameMusicTrivia.game.gameOver')}
              </h3>

              <div className="space-y-3 pt-4 max-w-sm mx-auto">
                {Object.entries(state.scores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([playerId, score], index) => {
                    const p = room?.players.find((p) => p.id === playerId);
                    if (!p) return null;
                    return (
                      <div
                        key={playerId}
                        className={`flex justify-between items-center p-4 rounded-xl font-bold ${index === 0 ? 'bg-amber-100 text-amber-900 border-2 border-amber-300' : 'bg-slate-50 text-slate-700 border'}`}
                      >
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
                    {t('gameMusicTrivia.game.returnToLobby')}
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
