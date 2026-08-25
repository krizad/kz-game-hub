'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RoomStatus,
  SaboteurActionKind,
  SaboteurLogEntry,
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

const TARGETING_STYLE: Record<Exclude<Targeting, null>, string> = {
  BREAK: 'bg-red-200 border-red-500 text-red-900',
  REPAIR: 'bg-emerald-200 border-emerald-500 text-emerald-900',
  MAP: 'bg-sky-200 border-sky-500 text-sky-900',
  ROCKFALL: 'bg-orange-200 border-orange-500 text-orange-900',
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
  const myRole = privateState.sbRole as SaboteurRole | undefined;

  const isHost = room.roomHostId === socketId;
  const me = state.players[socketId];
  const toolsBroken = (me?.brokenTools.length ?? 0) > 0;
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
  const toolWord = (tool: SaboteurTool) => t(`gameSaboteur.tool_${tool.toLowerCase()}`);

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
    if (targetPlayerId === socketId && targeting === 'BREAK') return;
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
        const ghostHere = validPlacements.has(key);
        const targetable =
          (targeting === 'ROCKFALL' && !!cell && !isGoal && cell.cardId !== 'start') ||
          (targeting === 'MAP' && isGoal);
        const peek = goalIndex >= 0 ? peekedGoals[String(goalIndex)] : undefined;

        cells.push(
          <button
            key={key}
            data-testid={`saboteur-cell-${key}`}
            onClick={() => handleBoardCellClick(x, y)}
            disabled={!ghostHere && !targetable}
            className={clsx(
              'relative aspect-square transition-all',
              isGoal
                ? 'rounded-t-[1.4rem] rounded-b-lg' // cave-arch silhouette
                : 'rounded-xl',
              !cell &&
                !ghostHere &&
                !targetable &&
                'border-2 border-dashed border-amber-900/25 bg-[#92400e]/35',
              cell && 'overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]',
              cell && !isGoal && 'border-2 border-amber-950/60',
              (ghostHere || targetable) &&
                'cursor-pointer ring-4 ring-lime-300 z-10 scale-[1.07] shadow-[0_6px_14px_rgba(0,0,0,0.45)]',
            )}
            title={
              cell ? `${cell.cardId}` : ghostHere ? `${selectedCard?.cardId} ${rotation}°` : ''
            }
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
            ) : ghostHere && selectedDef?.kind === 'PATH' ? (
              <PathTileSvg
                cardId={selectedDef.id}
                rotation={rotation}
                className="w-full h-full opacity-55 animate-pulse"
              />
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
        className="grid gap-1.5 sm:gap-2 bg-[#6b3410] p-2.5 sm:p-3 rounded-2xl border-4 border-black shadow-[6px_6px_0_0_#000] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_60%)]"
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
      const blocked = player.brokenTools.length > 0;
      return (
        <button
          key={player.id}
          data-testid={`saboteur-player-${player.id}`}
          onClick={() => handlePlayerClick(player.id)}
          disabled={!isTargetable}
          className={clsx(
            'w-full flex items-center gap-2 bg-white border-4 shadow-[3px_3px_0_0_#000] px-2 py-1.5 text-left rounded-xl transition-all',
            player.id === state.activePlayerId && 'border-lime-500 bg-lime-100',
            blocked && 'border-red-400 bg-red-50',
            !player.id && '',
            isTargetable &&
              'hover:bg-yellow-100 cursor-pointer ring-4 ring-purple-400 animate-pulse rounded-xl',
          )}
        >
          <span className="text-lg leading-none">{playerAvatar(player.id)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black truncate flex items-center gap-1">
              {playerName(player.id)}
              {player.id === socketId && (
                <span className="text-[9px] bg-black/80 text-white rounded px-1">YOU</span>
              )}
              {blocked && <span title={t('gameSaboteur.blockedTitle')}>🚫</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(Object.values(SaboteurTool) as SaboteurTool[]).map((tool) => {
                const broken = player.brokenTools.includes(tool);
                return (
                  <span
                    key={tool}
                    title={
                      broken ? `${toolWord(tool)}: ${t('gameSaboteur.broken')}` : toolWord(tool)
                    }
                    className={clsx(
                      'text-xs leading-none px-0.5 rounded',
                      broken &&
                        'opacity-60 line-through decoration-red-600 decoration-[3px] bg-red-100',
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
    <div className="flex gap-2 items-end overflow-x-auto pb-1 min-h-[6.5rem]">
      {myHand.map((handCard, index) => {
        const isSelected = selectedCardIndex === index;
        const def = saboteurGetCardDef(handCard.cardId);
        const pathBlocked = def?.kind === 'PATH' && toolsBroken;
        return (
          <div key={index} className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              data-testid={`saboteur-hand-${index}`}
              onClick={() => handleHandClick(index)}
              disabled={!isMyTurn}
              title={
                pathBlocked ? `${t('gameSaboteur.brokenToolCanNotBuild')}` : `${handCard.cardId}`
              }
              className={clsx(
                'w-14 h-20 sm:w-16 sm:h-24 rounded-xl border-4 border-black overflow-hidden transition-all bg-white',
                isSelected
                  ? '-translate-y-3 shadow-[4px_7px_0_0_#000] ring-4 ring-purple-500'
                  : 'shadow-[3px_3px_0_0_#000]',
                !isMyTurn && 'opacity-40 cursor-not-allowed',
                pathBlocked && 'grayscale opacity-70',
              )}
            >
              {def?.kind === 'PATH' ? (
                <PathTileSvg
                  cardId={handCard.cardId}
                  rotation={isSelected ? rotation : 0}
                  className="w-full h-full transition-transform"
                />
              ) : (
                <ActionCardFace cardId={handCard.cardId} />
              )}
            </button>
            {isSelected && (
              <div className="flex gap-1">
                {def?.kind === 'PATH' && (
                  <button
                    onClick={() => setRotation((r) => (r === 0 ? 180 : 0))}
                    title={t('gameSaboteur.rotate')}
                    className="text-[10px] font-black bg-sky-300 border-2 border-black rounded px-1.5 py-0.5 shadow-[2px_2px_0_0_#000]"
                  >
                    ⟳ {rotation === 0 ? '180°' : '0°'}
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

  const renderRoleBadge = () => {
    if (!myRole) return null;
    const miner = myRole === SaboteurRole.MINER;
    return (
      <div
        className={clsx(
          'flex items-center gap-2 rounded-xl border-4 border-black px-3 py-1.5 shadow-[3px_3px_0_0_#000]',
          miner ? 'bg-amber-300' : 'bg-rose-400 text-white',
        )}
        data-testid="saboteur-my-role"
      >
        <span className="text-lg leading-none">{miner ? '⛏️' : '💣'}</span>
        <div className="leading-tight">
          <div className="text-xs font-black uppercase tracking-wider">
            {miner ? t('gameSaboteur.roleMiner') : t('gameSaboteur.roleSaboteur')}
          </div>
          <div className="text-[10px] font-bold opacity-80">
            {miner ? t('gameSaboteur.roleMinerDesc') : t('gameSaboteur.roleSaboteurDesc')}
          </div>
        </div>
      </div>
    );
  };

  const renderBlockedBanner = () => {
    if (!toolsBroken || state.currentPhase !== SaboteurPhase.PLAYING) return null;
    const brokenIcons = (me?.brokenTools ?? []).map((tool) => TOOL_ICONS[tool]).join(' ');
    return (
      <div className="flex items-center gap-2 bg-red-200 border-4 border-red-500 rounded-xl px-3 py-1.5 shadow-[3px_3px_0_0_#000]">
        <span className="text-base">🚫</span>
        <div className="text-[11px] font-black text-red-900 leading-tight">
          {t('gameSaboteur.blockedBanner', { tools: brokenIcons })}
        </div>
      </div>
    );
  };

  const renderActionModeBar = () => {
    if (!targeting) return null;
    const labels: Record<Exclude<Targeting, null>, string> = {
      BREAK: t('gameSaboteur.chooseBreakTarget'),
      REPAIR: t('gameSaboteur.chooseRepairTarget'),
      MAP: t('gameSaboteur.chooseGoalToPeek'),
      ROCKFALL: t('gameSaboteur.chooseRockfallCell'),
    };
    const icons: Record<Exclude<Targeting, null>, string> = {
      BREAK: '🔨',
      REPAIR: '🔧',
      MAP: '🗺️',
      ROCKFALL: '🪨',
    };
    return (
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={clsx(
          'flex items-center gap-2 border-4 rounded-xl px-3 py-1.5 shadow-[3px_3px_0_0_#000]',
          TARGETING_STYLE[targeting],
        )}
      >
        <span className="text-base">{icons[targeting]}</span>
        <span className="text-xs font-black flex-1">{labels[targeting]}</span>
        <button
          onClick={resetSelection}
          className="text-[10px] font-black bg-white border-2 border-black rounded px-1.5 py-0.5 shadow-[2px_2px_0_0_#000]"
        >
          ✕ {t('gameSaboteur.cancel')}
        </button>
      </motion.div>
    );
  };

  const renderLog = () => {
    const entries: SaboteurLogEntry[] = [...(state.log ?? [])].reverse();
    const renderEntry = (e: SaboteurLogEntry) => {
      const name = playerName(e.playerId);
      const target = e.targetId ? playerName(e.targetId) : '';
      let icon = '•';
      let text = '';
      switch (e.kind) {
        case 'PLACE':
          icon = '🛠️';
          text = t('gameSaboteur.logPlace', { name, x: e.x ?? 0, y: e.y ?? 0 });
          break;
        case 'BREAK':
          icon = '🔨';
          text = t('gameSaboteur.logBreak', {
            name,
            target,
            tool: e.tool ? TOOL_ICONS[e.tool] : '',
          });
          break;
        case 'REPAIR':
          icon = '🔧';
          text = t('gameSaboteur.logRepair', {
            name,
            target,
            tool: e.tool ? TOOL_ICONS[e.tool] : '',
          });
          break;
        case 'MAP':
          icon = '🗺️';
          text = t('gameSaboteur.logMap', { name, goal: (e.goalIndex ?? 0) + 1 });
          break;
        case 'ROCKFALL':
          icon = '🪨';
          text = t('gameSaboteur.logRockfall', { name, x: e.x ?? 0, y: e.y ?? 0 });
          break;
        case 'DISCARD':
          icon = '🗑️';
          text = t('gameSaboteur.logDiscard', { name });
          break;
        case 'PASS':
          icon = '⏭️';
          text = t('gameSaboteur.logPass', { name });
          break;
        case 'PICK_GOLD':
          icon = '🪙';
          text = t('gameSaboteur.logGold', { name, value: e.value ?? 0 });
          break;
        case 'MINERS_WIN':
          icon = '💰';
          text = t('gameSaboteur.logMinersWin', { goal: (e.goalIndex ?? 0) + 1 });
          break;
        case 'SABOTEURS_WIN':
          icon = '💣';
          text = t('gameSaboteur.logSaboteursWin');
          break;
      }
      return (
        <div key={e.seq} className="flex items-start gap-1.5 text-[10px] font-bold leading-snug">
          <span className="flex-shrink-0">{icon}</span>
          <span className="text-stone-700">{text}</span>
        </div>
      );
    };
    return (
      <div className="bg-white border-4 border-black rounded-xl shadow-[3px_3px_0_0_#000] p-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1">
          📜 {t('gameSaboteur.logTitle')}
        </div>
        <div className="space-y-1 max-h-44 lg:max-h-60 overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <div className="text-[10px] font-bold text-stone-400">—</div>
          ) : (
            entries.map(renderEntry)
          )}
        </div>
      </div>
    );
  };

  const pathBlockedHint = isMyTurn && toolsBroken;

  const hint = (() => {
    if (state.currentPhase === SaboteurPhase.GOLD_PICK) return t('gameSaboteur.goldPickTitle');
    if (!isMyTurn) {
      return t('gameSaboteur.waitingFor', { name: playerName(state.activePlayerId ?? '') });
    }
    if (pathBlockedHint) return t('gameSaboteur.brokenToolCanNotBuild');
    if (targeting) {
      const labels: Record<Exclude<Targeting, null>, string> = {
        BREAK: t('gameSaboteur.chooseBreakTarget'),
        REPAIR: t('gameSaboteur.chooseRepairTarget'),
        MAP: t('gameSaboteur.chooseGoalToPeek'),
        ROCKFALL: t('gameSaboteur.chooseRockfallCell'),
      };
      return labels[targeting];
    }
    if (selectedDef?.kind === 'PATH') {
      return validPlacements.size > 0
        ? t('gameSaboteur.choosePlacement')
        : t('gameSaboteur.noPlacement');
    }
    return t('gameSaboteur.selectCardHint');
  })();

  const renderRoundEndOrGameOver = () => {
    if (state.currentPhase === SaboteurPhase.GAME_OVER && state.finalResults) {
      const ranked = Object.entries(state.finalResults.scores).sort((a, b) => b[1] - a[1]);
      return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-amber-100 border-4 border-black shadow-[8px_8px_0_0_#000] w-full max-w-sm p-6 space-y-4 rounded-2xl"
          >
            <h3 className="text-2xl font-black text-center uppercase tracking-widest">
              🏆 {t('gameSaboteur.gameOver')}
            </h3>
            <div className="space-y-2">
              {ranked.map(([id, score]) => (
                <div
                  key={id}
                  className="flex justify-between items-center bg-white border-2 border-black px-3 py-2 font-black rounded-lg"
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
                className="w-full bg-red-400 hover:bg-red-300 text-black border-4 border-black font-black py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000] rounded-xl"
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
          className="bg-amber-100 border-4 border-black shadow-[8px_8px_0_0_#000] w-full max-w-sm p-6 space-y-4 rounded-2xl"
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
                className="flex justify-between items-center bg-white border-2 border-black px-3 py-1.5 text-sm font-black rounded-lg"
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
              className="w-full bg-lime-400 hover:bg-lime-300 text-black border-4 border-black font-black py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000] rounded-xl"
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
          className="bg-amber-100 border-4 border-black shadow-[8px_8px_0_0_#000] w-full max-w-md p-6 space-y-4 rounded-2xl"
        >
          <h3 className="text-xl font-black text-center uppercase tracking-widest">
            💰 {t('gameSaboteur.goldPickTitle')}
          </h3>
          <p className="text-center text-sm font-bold bg-white border-2 border-black rounded-lg px-2 py-1">
            {isMyPick
              ? t('gameSaboteur.yourPick')
              : t('gameSaboteur.pickingNow', {
                  name: playerName(result.currentPickerId ?? ''),
                })}
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

      {/* Left: status + board + hand */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {renderRoleBadge()}
          <span className="bg-white border-2 border-black rounded-lg px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
            ⛏️ {t('gameSaboteur.round')} {state.round}/3
          </span>
          <span className="bg-white border-2 border-black rounded-lg px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
            🃏 {t('gameSaboteur.stock')}: {state.stockCount}
          </span>
          <span
            className={clsx(
              'border-2 border-black rounded-lg px-2 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]',
              isMyTurn ? 'bg-lime-300' : 'bg-white',
            )}
          >
            {hint}
          </span>
        </div>

        {renderBlockedBanner()}
        {renderActionModeBar()}
        {renderBoard()}
        {renderHand()}
      </div>

      {/* Right: players + log */}
      <div className="w-full lg:w-56 space-y-2">
        <div className="text-xs font-black uppercase tracking-widest text-stone-700">
          {t('gameSaboteur.players')}
        </div>
        {renderPlayers()}
        {renderLog()}
      </div>

      <AnimatePresence>
        {renderGoldPick()}
        {renderRoundEndOrGameOver()}
      </AnimatePresence>
    </div>
  );
}
