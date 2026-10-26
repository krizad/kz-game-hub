'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShipType,
  ShipPlacement,
  ShipOrientation,
  BattleshipGridPreset,
  CLASSIC_10x10_FLEET,
  QUICK_8x8_FLEET,
  CellStatus,
  BATTLESHIP_PRIVATE_OCEAN_KEY,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { useGameFeel } from '@/hooks/useGameFeel';
import { audioManager } from '@/lib/audioManager';
import {
  Crosshair,
  RotateCw,
  Shuffle,
  Shield,
  Flame,
  Waves,
  Skull,
  Award,
  Users,
  Compass,
  RotateCcw,
} from 'lucide-react';

const SHIP_ICONS: Record<ShipType, string> = {
  [ShipType.CARRIER]: '🚢',
  [ShipType.BATTLESHIP]: '🛳️',
  [ShipType.CRUISER]: '🛥️',
  [ShipType.SUBMARINE]: '🌊',
  [ShipType.DESTROYER]: '🚤',
};

export function BattleshipView() {
  const {
    room,
    socketId,
    privateState,
    battleshipPlaceShips,
    battleshipFire,
    battleshipPing,
    battleshipReset,
  } = useGameStore();
  const { t } = useTranslate();
  const { shake, flash, haptic, celebrate } = useGameFeel();
  const prevVolleySigRef = useRef<string>('');
  const prevPhaseRef = useRef<string | undefined>(undefined);

  const state = room?.battleshipState;
  const isHost = socketId === room?.roomHostId;

  const gridSize = state?.gridSize ?? 10;
  const gridPreset: BattleshipGridPreset = state?.gridPreset ?? 'CLASSIC_10x10';
  const fleetConfig = useMemo(
    () => (gridPreset === 'CLASSIC_10x10' ? CLASSIC_10x10_FLEET : QUICK_8x8_FLEET),
    [gridPreset],
  );

  // Private ocean grid
  const myPrivateOcean = privateState[BATTLESHIP_PRIVATE_OCEAN_KEY] as
    | { targetId: string; ships: ShipPlacement[]; gridSize: number }
    | undefined;

  // Placement local state
  const [placedShips, setPlacedShips] = useState<ShipPlacement[]>([]);
  const [selectedShipIndex, setSelectedShipIndex] = useState<number>(0);
  const [orientation, setOrientation] = useState<ShipOrientation>('HORIZONTAL');
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Playing phase targeting
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedFireCoord, setSelectedFireCoord] = useState<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'TARGET' | 'MY_OCEAN'>('TARGET');

  // Sync placed ships if private state arrives
  useEffect(() => {
    if (myPrivateOcean?.ships && myPrivateOcean.ships.length > 0 && placedShips.length === 0) {
      setPlacedShips(myPrivateOcean.ships);
    }
  }, [myPrivateOcean, placedShips.length]);

  // Target selection initialization
  useEffect(() => {
    if (!state || state.phase === 'PLACEMENT') return;

    if (state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD') {
      const myTeam = state.teams[socketId || ''];
      const enemyTeam = myTeam === 'RED' ? 'BLUE' : 'RED';
      setSelectedTargetId(enemyTeam);
    } else {
      // Pick first alive opponent
      const opponents = state.alivePlayerIds.filter((id) => id !== socketId);
      if (opponents.length > 0 && (!selectedTargetId || !opponents.includes(selectedTargetId))) {
        setSelectedTargetId(opponents[0]);
      }
    }
  }, [state, socketId, selectedTargetId]);

  // Helper: Generate Random Placement locally
  const handleAutoRandomize = () => {
    const placements: ShipPlacement[] = [];
    const occupied = new Set<string>();

    for (const ship of fleetConfig) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 200) {
        attempts++;
        const ori: ShipOrientation = Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL';
        const maxX = ori === 'HORIZONTAL' ? gridSize - ship.length : gridSize - 1;
        const maxY = ori === 'VERTICAL' ? gridSize - ship.length : gridSize - 1;
        const sx = Math.floor(Math.random() * (maxX + 1));
        const sy = Math.floor(Math.random() * (maxY + 1));

        let coll = false;
        const coords: { x: number; y: number }[] = [];
        for (let i = 0; i < ship.length; i++) {
          const cx = ori === 'HORIZONTAL' ? sx + i : sx;
          const cy = ori === 'VERTICAL' ? sy + i : sy;
          if (occupied.has(`${cx},${cy}`)) {
            coll = true;
            break;
          }
          coords.push({ x: cx, y: cy });
        }

        if (!coll) {
          coords.forEach((c) => occupied.add(`${c.x},${c.y}`));
          placements.push({
            id: `ship_${ship.type}_${Date.now()}_${Math.random()}`,
            type: ship.type,
            x: sx,
            y: sy,
            orientation: ori,
            length: ship.length,
            hits: 0,
            sunk: false,
          });
          placed = true;
        }
      }
    }

    setPlacedShips(placements);
    audioManager.playPlaceMark('X');
    haptic(25);
  };

  // Helper: Try placing ship at cell
  const handleCellClickPlacement = (x: number, y: number) => {
    const currentShip = fleetConfig[selectedShipIndex];
    if (!currentShip) return;

    // Check bounds
    const endX = orientation === 'HORIZONTAL' ? x + currentShip.length - 1 : x;
    const endY = orientation === 'VERTICAL' ? y + currentShip.length - 1 : y;
    if (endX >= gridSize || endY >= gridSize) {
      audioManager.playErrorBuzz();
      haptic(30);
      return;
    }

    // Check overlap with other ships (excluding current ship type if re-placing)
    const otherShips = placedShips.filter((s) => s.type !== currentShip.type);
    const occupied = new Set<string>();
    for (const s of otherShips) {
      for (let i = 0; i < s.length; i++) {
        const sx = s.orientation === 'HORIZONTAL' ? s.x + i : s.x;
        const sy = s.orientation === 'VERTICAL' ? s.y + i : s.y;
        occupied.add(`${sx},${sy}`);
      }
    }

    for (let i = 0; i < currentShip.length; i++) {
      const cx = orientation === 'HORIZONTAL' ? x + i : x;
      const cy = orientation === 'VERTICAL' ? y + i : y;
      if (occupied.has(`${cx},${cy}`)) {
        audioManager.playErrorBuzz();
        haptic(30);
        return; // Collision
      }
    }

    const newShip: ShipPlacement = {
      id: `ship_${currentShip.type}_${Date.now()}`,
      type: currentShip.type,
      x,
      y,
      orientation,
      length: currentShip.length,
      hits: 0,
      sunk: false,
    };

    setPlacedShips([...otherShips, newShip]);
    audioManager.playPlaceMark('O');
    haptic(25);

    // Advance to next ship if available
    if (selectedShipIndex < fleetConfig.length - 1) {
      setSelectedShipIndex(selectedShipIndex + 1);
    }
  };

  const handleConfirmPlacement = () => {
    if (placedShips.length === fleetConfig.length) {
      audioManager.playReady();
      haptic(40);
      battleshipPlaceShips(placedShips);
    }
  };

  const handleFire = () => {
    if (!selectedFireCoord || !selectedTargetId) return;
    audioManager.playBuzzerPress();
    haptic(40);
    battleshipFire(selectedTargetId, selectedFireCoord.x, selectedFireCoord.y);
    setSelectedFireCoord(null);
  };

  const handlePing = () => {
    if (!selectedFireCoord) return;
    audioManager.playReady();
    haptic(20);
    battleshipPing(selectedFireCoord.x, selectedFireCoord.y);
  };

  // Trigger audio-visual feedback on new volley results & phase transitions
  useEffect(() => {
    if (!state) return;

    if (state.lastVolleyResults && state.lastVolleyResults.length > 0) {
      const sig = `${state.round}:${state.lastVolleyResults
        .map((v) => `${v.shooterId}-${v.targetId}-${v.x},${v.y}-${v.result}`)
        .join('|')}`;
      if (sig !== prevVolleySigRef.current) {
        prevVolleySigRef.current = sig;
        const hasSunk = state.lastVolleyResults.some((v) => v.result === 'SUNK');
        const hasCollision = state.lastVolleyResults.some((v) => v.result === 'COLLISION');
        const hasHit = state.lastVolleyResults.some((v) => v.result === 'HIT');

        if (hasSunk) {
          audioManager.playRockCrumble();
          shake(0.75);
          flash('red', 400);
          haptic([100, 40, 120]);
        } else if (hasCollision) {
          audioManager.playClash();
          shake(0.55);
          flash('gold', 350);
          haptic([60, 30, 60]);
        } else if (hasHit) {
          audioManager.playClash();
          shake(0.4);
          flash('red', 300);
          haptic(60);
        } else {
          audioManager.playSplash();
          haptic(20);
        }
      }
    }

    if (prevPhaseRef.current !== state.phase) {
      prevPhaseRef.current = state.phase;
      if (state.phase === 'RESULT') {
        audioManager.playSuccessChime();
        celebrate({ particleCount: 80, spread: 75 });
        flash('gold', 450);
        haptic([80, 40, 100]);
      }
    }
  }, [state, shake, flash, haptic, celebrate]);

  if (!state) return null;

  const myTeam = state.teams[socketId || ''];
  const isMyTurn = state.turnPlayerId === socketId;
  const isAlive = state.alivePlayerIds.includes(socketId || '');
  const myTargetId =
    state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD' ? myTeam : socketId;
  const isReady = myTargetId ? state.placementReady[myTargetId] : false;

  // Active Target Board
  const targetBoard = selectedTargetId ? state.targetGrids[selectedTargetId] || {} : {};
  const myBoardHits = myTargetId ? state.targetGrids[myTargetId] || {} : {};

  // Active Pings for current target
  const teamPings = myTeam ? state.pings[myTeam] || [] : [];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 p-2 sm:p-4 text-slate-900 select-none">
      {/* --- TOP STATUS BAR --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚓</span>
          <div>
            <h2 className="font-black text-lg leading-tight flex items-center gap-2">
              {t('battleship.title')}
              {myTeam && (
                <span
                  className={`text-xs px-2 py-0.5 border border-black rounded text-white ${
                    myTeam === 'RED' ? 'bg-red-600' : 'bg-blue-600'
                  }`}
                >
                  {myTeam === 'RED' ? t('battleship.teamRed') : t('battleship.teamBlue')}
                </span>
              )}
            </h2>
            <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
              <span>
                {state.mode === 'FREE_FOR_ALL' ? t('battleship.ffaMode') : t('battleship.teamMode')}
              </span>
              <span>•</span>
              <span>{t('battleship.roundLabel', { round: state.round })}</span>
            </div>
          </div>
        </div>

        {/* Turn Indicator / Countdown */}
        <div className="flex items-center gap-3">
          {state.phase === 'PLAYING' && (
            <div
              className={`px-3 py-1.5 border-3 border-black rounded-lg font-black text-sm flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] ${
                isMyTurn || state.mode === 'FREE_FOR_ALL'
                  ? 'bg-emerald-400 text-black animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Crosshair className="w-4 h-4" />
              {state.mode === 'FREE_FOR_ALL'
                ? t('battleship.simultaneousPrompt')
                : isMyTurn
                  ? t('battleship.yourTurnToFire')
                  : t('battleship.waitingEnemyTurn')}
            </div>
          )}

          {isHost && (
            <button
              onClick={battleshipReset}
              className="p-2 bg-rose-300 hover:bg-rose-400 border-2 border-black rounded shadow-[2px_2px_0_0_#000] font-black text-xs flex items-center gap-1"
              title={t('battleship.playAgain')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* --- RECENT EVENT ALERT BANNER --- */}
      <AnimatePresence>
        {state.lastVolleyResults.length > 0 && state.phase === 'PLAYING' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-1 p-2.5 bg-amber-200 border-3 border-black rounded-lg shadow-[3px_3px_0_0_#000]"
          >
            {state.lastVolleyResults.map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs sm:text-sm font-black"
              >
                <span className="flex items-center gap-1.5">
                  {v.result === 'COLLISION' && '💥'}
                  {v.result === 'SUNK' && '🔥'}
                  {v.result === 'HIT' && '🎯'}
                  {v.result === 'MISS' && '🌊'}
                  <span>
                    {v.shooterName} ➜ {v.targetName}
                  </span>
                </span>
                <span
                  className={`px-2 py-0.5 border border-black rounded font-mono text-xs ${
                    v.result === 'COLLISION'
                      ? 'bg-red-500 text-white animate-bounce'
                      : v.result === 'SUNK'
                        ? 'bg-amber-600 text-white'
                        : v.result === 'HIT'
                          ? 'bg-rose-500 text-white'
                          : 'bg-sky-200 text-slate-800'
                  }`}
                >
                  {v.result === 'COLLISION'
                    ? t('battleship.collision')
                    : v.result === 'SUNK'
                      ? `${t('battleship.sunk')} (${v.sunkShipType})`
                      : v.result === 'HIT'
                        ? t('battleship.hit')
                        : t('battleship.miss')}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PHASE 1: PLACEMENT PHASE --- */}
      {state.phase === 'PLACEMENT' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Controls Panel */}
          <div className="w-full lg:w-80 flex flex-col gap-3 p-4 bg-[#fde047] border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000]">
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5" />
              {t('battleship.placementTitle')}
            </h3>
            <p className="text-xs font-bold text-slate-700">{t('battleship.placementDesc')}</p>

            {/* Ship Selection List */}
            <div className="flex flex-col gap-1.5 my-1">
              {fleetConfig.map((ship, idx) => {
                const isPlaced = placedShips.some((s) => s.type === ship.type);
                const isSelected = selectedShipIndex === idx;
                return (
                  <button
                    key={ship.type}
                    onClick={() => setSelectedShipIndex(idx)}
                    className={`flex items-center justify-between p-2 rounded-lg border-3 border-black text-xs font-black transition-transform ${
                      isSelected
                        ? 'bg-white shadow-[2px_2px_0_0_#000] scale-[1.02]'
                        : isPlaced
                          ? 'bg-emerald-300 opacity-80'
                          : 'bg-yellow-100 hover:bg-yellow-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{SHIP_ICONS[ship.type]}</span>
                      <span>{t(`battleship.${ship.type.toLowerCase()}`)}</span>
                    </span>
                    <span className="font-mono bg-black text-white px-1.5 py-0.5 rounded">
                      {ship.length} {isPlaced ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                data-testid="battleship-rotate-btn"
                onClick={() =>
                  setOrientation(orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL')
                }
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 border-3 border-black rounded-lg font-black text-xs shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
              >
                <RotateCw className="w-4 h-4" />
                {orientation === 'HORIZONTAL'
                  ? t('battleship.horizontalBtn')
                  : t('battleship.verticalBtn')}
              </button>

              <button
                data-testid="battleship-randomize-btn"
                onClick={handleAutoRandomize}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#a7f3d0] hover:bg-[#6ee7b7] border-3 border-black rounded-lg font-black text-xs shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
              >
                <Shuffle className="w-4 h-4" />
                {t('battleship.randomizeBtn')}
              </button>
            </div>

            {/* Confirm Placement */}
            <button
              data-testid="battleship-confirm-placement-btn"
              onClick={handleConfirmPlacement}
              disabled={placedShips.length !== fleetConfig.length || isReady}
              className={`w-full py-3 px-4 border-4 border-black rounded-xl font-black text-sm shadow-[4px_4px_0_0_#000] transition-all ${
                isReady
                  ? 'bg-emerald-400 text-black cursor-default'
                  : placedShips.length === fleetConfig.length
                    ? 'bg-[#38bdf8] hover:bg-[#0ea5e9] text-black active:translate-x-[2px] active:translate-y-[2px]'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              {isReady
                ? t('battleship.placementLocked')
                : `${t('battleship.confirmPlacement')} (${placedShips.length}/${fleetConfig.length})`}
            </button>
          </div>

          {/* Ocean Grid Editor */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#0284c7] border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000] overflow-x-auto">
            <h4 className="font-black text-white text-sm mb-3 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('battleship.myOcean')} ({gridSize}×{gridSize})
            </h4>

            <div
              className="grid gap-1 bg-sky-950 p-2.5 border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000]"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                const x = idx % gridSize;
                const y = Math.floor(idx / gridSize);

                // Check if cell is occupied by placed ship
                const occupyingShip = placedShips.find((s) => {
                  for (let i = 0; i < s.length; i++) {
                    const sx = s.orientation === 'HORIZONTAL' ? s.x + i : s.x;
                    const sy = s.orientation === 'VERTICAL' ? s.y + i : s.y;
                    if (sx === x && sy === y) return true;
                  }
                  return false;
                });

                // Check hover preview
                const currentShip = fleetConfig[selectedShipIndex];
                let isPreview = false;
                let isPreviewInvalid = false;
                if (hoverCoord && currentShip) {
                  for (let i = 0; i < currentShip.length; i++) {
                    const px = orientation === 'HORIZONTAL' ? hoverCoord.x + i : hoverCoord.x;
                    const py = orientation === 'VERTICAL' ? hoverCoord.y + i : hoverCoord.y;
                    if (px === x && py === y) {
                      isPreview = true;
                      if (px >= gridSize || py >= gridSize) isPreviewInvalid = true;
                    }
                  }
                }

                return (
                  <button
                    key={`${x},${y}`}
                    data-testid={`battleship-place-cell-${x}-${y}`}
                    aria-label={t('battleship.cellAriaLabel', { x: x + 1, y: y + 1 })}
                    onClick={() => handleCellClickPlacement(x, y)}
                    onMouseEnter={() => setHoverCoord({ x, y })}
                    onMouseLeave={() => setHoverCoord(null)}
                    disabled={isReady}
                    className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center font-black text-xs border border-sky-800 rounded transition-colors ${
                      occupyingShip
                        ? 'bg-amber-400 border-2 border-black text-black'
                        : isPreview
                          ? isPreviewInvalid
                            ? 'bg-red-400'
                            : 'bg-emerald-400/80 border-2 border-black'
                          : 'bg-sky-800/70 hover:bg-sky-700/80'
                    }`}
                  >
                    {occupyingShip ? SHIP_ICONS[occupyingShip.type] : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- PHASE 2: PLAYING PHASE --- */}
      {state.phase === 'PLAYING' && (
        <div className="flex flex-col gap-4">
          {/* Opponent Selection Carousel / Tab Bar */}
          <div className="flex flex-col gap-2 p-3 bg-white border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center justify-between text-xs font-black text-slate-700">
              <span className="flex items-center gap-1.5 uppercase tracking-wide">
                <Users className="w-4 h-4 text-slate-900" />
                {t('battleship.aimOpponentTitle')}
              </span>
              <span>{isAlive ? t('battleship.readyToFire') : t('battleship.eliminated')}</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD'
                ? // 2 Teams in Shared Board
                  ['RED', 'BLUE'].map((teamKey) => {
                    const isOpponent = myTeam !== teamKey;
                    const isSelected = selectedTargetId === teamKey;
                    const remaining = state.shipsRemaining[teamKey] ?? 0;
                    return (
                      <button
                        key={teamKey}
                        data-testid={`battleship-target-${teamKey}`}
                        aria-pressed={isSelected}
                        onClick={() => isOpponent && setSelectedTargetId(teamKey)}
                        disabled={!isOpponent}
                        className={`flex-1 flex items-center justify-between p-2.5 rounded-lg border-3 border-black text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-amber-300 shadow-[3px_3px_0_0_#000] scale-[1.01]'
                            : isOpponent
                              ? 'bg-slate-100 hover:bg-slate-200'
                              : 'bg-slate-100 opacity-60 cursor-default'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-full ${teamKey === 'RED' ? 'bg-red-500' : 'bg-blue-500'}`}
                          />
                          <span>
                            {teamKey === 'RED' ? t('battleship.teamRed') : t('battleship.teamBlue')}
                          </span>
                          {!isOpponent && (
                            <span className="text-[10px] bg-slate-300 px-1 rounded">
                              {t('battleship.ourTeamTag')}
                            </span>
                          )}
                        </span>
                        <span className="font-mono bg-black text-white px-2 py-0.5 rounded">
                          {t('battleship.shipsRemainingLabel', { count: remaining })}
                        </span>
                      </button>
                    );
                  })
                : // FFA or Multi-Board: List each player
                  room?.players
                    .filter((p) => !p.isViewer && p.connected !== false)
                    .map((player) => {
                      const isSelf = player.socketId === socketId;
                      const isSelected = selectedTargetId === player.socketId;
                      const isTargetAlive = state.alivePlayerIds.includes(player.socketId);
                      const remaining = state.shipsRemaining[player.socketId] ?? 0;

                      return (
                        <button
                          key={player.socketId}
                          data-testid="battleship-target-player"
                          aria-pressed={isSelected}
                          onClick={() =>
                            !isSelf && isTargetAlive && setSelectedTargetId(player.socketId)
                          }
                          disabled={isSelf || !isTargetAlive}
                          className={`min-w-[140px] flex-1 flex flex-col gap-1 p-2 rounded-lg border-3 border-black text-xs font-black transition-all ${
                            isSelected
                              ? 'bg-[#fed7aa] shadow-[3px_3px_0_0_#000] scale-[1.02]'
                              : !isTargetAlive
                                ? 'bg-slate-200 opacity-40 cursor-not-allowed'
                                : isSelf
                                  ? 'bg-slate-100 opacity-60 cursor-default'
                                  : 'bg-white hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="truncate max-w-[85px]">{player.name}</span>
                            {!isTargetAlive && <Skull className="w-3.5 h-3.5 text-red-600" />}
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span>
                              {isSelf
                                ? t('battleship.youTag')
                                : isTargetAlive
                                  ? t('battleship.statusAlive')
                                  : t('battleship.statusSunk')}
                            </span>
                            <span className="bg-black text-white px-1.5 py-0.2 rounded">
                              {t('battleship.shipsCountUnit', { count: remaining })}
                            </span>
                          </div>
                        </button>
                      );
                    })}
            </div>
          </div>

          {/* Mobile Tab Switcher (TARGET vs MY OCEAN) */}
          <div className="flex sm:hidden gap-2">
            <button
              onClick={() => setActiveTab('TARGET')}
              className={`flex-1 py-2 font-black text-xs border-3 border-black rounded-lg shadow-[2px_2px_0_0_#000] ${
                activeTab === 'TARGET' ? 'bg-[#38bdf8]' : 'bg-white'
              }`}
            >
              🎯 {t('battleship.targetOcean')}
            </button>
            <button
              onClick={() => setActiveTab('MY_OCEAN')}
              className={`flex-1 py-2 font-black text-xs border-3 border-black rounded-lg shadow-[2px_2px_0_0_#000] ${
                activeTab === 'MY_OCEAN' ? 'bg-[#38bdf8]' : 'bg-white'
              }`}
            >
              🛡️ {t('battleship.myOcean')}
            </button>
          </div>

          {/* Active Grids Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Grid (For Firing) */}
            <div
              className={`flex flex-col items-center p-4 bg-[#0f172a] border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000] ${
                activeTab === 'TARGET' ? 'flex' : 'hidden sm:flex'
              }`}
            >
              <div className="w-full flex items-center justify-between mb-3 text-white">
                <span className="font-black text-sm flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-rose-400" />
                  {t('battleship.targetOcean')}
                </span>
                {selectedFireCoord && (
                  <span className="font-mono text-xs bg-rose-500 text-white px-2 py-0.5 border border-black rounded">
                    {t('battleship.aimingAt', {
                      x: selectedFireCoord.x + 1,
                      y: selectedFireCoord.y + 1,
                    })}
                  </span>
                )}
              </div>

              <div
                className="grid gap-1 bg-slate-900 p-2.5 border-4 border-black rounded-xl shadow-[3px_3px_0_0_#000]"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                  const x = idx % gridSize;
                  const y = Math.floor(idx / gridSize);
                  const coordKey = `${x},${y}`;
                  const status: CellStatus | undefined = targetBoard[coordKey];
                  const isSelected = selectedFireCoord?.x === x && selectedFireCoord?.y === y;
                  const ping = teamPings.find((p) => p.x === x && p.y === y);

                  return (
                    <button
                      key={coordKey}
                      data-testid="battleship-target-cell"
                      aria-label={t('battleship.cellAriaLabel', { x: x + 1, y: y + 1 })}
                      aria-pressed={isSelected}
                      onClick={() => !status && isAlive && setSelectedFireCoord({ x, y })}
                      disabled={!!status || !isAlive}
                      className={`relative w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center font-black text-xs border rounded transition-all ${
                        status === 'HIT'
                          ? 'bg-rose-500 text-white border-2 border-black'
                          : status === 'SUNK'
                            ? 'bg-amber-600 text-white border-2 border-black'
                            : status === 'MISS'
                              ? 'bg-sky-700/60 text-sky-200 border-sky-800'
                              : status === 'COLLISION'
                                ? 'bg-red-600 text-yellow-300 font-extrabold border-2 border-black animate-pulse'
                                : isSelected
                                  ? 'bg-amber-400 border-2 border-black scale-110 shadow-[2px_2px_0_0_#000]'
                                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      {status === 'HIT' && <Flame className="w-4 h-4 text-yellow-300" />}
                      {status === 'SUNK' && <Skull className="w-4 h-4 text-white" />}
                      {status === 'MISS' && (
                        <Waves className="w-3.5 h-3.5 text-sky-300 opacity-60" />
                      )}
                      {status === 'COLLISION' && '💥'}
                      {!status && isSelected && '🎯'}
                      {ping && !status && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-black animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Firing Controls */}
              <div className="w-full flex gap-2 mt-4">
                <button
                  data-testid="battleship-fire-btn"
                  onClick={handleFire}
                  disabled={
                    !selectedFireCoord || (!isMyTurn && state.mode !== 'FREE_FOR_ALL') || !isAlive
                  }
                  className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed border-4 border-black rounded-xl font-black text-sm text-white shadow-[3px_3px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {t('battleship.fireMissileBtn')}
                </button>

                {state.mode === 'TEAM_VS_TEAM' && state.teamFleetMode === 'SHARED_BOARD' && (
                  <button
                    data-testid="battleship-ping-btn"
                    onClick={handlePing}
                    disabled={!selectedFireCoord || !isAlive}
                    className="py-3 px-4 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 border-4 border-black rounded-xl font-black text-sm text-black shadow-[3px_3px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
                    title={t('battleship.pingTargetTitle')}
                  >
                    {t('battleship.pingTargetBtn')}
                  </button>
                )}
              </div>
            </div>

            {/* My Ocean Grid (Defending View) */}
            <div
              className={`flex flex-col items-center p-4 bg-[#0284c7] border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000] ${
                activeTab === 'MY_OCEAN' ? 'flex' : 'hidden sm:flex'
              }`}
            >
              <div className="w-full flex items-center justify-between mb-3 text-white">
                <span className="font-black text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-300" />
                  {t('battleship.myOcean')} {t('battleship.myOceanSubtitle')}
                </span>
                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">
                  {t('battleship.shipsRemainingLabel', {
                    count: myTargetId ? (state.shipsRemaining[myTargetId] ?? 0) : 0,
                  })}
                </span>
              </div>

              <div
                className="grid gap-1 bg-sky-950 p-2.5 border-4 border-black rounded-xl shadow-[3px_3px_0_0_#000]"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                  const x = idx % gridSize;
                  const y = Math.floor(idx / gridSize);
                  const coordKey = `${x},${y}`;

                  // Ships from private state
                  const myShips = myPrivateOcean?.ships || placedShips;
                  const occupyingShip = myShips.find((s) => {
                    for (let i = 0; i < s.length; i++) {
                      const sx = s.orientation === 'HORIZONTAL' ? s.x + i : s.x;
                      const sy = s.orientation === 'VERTICAL' ? s.y + i : s.y;
                      if (sx === x && sy === y) return true;
                    }
                    return false;
                  });

                  // Has enemy shot this cell?
                  const enemyHitStatus = myBoardHits[coordKey];

                  return (
                    <div
                      key={coordKey}
                      className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center font-black text-xs border rounded ${
                        enemyHitStatus === 'SUNK'
                          ? 'bg-amber-600 text-white border-2 border-black'
                          : enemyHitStatus === 'HIT'
                            ? 'bg-rose-500 text-yellow-200 border-2 border-black'
                            : enemyHitStatus === 'MISS'
                              ? 'bg-sky-900 text-sky-400 border border-sky-800'
                              : enemyHitStatus === 'COLLISION'
                                ? 'bg-red-600 text-white border-2 border-black'
                                : occupyingShip
                                  ? 'bg-emerald-400 border-2 border-black text-black'
                                  : 'bg-sky-800/70 border-sky-700'
                      }`}
                    >
                      {enemyHitStatus === 'HIT' && <Flame className="w-3.5 h-3.5" />}
                      {enemyHitStatus === 'SUNK' && <Skull className="w-3.5 h-3.5" />}
                      {enemyHitStatus === 'MISS' && <Waves className="w-3 h-3 opacity-50" />}
                      {enemyHitStatus === 'COLLISION' && '💥'}
                      {!enemyHitStatus && occupyingShip && SHIP_ICONS[occupyingShip.type]}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PHASE 3: RESULT PHASE (GAME OVER & FULL OCEAN REVEAL) --- */}
      {state.phase === 'RESULT' && (
        <div
          data-testid="battleship-winner-banner"
          className="flex flex-col gap-6 p-4 sm:p-6 bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0_0_#000]"
        >
          {/* Winner Title */}
          <div className="flex flex-col items-center text-center gap-2 p-4 bg-amber-300 border-4 border-black rounded-xl shadow-[4px_4px_0_0_#000]">
            <Award className="w-12 h-12 text-black animate-bounce" />
            <h2 className="font-black text-2xl sm:text-3xl text-slate-900">
              {state.winner?.team
                ? state.winner.team === 'RED'
                  ? t('battleship.winnerTeamRed')
                  : t('battleship.winnerTeamBlue')
                : t('battleship.winnerPlayer', { name: state.winner?.playerName ?? '' })}
            </h2>
            <p className="text-sm font-bold text-slate-800">
              {state.mode === 'TEAM_VS_TEAM'
                ? t('battleship.winnerTeamDesc')
                : t('battleship.winnerFfaDesc')}
            </p>
          </div>

          {/* Full Ocean Reveal Section (ADR 0016 Q14) */}
          <div className="flex flex-col gap-3">
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5" />
              {t('battleship.fullOceanReveal')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(state.revealedOceanGrids || {}).map(([targetId, ships]) => {
                const title =
                  targetId === 'RED'
                    ? t('battleship.redTeamFleet')
                    : targetId === 'BLUE'
                      ? t('battleship.blueTeamFleet')
                      : room?.players.find((p) => p.socketId === targetId)?.name || targetId;

                const boardStatus = state.targetGrids[targetId] || {};

                return (
                  <div
                    key={targetId}
                    className="flex flex-col items-center p-3 bg-slate-900 border-3 border-black rounded-xl"
                  >
                    <span className="font-black text-xs text-white mb-2">{title}</span>
                    <div
                      className="grid gap-0.5 bg-slate-950 p-2 border-2 border-black rounded-lg"
                      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                        const x = idx % gridSize;
                        const y = Math.floor(idx / gridSize);
                        const coordKey = `${x},${y}`;

                        const ship = ships.find((s) => {
                          for (let i = 0; i < s.length; i++) {
                            const sx = s.orientation === 'HORIZONTAL' ? s.x + i : s.x;
                            const sy = s.orientation === 'VERTICAL' ? s.y + i : s.y;
                            if (sx === x && sy === y) return true;
                          }
                          return false;
                        });

                        const shot = boardStatus[coordKey];

                        return (
                          <div
                            key={coordKey}
                            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-[10px] border border-slate-800 rounded ${
                              shot === 'HIT' || shot === 'SUNK'
                                ? 'bg-rose-500 text-white font-black'
                                : shot === 'MISS'
                                  ? 'bg-sky-950 text-sky-400'
                                  : ship
                                    ? 'bg-emerald-400 font-black text-black'
                                    : 'bg-slate-800'
                            }`}
                          >
                            {ship ? SHIP_ICONS[ship.type] : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Battle Statistics Table */}
          <div className="flex flex-col gap-2">
            <h3 className="font-black text-base text-slate-900">
              {t('battleship.battleStatsTitle')}
            </h3>
            <div className="overflow-x-auto border-3 border-black rounded-xl">
              <table className="w-full text-xs font-bold text-left bg-white">
                <thead className="bg-slate-100 border-b-2 border-black font-black uppercase">
                  <tr>
                    <th className="p-2.5">{t('battleship.statsPlayer')}</th>
                    <th className="p-2.5">{t('battleship.statsShotsFired')}</th>
                    <th className="p-2.5">{t('battleship.statsHits')}</th>
                    <th className="p-2.5">{t('battleship.statsShipsSunk')}</th>
                    <th className="p-2.5">{t('battleship.statsCollisions')}</th>
                    <th className="p-2.5">{t('battleship.statsAccuracy')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {Object.entries(state.battleStats).map(([pid, stats]) => {
                    const player = room?.players.find((p) => p.socketId === pid);
                    return (
                      <tr key={pid} className="hover:bg-slate-50 font-mono">
                        <td className="p-2.5 font-sans font-black">{player?.name || pid}</td>
                        <td className="p-2.5">{stats.shotsFired}</td>
                        <td className="p-2.5 text-emerald-600">{stats.hits}</td>
                        <td className="p-2.5 text-amber-600">{stats.shipsSunk}</td>
                        <td className="p-2.5 text-rose-600">{stats.collisions}</td>
                        <td className="p-2.5 font-black text-slate-900">{stats.accuracy}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Play Again Button */}
          {isHost && (
            <button
              data-testid="battleship-reset-btn"
              onClick={battleshipReset}
              className="w-full py-3.5 bg-emerald-400 hover:bg-emerald-500 border-4 border-black rounded-xl font-black text-base shadow-[4px_4px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
            >
              {t('battleship.returnToLobbyBtn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
