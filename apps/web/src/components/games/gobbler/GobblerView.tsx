'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, GobblerSize, GobblerPiece, PlayerSide } from '@repo/types';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarEmoji } from '@/components/core/utils';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import clsx from 'clsx';

const SIZE_STYLES: Record<GobblerSize, { board: string; inventory: string }> = {
  SMALL: { board: 'w-[40%] h-[40%] border-[3px]', inventory: 'w-6 h-6 sm:w-8 sm:h-8 border-2' },
  MEDIUM: {
    board: 'w-[65%] h-[65%] border-[4px]',
    inventory: 'w-9 h-9 sm:w-12 sm:h-12 border-[2.5px]',
  },
  LARGE: {
    board: 'w-[90%] h-[90%] border-[5px]',
    inventory: 'w-12 h-12 sm:w-16 sm:h-16 border-[3px]',
  },
};

const COLOR_STYLES: Record<PlayerSide, { base: string; glow: string; text: string }> = {
  X: {
    base: 'border-cyan-400 bg-cyan-500/10',
    glow: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]',
    text: 'text-cyan-300',
  },
  O: {
    base: 'border-pink-500 bg-pink-500/10',
    glow: 'shadow-[0_0_15px_rgba(236,72,153,0.2)]',
    text: 'text-pink-300',
  },
};

export function GobblerView() {
  const { room, socketId, gobblerJoinSide, gobblerPlacePiece, gobblerMovePiece, gobblerReset, actionLoading } =
    useGameStore();
  const gb = room?.gobblerState;

  const [selectedInventoryPieceId, setSelectedInventoryPieceId] = useState<string | null>(null);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);

  if (!gb) return null;

  const mySide = gb.playerXId === socketId ? 'X' : gb.playerOId === socketId ? 'O' : null;
  const isMyTurn = mySide === gb.currentTurn && room.status === RoomStatus.PLAYING;

  const handleCellClick = (index: number) => {
    if (!isMyTurn || actionLoading) return;

    if (selectedInventoryPieceId) {
      gobblerPlacePiece(selectedInventoryPieceId, index);
      setSelectedInventoryPieceId(null);
    } else if (selectedBoardIndex !== null) {
      if (selectedBoardIndex === index) {
        setSelectedBoardIndex(null);
      } else {
        gobblerMovePiece(selectedBoardIndex, index);
        setSelectedBoardIndex(null);
      }
    } else {
      const cell = gb.board[index];
      if (cell.length > 0) {
        const topPiece = cell[cell.length - 1];
        if (topPiece.side === mySide) {
          setSelectedBoardIndex(index);
        }
      }
    }
  };

  const handleInventoryClick = (pieceId: string) => {
    if (!isMyTurn || actionLoading) return;
    setSelectedBoardIndex(null); // Clear board selection
    if (selectedInventoryPieceId === pieceId) {
      setSelectedInventoryPieceId(null);
    } else {
      setSelectedInventoryPieceId(pieceId);
    }
  };

  const renderPiece = (
    piece: GobblerPiece,
    isSelected: boolean = false,
    context: 'inventory' | 'board' = 'board',
  ) => {
    return (
      <motion.div
        key={context + '-' + piece.id}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className={clsx(
          'rounded-full flex items-center justify-center transition-all flex-shrink-0 backdrop-blur-sm',
          SIZE_STYLES[piece.size][context],
          COLOR_STYLES[piece.side].base,
          COLOR_STYLES[piece.side].glow,
          isSelected &&
            'ring-[3px] sm:ring-4 ring-white shadow-[0_0_25px_rgba(255,255,255,0.7)] z-20 scale-105',
        )}
      >
        <div
          className={clsx(
            'font-black leading-none select-none drop-shadow-lg',
            COLOR_STYLES[piece.side].text,
            context === 'inventory'
              ? piece.size === 'SMALL'
                ? 'text-[10px] sm:text-xs'
                : piece.size === 'MEDIUM'
                  ? 'text-sm sm:text-lg'
                  : 'text-lg sm:text-2xl'
              : piece.size === 'SMALL'
                ? 'text-lg sm:text-2xl'
                : piece.size === 'MEDIUM'
                  ? 'text-3xl sm:text-5xl'
                  : 'text-5xl sm:text-7xl',
          )}
        >
          {piece.side}
        </div>
      </motion.div>
    );
  };

  const renderInventory = (side: PlayerSide) => {
    const isInventoryOwner = mySide === side;
    const inventory = gb.inventory[side];

    const smalls = inventory.filter((p) => p.size === 'SMALL');
    const mediums = inventory.filter((p) => p.size === 'MEDIUM');
    const larges = inventory.filter((p) => p.size === 'LARGE');

    const renderStack = (pieces: GobblerPiece[]) => {
      if (pieces.length === 0) {
        return (
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-[1.25rem] bg-amber-100/20 border-2 border-amber-300/20 border-dashed flex-shrink-0" />
        );
      }
      const topPiece = pieces[0];
      const count = pieces.length;
      const isSelected = selectedInventoryPieceId === topPiece.id;

      return (
        <div
          className={clsx(
            'relative w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 bg-amber-100/40 backdrop-blur-md rounded-[1.25rem] transition-all border border-amber-300/50 shadow-inner flex items-center justify-center group',
            isInventoryOwner
              ? 'cursor-pointer hover:bg-amber-200/50 hover:border-slate-500/50 hover:shadow-lg hover:-translate-y-1'
              : 'opacity-80',
            isSelected &&
              'bg-amber-200/80 border-white/40 shadow-xl ring-2 ring-white/20 -translate-y-1',
          )}
          onClick={() => isInventoryOwner && handleInventoryClick(topPiece.id)}
        >
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            {renderPiece(topPiece, isSelected, 'inventory')}
          </div>

          <div className="absolute -bottom-2 -right-2 bg-white/90 text-slate-800 text-[10px] sm:text-xs font-black px-2 sm:px-3 py-0.5 sm:py-1 rounded-xl border border-amber-300 z-20 shadow-lg backdrop-blur-xl">
            x{count}
          </div>
        </div>
      );
    };

    const isActive = room.status === RoomStatus.PLAYING && gb.currentTurn === side;

    return (
      <div
        className={clsx(
          'flex flex-col gap-3 p-4 sm:p-5 rounded-[2rem] border transition-all duration-500 w-full relative overflow-hidden backdrop-blur-sm shadow-2xl',
          isActive
            ? side === 'X'
              ? 'bg-cyan-950/20 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/20'
              : 'bg-pink-950/20 border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.15)] ring-1 ring-pink-500/20'
            : 'bg-white/40 border-amber-200/50',
        )}
      >
        {isActive && (
          <div
            className={clsx(
              'absolute top-0 left-0 w-full h-[2px] animate-pulse',
              side === 'X'
                ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'
                : 'bg-gradient-to-r from-transparent via-pink-400 to-transparent',
            )}
          />
        )}
        <div className="flex justify-between items-center w-full px-2">
          <h4
            className={clsx(
              'text-xs sm:text-sm font-black uppercase tracking-widest',
              side === 'X' ? 'text-cyan-400/80' : 'text-pink-400/80',
            )}
          >
            {side} Inventory
          </h4>
          {isActive && (
            <span className="flex h-2 w-2 relative">
              <span
                className={clsx(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  side === 'X' ? 'bg-cyan-400' : 'bg-pink-400',
                )}
              ></span>
              <span
                className={clsx(
                  'relative inline-flex rounded-full h-2 w-2',
                  side === 'X' ? 'bg-cyan-500' : 'bg-pink-500',
                )}
              ></span>
            </span>
          )}
        </div>
        <div className="flex gap-4 sm:gap-6 justify-center">
          {renderStack(smalls)}
          {renderStack(mediums)}
          {renderStack(larges)}
        </div>
      </div>
    );
  };

  const getPlayerDetails = (playerId?: string) => {
    return room.players.find((p) => p.socketId === playerId);
  };

  const pX = getPlayerDetails(gb.playerXId);
  const pO = getPlayerDetails(gb.playerOId);

  // Layout decision for mobile
  // Top side is the opposing player (or X if spectating)
  // Bottom side is current player (or O if spectating)
  const bottomSide = mySide || 'X';
  const topSide = bottomSide === 'X' ? 'O' : 'X';

  const pTop = topSide === 'X' ? pX : pO;
  const pBottom = bottomSide === 'X' ? pX : pO;

  const renderPlayerHeader = (side: PlayerSide, details: any) => {
    const isActive = room.status === RoomStatus.PLAYING && gb.currentTurn === side;
    const isMe = details?.socketId === socketId;
    return (
      <div
        className={clsx(
          'flex items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 rounded-full border bg-white/50 backdrop-blur-md shadow-xl transition-all duration-300',
          isActive
            ? side === 'X'
              ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
              : 'border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
            : 'border-amber-200',
        )}
      >
        <div
          className={clsx(
            'w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl shadow-inner border-2',
            side === 'X'
              ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-200'
              : 'bg-pink-950/50 border-pink-500/30 text-pink-200',
          )}
        >
          {details ? getAvatarEmoji(details.id) : '👤'}
        </div>
        <div className="flex flex-col">
          <div className="text-sm sm:text-lg font-black text-white">
            {details ? details.name : `Player ${side}`}
            {isMe && (
              <span className="ml-2 text-slate-600 font-medium text-xs sm:text-sm">(You)</span>
            )}
          </div>
          <div
            className={clsx(
              'text-[10px] sm:text-xs font-bold uppercase tracking-widest',
              side === 'X' ? 'text-cyan-400' : 'text-pink-400',
            )}
          >
            Team {side}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 w-full relative">
      {actionLoading && <ActionLoadingOverlay />}
      {room.status === RoomStatus.LOBBY && (
        <div className="bg-white/60 backdrop-blur-xl border border-amber-300/50 rounded-[2.5rem] p-6 sm:p-10 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 rounded-3xl mx-auto mb-6 flex items-center justify-center text-3xl sm:text-4xl shadow-inner border border-amber-300/50 rotate-3">
            🦃
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3 text-white drop-shadow-sm">
            Gobbler
          </h2>
          <p className="text-slate-600 text-center mb-10 font-medium text-sm sm:text-base px-4">
            Larger pieces can gobble smaller ones! Select your team to begin.
          </p>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <button
              onClick={() => gobblerJoinSide('X')}
              disabled={actionLoading || (!!gb.playerXId && gb.playerXId !== socketId)}
              className={clsx(
                'p-6 sm:p-8 rounded-[2rem] border-[3px] transition-all flex flex-col items-center gap-4 group relative overflow-hidden',
                gb.playerXId === socketId
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                  : gb.playerXId
                    ? 'border-amber-200 bg-white/50 opacity-50 cursor-not-allowed'
                    : 'border-amber-300 bg-amber-100/50 hover:border-cyan-400/50 hover:bg-amber-100 hover:shadow-xl hover:-translate-y-1',
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl sm:text-6xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] group-hover:scale-110 transition-transform duration-300">
                X
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest z-10">
                {pX ? pX.name : 'Join X'}
              </div>
            </button>

            <button
              onClick={() => gobblerJoinSide('O')}
              disabled={actionLoading || (!!gb.playerOId && gb.playerOId !== socketId)}
              className={clsx(
                'p-6 sm:p-8 rounded-[2rem] border-[3px] transition-all flex flex-col items-center gap-4 group relative overflow-hidden',
                gb.playerOId === socketId
                  ? 'border-pink-500 bg-pink-500/10 shadow-[0_0_30px_rgba(236,72,153,0.2)]'
                  : gb.playerOId
                    ? 'border-amber-200 bg-white/50 opacity-50 cursor-not-allowed'
                    : 'border-amber-300 bg-amber-100/50 hover:border-pink-500/50 hover:bg-amber-100 hover:shadow-xl hover:-translate-y-1',
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl sm:text-6xl font-black text-pink-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.4)] group-hover:scale-110 transition-transform duration-300">
                O
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest z-10">
                {pO ? pO.name : 'Join O'}
              </div>
            </button>
          </div>
        </div>
      )}

      {room.status !== RoomStatus.LOBBY && (
        <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-4 sm:gap-8 items-center justify-center min-h-[500px]">
          {/* Top/Left Player */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full md:w-80 order-1 flex-shrink-0 z-10">
            {renderPlayerHeader(topSide, pTop)}
            {renderInventory(topSide)}
          </div>

          {/* Board Area */}
          <div className="order-2 w-full max-w-[340px] sm:max-w-[420px] md:max-w-[460px] flex-shrink-0 relative my-2 sm:my-0 flex flex-col items-center">
            {/* Scoreboard */}
            <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md rounded-2xl px-6 py-3 border border-amber-300/50 shadow-lg mb-4 sm:mb-6">
              <div className="flex flex-col items-center">
                <span className="text-cyan-400 font-black text-2xl sm:text-3xl leading-none">
                  {gb.scores.X}
                </span>
                <span className="text-[10px] text-cyan-500/80 font-bold uppercase tracking-widest mt-1">
                  Team X
                </span>
              </div>
              <div className="text-slate-500 font-bold text-xl px-2">-</div>
              <div className="flex flex-col items-center">
                <span className="text-pink-400 font-black text-2xl sm:text-3xl leading-none">
                  {gb.scores.O}
                </span>
                <span className="text-[10px] text-pink-500/80 font-bold uppercase tracking-widest mt-1">
                  Team O
                </span>
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-xl border border-amber-300/50 rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-2xl w-full relative">
              {/* Turn Indicator inside board area */}
              {room.status === RoomStatus.PLAYING && (
                <div className="absolute -top-4 sm:-top-5 left-1/2 -translate-x-1/2 bg-amber-100/90 text-slate-800 px-5 sm:px-8 py-2 sm:py-2.5 rounded-full border border-amber-400/50 shadow-xl backdrop-blur-md z-30 flex items-center gap-2">
                  <div
                    className={clsx(
                      'w-2 h-2 rounded-full',
                      gb.currentTurn === mySide ? 'bg-green-400 animate-pulse' : 'bg-slate-500',
                    )}
                  />
                  <span className="text-xs sm:text-sm font-black uppercase tracking-widest whitespace-nowrap">
                    {gb.currentTurn === mySide ? 'Your Turn' : `${gb.currentTurn}'s Turn`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full aspect-square relative z-10 mt-2 sm:mt-4">
                {gb.board.map((cellStack, idx) => {
                  const isWinningCell = gb.winningLine?.includes(idx);
                  const canPlaceHere =
                    (selectedInventoryPieceId && isMyTurn) ||
                    (selectedBoardIndex !== null && selectedBoardIndex !== idx && isMyTurn);
                  const isSelectedCellToMove = selectedBoardIndex === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleCellClick(idx)}
                      className={clsx(
                        'bg-amber-50/60 border-2 rounded-[1.25rem] sm:rounded-[1.75rem] relative overflow-hidden transition-all duration-300 group flex items-center justify-center',
                        isSelectedCellToMove
                          ? 'border-white/60 bg-white/10 shadow-[inset_0_0_30px_rgba(255,255,255,0.2)]'
                          : isWinningCell
                            ? 'border-green-400 bg-green-500/20 shadow-[0_0_30px_rgba(74,222,128,0.4)] z-20 scale-105'
                            : canPlaceHere
                              ? 'border-amber-400/80 hover:border-slate-400 hover:bg-amber-100/80 hover:shadow-lg'
                              : 'border-amber-200/50',
                        isMyTurn ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <AnimatePresence>
                        {cellStack.map((piece, pieceIdx) => {
                          const isTopMost = pieceIdx === cellStack.length - 1;
                          return (
                            <div
                              key={piece.id}
                              className={clsx(
                                'absolute inset-0 flex items-center justify-center w-full h-full transition-opacity duration-300',
                                !isTopMost && 'opacity-0 pointer-events-none',
                              )}
                            >
                              {renderPiece(piece, isSelectedCellToMove && isTopMost, 'board')}
                            </div>
                          );
                        })}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Result Overlay Container directly over the board area to fit cleanly */}
            <AnimatePresence>
              {room.status === RoomStatus.RESULT && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 -m-4 sm:-m-8 z-50 flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-amber-50/80 backdrop-blur-md rounded-[3rem] shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
                  <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center w-full">
                    {gb.winner === 'DRAW' ? (
                      <>
                        <div className="text-5xl sm:text-7xl mb-4 sm:mb-6 animate-bounce">🤝</div>
                        <div className="text-3xl sm:text-5xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-lg">
                          Draw!
                        </div>
                        <div className="text-slate-700 font-medium mb-6 sm:mb-8 text-sm sm:text-lg">
                          A truly balanced match.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-5xl sm:text-7xl mb-4 sm:mb-6 animate-bounce">🏆</div>
                        <div
                          className="text-3xl sm:text-5xl font-black uppercase tracking-widest mb-2 drop-shadow-lg"
                          style={{ color: gb.winner === 'X' ? '#22d3ee' : '#f472b6' }}
                        >
                          {gb.winner} Wins!
                        </div>
                        <div className="text-slate-700 font-medium mb-6 sm:mb-10 text-sm sm:text-lg">
                          <strong className="text-white">
                            {gb.winner === 'X' ? pX?.name : pO?.name}
                          </strong>{' '}
                          claims victory!
                        </div>
                      </>
                    )}

                    {(room.roomHostId === socketId || mySide) && (
                      <button
                        onClick={gobblerReset}
                        disabled={actionLoading}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 text-slate-800 font-black px-6 sm:px-10 py-3 sm:py-4 rounded-2xl transition-all shadow-xl hover:shadow-white/10 active:scale-95 uppercase tracking-widest text-sm sm:text-lg backdrop-blur-md overflow-hidden relative group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                        Play Again
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom/Right Player */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full md:w-80 order-3 flex-shrink-0 z-10">
            {renderInventory(bottomSide)}
            {renderPlayerHeader(bottomSide, pBottom)}
          </div>
        </div>
      )}
    </div>
  );
}
