import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, RotateCcw, AlertTriangle, Users, Trophy } from 'lucide-react';
import { useServerClock } from '@/hooks/useServerClock';
import { SoundToggle } from '@/components/core/SoundToggle';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';

export const WhoFirstView = () => {
  const { room, socketId, startGame, updateConfig, whoFirstGameAction, resetRoom, actionLoading } =
    useGameStore();
  const { t } = useTranslate();
  const { serverOffset } = useServerClock();
  const [activeTime, setActiveTime] = useState<number>(0);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const { enabled: soundsEnabled, toggle: toggleSound } = useSoundSettings();
  const [isSubmittingNext, setIsSubmittingNext] = useState<boolean>(false);
  const prevPhaseRef = useRef<string | null>(null);

  const isHost = room?.roomHostId === socketId;
  const state = room?.whoFirstState;

  const playSound = useCallback(
    (type: 'ready' | 'go' | 'foul' | 'win') => {
      if (!soundsEnabled) return;
      if (type === 'go') {
        audioManager.playBuzzer();
      } else if (type === 'ready') {
        audioManager.playReady();
      } else if (type === 'foul') {
        audioManager.playFoul();
      } else if (type === 'win') {
        audioManager.playSuccessChime();
      }
    },
    [soundsEnabled],
  );

  useEffect(() => {
    if (state?.phase && state.phase !== prevPhaseRef.current) {
      if (state.phase === 'ACTIVE') {
        playSound('go');
        gameFeel.flash('white', 200);
        gameFeel.haptic(50);
      } else if (state.phase === 'COUNTDOWN') {
        playSound('ready');
      } else if (state.phase === 'ROUND_RESULT' || state.phase === 'FINISHED') {
        playSound('win');
        const winner = state.presses[0];
        const localPress = state.presses.find((p) => p.socketId === socketId);
        if (winner && winner.socketId === socketId) {
          void gameFeel.celebrate();
          gameFeel.flash('gold');
          gameFeel.haptic([80, 50, 100]);
        } else if (localPress?.isPenalty) {
          gameFeel.shake(0.6);
          gameFeel.flash('red');
          gameFeel.haptic([150]);
        }
      }
      prevPhaseRef.current = state.phase;
    }
  }, [state?.phase, state?.presses, socketId, playSound]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state?.phase === 'ACTIVE' && state.activeStartTime) {
      const update = () => {
        const elapsed = Math.max(0, Date.now() + serverOffset - state.activeStartTime!);
        setActiveTime(elapsed);
      };
      update();
      interval = setInterval(update, 50);
    } else {
      setActiveTime(0);
    }
    return () => clearInterval(interval);
  }, [state?.phase, state?.activeStartTime, serverOffset]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state?.phase === 'COUNTDOWN' && state.countdownEndTime) {
      const update = () => {
        const remaining = Math.max(0, state.countdownEndTime! - (Date.now() + serverOffset));
        setCountdownRemaining(remaining);
        if (remaining <= 0) clearInterval(interval);
      };
      update();
      interval = setInterval(update, 50);
    } else {
      setCountdownRemaining(0);
    }
    return () => clearInterval(interval);
  }, [state?.phase, state?.countdownEndTime, serverOffset]);

  useEffect(() => {
    setIsSubmittingNext(false);
  }, [state?.currentRound, state?.phase]);

  const isPlayer = room?.players.some((p) => p.socketId === socketId && !p.isViewer) ?? false;
  const hostPlays = room?.config.whoFirstHostPlays;
  const canPlay = isPlayer && (!isHost || hostPlays);
  const hasPressed = state?.presses.some((p) => p.socketId === socketId) ?? false;
  const myPress = state?.presses.find((p) => p.socketId === socketId);
  const penaltyEnabled = room?.config.whoFirstPenalty ?? false;

  const isPressable =
    canPlay &&
    !hasPressed &&
    (state?.phase === 'ACTIVE' || (state?.phase === 'COUNTDOWN' && penaltyEnabled));

  const handlePressButton = () => {
    if (!room || !isPressable) return;
    whoFirstGameAction({ type: 'PRESS_BUTTON' });
  };

  const handleNextRound = () => {
    if (!room || isSubmittingNext || !isHost) return;
    setIsSubmittingNext(true);
    whoFirstGameAction({ type: 'NEXT_ROUND' });
  };

  const handleEndGame = () => {
    if (!room || !isHost) return;
    whoFirstGameAction({ type: 'END_GAME' });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && isPressable) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          document.querySelector('[role="dialog"]')
        ) {
          return;
        }
        e.preventDefault();
        handlePressButton();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPressable]);

  if (!room) return null;

  // Render Lobby Config (before the game starts)
  if (!state || state.phase === 'LOBBY') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
        <div className="w-full bg-cyan-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden p-6">
          <div className="flex items-center justify-between mb-6">
            <h2
              data-testid="lobby-title"
              className="text-3xl font-black text-black uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              {t('whoFirst.lobby.title')}
            </h2>
            <SoundToggle
              enabled={soundsEnabled}
              onToggle={toggleSound}
              titleOn={t('whoFirst.game.soundOn')}
              titleOff={t('whoFirst.game.soundOff')}
              testId="who-first-sound-toggle"
              className="w-10 h-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>
          <div className="space-y-6 bg-white border-4 border-black p-4">
            {isHost ? (
              <>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                  <div className="flex items-center justify-between p-3 bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Label className="flex items-center gap-2 text-black font-black uppercase tracking-widest text-sm">
                      <Play className="w-5 h-5 fill-black" />
                      {t('whoFirst.lobby.minCountdown')}
                    </Label>
                    <input
                      aria-label={t('whoFirst.lobby.minCountdown')}
                      type="number"
                      className="w-16 bg-white border-2 border-black p-1 text-center font-black text-black focus:outline-none focus:ring-0"
                      value={(room.config.whoFirstMinCountdownMs || 2000) / 1000}
                      onChange={(e) =>
                        updateConfig({ whoFirstMinCountdownMs: parseInt(e.target.value) * 1000 })
                      }
                      min={1}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Label className="flex items-center gap-2 text-black font-black uppercase tracking-widest text-sm">
                      <Play className="w-5 h-5 fill-black" />
                      {t('whoFirst.lobby.maxCountdown')}
                    </Label>
                    <input
                      aria-label={t('whoFirst.lobby.maxCountdown')}
                      type="number"
                      className="w-16 bg-white border-2 border-black p-1 text-center font-black text-black focus:outline-none focus:ring-0"
                      value={(room.config.whoFirstMaxCountdownMs || 5000) / 1000}
                      onChange={(e) =>
                        updateConfig({ whoFirstMaxCountdownMs: parseInt(e.target.value) * 1000 })
                      }
                      min={1}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Label
                      htmlFor="infinite-switch"
                      className="flex items-center gap-2 text-black font-black uppercase tracking-widest text-sm"
                    >
                      <RotateCcw className="w-5 h-5 fill-black" />
                      {t('whoFirst.lobby.infiniteRounds')}
                    </Label>
                    <Switch
                      id="infinite-switch"
                      className="data-[state=checked]:bg-indigo-400 data-[state=unchecked]:bg-slate-300 border-2 border-black shadow-none"
                      checked={room.config.whoFirstInfiniteRounds}
                      onCheckedChange={(checked) =>
                        updateConfig({ whoFirstInfiniteRounds: checked })
                      }
                    />
                  </div>
                  {!room.config.whoFirstInfiniteRounds && (
                    <div className="flex items-center justify-between p-3 bg-indigo-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <Label className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm">
                        <Trophy className="w-5 h-5 fill-white" />
                        {t('whoFirst.lobby.roundsCount')}
                      </Label>
                      <input
                        aria-label={t('whoFirst.lobby.roundsCount')}
                        type="number"
                        className="w-16 bg-white border-2 border-black p-1 text-center font-black text-black focus:outline-none focus:ring-0"
                        value={room.config.whoFirstMaxRounds ?? room.config.maxRounds ?? 5}
                        onChange={(e) =>
                          updateConfig({ whoFirstMaxRounds: parseInt(e.target.value) })
                        }
                        min={1}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-pink-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Label
                      htmlFor="counter-switch"
                      className="flex items-center gap-2 text-black font-black uppercase tracking-widest text-sm"
                    >
                      <Play className="w-5 h-5 fill-black" />
                      {t('whoFirst.lobby.showCounter')}
                    </Label>
                    <Switch
                      id="counter-switch"
                      className="data-[state=checked]:bg-emerald-400 data-[state=unchecked]:bg-slate-300 border-2 border-black shadow-none"
                      checked={room.config.whoFirstShowCounter !== false}
                      onCheckedChange={(checked) => updateConfig({ whoFirstShowCounter: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Label
                      htmlFor="penalty-switch"
                      className="flex items-center gap-2 text-black font-black uppercase tracking-widest text-sm"
                    >
                      <AlertTriangle className="w-5 h-5 fill-black" />
                      {t('whoFirst.lobby.penaltyLabel')}
                    </Label>
                    <Switch
                      id="penalty-switch"
                      className="data-[state=checked]:bg-rose-400 data-[state=unchecked]:bg-slate-300 border-2 border-black shadow-none"
                      checked={room.config.whoFirstPenalty}
                      onCheckedChange={(checked) => updateConfig({ whoFirstPenalty: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-cyan-200 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Label
                      htmlFor="host-plays-switch"
                      className="flex items-center gap-2 text-black font-black uppercase tracking-widest text-sm"
                    >
                      <Users className="w-5 h-5 fill-black" />
                      {t('whoFirst.lobby.hostPlaysLabel')}
                    </Label>
                    <Switch
                      id="host-plays-switch"
                      className="data-[state=checked]:bg-indigo-400 data-[state=unchecked]:bg-slate-300 border-2 border-black shadow-none"
                      checked={room.config.whoFirstHostPlays}
                      onCheckedChange={(checked) => updateConfig({ whoFirstHostPlays: checked })}
                    />
                  </div>
                </div>

                <div className="mt-4 border-t-4 border-black pt-4">
                  <Label className="text-black text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2 bg-yellow-300 inline-block px-2 border-2 border-black">
                    <Users className="w-4 h-4 inline-block -mt-1 mr-1" />
                    {t('lobby.playersInRoom')} ({room.players.filter((p) => p.connected).length})
                  </Label>
                  <div className="grid grid-cols-2 gap-3 max-h-32 overflow-y-auto mt-2">
                    {room.players
                      .filter((p) => p.connected)
                      .map((player) => (
                        <div
                          key={player.socketId}
                          className="flex items-center gap-2 bg-white p-2 border-2 border-black"
                        >
                          <div className="w-6 h-6 border-2 border-black bg-indigo-400 text-white flex items-center justify-center font-black text-xs uppercase">
                            {player.name.charAt(0)}
                          </div>
                          <span className="text-sm font-black text-black truncate uppercase tracking-widest">
                            {player.name} {player.socketId === room.roomHostId && '👑'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <Button
                  data-testid="start-btn"
                  onClick={() => startGame()}
                  disabled={room.players.filter((p) => p.connected).length < 2 || actionLoading}
                  className="w-full mt-6 bg-emerald-400 hover:bg-emerald-300 text-black font-black py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-xl uppercase tracking-widest"
                  size="lg"
                >
                  <Play className="w-6 h-6 mr-2 fill-black" />
                  {t('whoFirst.lobby.startBtn')}
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="w-12 h-12 border-4 border-black bg-yellow-300 animate-spin"></div>
                <div
                  data-testid="who-first-lobby-waiting-host"
                  className="text-center text-black font-black uppercase tracking-widest bg-cyan-300 border-2 border-black px-4 py-2"
                >
                  {t('whoFirst.lobby.waitingForHost')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto space-y-8 relative overflow-hidden p-4">
      {/* Header Info */}
      <div className="w-full flex justify-between items-center text-black bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative min-h-[4rem] flex-wrap gap-4">
        <div
          data-testid="who-first-round-indicator"
          className="font-black text-white bg-indigo-400 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-sm sm:text-base"
        >
          {state.maxRounds === 0
            ? t('whoFirst.game.infiniteRound', { round: state.currentRound })
            : `Round ${state.currentRound} / ${state.maxRounds}`}
        </div>
        {state.phase === 'COUNTDOWN' && room.config.whoFirstShowCounter !== false && (
          <div
            data-testid="who-first-countdown-display"
            className="font-black text-xl sm:text-2xl text-black bg-yellow-300 border-2 border-black px-4 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] absolute left-1/2 -translate-x-1/2"
          >
            {(countdownRemaining / 1000).toFixed(3)}s
          </div>
        )}
        {state.phase === 'ACTIVE' && room.config.whoFirstShowCounter !== false && (
          <div
            data-testid="who-first-active-timer"
            className="font-black text-xl sm:text-2xl text-white bg-emerald-400 border-2 border-black px-4 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] absolute left-1/2 -translate-x-1/2"
          >
            {(activeTime / 1000).toFixed(3)}s
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <SoundToggle
            enabled={soundsEnabled}
            onToggle={toggleSound}
            titleOn={t('whoFirst.game.soundOn')}
            titleOff={t('whoFirst.game.soundOff')}
            testId="who-first-sound-toggle"
            className="w-9 h-9"
          />
          {isHost && (state.phase === 'COUNTDOWN' || state.phase === 'ACTIVE') && (
            <Button
              data-testid="who-first-end-game-btn"
              onClick={handleEndGame}
              variant="destructive"
              size="sm"
              className="font-black uppercase tracking-widest bg-rose-400 border-2 border-black text-white hover:bg-rose-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
            >
              {t('whoFirst.game.endGameNow')}
            </Button>
          )}
        </div>
      </div>

      {/* Main Interaction Area */}
      {state.phase === 'COUNTDOWN' || state.phase === 'ACTIVE' ? (
        <div
          data-testid="who-first-active-container"
          className={`flex flex-col items-center justify-center space-y-12 py-12 flex-1 w-full relative transition-colors duration-200 border-4 ${
            state.phase === 'ACTIVE'
              ? 'bg-emerald-100 border-emerald-600 shadow-[8px_8px_0px_0px_#059669]'
              : 'bg-yellow-50 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          {state.phase === 'COUNTDOWN' && (
            <div
              data-testid="status-ready"
              className="text-5xl md:text-7xl font-black text-black bg-yellow-300 border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-bounce motion-reduce:animate-none uppercase tracking-widest absolute top-0 z-10"
            >
              {t('whoFirst.game.ready')}
            </div>
          )}
          {state.phase === 'ACTIVE' && (
            <div
              data-testid="status-go"
              className="text-5xl md:text-7xl font-black text-white bg-emerald-500 border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest absolute top-0 z-10"
            >
              {t('whoFirst.game.go')}
            </div>
          )}

          {canPlay && (
            <button
              data-testid="press-btn"
              onClick={handlePressButton}
              disabled={!isPressable}
              aria-disabled={!isPressable}
              className={`
 relative flex items-center justify-center
 w-48 h-48 md:w-64 md:h-64 border-8 border-black
 text-4xl font-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 uppercase tracking-widest mt-16
 select-none
 ${
   hasPressed
     ? myPress?.isPenalty
       ? 'bg-rose-300 text-black cursor-not-allowed translate-y-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
       : 'bg-slate-300 text-slate-500 cursor-not-allowed translate-y-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
     : state.phase === 'ACTIVE'
       ? 'bg-rose-500 text-white hover:bg-rose-400 active:translate-y-3 active:shadow-none cursor-pointer'
       : penaltyEnabled
         ? 'bg-amber-400 text-black hover:bg-amber-300 active:translate-y-3 active:shadow-none cursor-pointer'
         : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
 }
 `}
            >
              {hasPressed
                ? myPress?.isPenalty
                  ? t('whoFirst.game.penalty')
                  : t('whoFirst.game.pressed')
                : state.phase === 'COUNTDOWN' && !penaltyEnabled
                  ? t('whoFirst.game.ready')
                  : t('whoFirst.game.pressBtn')}
            </button>
          )}

          {!canPlay && (
            <div className="text-xl text-black font-black uppercase tracking-widest bg-cyan-300 px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-16">
              {t('whoFirst.game.spectating')}
            </div>
          )}
        </div>
      ) : null}

      {/* Results Area */}
      {(state.phase === 'ROUND_RESULT' || state.phase === 'FINISHED') && (
        <div
          data-testid="who-first-results"
          className="w-full bg-pink-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mt-8"
        >
          <div className="bg-white border-b-4 border-black p-4 flex flex-col gap-2">
            <h2
              data-testid="round-result-title"
              className="text-2xl text-center text-black flex items-center justify-center gap-3 font-black uppercase tracking-widest"
            >
              <Trophy className="text-black w-8 h-8 fill-yellow-300" />
              {state.phase === 'FINISHED'
                ? t('whoFirst.result.finalTitle')
                : t('whoFirst.result.roundTitle')}
            </h2>
            <div
              data-testid="who-first-network-disclaimer"
              className="text-xs text-black bg-yellow-100 border-2 border-black p-2 text-center font-bold"
            >
              ℹ️ {t('whoFirst.result.networkDisclaimer')}
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              {state.presses
                .filter((p) => !p.isPenalty)
                .sort((a, b) => (a.reactionTimeMs || 0) - (b.reactionTimeMs || 0))
                .map((press, index) => {
                  const player = room.players.find((p) => p.socketId === press.socketId);
                  const isMe = press.socketId === socketId;
                  const fastestTime =
                    state.presses
                      .filter((p) => !p.isPenalty)
                      .sort((a, b) => (a.reactionTimeMs || 0) - (b.reactionTimeMs || 0))[0]
                      ?.reactionTimeMs || 0;
                  const diff = (press.reactionTimeMs || 0) - fastestTime;

                  return (
                    <div
                      key={press.socketId}
                      className={`flex items-center justify-between p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                        isMe ? 'bg-indigo-300' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 flex items-center justify-center font-black text-2xl border-4 border-black ${
                            index === 0
                              ? 'bg-yellow-300'
                              : index === 1
                                ? 'bg-slate-300'
                                : index === 2
                                  ? 'bg-amber-500'
                                  : 'bg-white'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="font-black uppercase tracking-widest text-black text-lg">
                          {player?.name || 'Unknown'} {isMe && `(${t('lobby.you')})`}
                        </span>
                      </div>
                      <div className="text-right bg-emerald-400 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-black font-black text-xl">
                          {((press.reactionTimeMs || 0) / 1000).toFixed(3)}s
                        </div>
                        {index > 0 && (
                          <div className="text-xs text-black font-black">
                            +{(diff / 1000).toFixed(3)}s
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Penalties */}
              {state.presses
                .filter((p) => p.isPenalty)
                .map((press) => {
                  const player = room.players.find((p) => p.socketId === press.socketId);
                  return (
                    <div
                      key={press.socketId}
                      data-testid="who-first-early-press"
                      className="flex flex-col gap-2 p-4 bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 flex items-center justify-center bg-black border-4 border-black">
                            <AlertTriangle className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                          </div>
                          <span className="font-black text-black line-through uppercase tracking-widest text-lg">
                            {player?.name || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-black font-black text-sm uppercase tracking-widest bg-yellow-300 px-3 py-1 border-4 border-black">
                          {t('whoFirst.result.earlyPress')}
                        </div>
                      </div>
                      <div
                        data-testid="who-first-penalty-reason"
                        className="text-xs font-bold text-red-950 bg-rose-200 border-2 border-black p-1.5"
                      >
                        ⚠️ {t('whoFirst.result.earlyPressExplanation')}
                      </div>
                    </div>
                  );
                })}

              {/* Did not press */}
              {room.players
                .filter(
                  (p) =>
                    p.connected &&
                    (p.socketId !== room.roomHostId || hostPlays) &&
                    !state.presses.some((press) => press.socketId === p.socketId),
                )
                .map((p) => (
                  <div
                    key={p.socketId}
                    className="flex items-center justify-between p-4 bg-slate-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] opacity-80"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center bg-slate-500 border-4 border-black text-white font-black text-2xl">
                        -
                      </div>
                      <span className="font-black text-black uppercase tracking-widest text-lg">
                        {p.name}
                      </span>
                    </div>
                    <div className="text-black font-black text-sm uppercase tracking-widest bg-white px-3 py-1 border-2 border-black">
                      {t('whoFirst.result.noPress')}
                    </div>
                  </div>
                ))}
            </div>

            {state.phase === 'ROUND_RESULT' &&
              state.presses.length > 0 &&
              state.presses.every((p) => p.isPenalty) && (
                <div className="mt-6 p-6 bg-rose-400 border-4 border-black text-center flex flex-col items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <AlertTriangle className="w-12 h-12 text-black fill-yellow-300 animate-bounce motion-reduce:animate-none" />
                  <h3 className="text-2xl font-black text-black uppercase tracking-widest bg-white px-4 py-1 border-2 border-black">
                    {t('whoFirst.result.allFouls')}
                  </h3>
                </div>
              )}

            {state.phase === 'ROUND_RESULT' &&
              (isHost ? (
                <div className="mt-8 pt-6 border-t-4 border-black flex flex-col md:flex-row items-center justify-center gap-4">
                  <Button
                    data-testid="who-first-next-round-btn"
                    onClick={handleNextRound}
                    disabled={isSubmittingNext}
                    size="lg"
                    className="w-full md:w-auto bg-emerald-400 hover:bg-emerald-300 text-black font-black py-6 px-10 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-lg uppercase tracking-widest"
                  >
                    {t('whoFirst.result.nextRoundBtn')}
                  </Button>
                  <Button
                    data-testid="who-first-end-game-btn"
                    onClick={handleEndGame}
                    variant="outline"
                    size="lg"
                    className="w-full md:w-auto bg-rose-400 hover:bg-rose-300 text-black font-black py-6 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-lg uppercase tracking-widest"
                  >
                    {t('whoFirst.game.endGameNow')}
                  </Button>
                </div>
              ) : (
                <div
                  data-testid="who-first-waiting-host"
                  className="mt-6 text-center text-black font-black uppercase tracking-widest bg-cyan-200 border-2 border-black p-3"
                >
                  ⏳ {t('whoFirst.result.waitingHostNextRound')}
                </div>
              ))}

            {state.phase === 'FINISHED' &&
              (isHost ? (
                <div className="mt-8 pt-6 border-t-4 border-black flex items-center justify-center">
                  <Button
                    data-testid="who-first-rematch-btn"
                    onClick={() => resetRoom()}
                    variant="outline"
                    size="lg"
                    className="w-full md:w-auto bg-cyan-300 hover:bg-cyan-200 text-black font-black py-6 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-lg uppercase tracking-widest"
                  >
                    <RotateCcw className="w-5 h-5 mr-2 stroke-black" />
                    {t('whoFirst.result.endGameBtn')}
                  </Button>
                </div>
              ) : (
                <div
                  data-testid="who-first-waiting-host"
                  className="mt-6 text-center text-black font-black uppercase tracking-widest bg-cyan-200 border-2 border-black p-3"
                >
                  ⏳ {t('whoFirst.result.waitingHostNewGame')}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
