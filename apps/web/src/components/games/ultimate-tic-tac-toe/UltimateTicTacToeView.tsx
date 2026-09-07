'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, GameType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { RulesModal } from '@/components/RulesModal';

export function UltimateTicTacToeView() {
  const { room, socketId, utttJoinSide, utttMakeMove, utttReset, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [hoveredCell, setHoveredCell] = useState<{ macro: number; micro: number } | null>(null);

  if (!room || !room.ultimateTicTacToeState) return null;
  const uttt = room.ultimateTicTacToeState;

  const isX = uttt.playerXId === socketId;
  const isO = uttt.playerOId === socketId;
  const mySide = isX ? 'X' : isO ? 'O' : null;
  const isMyTurn = mySide === uttt.currentTurn;

  const isFreeMove = uttt.activeMacroIndex === null;

  const playerXName = room.players.find((p) => p.socketId === uttt.playerXId)?.name;
  const playerOName = room.players.find((p) => p.socketId === uttt.playerOId)?.name;
  const playerXScore = room.players.find((p) => p.socketId === uttt.playerXId)?.score || 0;
  const playerOScore = room.players.find((p) => p.socketId === uttt.playerOId)?.score || 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 relative font-mono h-full overflow-y-auto overflow-x-hidden w-full max-w-4xl mx-auto">
      {actionLoading && <ActionLoadingOverlay />}

      {room.status === RoomStatus.LOBBY ? (
        <div className="flex flex-col items-center gap-6 my-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-widest bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
            {t('gameUltimateTTT.title')}
          </h2>

          <div className="flex flex-wrap justify-center gap-6 mt-2">
            {/* Player X Slot */}
            <div
              className={`p-6 border-4 border-black flex flex-col items-center gap-4 w-40 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform ${
                uttt.playerXId ? 'bg-cyan-300' : 'bg-white'
              }`}
            >
              <div className="text-6xl font-black text-black">X</div>
              {uttt.playerXId ? (
                <div className="text-black font-bold text-center truncate w-full px-2">
                  {playerXName}
                </div>
              ) : (
                <button
                  onClick={() => utttJoinSide('X')}
                  disabled={actionLoading}
                  className="bg-white border-2 border-black hover:bg-gray-200 px-4 py-2 font-black text-black disabled:opacity-50 disabled:cursor-not-allowed w-full active:translate-y-1"
                >
                  {t('gameTicTacToe.joinAs', { side: 'X' })}
                </button>
              )}
            </div>

            {/* Player O Slot */}
            <div
              className={`p-6 border-4 border-black flex flex-col items-center gap-4 w-40 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform ${
                uttt.playerOId ? 'bg-pink-300' : 'bg-white'
              }`}
            >
              <div className="text-6xl font-black text-black">O</div>
              {uttt.playerOId ? (
                <div className="text-black font-bold text-center truncate w-full px-2">
                  {playerOName}
                </div>
              ) : (
                <button
                  onClick={() => utttJoinSide('O')}
                  disabled={actionLoading}
                  className="bg-white border-2 border-black hover:bg-gray-200 px-4 py-2 font-black text-black disabled:opacity-50 disabled:cursor-not-allowed w-full active:translate-y-1"
                >
                  {t('gameTicTacToe.joinAs', { side: 'O' })}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <p className="text-black font-bold bg-white border-2 border-black px-4 py-1 text-center text-sm sm:text-base">
              {t('gameTicTacToe.waitingJoin')}
            </p>
            <RulesModal
              defaultGameType={GameType.ULTIMATE_TIC_TAC_TOE}
              isGameRoom={true}
              triggerClassName="text-sm font-black text-black hover:bg-yellow-200 bg-yellow-300 transition-colors flex items-center gap-2 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none text-nowrap"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full max-w-lg">
          {/* Header Score & Turn Indicator */}
          <div className="flex justify-between w-full items-center px-1">
            {/* Player X Info */}
            <div
              className={`flex flex-col items-center bg-cyan-300 border-4 border-black p-2 min-w-[90px] sm:min-w-[110px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform ${
                uttt.currentTurn === 'X' && room.status === RoomStatus.PLAYING
                  ? 'scale-105 ring-4 ring-cyan-500'
                  : 'opacity-70 scale-95'
              }`}
            >
              <span className="text-black font-black text-3xl sm:text-4xl">X</span>
              <span className="text-black font-bold text-xs sm:text-sm truncate max-w-[85px] sm:max-w-[100px]">
                {playerXName}
              </span>
              <span className="text-black text-[10px] sm:text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
                {t('gameTicTacToe.score')}: {playerXScore}
              </span>
            </div>

            {/* Turn & Status Badge */}
            <div className="flex flex-col items-center gap-1 mx-2">
              <div className="text-xs sm:text-sm font-black tracking-wider uppercase text-black bg-white px-3 py-1.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
                {room.status === RoomStatus.RESULT
                  ? t('gameTicTacToe.gameOver')
                  : isMyTurn
                    ? t('gameUltimateTTT.yourTurn')
                    : t('gameUltimateTTT.opponentTurn', { turn: uttt.currentTurn })}
              </div>

              {room.status === RoomStatus.PLAYING && (
                <div
                  className={`text-[10px] sm:text-xs font-black px-2 py-0.5 border-2 border-black text-center ${
                    isFreeMove
                      ? 'bg-yellow-300 text-black animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  {isFreeMove
                    ? t('gameUltimateTTT.freeMove')
                    : t('gameUltimateTTT.targetBoard', { board: (uttt.activeMacroIndex ?? 0) + 1 })}
                </div>
              )}

              <RulesModal
                defaultGameType={GameType.ULTIMATE_TIC_TAC_TOE}
                isGameRoom={true}
                triggerClassName="text-[10px] sm:text-xs font-black text-black hover:bg-yellow-200 bg-white transition-colors flex items-center gap-1 px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 text-nowrap"
              />
            </div>

            {/* Player O Info */}
            <div
              className={`flex flex-col items-center bg-pink-300 border-4 border-black p-2 min-w-[90px] sm:min-w-[110px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform ${
                uttt.currentTurn === 'O' && room.status === RoomStatus.PLAYING
                  ? 'scale-105 ring-4 ring-pink-500'
                  : 'opacity-70 scale-95'
              }`}
            >
              <span className="text-black font-black text-3xl sm:text-4xl">O</span>
              <span className="text-black font-bold text-xs sm:text-sm truncate max-w-[85px] sm:max-w-[100px]">
                {playerOName}
              </span>
              <span className="text-black text-[10px] sm:text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
                {t('gameTicTacToe.score')}: {playerOScore}
              </span>
            </div>
          </div>

          {/* 9x9 Ultimate Board */}
          <div
            className="w-full aspect-square max-w-[440px] sm:max-w-[480px] bg-black p-2 sm:p-2.5 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] grid grid-cols-3 gap-2 sm:gap-2.5"
            onMouseLeave={() => setHoveredCell(null)}
          >
            {uttt.subBoards.map((subBoard, macroIndex) => {
              const isMacroWinner = uttt.winningMacroLine?.includes(macroIndex);
              const isSubBoardPlayable =
                room.status === RoomStatus.PLAYING &&
                !subBoard.winner &&
                (isFreeMove || uttt.activeMacroIndex === macroIndex);

              // Check if this sub-board is the hover target (where the next move will send the opponent)
              const isHoverTarget =
                hoveredCell &&
                hoveredCell.micro === macroIndex &&
                isSubBoardPlayable &&
                !subBoard.winner;

              return (
                <div
                  key={`macro-${macroIndex}`}
                  className={`relative grid grid-cols-3 gap-1 p-1 bg-gray-200 border-2 sm:border-3 transition-all ${
                    isSubBoardPlayable
                      ? 'border-yellow-400 ring-2 sm:ring-3 ring-yellow-400 bg-yellow-50'
                      : 'border-black opacity-80'
                  } ${isHoverTarget ? 'ring-4 ring-purple-500' : ''}`}
                >
                  {/* Won Overlay for Sub-Board */}
                  {subBoard.winner && (
                    <div
                      className={`absolute inset-0 z-10 flex items-center justify-center font-black border-2 border-black transition-all ${
                        subBoard.winner === 'X'
                          ? 'bg-cyan-400/90 text-cyan-950'
                          : subBoard.winner === 'O'
                            ? 'bg-pink-400/90 text-pink-950'
                            : 'bg-gray-400/90 text-gray-900'
                      } ${isMacroWinner ? 'animate-bounce' : ''}`}
                    >
                      <span className="text-4xl sm:text-5xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        {subBoard.winner === 'DRAW' ? '—' : subBoard.winner}
                      </span>
                    </div>
                  )}

                  {/* 3x3 Micro Cells inside this Sub-Board */}
                  {subBoard.cells.map((cell, microIndex) => {
                    const isWinningSubCell = subBoard.winningLine?.includes(microIndex);
                    const isCellPlayable =
                      isSubBoardPlayable && cell === null && isMyTurn && !actionLoading;

                    return (
                      <button
                        key={`cell-${macroIndex}-${microIndex}`}
                        disabled={!isCellPlayable}
                        onClick={() => utttMakeMove(macroIndex, microIndex)}
                        onMouseEnter={() => {
                          if (isCellPlayable) {
                            setHoveredCell({ macro: macroIndex, micro: microIndex });
                          }
                        }}
                        className={`aspect-square flex items-center justify-center font-black text-base sm:text-lg transition-colors select-none ${
                          cell === null
                            ? isCellPlayable
                              ? 'bg-white hover:bg-yellow-200 active:bg-yellow-300 cursor-pointer'
                              : 'bg-white/60 cursor-default'
                            : 'bg-white cursor-default'
                        } ${
                          cell === 'X'
                            ? 'text-cyan-600 font-black'
                            : cell === 'O'
                              ? 'text-pink-600 font-black'
                              : ''
                        } ${isWinningSubCell ? 'bg-green-200' : ''}`}
                      >
                        {cell}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Result Banner & Play Again */}
          {room.status === RoomStatus.RESULT && (
            <div className="flex flex-col items-center gap-3 mt-2 animate-in zoom-in slide-in-from-bottom-3 w-full">
              {uttt.winner === 'DRAW' ? (
                <div className="text-2xl sm:text-3xl font-black text-black bg-gray-300 px-6 py-3 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center w-full">
                  {t('gameTicTacToe.draw')}
                </div>
              ) : (
                <div
                  className={`text-xl sm:text-3xl text-center font-black text-black px-6 py-3 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full ${
                    uttt.winner === 'X' ? 'bg-cyan-300' : 'bg-pink-300'
                  }`}
                >
                  {t('gameTicTacToe.wins', {
                    winner: uttt.winner === 'X' ? playerXName || 'X' : playerOName || 'O',
                  })}
                </div>
              )}

              {(room.roomHostId === socketId || mySide) && (
                <button
                  onClick={utttReset}
                  disabled={actionLoading}
                  className="bg-yellow-300 hover:bg-yellow-200 text-black font-black px-8 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm sm:text-base w-full sm:w-auto"
                >
                  {t('gameTicTacToe.playAgain')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
