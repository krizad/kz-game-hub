'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';
import { getAvatarEmoji } from '@/components/core/utils';
import { toast } from 'react-hot-toast';
import { GameType, TheMindPhase } from '@repo/types';
import { Button } from '@/components/ui/button';

import { Play, Heart, Star, Users, RotateCcw, Zap, Check, X, EyeOff } from 'lucide-react';

const THE_MIND_RESULT_TOAST_ID = 'the-mind-result';

export function TheMindView() {
  const {
    room,
    socketId,
    playerId: storedPlayerId,
    myName,
    privateState,
    updateConfig,
    resetRoom,
    startGame,
    theMindReady,
    theMindPlayCard,
    theMindNextLevel,
    theMindProposeShuriken,
    theMindVoteShuriken,
    theMindCancelShuriken,
  } = useGameStore();
  const { t } = useTranslate();

  const [displayPhase, setDisplayPhase] = React.useState<TheMindPhase | null>(null);
  const [remainingTime, setRemainingTime] = React.useState<number | null>(null);
  const previousPhaseRef = React.useRef<TheMindPhase | null>(null);
  const playedCardsContainerRef = React.useRef<HTMLDivElement>(null);
  const resultCardsContainerRef = React.useRef<HTMLDivElement>(null);
  const [revealedCount, setRevealedCount] = React.useState(0);
  const [selectedExtremeCard, setSelectedExtremeCard] = React.useState<number | null>(null);

  const playerId = React.useMemo(() => {
    if (!room) return storedPlayerId;

    const currentPlayer = room.players.find(
      (player) =>
        player.id === storedPlayerId || player.socketId === socketId || player.name === myName,
    );

    return currentPlayer?.id ?? storedPlayerId;
  }, [room, storedPlayerId, socketId, myName]);

  const showResultToast = React.useCallback(
    (success: boolean) => {
      const options = {
        id: THE_MIND_RESULT_TOAST_ID,
        duration: 3000,
        position: 'top-center' as const,
      };

      if (success) {
        toast.success(t('gameTheMind.game.levelCleared'), options);
      } else {
        toast.error(t('gameTheMind.game.mistake'), options);
      }
    },
    [t],
  );

  React.useEffect(() => {
    if (playerId && playerId !== storedPlayerId) {
      useGameStore.setState({ playerId });
    }
  }, [playerId, storedPlayerId]);

  React.useEffect(() => {
    const currentHand = (privateState.theMindHand as number[] | undefined) ?? [];
    if (selectedExtremeCard !== null && !currentHand.includes(selectedExtremeCard)) {
      setSelectedExtremeCard(null);
    }
  }, [privateState, selectedExtremeCard]);

  React.useEffect(() => {
    if (playedCardsContainerRef.current) {
      playedCardsContainerRef.current.scrollLeft = playedCardsContainerRef.current.scrollWidth;
    }
  }, [room?.theMindState?.playedCards?.length]);

  React.useEffect(() => {
    const currentPhase = room?.theMindState?.phase;
    if (
      !currentPhase ||
      currentPhase === TheMindPhase.LOBBY ||
      currentPhase === TheMindPhase.SETUP ||
      currentPhase === TheMindPhase.PLAYING
    ) {
      toast.remove(THE_MIND_RESULT_TOAST_ID);
      setDisplayPhase(null);
      setRevealedCount(0);
    }
  }, [room?.theMindState?.phase]);

  React.useEffect(() => {
    if (!room?.theMindState) return;
    const current = room.theMindState.phase;
    const prev = previousPhaseRef.current;

    if (
      prev === TheMindPhase.PLAYING &&
      (current === TheMindPhase.LEVEL_RESULT ||
        current === TheMindPhase.SHURIKEN_RESULT ||
        current === TheMindPhase.GAME_OVER)
    ) {
      if (current === TheMindPhase.LEVEL_RESULT || current === TheMindPhase.GAME_OVER) {
        const result = room.theMindState.result;
        if (!room.config?.theMindBlindMode && result) {
          showResultToast(result.success);
        }
      }

      const timer = setTimeout(() => {
        setDisplayPhase(current);
      }, 2000);
      previousPhaseRef.current = current;
      return () => clearTimeout(timer);
    } else {
      setDisplayPhase(current);
      previousPhaseRef.current = current;
    }
  }, [
    room?.config?.theMindBlindMode,
    room?.theMindState?.phase,
    room?.theMindState?.result,
    showResultToast,
  ]);

  React.useEffect(() => {
    const actualPhase = room?.theMindState?.phase;
    const result = room?.theMindState?.result;
    const isActualResultPhase =
      actualPhase === TheMindPhase.LEVEL_RESULT || actualPhase === TheMindPhase.GAME_OVER;

    if (
      (displayPhase === TheMindPhase.LEVEL_RESULT || displayPhase === TheMindPhase.GAME_OVER) &&
      isActualResultPhase &&
      room?.config?.theMindBlindMode &&
      room?.theMindState?.playedCards &&
      result
    ) {
      setRevealedCount(0);
      const maxCount = room.theMindState.playedCards.length;
      if (maxCount === 0) {
        showResultToast(result.success);
        return;
      }

      let count = 0;
      const wasSuccessful = result.success;
      const timer = setInterval(() => {
        if (count < maxCount) {
          count++;
          setRevealedCount(count);
          if (count === maxCount) {
            clearInterval(timer);
            showResultToast(wasSuccessful);
          }
        } else {
          clearInterval(timer);
        }
      }, 800);
      return () => clearInterval(timer);
    }
  }, [
    displayPhase,
    room?.config?.theMindBlindMode,
    room?.theMindState?.phase,
    room?.theMindState?.playedCards?.length,
    room?.theMindState?.result?.success,
    showResultToast,
  ]);

  React.useEffect(() => {
    if (room?.theMindState?.levelEndTime && room?.theMindState?.phase === TheMindPhase.PLAYING) {
      const timer = setInterval(() => {
        const remaining = room.theMindState!.levelEndTime! - Date.now();
        if (remaining <= 0) {
          setRemainingTime(0);
          clearInterval(timer);
        } else {
          setRemainingTime(Math.ceil(remaining / 1000));
        }
      }, 200);
      return () => clearInterval(timer);
    } else {
      setRemainingTime(null);
    }
  }, [room?.theMindState?.levelEndTime, room?.theMindState?.phase]);

  React.useEffect(() => {
    if (resultCardsContainerRef.current && revealedCount > 0) {
      const container = resultCardsContainerRef.current;
      const child = container.children[revealedCount - 1] as HTMLElement;
      if (child) {
        const containerRect = container.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        const centeredScrollLeft =
          container.scrollLeft +
          childRect.left -
          containerRect.left -
          (container.clientWidth - childRect.width) / 2;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;

        container.scrollTo({
          left: Math.max(0, Math.min(centeredScrollLeft, maxScrollLeft)),
          behavior: 'smooth',
        });
      }
    }
  }, [revealedCount]);

  if (!room || room.gameType !== GameType.THE_MIND) return null;

  const isHost = room.roomHostId === socketId;

  const renderLobby = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
      <div className="w-full bg-cyan-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] - overflow-hidden p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-center text-black uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {t('gameTheMind.lobby.title')}
          </h2>
        </div>
        <div className="space-y-6">
          {isHost ? (
            <div className="flex flex-col items-center gap-6">
              <div className="w-full space-y-4 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                <div className="flex items-center justify-between p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  <label className="flex items-center gap-2 text-black font-black uppercase tracking-widest">
                    <Heart className="w-5 h-5 text-rose-500" />
                    {t('gameTheMind.lobby.startingLives')}
                  </label>
                  <input
                    aria-label={t('gameTheMind.lobby.startingLives')}
                    type="number"
                    className="w-16 bg-yellow-300 border-2 border-black p-1 text-center font-black text-black"
                    value={
                      room.config?.theMindStartingLives ??
                      room.players.filter((p) => p.connected).length
                    }
                    onChange={(e) =>
                      updateConfig({ theMindStartingLives: parseInt(e.target.value) })
                    }
                    min={1}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                  <label className="flex items-center gap-2 text-black font-black uppercase tracking-widest">
                    <Star className="w-5 h-5 text-indigo-500" />
                    {t('gameTheMind.lobby.startingShurikens')}
                  </label>
                  <input
                    aria-label={t('gameTheMind.lobby.startingShurikens')}
                    type="number"
                    className="w-16 bg-pink-300 border-2 border-black p-1 text-center font-black text-black"
                    value={room.config?.theMindStartingShurikens ?? 1}
                    onChange={(e) =>
                      updateConfig({ theMindStartingShurikens: parseInt(e.target.value) })
                    }
                    min={0}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  <label className="flex items-center gap-2 text-black font-black uppercase tracking-widest">
                    <EyeOff className="w-5 h-5 text-black" />
                    {t('gameTheMind.lobby.blindMode')}
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={room.config?.theMindBlindMode ?? false}
                      onChange={(e) => updateConfig({ theMindBlindMode: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 border-2 border-black peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black after:border-2 after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-400"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                  <label className="flex items-center gap-2 text-black font-black uppercase tracking-widest">
                    <span className="text-xl">🔥</span>
                    {t('gameTheMind.lobby.gameMode')}
                  </label>
                  <NeobrutalismSelect
                    value={room.config?.theMindMode ?? 'NORMAL'}
                    options={[
                      { value: 'NORMAL', label: t('gameTheMind.lobby.modeNormal') || 'Normal' },
                      { value: 'EXTREME', label: t('gameTheMind.lobby.modeExtreme') || 'Extreme' },
                    ]}
                    onChange={(val) => updateConfig({ theMindMode: val as 'NORMAL' | 'EXTREME' })}
                    className="bg-rose-400 w-32"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                  <label className="flex items-center gap-2 text-black font-black uppercase tracking-widest">
                    <span className="text-xl">⏱️</span>
                    {t('gameTheMind.lobby.timeAttack')}
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={room.config?.theMindTimeAttack ?? false}
                      onChange={(e) => updateConfig({ theMindTimeAttack: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 border-2 border-black peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black after:border-2 after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-300"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                  <label className="flex items-center gap-2 text-black font-black uppercase tracking-widest">
                    <span className="text-xl">🏆</span>
                    {t('gameTheMind.lobby.maxLevel')}
                  </label>
                  <NeobrutalismSelect
                    value={String(room.config?.theMindMaxLevel ?? '')}
                    options={[
                      { value: '', label: 'Auto' },
                      ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((lv) => ({
                        value: String(lv),
                        label: String(lv),
                      })),
                    ]}
                    onChange={(val) => {
                      const parsedVal = val === '' ? undefined : parseInt(val);
                      updateConfig({ theMindMaxLevel: parsedVal });
                    }}
                    className="bg-emerald-400 w-24 text-center"
                  />
                </div>
              </div>

              <p className="text-black bg-white px-2 py-1 border-2 border-black text-center font-bold uppercase tracking-widest">
                {t('gameTheMind.lobby.readyToStart')}
              </p>
              <Button
                onClick={() => startGame()}
                disabled={room.players.filter((p) => p.connected).length < 2}
                className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-xl uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                <Play className="w-6 h-6 mr-2" />
                {t('lobby.startGame')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="text-4xl animate-bounce">⏳</div>
              <div className="text-center text-black bg-white px-4 py-2 border-4 border-black font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                {t('lobby.waitingForHost')}
              </div>
            </div>
          )}
          <div className="border-t-4 border-black pt-4">
            <p className="text-black text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2 bg-white px-2 py-1 border-2 border-black - w-fit shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Users className="w-4 h-4" />
              {t('lobby.playersInRoom')} ({room.players.filter((p) => p.connected).length})
            </p>
            <div className="grid grid-cols-2 gap-4 max-h-32 overflow-y-auto">
              {room.players
                .filter((p) => p.connected)
                .map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center gap-2 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] "
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center text-sm border-2 border-black flex-shrink-0"
                      style={{
                        backgroundColor: player.color || '#fbbf24',
                      }}
                      title={player.name}
                    >
                      {player.avatar || getAvatarEmoji(player.id)}
                    </div>
                    <span className="text-sm font-black uppercase tracking-widest truncate text-black">
                      {player.name} {player.socketId === room.roomHostId && '👑'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!room.theMindState) {
    return room.status === 'LOBBY' ? renderLobby() : null;
  }

  const state = room.theMindState;
  const myHand = (privateState.theMindHand as number[] | undefined) ?? [];
  const canPlay = state.phase === TheMindPhase.PLAYING;
  const shurikenVote = state.shurikenVotes[playerId];
  const isShurikenProposer = state.shurikenProposerId === playerId;
  const blindMistakeIndexes = new Set(state.result?.invalidPlayIndexes ?? []);

  const renderSetup = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full max-w-sm mx-auto p-4">
      <div className="text-center space-y-6 w-full">
        <h2 className="w-full text-4xl font-black text-black uppercase tracking-widest bg-yellow-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] px-6 py-3">
          {t('gameTheMind.game.level')} {state.level}/{state.maxLevel}
        </h2>
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="w-full flex items-center justify-center gap-2 bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-3">
            <Heart className="w-6 h-6 text-black" />
            <span className="font-black text-2xl text-black">{state.lives}</span>
          </div>
          <div className="w-full flex items-center justify-center gap-2 bg-indigo-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-3">
            <Star className="w-6 h-6 text-black" />
            <span className="font-black text-2xl text-black">{state.shuriken}</span>
          </div>
        </div>
        <p className="w-full text-black bg-white border-2 border-black px-4 py-2 font-black text-xl uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameTheMind.game.cardsDealt', { count: state.level })}
        </p>
        <div className="mt-8 w-full">
          {!state.readyPlayers.includes(playerId) ? (
            <Button
              onClick={() => theMindReady()}
              className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black py-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none text-2xl uppercase tracking-widest"
              size="lg"
            >
              <Check className="w-8 h-8 mr-3 stroke-[3]" />
              {t('gameTheMind.game.readyBtn')}
            </Button>
          ) : (
            <div className="w-full text-black bg-emerald-400 font-black text-xl flex items-center justify-center gap-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-5 px-6 uppercase tracking-widest">
              <Check className="w-6 h-6 stroke-[3]" />
              {t('gameTheMind.game.waitingForOthers')}
            </div>
          )}
        </div>
        <p className="text-sm text-black font-bold uppercase tracking-widest bg-white border-2 border-black inline-block px-3 py-1 -">
          {state.readyPlayers.length}/{room.players.filter((p) => p.connected).length}{' '}
          {t('gameTheMind.game.ready')}
        </p>
      </div>
    </div>
  );

  const renderPlaying = () => (
    <div className="flex-1 flex flex-col space-y-4 w-full max-w-2xl mx-auto p-2 sm:p-4">
      <div className="flex items-center justify-between bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-black uppercase tracking-widest bg-yellow-300 border-2 border-black px-2 py-1 -">
            {t('gameTheMind.game.level')} {state.level}/{state.maxLevel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-rose-400 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
            <Heart className="w-5 h-5 text-black fill-black" />
            <span className="font-black text-lg text-black">{state.lives}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-400 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
            <Star className="w-5 h-5 text-black fill-black" />
            <span className="font-black text-lg text-black">{state.shuriken}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {room.players
          .filter((p) => p.connected && p.id !== playerId)
          .map((p) => {
            const handCount = state.handSizes[p.id] ?? 0;
            return (
              <div
                key={p.socketId}
                className="bg-white border-2 border-black px-2 py-1 flex items-center gap-1.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -"
              >
                <span>{p.avatar || getAvatarEmoji(p.id)}</span>
                <span className="font-black uppercase tracking-widest text-black">{p.name}</span>
                <span className="border-2 border-black bg-cyan-300 px-2 py-0.5 font-black text-black text-[10px]">
                  {handCount}
                </span>
              </div>
            );
          })}
      </div>

      {remainingTime !== null && (
        <div
          className={`flex items-center justify-center p-3 border-4 border-black font-black text-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors duration-300 ${remainingTime <= 10 ? 'bg-rose-500 text-black animate-pulse' : 'bg-white text-black'}`}
        >
          ⏱️ {remainingTime}s
        </div>
      )}

      {room.config?.theMindMode === 'EXTREME' ? (
        <div className="flex gap-4">
          <button
            disabled={!canPlay || selectedExtremeCard === null}
            onClick={() => {
              if (canPlay && selectedExtremeCard !== null) {
                theMindPlayCard(selectedExtremeCard, 'UP');
              }
            }}
            className={`flex-1 border-4 border-black p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${canPlay && selectedExtremeCard !== null ? 'bg-cyan-300 hover:bg-cyan-200 cursor-pointer active:translate-y-1 active:shadow-none -' : 'bg-slate-200 opacity-70 cursor-not-allowed'}`}
          >
            <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black ">
              {t('gameTheMind.game.whitePileUp')}
            </p>
            <div className="text-4xl sm:text-5xl font-black text-black leading-none my-2">
              {room.config?.theMindBlindMode ? '?' : state.pileTop}
            </div>
            {canPlay && selectedExtremeCard !== null && (
              <div className="mt-2 text-xs text-black font-black bg-white border-2 border-black px-2 py-1 mx-auto w-fit -">
                {t('gameTheMind.game.playCard', { card: Math.abs(selectedExtremeCard) })}
              </div>
            )}
          </button>
          <button
            disabled={!canPlay || selectedExtremeCard === null}
            onClick={() => {
              if (canPlay && selectedExtremeCard !== null) {
                theMindPlayCard(selectedExtremeCard, 'DOWN');
              }
            }}
            className={`flex-1 border-4 border-black p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${canPlay && selectedExtremeCard !== null ? 'bg-rose-400 hover:bg-rose-300 cursor-pointer active:translate-y-1 active:shadow-none ' : 'bg-slate-200 opacity-70 cursor-not-allowed'}`}
          >
            <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black -">
              {t('gameTheMind.game.redPileDown')}
            </p>
            <div className="text-4xl sm:text-5xl font-black text-black leading-none my-2">
              {room.config?.theMindBlindMode ? '?' : (state.pileTopDOWN ?? 101)}
            </div>
            {canPlay && selectedExtremeCard !== null && (
              <div className="mt-2 text-xs text-black font-black bg-white border-2 border-black px-2 py-1 mx-auto w-fit ">
                {t('gameTheMind.game.playCard', { card: Math.abs(selectedExtremeCard) })}
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-purple-300 border-4 border-black p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
          <p className="text-sm font-black text-black uppercase tracking-widest mb-2 bg-white inline-block px-3 py-1 border-2 border-black -">
            {t('gameTheMind.game.pileTop')}
          </p>
          <div className="text-7xl font-black text-black leading-none my-4">
            {room.config?.theMindBlindMode ? '?' : state.pileTop}
          </div>
          {state.pileTopPlayerId && !room.config?.theMindBlindMode && (
            <p className="mt-2 text-sm text-black font-black uppercase tracking-widest bg-white border-2 border-black inline-block px-2 py-1 ">
              {t('gameTheMind.game.playedBy', {
                name: room.players.find((p) => p.id === state.pileTopPlayerId)?.name || 'Unknown',
              })}
            </p>
          )}
        </div>
      )}

      {state.playedCards && state.playedCards.length > 0 && (
        <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          <h3 className="text-xs font-black text-black uppercase tracking-widest mb-2 bg-yellow-300 inline-block px-2 border-2 border-black ">
            {t('gameTheMind.game.playedCardsLog')}
          </h3>
          <div
            ref={playedCardsContainerRef}
            className="flex gap-2 overflow-x-auto pb-2 scroll-smooth"
          >
            {state.playedCards.map((pc, idx) => {
              const playerName = room.players.find((p) => p.id === pc.playerId)?.name || 'Unknown';
              const isDown = pc.pile === 'DOWN';
              return (
                <div
                  key={idx}
                  className={`flex-shrink-0 border-4 border-black p-2 text-center min-w-[60px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${room.config?.theMindBlindMode ? 'bg-slate-300' : isDown ? 'bg-rose-400' : 'bg-cyan-300'}`}
                >
                  {!room.config?.theMindBlindMode && (
                    <div
                      className="text-[10px] font-black uppercase text-black truncate w-16 bg-white border border-black px-1 mb-1"
                      title={playerName}
                    >
                      {playerName}
                    </div>
                  )}
                  <div className="font-black text-black text-xl">
                    {room.config?.theMindBlindMode ? '?' : Math.abs(pc.card ?? 0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-emerald-400 border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col min-h-0 ">
        <h3 className="text-sm font-black text-black uppercase tracking-widest mb-4 bg-white inline-block px-3 py-1 border-2 border-black w-fit -">
          {t('gameTheMind.game.yourHand')} ({myHand.length})
        </h3>
        <div className="flex flex-wrap gap-3 overflow-y-auto justify-center p-2">
          {myHand.map((card) => {
            const isExtreme = room.config?.theMindMode === 'EXTREME';
            const isPlayable = isExtreme || card === myHand[0];
            const isSelected = isExtreme && selectedExtremeCard === card;
            const displayCard = Math.abs(card);

            let buttonClass = '';
            if (isExtreme) {
              buttonClass = isSelected
                ? 'bg-yellow-300 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] scale-110 - cursor-pointer'
                : 'bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 cursor-pointer';
            } else if (isPlayable && canPlay) {
              buttonClass =
                'bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300 hover:scale-105 hover:- cursor-pointer active:translate-y-1 active:shadow-none transition-all';
            } else if (isPlayable && !canPlay) {
              buttonClass =
                'bg-slate-200 text-slate-500 border-4 border-slate-400 cursor-not-allowed';
            } else {
              buttonClass =
                'bg-slate-300 text-slate-500 border-4 border-slate-400 cursor-not-allowed opacity-80';
            }

            return (
              <button
                key={card}
                onClick={() => {
                  if (canPlay && isExtreme) {
                    setSelectedExtremeCard(card);
                  } else if (canPlay && isPlayable) {
                    theMindPlayCard(card, 'UP');
                  }
                }}
                disabled={!canPlay || !isPlayable}
                aria-pressed={isExtreme ? isSelected : undefined}
                className={`w-16 h-24 font-black text-2xl flex items-center justify-center ${buttonClass}`}
              >
                {displayCard}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-4">
        {state.shuriken > 0 && state.phase !== TheMindPhase.SHURIKEN_VOTE && (
          <Button
            onClick={() => theMindProposeShuriken()}
            variant="outline"
            className="bg-indigo-400 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-indigo-300 font-black px-6 py-6 text-lg uppercase tracking-widest active:translate-y-1 active:shadow-none"
          >
            <Zap className="w-5 h-5 mr-2 stroke-[3]" />
            {t('gameTheMind.game.useShuriken')} ({state.shuriken})
          </Button>
        )}
        {isHost && (
          <Button
            onClick={() => resetRoom()}
            variant="outline"
            className="bg-rose-400 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-rose-300 font-black px-6 py-6 text-lg uppercase tracking-widest - active:translate-y-1 active:shadow-none"
          >
            <RotateCcw className="w-5 h-5 mr-2 stroke-[3]" />
            {t('gameTheMind.game.exitGame')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderShurikenVote = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
      <div className="w-full bg-indigo-400 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden p-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black text-black uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 - shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Zap className="w-6 h-6 inline-block mr-2 stroke-[3]" />
            {t('gameTheMind.game.shurikenVoteTitle')}
          </h2>
        </div>
        <div className="space-y-6 bg-white border-4 border-black p-4 -">
          <p className="text-center text-black font-black text-lg uppercase tracking-widest">
            {isShurikenProposer
              ? t('gameTheMind.game.youProposedShuriken')
              : t('gameTheMind.game.shurikenProposedBy', {
                  name:
                    room.players.find((p) => p.id === state.shurikenProposerId)?.name || 'Unknown',
                })}
          </p>
          <p className="text-center text-sm text-black font-bold border-2 border-black p-2 bg-yellow-300 ">
            {t('gameTheMind.game.shurikenVoteDesc')}
          </p>
          {shurikenVote === undefined ? (
            <div className="flex gap-4 justify-center mt-4">
              <Button
                onClick={() => theMindVoteShuriken(true)}
                className="bg-emerald-400 hover:bg-emerald-300 text-black font-black py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none - uppercase tracking-widest"
              >
                <Check className="w-6 h-6 mr-2 stroke-[3]" />
                {t('gameTheMind.game.agree')}
              </Button>
              <Button
                onClick={() => theMindVoteShuriken(false)}
                variant="outline"
                className="bg-rose-400 hover:bg-rose-300 text-black font-black py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest"
              >
                <X className="w-6 h-6 mr-2 stroke-[3]" />
                {t('gameTheMind.game.disagree')}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div
                className={`font-black text-2xl uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 ${shurikenVote ? 'text-emerald-500' : 'text-rose-500'}`}
              >
                {shurikenVote
                  ? t('gameTheMind.game.votedAgree')
                  : t('gameTheMind.game.votedDisagree')}
              </div>
              <p className="text-sm text-black font-bold uppercase tracking-widest border-2 border-black p-2 bg-cyan-300 -">
                {t('gameTheMind.game.waitingForVotes')} ({Object.keys(state.shurikenVotes).length}/
                {room.players.filter((p) => p.connected).length})
              </p>
            </div>
          )}
          {isShurikenProposer && (
            <Button
              onClick={() => theMindCancelShuriken()}
              variant="outline"
              className="w-full bg-yellow-300 hover:bg-yellow-200 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black py-4 uppercase tracking-widest mt-4 active:translate-y-1 active:shadow-none"
            >
              {t('gameTheMind.game.cancelProposal')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const renderShurikenResult = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <div className="w-full bg-indigo-400 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] - overflow-hidden p-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black text-black uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Zap className="w-6 h-6 inline-block mr-2 stroke-[3]" />
            {t('gameTheMind.game.shurikenResultTitle')}
          </h2>
        </div>
        <div className="space-y-6 bg-white border-4 border-black p-4 ">
          <p className="text-center text-black font-black text-lg uppercase tracking-widest border-2 border-black bg-cyan-300 p-2 -">
            {t('gameTheMind.game.shurikenResultDesc')}
          </p>
          <div className="bg-yellow-300 border-4 border-black p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            {Object.entries(state.discardedCards || {}).map(([pid, cards]) => {
              const player = room.players.find((p) => p.id === pid);
              return (
                <div
                  key={pid}
                  className="flex items-center justify-between text-sm bg-white border-2 border-black px-2 py-1 -"
                >
                  <span className="font-black text-black uppercase tracking-widest">
                    {player?.name || 'Unknown'}
                  </span>
                  <span className="text-black font-black text-lg">[{cards.join(', ')}]</span>
                </div>
              );
            })}
          </div>
          {isHost && (
            <Button
              onClick={() => theMindNextLevel()}
              className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-xl uppercase tracking-widest "
              size="lg"
            >
              <Play className="w-6 h-6 mr-2" />
              {t('gameTheMind.game.resumeLevel')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const renderBlindReveal = () => {
    if (!room.config?.theMindBlindMode || !state.result) return null;

    const revealFinished = revealedCount === state.playedCards.length;

    return (
      <div className="space-y-4 text-left">
        <div className="bg-slate-800 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 -">
          <p className="text-sm font-black text-white mb-2 uppercase tracking-widest text-center bg-black inline-block px-2 py-1 ">
            {t('gameTheMind.game.playedCardsLog')}
          </p>
          <div
            ref={resultCardsContainerRef}
            className="flex gap-2 overflow-x-auto pb-2 scroll-smooth items-center mt-2"
          >
            {state.playedCards.map((pc, idx) => {
              const isRevealed = idx < revealedCount;
              const playerName = room.players.find((p) => p.id === pc.playerId)?.name || 'Unknown';
              const isMistake =
                isRevealed && !state.result?.success && blindMistakeIndexes.has(idx);

              return (
                <div
                  key={idx}
                  className={`flex-shrink-0 border-4 border-black p-2 text-center min-w-[70px] transition-all duration-500 transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    isRevealed
                      ? isMistake
                        ? 'bg-rose-500 scale-110 '
                        : 'bg-white'
                      : 'bg-slate-600 scale-95'
                  }`}
                  style={{
                    transformStyle: 'preserve-3d',
                    perspective: '1000px',
                  }}
                >
                  <div
                    className="w-full h-full transition-transform duration-500"
                    style={{
                      transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)',
                    }}
                  >
                    {isRevealed ? (
                      <>
                        <div
                          className={`text-[10px] uppercase font-black truncate w-16 mb-1 ${isMistake ? 'text-black' : 'text-black'} bg-white border-2 border-black`}
                          title={playerName}
                        >
                          {playerName}
                        </div>
                        <div
                          className={`font-black text-2xl ${isMistake ? 'text-black' : 'text-black'}`}
                        >
                          {Math.abs(pc.card ?? 0)}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-white font-black text-2xl">
                        ?
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {revealFinished && !state.result.success && (
          <div className="bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center animate-in fade-in zoom-in duration-500 ">
            <p className="text-2xl font-black text-black mb-1 uppercase tracking-widest bg-white inline-block px-2 border-2 border-black -">
              {t('gameTheMind.game.mistake')}
            </p>
            <p className="text-sm font-black text-black uppercase tracking-widest mt-2">
              {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
            </p>
          </div>
        )}

        {revealFinished && state.result.success && (
          <p className="text-center text-black font-black text-xl uppercase tracking-widest bg-emerald-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 animate-in fade-in duration-500 ">
            {t('gameTheMind.game.levelCleared')}
          </p>
        )}
      </div>
    );
  };

  const renderLevelResult = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <div className="w-full bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden p-6">
        <div
          className={`border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 text-center py-4 - ${state.result?.success ? 'bg-emerald-400' : 'bg-rose-400'}`}
        >
          <h2 className={`text-2xl font-black text-black uppercase tracking-widest`}>
            {state.result?.success
              ? t('gameTheMind.game.levelComplete')
              : state.result?.isTimeOut
                ? t('gameTheMind.game.timesUp')
                : t('gameTheMind.game.mistake')}
          </h2>
        </div>
        <div className="space-y-6">
          {state.result && !state.result.success && !room.config?.theMindBlindMode && (
            <div className="space-y-6">
              <div className="bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 text-center ">
                <p className="text-sm font-black text-black uppercase tracking-widest mb-2 bg-white inline-block px-2 border-2 border-black -">
                  {t('gameTheMind.game.mistakeBy', {
                    name:
                      room.players.find((p) => p.id === state.result?.failedPlayerId)?.name ||
                      'Unknown',
                  })}
                </p>
                <p className="text-6xl font-black text-black leading-none my-4">{state.pileTop}</p>
                <p className="text-sm font-black text-black uppercase tracking-widest bg-yellow-300 inline-block px-2 border-2 border-black ">
                  {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
                </p>
              </div>

              {Object.keys(state.discardedCards).length > 0 && (
                <div className="bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 -">
                  <p className="text-sm font-black text-black uppercase tracking-widest mb-2 bg-white inline-block px-2 border-2 border-black ">
                    {t('gameTheMind.game.discardedCards')}:
                  </p>
                  <div className="space-y-2 mt-2">
                    {Object.entries(state.discardedCards).map(([pid, cards]) => {
                      const player = room.players.find((p) => p.id === pid);
                      return (
                        <div
                          key={pid}
                          className="flex items-center gap-2 text-sm bg-white border-2 border-black p-2 "
                        >
                          <span className="font-black text-black uppercase tracking-widest">
                            {player?.name || 'Unknown'}:
                          </span>
                          <span className="text-black font-black text-lg">
                            [{cards.map((c) => Math.abs(c)).join(', ')}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {state.lives === 0 && (
                <div className="bg-slate-200 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 ">
                  <p className="text-sm font-black text-black uppercase tracking-widest mb-2 bg-white inline-block px-2 border-2 border-black -">
                    {t('gameTheMind.game.remainingCards')}:
                  </p>
                  <div className="space-y-2 mt-2">
                    {Object.entries(state.remainingHands ?? {}).map(([pid, cards]) => {
                      if (cards.length === 0) return null;
                      const player = room.players.find((p) => p.id === pid);
                      return (
                        <div
                          key={pid}
                          className="flex items-center gap-2 text-sm bg-white border-2 border-black p-2 -"
                        >
                          <span className="font-black text-black uppercase tracking-widest">
                            {player?.name || 'Unknown'}:
                          </span>
                          <span className="text-black font-black text-lg">
                            [{cards.join(', ')}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {renderBlindReveal()}

          {state.result?.success && !room.config?.theMindBlindMode && (
            <div className="text-center">
              <p className="text-center text-black font-black text-2xl uppercase tracking-widest bg-emerald-400 border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - animate-in fade-in duration-500">
                {t('gameTheMind.game.levelCleared')}
              </p>
            </div>
          )}
          {isHost && (
            <Button
              onClick={() => theMindNextLevel()}
              className="w-full bg-cyan-300 hover:bg-cyan-200 text-black font-black py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-xl uppercase tracking-widest mt-6"
              size="lg"
            >
              <Play className="w-6 h-6 mr-2 stroke-[3]" />
              {state.result?.levelCleared
                ? `${t('gameTheMind.game.nextLevel')} ${state.level + 1}`
                : t('gameTheMind.game.resumeLevel')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <div className="w-full bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden p-6">
        <div
          className={`border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 text-center py-4 - ${
            state.level >= state.maxLevel ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
        >
          <h2 className={`text-4xl font-black text-black uppercase tracking-widest`}>
            {state.level >= state.maxLevel
              ? t('gameTheMind.game.youWin')
              : t('gameTheMind.game.gameOver')}
          </h2>
        </div>
        <div className="space-y-6 text-center">
          <div className="space-y-4">
            <p className="text-xl font-black text-black uppercase tracking-widest bg-yellow-300 border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
              {t('gameTheMind.game.levelReached', { level: state.level, max: state.maxLevel })}
            </p>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 -">
                <Heart className="w-6 h-6 text-black fill-black" />
                <span className="font-black text-2xl text-black">{state.lives}</span>
              </div>
              <div className="flex items-center gap-2 bg-indigo-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 ">
                <Star className="w-6 h-6 text-black fill-black" />
                <span className="font-black text-2xl text-black">{state.shuriken}</span>
              </div>
            </div>
          </div>

          {state.result && !state.result.success && !room.config?.theMindBlindMode && (
            <div className="space-y-6">
              <div className="bg-rose-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 text-center -">
                <p className="text-sm font-black text-black uppercase tracking-widest mb-2 bg-white inline-block px-2 border-2 border-black ">
                  {t('gameTheMind.game.mistakeBy', {
                    name:
                      room.players.find((p) => p.id === state.result?.failedPlayerId)?.name ||
                      'Unknown',
                  })}
                </p>
                <p className="text-6xl font-black text-black leading-none my-4">{state.pileTop}</p>
                <p className="text-sm font-black text-black uppercase tracking-widest bg-yellow-300 inline-block px-2 border-2 border-black -">
                  {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
                </p>
              </div>

              {Object.keys(state.discardedCards).length > 0 && (
                <div className="bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 ">
                  <p className="text-sm font-black text-black uppercase tracking-widest mb-2 bg-white inline-block px-2 border-2 border-black -">
                    {t('gameTheMind.game.discardedCards')}:
                  </p>
                  <div className="space-y-2 mt-2">
                    {Object.entries(state.discardedCards).map(([pid, cards]) => {
                      const player = room.players.find((p) => p.id === pid);
                      return (
                        <div
                          key={pid}
                          className="flex items-center gap-2 text-sm bg-white border-2 border-black p-2 -"
                        >
                          <span className="font-black text-black uppercase tracking-widest">
                            {player?.name || 'Unknown'}:
                          </span>
                          <span className="text-black font-black text-lg">
                            [{cards.map((c) => Math.abs(c)).join(', ')}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {renderBlindReveal()}

          <div className="border-t-4 border-black pt-6 mt-6">
            <p className="text-black text-lg font-black uppercase tracking-widest mb-4 bg-cyan-300 border-2 border-black inline-block px-3 py-1 -">
              {t('gameTheMind.game.finalScores')}
            </p>
            <div className="space-y-3">
              {[...room.players]
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 "
                  >
                    <span className="font-black text-black uppercase tracking-widest text-left">
                      {player.name}
                      {player.id === playerId && ` (${t('lobby.you')})`}
                    </span>
                    <span className="font-black text-2xl text-black bg-yellow-300 px-2 border-2 border-black -">
                      {player.score}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          {isHost && (
            <Button
              onClick={() => resetRoom()}
              className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-xl uppercase tracking-widest - mt-6"
              size="lg"
            >
              <RotateCcw className="w-6 h-6 mr-2 stroke-[3]" />
              {t('result.playAgain')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const phaseToRender = displayPhase || state.phase;

  switch (phaseToRender) {
    case TheMindPhase.LOBBY:
    case TheMindPhase.SETUP:
      return state.level === 1 && state.phase === TheMindPhase.LOBBY
        ? renderLobby()
        : renderSetup();
    case TheMindPhase.PLAYING:
      return renderPlaying();
    case TheMindPhase.SHURIKEN_VOTE:
      return renderShurikenVote();
    case TheMindPhase.SHURIKEN_RESULT:
      return renderShurikenResult();
    case TheMindPhase.LEVEL_RESULT:
      return renderLevelResult();
    case TheMindPhase.GAME_OVER:
      return renderGameOver();
    default:
      return renderSetup();
  }
}
