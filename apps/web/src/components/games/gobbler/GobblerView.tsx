'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, GobblerSize, GobblerPiece, PlayerSide, UserState } from '@repo/types';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslate } from '@/hooks/useTranslate';
import { getAvatarEmoji } from '@/components/core/utils';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import clsx from 'clsx';

const SIZE_STYLES: Record<GobblerSize, { board: string; inventory: string }> = {
  SMALL: {
    board: 'w-[40%] h-[40%] border-[3px]',
    inventory: 'w-6 h-6 sm:w-8 sm:h-8 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-8 2xl:h-8 border',
  },
  MEDIUM: {
    board: 'w-[65%] h-[65%] border-[4px]',
    inventory:
      'w-9 h-9 sm:w-12 sm:h-12 lg:w-7 lg:h-7 xl:w-9 xl:h-9 2xl:w-12 2xl:h-12 border-[2.5px]',
  },
  LARGE: {
    board: 'w-[90%] h-[90%] border-[5px]',
    inventory:
      'w-12 h-12 sm:w-16 sm:h-16 lg:w-10 lg:h-10 xl:w-12 xl:h-12 2xl:w-16 2xl:h-16 border-[3px]',
  },
};



export function GobblerView() {
  const {
    room,
    socketId,
    gobblerJoinSide,
    gobblerPlacePiece,
    gobblerMovePiece,
    gobblerReset,
    actionLoading,
  } = useGameStore();
  const { t } = useTranslate();
  const gb = room?.gobblerState;

  const [selectedInventoryPieceId, setSelectedInventoryPieceId] = useState<string | null>(null);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!gb) return;
    if (selectedInventoryPieceId) {
      const allPieces = [...gb.inventory.X, ...gb.inventory.O];
      if (!allPieces.some((p) => p.id === selectedInventoryPieceId)) {
        setSelectedInventoryPieceId(null);
      }
    }
  }, [gb, selectedInventoryPieceId]);

  useEffect(() => {
    if (!gb || selectedBoardIndex === null) return;
    const cell = gb.board[selectedBoardIndex];
    if (!cell || cell.length === 0) {
      setSelectedBoardIndex(null);
    } else if (mySide && cell[cell.length - 1].side !== mySide) {
      setSelectedBoardIndex(null);
    }
  }, [gb, selectedBoardIndex, mySide]);

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
    setSelectedBoardIndex(null);
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
          'rounded-full flex items-center justify-center transition-all flex-shrink-0 border-4 border-black font-mono',
          SIZE_STYLES[piece.size][context],
          piece.side === 'X' ? 'bg-cyan-300' : 'bg-pink-300',
          isSelected
            ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1 scale-105 z-20'
            : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
        )}
      >
        <div
          className={clsx(
            'font-black leading-none select-none drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] text-black',
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

    const renderStack = (pieces: GobblerPiece[], stackIndex: number) => {
      if (pieces.length === 0) {
        return (
          <div
            data-testid={`gobbler-inventory-${side}-stack-${stackIndex}`}
            className="w-14 h-14 sm:w-20 sm:h-20 lg:w-12 lg:h-12 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 bg-gray-100 border-4 border-black border-dashed flex-shrink-0"
          />
        );
      }
      const topPiece = pieces[0];
      const count = pieces.length;
      const isSelected = selectedInventoryPieceId === topPiece.id;

      return (
        <div
          data-testid={`gobbler-inventory-${side}-stack-${stackIndex}`}
          className={clsx(
            'relative w-14 h-14 sm:w-20 sm:h-20 lg:w-12 lg:h-12 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 flex-shrink-0 bg-white border-4 border-black transition-all flex items-center justify-center group font-mono',
            isInventoryOwner
              ? 'cursor-pointer hover:bg-yellow-300 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              : 'opacity-80',
            isSelected
              ? 'bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1'
              : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
          )}
          onClick={() => isInventoryOwner && handleInventoryClick(topPiece.id)}
        >
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            {renderPiece(topPiece, isSelected, 'inventory')}
          </div>

          <div className="absolute -bottom-2 -right-2 bg-white text-black text-[10px] sm:text-xs font-black px-2 py-0.5 border-2 border-black z-20 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            x{count}
          </div>
        </div>
      );
    };

    const isActive = room.status === RoomStatus.PLAYING && gb.currentTurn === side;

    return (
      <div
        className={clsx(
          'flex flex-col gap-2 sm:gap-3 p-3 sm:p-5 lg:p-2 xl:p-4 2xl:p-5 border-4 transition-all duration-500 w-full relative overflow-hidden font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
          isActive
            ? side === 'X'
              ? 'bg-cyan-300 border-black'
              : 'bg-pink-300 border-black'
            : 'bg-white border-black',
        )}
      >
        <div className="flex justify-between items-center w-full px-2 border-b-4 border-black border-dashed pb-2 mb-2 bg-white">
          <h4
            className={clsx('text-xs sm:text-sm font-black uppercase tracking-widest text-black')}
          >
            {t('gameGobbler.inventory', { side })}
          </h4>
          {isActive && (
            <span className="flex h-3 w-3 relative border-2 border-black bg-white ">
              <span className="animate-ping absolute inline-flex h-full w-full bg-black opacity-75"></span>
              <span className="relative inline-flex h-full w-full bg-black"></span>
            </span>
          )}
        </div>
        <div className="flex gap-2 sm:gap-6 lg:gap-1.5 xl:gap-4 2xl:gap-6 justify-center mt-2">
          {renderStack(smalls, 0)}
          {renderStack(mediums, 1)}
          {renderStack(larges, 2)}
        </div>
      </div>
    );
  };

  const getPlayerDetails = (playerId?: string) => {
    return room.players.find((p) => p.socketId === playerId);
  };

  const pX = getPlayerDetails(gb.playerXId);
  const pO = getPlayerDetails(gb.playerOId);

  const bottomSide = mySide || 'X';
  const topSide = bottomSide === 'X' ? 'O' : 'X';

  const pTop = topSide === 'X' ? pX : pO;
  const pBottom = bottomSide === 'X' ? pX : pO;

  const renderPlayerHeader = (side: PlayerSide, details: UserState | undefined) => {
    const isActive = room.status === RoomStatus.PLAYING && gb.currentTurn === side;
    const isMe = details?.socketId === socketId;
    return (
      <div
        className={clsx(
          'flex items-center gap-3 sm:gap-4 px-3 py-2 sm:px-6 sm:py-4 lg:px-2 lg:py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 border-4 transition-all duration-300 font-mono',
          isActive
            ? side === 'X'
              ? 'bg-cyan-300 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-pink-300 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grayscale opacity-80',
        )}
      >
        <div
          className={clsx(
            'w-10 h-10 sm:w-14 sm:h-14 lg:w-8 lg:h-8 xl:w-12 xl:h-12 2xl:w-14 2xl:h-14 flex flex-shrink-0 items-center justify-center text-xl sm:text-2xl lg:text-lg xl:text-xl border-2 border-black bg-white',
          )}
        >
          {details ? details.avatar || getAvatarEmoji(details.id) : '👤'}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="text-sm sm:text-lg lg:text-xs xl:text-base 2xl:text-lg font-black text-black truncate w-full">
            {details ? details.name : t('gameGobbler.player', { side })}
            {isMe && (
              <span className="ml-2 text-black bg-white px-1 border-2 border-black font-bold text-xs sm:text-sm inline-block -">
                {t('lobby.you')}
              </span>
            )}
          </div>
          <div
            className={clsx(
              'text-[10px] sm:text-xs font-black uppercase tracking-widest text-black bg-white px-1 border border-black inline-block mt-1',
            )}
          >
            {t('gameGobbler.team', { side })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 w-full relative">
      {actionLoading && <ActionLoadingOverlay />}
      {room.status === RoomStatus.LOBBY && (
        <div className="bg-white border-4 border-black p-6 sm:p-10 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500 font-mono">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-300 border-4 border-black mx-auto mb-6 flex items-center justify-center text-3xl sm:text-4xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            🦃
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-3 text-black uppercase tracking-tight">
            {t('gameGobbler.lobby')}
          </h2>
          <p className="text-black text-center mb-10 font-bold text-sm sm:text-base px-4 border-b-4 border-black border-dashed pb-6">
            {t('gameGobbler.gobblerTagline')}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <button
              onClick={() => gobblerJoinSide('X')}
              disabled={actionLoading || (!!gb.playerXId && gb.playerXId !== socketId)}
              className={clsx(
                'p-6 sm:p-8 border-4 border-black transition-transform flex flex-col items-center gap-4 group relative overflow-hidden',
                gb.playerXId === socketId
                  ? 'bg-cyan-300 shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]'
                  : gb.playerXId
                    ? 'bg-gray-200 opacity-50 cursor-not-allowed grayscale'
                    : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-300 active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
              )}
            >
              <div className="text-5xl sm:text-6xl font-black text-black group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
                X
              </div>
              <div className="text-xs sm:text-sm font-black text-black uppercase tracking-widest z-10 bg-white px-2 py-1 border-2 border-black">
                {pX ? pX.name : t('gameGobbler.join', { side: 'X' })}
              </div>
            </button>

            <button
              onClick={() => gobblerJoinSide('O')}
              disabled={actionLoading || (!!gb.playerOId && gb.playerOId !== socketId)}
              className={clsx(
                'p-6 sm:p-8 border-4 border-black transition-transform flex flex-col items-center gap-4 group relative overflow-hidden',
                gb.playerOId === socketId
                  ? 'bg-pink-300 shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]'
                  : gb.playerOId
                    ? 'bg-gray-200 opacity-50 cursor-not-allowed grayscale'
                    : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-pink-300 active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
              )}
            >
              <div className="text-5xl sm:text-6xl font-black text-black group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
                O
              </div>
              <div className="text-xs sm:text-sm font-black text-black uppercase tracking-widest z-10 bg-white px-2 py-1 border-2 border-black">
                {pO ? pO.name : t('gameGobbler.join', { side: 'O' })}
              </div>
            </button>
          </div>
        </div>
      )}

      {room.status !== RoomStatus.LOBBY && (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[500px]">
          {/* Scoreboard moved to top! */}
          <div className="flex items-center gap-4 bg-white border-4 border-black px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-8 sm:mb-10 font-mono z-10 relative">
            <div className="flex flex-col items-center">
              <span className="text-black font-black text-2xl sm:text-3xl leading-none">
                {gb.scores.X}
              </span>
              <span className="text-[10px] text-black font-black bg-cyan-300 px-1 border-2 border-black uppercase tracking-widest mt-1">
                {t('gameGobbler.team', { side: 'X' })}
              </span>
            </div>
            <div className="text-black font-black text-xl px-2">-</div>
            <div className="flex flex-col items-center">
              <span className="text-black font-black text-2xl sm:text-3xl leading-none">
                {gb.scores.O}
              </span>
              <span className="text-[10px] text-black font-black bg-pink-300 px-1 border-2 border-black uppercase tracking-widest mt-1">
                {t('gameGobbler.team', { side: 'O' })}
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-4 xl:gap-6 2xl:gap-8 items-center justify-center w-full">
            {/* Top/Left Player */}
            <div className="flex flex-col gap-3 sm:gap-4 w-full sm:max-w-md lg:w-48 xl:w-64 2xl:w-80 order-1 flex-shrink-0 z-10">
              {renderPlayerHeader(topSide, pTop)}
              {renderInventory(topSide)}
            </div>

            {/* Board Area */}
            <div className="order-2 w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[320px] xl:max-w-[400px] 2xl:max-w-[460px] flex-shrink-0 relative my-2 sm:my-0 flex flex-col items-center">
              <div className="bg-yellow-300 border-4 border-black p-4 sm:p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full relative font-mono">
                {/* Turn Indicator inside board area */}
                {room.status === RoomStatus.PLAYING && (
                  <div className="absolute -top-4 sm:-top-5 left-1/2 -translate-x-1/2 bg-white text-black px-5 sm:px-8 py-2 sm:py-2.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-30 flex items-center gap-2 -">
                    <div
                      className={clsx(
                        'w-3 h-3 border-2 border-black',
                        gb.currentTurn === mySide ? 'bg-green-400 animate-pulse' : 'bg-gray-400',
                      )}
                    />
                    <span className="text-xs sm:text-sm font-black uppercase tracking-widest whitespace-nowrap">
                      {gb.currentTurn === mySide
                        ? t('gameGobbler.yourTurn')
                        : t('gameGobbler.turn', { side: gb.currentTurn })}
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
                        data-testid={`gobbler-cell-${idx}`}
                        onClick={() => handleCellClick(idx)}
                        className={clsx(
                          'bg-white border-4 relative overflow-hidden transition-all duration-300 group flex items-center justify-center',
                          isSelectedCellToMove
                            ? 'border-black bg-gray-200 shadow-[inset_4px_4px_0px_rgba(0,0,0,0.2)]'
                            : isWinningCell
                              ? 'border-black bg-emerald-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 scale-105'
                              : canPlaceHere
                                ? 'border-black hover:bg-yellow-100 hover:shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)]'
                                : 'border-black',
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

              {/* Result Overlay */}
              <AnimatePresence>
                {room.status === RoomStatus.RESULT && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 -m-4 sm:-m-8 z-50 flex items-center justify-center font-mono"
                  >
                    <div
                      className={clsx(
                        'absolute inset-0 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-colors duration-700',
                        gb.winner === 'X'
                          ? 'bg-cyan-300'
                          : gb.winner === 'O'
                            ? 'bg-pink-300'
                            : 'bg-gray-200',
                      )}
                    />
                    <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center w-full">
                      {gb.winner === 'DRAW' ? (
                        <>
                          <div className="text-6xl sm:text-8xl mb-4 sm:mb-6 animate-bounce drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                            🤝
                          </div>
                          <div className="text-4xl sm:text-6xl font-black text-black uppercase tracking-widest mb-2 bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                            {t('gameGobbler.draw')}
                          </div>
                          <div className="text-black font-black mb-8 sm:mb-10 text-base sm:text-xl bg-white px-2 py-1 border-2 border-black mt-4 ">
                            {t('gameGobbler.drawSubtitle')}
                          </div>
                        </>
                      ) : (
                        <>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }}
                            transition={{ type: 'spring', duration: 1, bounce: 0.5 }}
                            className="text-7xl sm:text-9xl mb-4 sm:mb-6 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]"
                          >
                            🏆
                          </motion.div>
                          <div
                            data-testid="winner-banner"
                            className={clsx(
                              'text-4xl sm:text-6xl font-black uppercase tracking-widest mb-3 bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - text-black',
                            )}
                          >
                            {t('gameGobbler.wins', { winner: gb.winner || '' })}
                          </div>
                          <div className="text-black font-black mb-8 sm:mb-12 text-base sm:text-xl bg-white px-3 py-2 border-2 border-black mt-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <strong className="text-black text-lg sm:text-2xl">
                              {t('gameGobbler.claimsVictory', {
                                name: (gb.winner === 'X' ? pX?.name : pO?.name) || '',
                              })}
                            </strong>
                          </div>
                        </>
                      )}

                      {(room.roomHostId === socketId || mySide) && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={gobblerReset}
                          disabled={actionLoading}
                          className={clsx(
                            'font-black px-8 sm:px-12 py-4 sm:py-5 transition-transform uppercase tracking-widest text-sm sm:text-lg overflow-hidden relative group disabled:opacity-50 disabled:cursor-not-allowed border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
                            gb.winner === 'X'
                              ? 'bg-yellow-300 text-black'
                              : gb.winner === 'O'
                                ? 'bg-emerald-300 text-black'
                                : 'bg-white text-black',
                          )}
                        >
                          {t('gameGobbler.playAgain')}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom/Right Player */}
            <div className="flex flex-col-reverse lg:flex-col gap-3 sm:gap-4 w-full sm:max-w-md lg:w-48 xl:w-64 2xl:w-80 order-3 flex-shrink-0 z-10">
              {renderPlayerHeader(bottomSide, pBottom)}
              {renderInventory(bottomSide)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
