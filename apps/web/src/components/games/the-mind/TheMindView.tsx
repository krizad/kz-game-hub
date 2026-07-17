'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { getAvatarEmoji } from '@/components/core/utils';
import { toast } from 'react-hot-toast';
import { GameType, getTheMindInvalidPlayIndexes, TheMindPhase } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Heart, Star, Users, RotateCcw, Zap, Check, X, EyeOff } from 'lucide-react';

const THE_MIND_RESULT_TOAST_ID = 'the-mind-result';

export function TheMindView() {
  const {
    room,
    socket,
    socketId,
    playerId: storedPlayerId,
    myName,
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
    const currentHand = room?.theMindState?.playerHands[playerId] ?? [];
    if (selectedExtremeCard !== null && !currentHand.includes(selectedExtremeCard)) {
      setSelectedExtremeCard(null);
    }
  }, [room?.theMindState?.playerHands, playerId, selectedExtremeCard]);

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
        child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [revealedCount]);

  if (!room || room.gameType !== GameType.THE_MIND) return null;

  const isHost = room.roomHostId === socketId;

  const renderLobby = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
      <Card className="w-full bg-white border border-amber-200 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-indigo-50 border-b border-indigo-200 pb-4 pt-6">
          <CardTitle className="text-2xl font-black text-center text-indigo-600 uppercase tracking-widest">
            {t('gameTheMind.lobby.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isHost ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full space-y-4 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-slate-700 font-bold">
                    <Heart className="w-5 h-5 text-rose-500" />
                    {t('gameTheMind.lobby.startingLives')}
                  </label>
                  <input
                    aria-label={t('gameTheMind.lobby.startingLives')}
                    type="number"
                    className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-slate-700"
                    value={
                      room.config?.theMindStartingLives ??
                      room.players.filter((p) => p.connected).length
                    }
                    onChange={(e) =>
                      socket?.emit('update_config', {
                        code: room.code,
                        config: { theMindStartingLives: parseInt(e.target.value) },
                      })
                    }
                    min={1}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-slate-700 font-bold">
                    <Star className="w-5 h-5 text-indigo-500" />
                    {t('gameTheMind.lobby.startingShurikens')}
                  </label>
                  <input
                    aria-label={t('gameTheMind.lobby.startingShurikens')}
                    type="number"
                    className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-slate-700"
                    value={room.config?.theMindStartingShurikens ?? 1}
                    onChange={(e) =>
                      socket?.emit('update_config', {
                        code: room.code,
                        config: { theMindStartingShurikens: parseInt(e.target.value) },
                      })
                    }
                    min={0}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-slate-700 font-bold">
                    <EyeOff className="w-5 h-5 text-slate-600" />
                    {t('gameTheMind.lobby.blindMode')}
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={room.config?.theMindBlindMode ?? false}
                      onChange={(e) =>
                        socket?.emit('update_config', {
                          code: room.code,
                          config: { theMindBlindMode: e.target.checked },
                        })
                      }
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-slate-700 font-bold">
                    <span className="text-xl">🔥</span>
                    {t('gameTheMind.lobby.gameMode')}
                  </label>
                  <select
                    className="bg-white border border-slate-300 rounded-lg p-1 text-sm font-bold text-slate-700"
                    value={room.config?.theMindMode ?? 'NORMAL'}
                    onChange={(e) =>
                      socket?.emit('update_config', {
                        code: room.code,
                        config: { theMindMode: e.target.value },
                      })
                    }
                  >
                    <option value="NORMAL">{t('gameTheMind.lobby.modeNormal') || 'Normal'}</option>
                    <option value="EXTREME">
                      {t('gameTheMind.lobby.modeExtreme') || 'Extreme'}
                    </option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-slate-700 font-bold">
                    <span className="text-xl">⏱️</span>
                    {t('gameTheMind.lobby.timeAttack')}
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={room.config?.theMindTimeAttack ?? false}
                      onChange={(e) =>
                        socket?.emit('update_config', {
                          code: room.code,
                          config: { theMindTimeAttack: e.target.checked },
                        })
                      }
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-slate-700 font-bold">
                    <span className="text-xl">🏆</span>
                    {t('gameTheMind.lobby.maxLevel')}
                  </label>
                  <select
                    className="bg-white border border-slate-300 rounded-lg p-1 text-sm font-bold text-slate-700 w-20 text-center"
                    value={room.config?.theMindMaxLevel ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                      socket?.emit('update_config', {
                        code: room.code,
                        config: { theMindMaxLevel: val },
                      });
                    }}
                  >
                    <option value="">Auto</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-slate-600 text-center font-medium mt-2">
                {t('gameTheMind.lobby.readyToStart')}
              </p>
              <Button
                onClick={() => socket?.emit('start_game', { code: room.code })}
                disabled={room.players.filter((p) => p.connected).length < 2}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
                size="lg"
              >
                <Play className="w-6 h-6 mr-2" />
                {t('lobby.startGame')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <div className="text-center text-slate-500 font-medium animate-pulse">
                {t('lobby.waitingForHost')}
              </div>
            </div>
          )}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-slate-500 text-sm font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('lobby.playersInRoom')} ({room.players.filter((p) => p.connected).length})
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {room.players
                .filter((p) => p.connected)
                .map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-sm shadow-inner flex-shrink-0 border"
                      style={{
                        backgroundColor: player.color ? `${player.color}22` : '#e0e7ff',
                        borderColor: player.color || '#c7d2fe',
                      }}
                      title={player.name}
                    >
                      {player.avatar || getAvatarEmoji(player.id)}
                    </div>
                    <span
                      className="text-sm font-medium truncate"
                      style={{
                        color: player.color || '#334155',
                        fontWeight: player.color ? 800 : 500,
                      }}
                    >
                      {player.name} {player.socketId === room.roomHostId && '👑'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!room.theMindState) {
    return room.status === 'LOBBY' ? renderLobby() : null;
  }

  const state = room.theMindState;
  const myHand = state.playerHands[playerId] || [];
  const canPlay = state.phase === TheMindPhase.PLAYING;
  const shurikenVote = state.shurikenVotes[playerId];
  const isShurikenProposer = state.shurikenProposerId === playerId;
  const blindMistakeIndexes = new Set(
    getTheMindInvalidPlayIndexes(
      state.playedCards,
      room.config?.theMindMode === 'EXTREME' ? 'EXTREME' : 'NORMAL',
    ),
  );

  const renderSetup = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full max-w-lg mx-auto p-4">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-black text-indigo-600 uppercase tracking-widest">
          {t('gameTheMind.game.level')} {state.level}/{state.maxLevel}
        </h2>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
            <Heart className="w-5 h-5 text-rose-500" />
            <span className="font-black text-xl text-rose-600">{state.lives}</span>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
            <Star className="w-5 h-5 text-indigo-500" />
            <span className="font-black text-xl text-indigo-600">{state.shuriken}</span>
          </div>
        </div>
        <p className="text-slate-500 font-medium text-lg">
          {t('gameTheMind.game.cardsDealt', { count: state.level })}
        </p>
        {!state.readyPlayers.includes(playerId) ? (
          <Button
            onClick={() => theMindReady()}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg active:scale-95 text-lg"
            size="lg"
          >
            <Check className="w-5 h-5 mr-2" />
            {t('gameTheMind.game.readyBtn')}
          </Button>
        ) : (
          <div className="text-green-600 font-bold text-lg flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            {t('gameTheMind.game.waitingForOthers')}
          </div>
        )}
        <p className="text-sm text-slate-400">
          {state.readyPlayers.length}/{room.players.filter((p) => p.connected).length}{' '}
          {t('gameTheMind.game.ready')}
        </p>
      </div>
    </div>
  );

  const renderPlaying = () => (
    <div className="flex-1 flex flex-col space-y-3 w-full max-w-2xl mx-auto p-2 sm:p-4">
      <div className="flex items-center justify-between bg-white border border-amber-200 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 uppercase">
            {t('gameTheMind.game.level')} {state.level}/{state.maxLevel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="font-black text-lg text-rose-600">{state.lives}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-indigo-500" />
            <span className="font-black text-lg text-indigo-600">{state.shuriken}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {room.players
          .filter((p) => p.connected && p.id !== playerId)
          .map((p) => {
            const handCount = state.playerHands[p.id]?.length || 0;
            return (
              <div
                key={p.socketId}
                className="bg-white border rounded-lg px-2 py-1 flex items-center gap-1.5 text-xs shadow-sm"
                style={{ borderColor: p.color ? `${p.color}44` : '#e2e8f0' }}
              >
                <span>{p.avatar || getAvatarEmoji(p.id)}</span>
                <span className="font-bold" style={{ color: p.color || '#475569' }}>
                  {p.name}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-black text-[10px]"
                  style={{
                    backgroundColor: p.color ? `${p.color}11` : '#e0e7ff',
                    color: p.color || '#4338ca',
                  }}
                >
                  {handCount}
                </span>
              </div>
            );
          })}
      </div>

      {remainingTime !== null && (
        <div
          className={`flex items-center justify-center p-3 rounded-2xl border-2 font-black text-3xl shadow-sm transition-colors duration-300 ${remainingTime <= 10 ? 'bg-rose-100 text-rose-600 border-rose-300 animate-pulse' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
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
            className={`flex-1 border-2 rounded-2xl p-4 text-center shadow-sm transition-all ${canPlay && selectedExtremeCard !== null ? 'bg-indigo-50 border-indigo-400 hover:bg-indigo-100 cursor-pointer active:scale-95' : 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'}`}
          >
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
              White Pile (UP)
            </p>
            <span className="text-4xl sm:text-5xl font-black text-indigo-600 leading-none">
              {room.config?.theMindBlindMode && state.pileTop > 0 ? '?' : state.pileTop}
            </span>
            {canPlay && selectedExtremeCard !== null && (
              <div className="mt-2 text-xs text-indigo-500 font-bold bg-indigo-100 rounded-full px-2 py-1 mx-auto w-fit">
                Play {Math.abs(selectedExtremeCard)}
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
            className={`flex-1 border-2 rounded-2xl p-4 text-center shadow-sm transition-all ${canPlay && selectedExtremeCard !== null ? 'bg-rose-50 border-rose-400 hover:bg-rose-100 cursor-pointer active:scale-95' : 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'}`}
          >
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">
              Red Pile (DOWN)
            </p>
            <span className="text-4xl sm:text-5xl font-black text-rose-600 leading-none">
              {room.config?.theMindBlindMode ? '?' : (state.pileTopDOWN ?? 101)}
            </span>
            {canPlay && selectedExtremeCard !== null && (
              <div className="mt-2 text-xs text-rose-500 font-bold bg-rose-100 rounded-full px-2 py-1 mx-auto w-fit">
                Play {Math.abs(selectedExtremeCard)}
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">
            {t('gameTheMind.game.pileTop')}
          </p>
          <span className="text-5xl font-black text-indigo-600 leading-none">
            {room.config?.theMindBlindMode && state.pileTop > 0 ? '?' : state.pileTop}
          </span>
          {state.pileTopPlayerId && !room.config?.theMindBlindMode && (
            <p className="mt-2 text-sm text-indigo-500 font-medium">
              {t('gameTheMind.game.playedBy', {
                name: room.players.find((p) => p.id === state.pileTopPlayerId)?.name || 'Unknown',
              })}
            </p>
          )}
        </div>
      )}

      {state.playedCards && state.playedCards.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            {t('gameTheMind.game.playedCardsLog')}
          </h3>
          <div
            ref={playedCardsContainerRef}
            className="flex gap-2 overflow-x-auto pb-1 scroll-smooth"
          >
            {state.playedCards.map((pc, idx) => {
              const playerName = room.players.find((p) => p.id === pc.playerId)?.name || 'Unknown';
              const isDown = pc.pile === 'DOWN';
              return (
                <div
                  key={idx}
                  className={`flex-shrink-0 border rounded-lg p-2 text-center min-w-[60px] ${room.config?.theMindBlindMode ? 'bg-slate-800 border-slate-700' : isDown ? 'bg-rose-50 border-rose-200' : 'bg-white border-indigo-200'}`}
                >
                  {!room.config?.theMindBlindMode && (
                    <div className="text-xs text-slate-400 truncate w-16" title={playerName}>
                      {playerName}
                    </div>
                  )}
                  <div
                    className={`font-bold ${room.config?.theMindBlindMode ? 'text-slate-500' : isDown ? 'text-rose-600' : 'text-indigo-600'}`}
                  >
                    {room.config?.theMindBlindMode ? '?' : Math.abs(pc.card)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-amber-200 rounded-2xl p-3 shadow-sm flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
          {t('gameTheMind.game.yourHand')} ({myHand.length})
        </h3>
        <div className="flex flex-wrap gap-2 overflow-y-auto justify-center p-1">
          {myHand.map((card) => {
            const isExtreme = room.config?.theMindMode === 'EXTREME';
            const isPlayable = isExtreme || card === myHand[0];
            const isSelected = isExtreme && selectedExtremeCard === card;
            const displayCard = Math.abs(card);

            let buttonClass = '';
            if (isExtreme) {
              buttonClass = isSelected
                ? 'bg-amber-300 text-slate-900 border-amber-500 shadow-lg scale-105 cursor-pointer'
                : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500 cursor-pointer';
            } else if (isPlayable && canPlay) {
              buttonClass =
                'bg-indigo-600 text-white border-indigo-700 shadow-lg hover:bg-indigo-500 hover:scale-105 cursor-pointer';
            } else if (isPlayable && !canPlay) {
              buttonClass = 'bg-indigo-200 text-indigo-400 border-indigo-300 cursor-not-allowed';
            } else {
              buttonClass =
                'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60';
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
                className={`w-16 h-20 rounded-xl font-black text-xl transition-all duration-200 border-2 ${buttonClass}`}
              >
                {displayCard}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {state.shuriken > 0 && state.phase !== TheMindPhase.SHURIKEN_VOTE && (
          <Button
            onClick={() => theMindProposeShuriken()}
            variant="outline"
            className="border-indigo-200 text-indigo-500 hover:bg-indigo-50 font-bold rounded-xl shadow-sm"
          >
            <Zap className="w-4 h-4 mr-2" />
            {t('gameTheMind.game.useShuriken')} ({state.shuriken})
          </Button>
        )}
        {isHost && (
          <Button
            onClick={() => socket?.emit('reset_game', { code: room.code })}
            variant="outline"
            className="border-rose-200 text-rose-500 hover:bg-rose-50 font-bold rounded-xl shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('gameTheMind.game.exitGame')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderShurikenVote = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
      <Card className="w-full bg-white border border-indigo-200 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-indigo-50 border-b border-indigo-200 pb-4 pt-6">
          <CardTitle className="text-xl font-black text-center text-indigo-600 uppercase tracking-widest">
            <Zap className="w-6 h-6 inline-block mr-2" />
            {t('gameTheMind.game.shurikenVoteTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <p className="text-center text-slate-600 font-medium">
            {isShurikenProposer
              ? t('gameTheMind.game.youProposedShuriken')
              : t('gameTheMind.game.shurikenProposedBy', {
                  name:
                    room.players.find((p) => p.id === state.shurikenProposerId)?.name || 'Unknown',
                })}
          </p>
          <p className="text-center text-sm text-slate-400">
            {t('gameTheMind.game.shurikenVoteDesc')}
          </p>
          {shurikenVote === undefined ? (
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => theMindVoteShuriken(true)}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg active:scale-95"
              >
                <Check className="w-5 h-5 mr-2" />
                {t('gameTheMind.game.agree')}
              </Button>
              <Button
                onClick={() => theMindVoteShuriken(false)}
                variant="outline"
                className="border-rose-200 text-rose-500 hover:bg-rose-50 font-bold py-4 px-8 rounded-xl transition-all shadow-sm"
              >
                <X className="w-5 h-5 mr-2" />
                {t('gameTheMind.game.disagree')}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div
                className={shurikenVote ? 'text-green-600 font-bold' : 'text-rose-500 font-bold'}
              >
                {shurikenVote
                  ? t('gameTheMind.game.votedAgree')
                  : t('gameTheMind.game.votedDisagree')}
              </div>
              <p className="text-sm text-slate-400">
                {t('gameTheMind.game.waitingForVotes')} ({Object.keys(state.shurikenVotes).length}/
                {room.players.filter((p) => p.connected).length})
              </p>
            </div>
          )}
          {isShurikenProposer && (
            <Button
              onClick={() => theMindCancelShuriken()}
              variant="outline"
              className="w-full border-amber-200 text-amber-600 hover:bg-amber-50 font-bold"
            >
              {t('gameTheMind.game.cancelProposal')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderShurikenResult = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <Card className="w-full bg-white border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-indigo-50 border-b border-indigo-200 pb-4 pt-6">
          <CardTitle className="text-2xl font-black text-center text-indigo-600 uppercase tracking-widest">
            <Zap className="w-6 h-6 inline-block mr-2" />
            {t('gameTheMind.game.shurikenResultTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <p className="text-center text-slate-600 font-medium">
            {t('gameTheMind.game.shurikenResultDesc')}
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            {Object.entries(state.discardedCards || {}).map(([pid, cards]) => {
              const player = room.players.find((p) => p.id === pid);
              return (
                <div key={pid} className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">{player?.name || 'Unknown'}</span>
                  <span className="text-indigo-600 font-black">[{cards.join(', ')}]</span>
                </div>
              );
            })}
          </div>
          {isHost && (
            <Button
              onClick={() => theMindNextLevel()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
              size="lg"
            >
              <Play className="w-6 h-6 mr-2" />
              {t('gameTheMind.game.resumeLevel')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderLevelResult = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <Card className="w-full bg-white border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader
          className={`border-b pb-4 pt-6 ${state.result?.success ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}
        >
          <CardTitle
            className={`text-2xl font-black text-center uppercase tracking-widest ${state.result?.success ? 'text-green-600' : 'text-rose-600'}`}
          >
            {state.result?.success
              ? t('gameTheMind.game.levelComplete')
              : state.result?.isTimeOut
                ? "TIME'S UP!"
                : t('gameTheMind.game.mistake')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {state.result && !state.result.success && !room.config?.theMindBlindMode && (
            <div className="space-y-4">
              <div className="bg-rose-100 border border-rose-300 rounded-xl p-4 text-center">
                <p className="text-sm font-bold text-rose-700 mb-1">
                  {t('gameTheMind.game.mistakeBy', {
                    name:
                      room.players.find((p) => p.id === state.result?.failedPlayerId)?.name ||
                      'Unknown',
                  })}
                </p>
                <p className="text-4xl font-black text-rose-800 leading-none my-2">
                  {state.pileTop}
                </p>
                <p className="text-sm font-medium text-rose-600">
                  {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
                </p>
              </div>

              {Object.keys(state.discardedCards).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-700 mb-2">
                    {t('gameTheMind.game.discardedCards')}:
                  </p>
                  {Object.entries(state.discardedCards).map(([pid, cards]) => {
                    const player = room.players.find((p) => p.id === pid);
                    return (
                      <div key={pid} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">
                          {player?.name || 'Unknown'}:
                        </span>
                        <span className="text-slate-500 font-bold">
                          [{cards.map((c) => Math.abs(c)).join(', ')}]
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {state.lives === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-700 mb-2">
                    {t('gameTheMind.game.remainingCards')}:
                  </p>
                  {Object.entries(state.playerHands).map(([pid, cards]) => {
                    if (cards.length === 0) return null;
                    const player = room.players.find((p) => p.id === pid);
                    return (
                      <div key={pid} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">
                          {player?.name || 'Unknown'}:
                        </span>
                        <span className="text-indigo-600 font-bold">[{cards.join(', ')}]</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {room.config?.theMindBlindMode && (
            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-sm font-bold text-slate-300 mb-2 uppercase tracking-widest text-center">
                  {t('gameTheMind.game.playedCardsLog')}
                </p>
                <div
                  ref={resultCardsContainerRef}
                  className="flex gap-2 overflow-x-auto pb-2 scroll-smooth items-center"
                >
                  {state.playedCards.map((pc, idx) => {
                    const isRevealed = idx < revealedCount;
                    const playerName =
                      room.players.find((p) => p.id === pc.playerId)?.name || 'Unknown';
                    const isMistake =
                      isRevealed && !state.result?.success && blindMistakeIndexes.has(idx);

                    return (
                      <div
                        key={idx}
                        className={`flex-shrink-0 border-2 rounded-lg p-2 text-center min-w-[70px] transition-all duration-500 transform ${
                          isRevealed
                            ? isMistake
                              ? 'bg-rose-100 border-rose-500 scale-110 shadow-lg rotate-3'
                              : 'bg-white border-slate-200'
                            : 'bg-slate-700 border-slate-600 scale-95'
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
                                className={`text-[10px] truncate w-16 mb-1 ${isMistake ? 'text-rose-600 font-bold' : 'text-slate-400'}`}
                                title={playerName}
                              >
                                {playerName}
                              </div>
                              <div
                                className={`font-black text-xl ${isMistake ? 'text-rose-700' : 'text-indigo-600'}`}
                              >
                                {Math.abs(pc.card)}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 font-black text-xl">
                              ?
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {revealedCount === state.playedCards.length &&
                state.result &&
                !state.result.success && (
                  <div className="bg-rose-100 border border-rose-300 rounded-xl p-4 text-center animate-in fade-in zoom-in duration-500">
                    <p className="text-xl font-black text-rose-700 mb-1">
                      {t('gameTheMind.game.mistake')}
                    </p>
                    <p className="text-sm font-medium text-rose-600">
                      {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
                    </p>
                  </div>
                )}
            </div>
          )}

          {state.result?.success &&
            (!room.config?.theMindBlindMode || revealedCount === state.playedCards.length) && (
              <p className="text-center text-slate-600 font-medium text-lg animate-in fade-in duration-500">
                {t('gameTheMind.game.levelCleared')}
              </p>
            )}
          {isHost && (
            <Button
              onClick={() => theMindNextLevel()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
              size="lg"
            >
              <Play className="w-6 h-6 mr-2" />
              {state.result?.levelCleared
                ? `${t('gameTheMind.game.nextLevel')} ${state.level + 1}`
                : t('gameTheMind.game.resumeLevel')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <Card className="w-full bg-white border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader
          className={
            state.level >= state.maxLevel
              ? 'bg-green-50 border-b border-green-200 pb-4 pt-6'
              : 'bg-rose-50 border-b border-rose-200 pb-4 pt-6'
          }
        >
          <CardTitle
            className={`text-3xl font-black text-center uppercase tracking-widest ${state.level >= state.maxLevel ? 'text-green-600' : 'text-rose-600'}`}
          >
            {state.level >= state.maxLevel
              ? t('gameTheMind.game.youWin')
              : t('gameTheMind.game.gameOver')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 text-center">
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-600">
              {t('gameTheMind.game.levelReached', { level: state.level, max: state.maxLevel })}
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <Heart className="w-5 h-5 text-rose-500" />
                <span className="font-black text-xl text-rose-600">{state.lives}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-indigo-500" />
                <span className="font-black text-xl text-indigo-600">{state.shuriken}</span>
              </div>
            </div>
          </div>

          {state.result && !state.result.success && !room.config?.theMindBlindMode && (
            <div className="space-y-4">
              <div className="bg-rose-100 border border-rose-300 rounded-xl p-4 text-center">
                <p className="text-sm font-bold text-rose-700 mb-1">
                  {t('gameTheMind.game.mistakeBy', {
                    name:
                      room.players.find((p) => p.id === state.result?.failedPlayerId)?.name ||
                      'Unknown',
                  })}
                </p>
                <p className="text-4xl font-black text-rose-800 leading-none my-2">
                  {state.pileTop}
                </p>
                <p className="text-sm font-medium text-rose-600">
                  {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
                </p>
              </div>

              {Object.keys(state.discardedCards).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-700 mb-2">
                    {t('gameTheMind.game.discardedCards')}:
                  </p>
                  {Object.entries(state.discardedCards).map(([pid, cards]) => {
                    const player = room.players.find((p) => p.id === pid);
                    return (
                      <div key={pid} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">
                          {player?.name || 'Unknown'}:
                        </span>
                        <span className="text-slate-500 font-bold">
                          [{cards.map((c) => Math.abs(c)).join(', ')}]
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              {t('gameTheMind.game.finalScores')}
            </p>
            <div className="space-y-2">
              {[...room.players]
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700">
                      {player.name}
                      {player.id === playerId && ` (${t('lobby.you')})`}
                    </span>
                    <span className="font-black text-indigo-600">{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
          {isHost && (
            <Button
              onClick={() => socket?.emit('reset_game', { code: room.code })}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
              size="lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              {t('result.playAgain')}
            </Button>
          )}
        </CardContent>
      </Card>
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
