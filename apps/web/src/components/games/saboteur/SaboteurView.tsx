'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RoomStatus,
  SaboteurActionKind,
  SaboteurPhase,
  SaboteurRole,
  SaboteurTool,
  SABOTEUR_BOARD_BOUNDS,
  saboteurCellKey,
  saboteurGetCardDef,
  saboteurSimulatePlacement,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { getAvatarEmoji } from '@/components/core/utils';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import clsx from 'clsx';
import { ActionCardFace, GoldNuggetValue, GoalRevealFace, PathTileSvg } from './PathTileSvg';

type Targeting = 'BREAK' | 'REPAIR' | 'MAP' | 'ROCKFALL' | null;

const TOOL_ICONS: Record<SaboteurTool, string> = {
  [SaboteurTool.LANTERN]: '🔦',
  [SaboteurTool.CART]: '🛒',
  [SaboteurTool.PICKAXE]: '⛏️',
};

export function SaboteurView() {
  const {
    room,
    socketId,
    privateState,
    actionLoading,
    saboteurPlacePath,
    saboteurPlayAction,
    saboteurDiscard,
    saboteurPickGold,
    saboteurNextRound,
    saboteurReset,
  } = useGameStore();
  const { t } = useTranslate();

  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState<0 | 180>(0);
  const [targeting, setTargeting] = useState<Targeting>(null);

  const state = room?.saboteurState;
  if (!room || !state) return null;

  const myHand = (privateState.sbHand as Array<{ cardId: string }> | undefined) ?? [];
  const peekedGoals =
    (privateState.sbPeekedGoals as Record<string, 'GOLD' | 'STONE'> | undefined) ?? {};

  const isHost = room.roomHostId === socketId;
  const me = state.players[socketId];
  const isMyTurn =
    state.currentPhase === SaboteurPhase.PLAYING &&
    state.activePlayerId === socketId &&
    room.status === RoomStatus.PLAYING;

  const selectedCard =
    selectedCardIndex !== null && selectedCardIndex < myHand.length
      ? myHand[selectedCardIndex]
      : undefined;
  const selectedDef = selectedCard ? saboteurGetCardDef(selectedCard.cardId) : undefined;

  // Cheap enough to recompute per render (9×5 grid).
  const toolsBroken = (me?.brokenTools.length ?? 0) > 0;
  const validPlacements = (() => {
    if (!isMyTurn || !selectedDef || selectedDef.kind !== 'PATH' || toolsBroken) {
      return new Set<string>();
    }
    const keys = new Set<string>();
    const { minX, maxX, minY, maxY } = SABOTEUR_BOARD_BOUNDS;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (saboteurSimulatePlacement(state.board, x, y, selectedDef.id, rotation).valid) {
          keys.add(saboteurCellKey(x, y));
        }
      }
    }
    return keys;
  })();

  const playerName = (id: string) => room.players.find((p) => p.socketId === id)?.name ?? id;
  const playerAvatar = (id: string) => getAvatarEmoji(playerName(id));

  const resetSelection = () => {
    setSelectedCardIndex(null);
    setRotation(0);
    setTargeting(null);
  };

  const handleHandClick = (index: number) => {
    if (!isMyTurn || actionLoading) return;
    if (selectedCardIndex === index) {
      resetSelection();
      return;
    }
    setSelectedCardIndex(index);
    setRotation(0);
    const def = saboteurGetCardDef(myHand[index].cardId);
    if (def?.kind === 'ACTION' && def.action) {
      switch (def.action.kind) {
        case SaboteurActionKind.BREAK:
          setTargeting('BREAK');
          break;
        case SaboteurActionKind.REPAIR:
          setTargeting('REPAIR');
          break;
        case SaboteurActionKind.MAP:
          setTargeting('MAP');
          break;
        case SaboteurActionKind.ROCKFALL:
          setTargeting('ROCKFALL');
          break;
      }
    } else {
      setTargeting(null);
    }
  };

  const handleBoardCellClick = (x: number, y: number) => {
    if (!isMyTurn || actionLoading || selectedCardIndex === null) return;
    const key = saboteurCellKey(x, y);

    if (targeting === 'ROCKFALL') {
      saboteurPlayAction({ cardIndex: selectedCardIndex, targetX: x, targetY: y });
      resetSelection();
      return;
    }
    if (targeting === 'MAP' && state.board[key]?.cardId === 'goal') {
      const goalIndex = state.goalCells.findIndex((g) => g.x === x && g.y === y);
      if (goalIndex >= 0) {
        saboteurPlayAction({ cardIndex: selectedCardIndex, goalIndex });
        resetSelection();
      }
      return;
    }
    if (selectedDef?.kind === 'PATH' && validPlacements.has(key)) {
      saboteurPlacePath(selectedCardIndex, x, y, rotation);
      resetSelection();
    }
  };

  const handlePlayerClick = (targetPlayerId: string) => {
    if (!isMyTurn || actionLoading || selectedCardIndex === null) return;
    if (targeting !== 'BREAK' && targeting !== 'REPAIR') return;
    if (targetPlayerId === socketId && targeting === 'BREAK') return; // pointless self-break
    saboteurPlayAction({
      cardIndex: selectedCardIndex,
      targetPlayerId,
    });
    resetSelection();
  };

  const handleGoalBadgeClick = (goalIndex: number) => {
    if (!isMyTurn || actionLoading || targeting !== 'MAP' || selectedCardIndex === null) return;
    saboteurPlayAction({ cardIndex: selectedCardIndex, goalIndex });
    resetSelection();
  };

  // ---------- Sub renders ----------

  const renderBoard = () => {
    const cells = [];
    for (let y = SABOTEUR_BOARD_BOUNDS.minY; y <= SABOTEUR_BOARD_BOUNDS.maxY; y++) {
      for (let x = SABOTEUR_BOARD_BOUNDS.minX; x <= SABOTEUR_BOARD_BOUNDS.maxX; x++) {
        const key = saboteurCellKey(x, y);
        const cell = state.board[key];
        const isGoal = cell?.cardId === 'goal';
        const goalIndex = isGoal ? state.goalCells.findIndex((g) => g.x === x && g.y === y) : -1;
        const highlighted =
          (targeting === 'ROCKFALL' && !!cell && !isGoal && cell.cardId !== 'start') ||
          (targeting === 'MAP' && isGoal) ||
          validPlacements.has(key);
        const peek = goalIndex >= 0 ? peekedGoals[String(goalIndex)] : undefined;

        cells.push(
          <button
            key={key}
            data-testid={`saboteur-cell-${key}`}
            onClick={() => handleBoardCellClick(x, y)}
            disabled={!highlighted}
            className={clsx(
              'relative aspect-square rounded-md overflow-hidden transition-all border-2',
              cell ? 'border-black/60' : 'border-dashed border-amber-900/30 bg-[#92400e]/40',
              highlighted && 'ring-4 ring-lime-400 z-10 scale-[1.06] cursor-pointer shadow-lg',
            )}
            title={cell ? `${cell.cardId}` : ''}
          >
            {cell ? (
              isGoal && state.revealedGoals[goalIndex] ? (
                <GoalRevealFace content={state.revealedGoals[goalIndex]!} />
              ) : (
                <PathTileSvg
                  cardId={cell.cardId}
                  rotation={cell.rotation}
                  className="w-full h-full"
                />
              )
            ) : null}
            {peek && goalIndex >= 0 && !state.revealedGoals[goalIndex] && (
              <span className="absolute bottom-0 right-0 text-[10px] bg-white/90 rounded px-0.5 leading-tight">
                {peek === 'GOLD' ? '💰' : '🪨'}
              </span>
            )}
          </button>,
        );
      }
    }
    return (
      <div
        className="grid gap-1 sm:gap-1.5 bg-[#78350f] p-2 sm:p-3 border-4 border-black shadow-[6px_6px_0_0_#000]"
        style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}
      >
        {cells}
      </div>
    );
  };

  const renderPlayers = () =>
    Object.values(state.players).map((player) => {
      const isTargetable =
        isMyTurn &&
        (targeting === 'BREAK' || targeting === 'REPAIR') &&
        !(targeting === 'BREAK' && player.id === socketId);
      return (
        <button
          key={player.id}
          onClick={() => handlePlayerClick(player.id)}
          disabled={!isTargetable}
          className={clsx(
            'w-full flex items-center gap-2 bg-white border-4 border-black shadow-[3px_3px_0_0_#000] px-2 py-1.5 text-left',
            player.id === state.activePlayerId && 'bg-lime-200',
            isTargetable && 'hover:bg-yellow-200 cursor-pointer ring-2 ring-purple-500',
          )}
        >
          <span className="text-lg leading-none">{playerAvatar(player.id)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black truncate">
              {playerName(player.id)}
              {player.id === socketId && ' (You)'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(Object.values(SaboteurTool) as SaboteurTool[]).map((tool) => {
                const broken = player.brokenTools.includes(tool);
                return (
                  <span
                    key={tool}
                    className={clsx(
                      'text-xs leading-none px-0.5 rounded',
                      broken &&
                        'opacity-50 line-through decoration-red-600 decoration-2 bg-red-100',
                    )}
                  >
                    {TOOL_ICONS[tool]}
                  </span>
                );
              })}
              <span className="text-[10px] font-black ml-auto">🪙{player.score}</span>
              <span className="text-[10px] font-black" title={t('gameSaboteur.handSize')}>
                🂠{player.handSize}
              </span>
            </div>
          </div>
        </button>
      );
    });

  const renderHand = () => (
    <div className="flex gap-2 items-stretch overflow-x-auto pb-1">
      {myHand.map((handCard, index) => {
        const isSelected = selectedCardIndex === index;
        const def = saboteurGetCardDef(handCard.cardId);
        const pathBlocked = def?.kind === 'PATH' && (me?.brokenTools.length ?? 0) > 0;
        return (
          <div key={index} className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              data-testid={`saboteur-hand-${index}`}
              onClick={() => handleHandClick(index)}
              disabled={!isMyTurn}
              title={pathBlocked ? t('gameSaboteur.brokenToolCanNotBuild') : undefined}
              className={clsx(
                'w-14 h-20 sm:w-16 sm:h-24 border-4 border-black overflow-hidden transition-all bg-white',
                isSelected
                  ? '-translate-y-2 shadow-[4px_6px_0_0_#000] ring-4 ring-purple-500'
                  : 'shadow-[3px_3px_0_0_#000]',
                !isMyTurn && 'opacity-40 cursor-not-allowed',
                pathBlocked && 'grayscale-[40%]',
              )}
            >
              {def?.kind === 'PATH' ? (
                <PathTileSvg cardId={handCard.cardId} rotation={0} className="w-full h-full" />
              ) : (
                <ActionCardFace cardId={handCard.cardId} />
              )}
            </button>
            {isSelected && (
              <div className="flex gap-1">
                {def?.kind === 'PATH' && (
                  <button
                    onClick={() => setRotation((r) => (r === 0 ? 180 : 0))}
                    className="text-[10px] font-black bg-sky-300 border-2 border-black rounded px-1.5 py-0.5 shadow-[2px_2px_0_0_#000]"
                  >
                    ⟳ 180°
                  </button>
                )}
                <button
                  onClick={() => {
                    saboteurDiscard(selectedCardIndex!);
                    resetSelection();
                  }}
                  className="text-[10px] font-black bg-red-300 border-2 border-black rounded px-1.5 py-0.5 shadow-[2px_2px_0_0_#000]"
                >
                  {t('gameSaboteur.discard')}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {myHand.length === 0 && (
        <div className="text-sm font-bold text-stone-600 py-8">{t('gameSaboteur.emptyHand')}</div>
      )}
    </div>
  );

  const pathBlockedHint = isMyTurn && (me?.brokenTools.length ?? 0) > 0;

  const hint = (() => {
    if (!isMyTurn) {
      return t('gameSaboteur.waitingFor', { name: playerName(state.activePlayerId ?? '') });
    }
    if (pathBlockedHint) return t('gameSaboteur.brokenToolCanNotBuild');
    switch (targeting) {
      case 'BREAK':
        return t('gameSaboteur.chooseBreakTarget');
      case 'REPAIR':
        return t('gameSaboteur.chooseRepairTarget');
      case 'MAP':
        return t('gameSaboteur.chooseGoalToPeek');
      case 'ROCKFALL':
        return t('gameSaboteur.chooseRockfallCell');
      default:
        if (selectedDef?.kind === 'PATH') return t('gameSaboteur.choosePlacement');
        return t('gameSaboteur.selectCardHint');
    }
  })();

  const renderRoundEndOrGameOver = () => {
    if (state.currentPhase === SaboteurPhase.GAME_OVER && state.finalResults) {
      const ranked = Object.entries(state.finalResults.scores).sort((a, b) => b[1] - a[1]);
      return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-amber-100 border-4 border-black shadow-[8px_8px_0_0_#000] w-full max-w-sm p-6 space-y-4"
          >
            <h3 className="text-2xl font-black text-center uppercase tracking-widest">
              🏆 {t('gameSaboteur.gameOver')}
            </h3>
            <div className="space-y-2">
              {ranked.map(([id, score]) => (
                <div
                  key={id}
                  className="flex justify-between items-center bg-white border-2 border-black px-3 py-2 font-black"
                >
                  <span>
                    {playerAvatar(id)} {playerName(id)}
                    {id === socketId && ' (You)'}
                  </span>
                  <span>🪙 {score}</span>
                </div>
              ))}
            </div>
            {isHost && (
              <button
                onClick={() => saboteurReset()}
                className="w-full bg-red-400 hover:bg-red-300 text-black border-4 border-black font-black py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000]"
              >
                {t('gameSaboteur.backToLobby')}
              </button>
            )}
          </motion.div>
        </div>
      );
    }

    if (state.currentPhase !== SaboteurPhase.ROUND_END || !state.roundResult) return null;
    const result = state.roundResult;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-amber-100 border-4 border-black shadow-[8px_8px_0_0_#000] w-full max-w-sm p-6 space-y-4"
        >
          <h3 className="text-xl font-black text-center uppercase tracking-widest">
            {result.winnerRole === SaboteurRole.MINER
              ? `⛏️ ${t('gameSaboteur.minersWin')}`
              : `💣 ${t('gameSaboteur.saboteursWin')}`}
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {Object.values(state.players).map((player) => (
              <div
                key={player.id}
                className="flex justify-between items-center bg-white border-2 border-black px-3 py-1.5 text-sm font-black"
              >
                <span>
                  {player.role === SaboteurRole.MINER ? '⛏️' : '💣'} {playerName(player.id)}
                  {player.id === socketId && ' (You)'}
                </span>
                <span className="flex gap-2">
                  {result.picks?.[player.id] !== undefined && (
                    <span className="text-yellow-600">+🪙{result.picks[player.id]}</span>
                  )}
                  {result.winnerRole === SaboteurRole.SABOTEUR &&
                    player.role === SaboteurRole.SABOTEUR && (
                      <span className="text-yellow-600">+🪙{result.saboteurBonus}</span>
                    )}
                  <span>Σ {player.score}</span>
                </span>
              </div>
            ))}
          </div>
          {isHost ? (
            <button
              onClick={() => saboteurNextRound()}
              className="w-full bg-lime-400 hover:bg-lime-300 text-black border-4 border-black font-black py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000]"
            >
              {t('gameSaboteur.nextRound')}
            </button>
          ) : (
            <div className="text-center text-sm font-bold">
              {t('gameSaboteur.waitingHostNextRound')}
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  const renderGoldPick = () => {
    if (state.currentPhase !== SaboteurPhase.GOLD_PICK || !state.roundResult) return null;
    const result = state.roundResult;
    const pool = result.goldPool ?? [];
    const isMyPick = result.currentPickerId === socketId;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-amber-100 border-4 border-black shadow-[8px_8px_0_0_#000] w-full max-w-md p-6 space-y-4"
        >
          <h3 className="text-xl font-black text-center uppercase tracking-widest">
            💰 {t('gameSaboteur.goldPickTitle')}
          </h3>
          <p className="text-center text-sm font-bold bg-white border-2 border-black rounded px-2 py-1">
            {isMyPick
              ? t('gameSaboteur.yourPick')
              : t('gameSaboteur.pickingNow', { name: playerName(result.currentPickerId ?? '') })}
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {pool.map((value, idx) => {
              const taken = value < 0;
              const takerEntry = Object.entries(result.picks ?? {}).find(
                ([, v]) => v === Math.abs(value),
              );
              return taken ? (
                <div key={idx} className="relative opacity-50">
                  <GoldNuggetValue value={Math.abs(value)} className="w-14 h-14" />
                  <span className="absolute -bottom-2 -right-2 text-[10px] font-black bg-white border border-black rounded-full px-1">
                    {playerName(takerEntry?.[0] ?? '')}
                  </span>
                </div>
              ) : (
                <button
                  key={idx}
                  data-testid={`saboteur-gold-${idx}`}
                  onClick={() => isMyPick && saboteurPickGold(idx)}
                  disabled={!isMyPick || actionLoading}
                  className={clsx(
                    'transition-transform',
                    isMyPick && 'hover:scale-110 hover:-translate-y-1 cursor-pointer',
                    !isMyPick && 'cursor-default',
                  )}
                >
                  <GoldNuggetValue value={value} className="w-14 h-14" />
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  };

  // ---------- Layout ----------

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-3 w-full max-w-5xl mx-auto relative">
      {actionLoading && <ActionLoadingOverlay />}

      {/* Left: board + hand */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-white border-2 border-black rounded px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
            ⛏️ {t('gameSaboteur.round')} {state.round}/3
          </span>
          <span className="bg-white border-2 border-black rounded px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
            🃏 {t('gameSaboteur.stock')}: {state.stockCount}
          </span>
          <span
            className={clsx(
              'border-2 border-black rounded px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]',
              isMyTurn ? 'bg-lime-300' : 'bg-white',
            )}
          >
            {hint}
          </span>
          {selectedCardIndex !== null && (
            <button
              onClick={resetSelection}
              className="bg-red-300 hover:bg-red-200 border-2 border-black rounded px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]"
            >
              ✕ {t('gameSaboteur.cancel')}
            </button>
          )}
        </div>

        {renderBoard()}
        {renderHand()}
      </div>

      {/* Right: players */}
      <div className="w-full lg:w-56 space-y-2">
        <div className="text-xs font-black uppercase tracking-widest text-stone-700">
          {t('gameSaboteur.players')}
        </div>
        {renderPlayers()}
      </div>

      <AnimatePresence>
        {renderGoldPick()}
        {renderRoundEndOrGameOver()}
      </AnimatePresence>
    </div>
  );
}
