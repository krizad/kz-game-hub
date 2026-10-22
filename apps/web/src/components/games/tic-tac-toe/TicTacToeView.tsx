'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { BOT_SOCKET_ID, GameType, RoomStatus } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { FirstRoundGuide } from '@/components/lobby/FirstRoundGuide';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';

export function TicTacToeView() {
  const {
    room,
    socketId,
    tttJoinSide,
    tttMakeMove,
    tttReset,
    actionLoading,
    pendingActions,
    dismissPendingAction,
  } = useGameStore();
  const { t } = useTranslate();

  const [unknownActionId, unknownPendingAction] =
    Object.entries(pendingActions).find(([, a]) => a.status === 'unknown') ?? [];
  const showActionOverlay = actionLoading || !!unknownPendingAction;

  if (!room || !room.ticTacToeState) return null;
  const ttt = room.ticTacToeState;

  const isX = ttt.playerXId === socketId;
  const isO = ttt.playerOId === socketId;
  const mySide = isX ? 'X' : isO ? 'O' : null;
  const isMyTurn = mySide === ttt.currentTurn;

  const prevStatusRef = useRef(room.status);
  useEffect(() => {
    if (prevStatusRef.current !== RoomStatus.RESULT && room.status === RoomStatus.RESULT) {
      if (ttt.winner === 'X' || ttt.winner === 'O') {
        audioManager.playSuccessChime();
        if (ttt.winner === mySide) {
          void gameFeel.celebrate();
          gameFeel.flash('gold');
          gameFeel.haptic([100, 50, 150]);
        } else if (mySide) {
          gameFeel.shake(0.4);
          gameFeel.flash('red');
          gameFeel.haptic([100]);
        }
      }
    }
    prevStatusRef.current = room.status;
  }, [room.status, ttt.winner, mySide]);

  const isVsBot = !!room.config?.ticTacToeVsBot;
  const botSide =
    ttt.playerXId === BOT_SOCKET_ID ? 'X' : ttt.playerOId === BOT_SOCKET_ID ? 'O' : null;
  const isBotTurn = room.status === RoomStatus.PLAYING && botSide === ttt.currentTurn;

  useEffect(() => {
    if (room.status !== RoomStatus.PLAYING || !isMyTurn || actionLoading) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      let cellIndex: number | undefined;
      switch (e.code) {
        // Numpad mapped to 3x3 layout
        case 'Numpad7':
          cellIndex = 0;
          break;
        case 'Numpad8':
          cellIndex = 1;
          break;
        case 'Numpad9':
          cellIndex = 2;
          break;
        case 'Numpad4':
          cellIndex = 3;
          break;
        case 'Numpad5':
          cellIndex = 4;
          break;
        case 'Numpad6':
          cellIndex = 5;
          break;
        case 'Numpad1':
          cellIndex = 6;
          break;
        case 'Numpad2':
          cellIndex = 7;
          break;
        case 'Numpad3':
          cellIndex = 8;
          break;
        // Digits mapped 1-9
        case 'Digit1':
          cellIndex = 0;
          break;
        case 'Digit2':
          cellIndex = 1;
          break;
        case 'Digit3':
          cellIndex = 2;
          break;
        case 'Digit4':
          cellIndex = 3;
          break;
        case 'Digit5':
          cellIndex = 4;
          break;
        case 'Digit6':
          cellIndex = 5;
          break;
        case 'Digit7':
          cellIndex = 6;
          break;
        case 'Digit8':
          cellIndex = 7;
          break;
        case 'Digit9':
          cellIndex = 8;
          break;
        default:
          if (e.key >= '1' && e.key <= '9') {
            cellIndex = Number(e.key) - 1;
          }
      }

      if (cellIndex !== undefined && ttt.board[cellIndex] === null) {
        e.preventDefault();
        tttMakeMove(cellIndex);
        audioManager.playPlaceMark(mySide ?? 'X');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [room.status, isMyTurn, actionLoading, ttt.board, mySide, tttMakeMove]);

  const playerXName =
    ttt.playerXId === BOT_SOCKET_ID
      ? `${t('gameTicTacToe.bot.botBadge')} (${t(room.config?.ticTacToeBotDifficulty === 'EASY' ? 'gameTicTacToe.bot.easy' : 'gameTicTacToe.bot.god')})`
      : room.players.find((p) => p.socketId === ttt.playerXId)?.name;

  const playerOName =
    ttt.playerOId === BOT_SOCKET_ID
      ? `${t('gameTicTacToe.bot.botBadge')} (${t(room.config?.ticTacToeBotDifficulty === 'EASY' ? 'gameTicTacToe.bot.easy' : 'gameTicTacToe.bot.god')})`
      : room.players.find((p) => p.socketId === ttt.playerOId)?.name;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative font-mono h-full overflow-y-auto overflow-x-hidden w-full">
      {showActionOverlay && (
        <ActionLoadingOverlay
          status={unknownPendingAction ? 'unknown' : 'pending'}
          onDismiss={unknownActionId ? () => dismissPendingAction(unknownActionId) : undefined}
        />
      )}
      {room.status === RoomStatus.LOBBY ? (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-3xl font-black text-black uppercase tracking-widest bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameTicTacToe.lobby')}
          </h2>
          <div className="flex gap-6 mt-4">
            <div
              className={`p-6 border-4 border-black flex flex-col items-center gap-4 w-44 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform ${ttt.playerXId ? 'bg-cyan-300' : 'bg-white'}`}
            >
              <div className="text-6xl font-black text-black">X</div>
              {ttt.playerXId ? (
                <div className="text-black font-bold text-center truncate w-full px-2">
                  {playerXName}
                </div>
              ) : (
                <button
                  data-testid="ttt-join-x"
                  onClick={() => tttJoinSide('X')}
                  disabled={actionLoading}
                  className="bg-white border-2 border-black hover:bg-gray-200 px-3 py-2 font-black text-black text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full active:translate-y-1"
                >
                  {t('gameTicTacToe.joinAs', { side: 'X' })}
                </button>
              )}
            </div>

            <div
              className={`p-6 border-4 border-black flex flex-col items-center gap-4 w-44 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform - ${ttt.playerOId ? 'bg-pink-300' : 'bg-white'}`}
            >
              <div className="text-6xl font-black text-black">O</div>
              {ttt.playerOId ? (
                <div className="text-black font-bold text-center truncate w-full px-2">
                  {playerOName}
                </div>
              ) : (
                <button
                  data-testid="ttt-join-o"
                  onClick={() => tttJoinSide('O')}
                  disabled={actionLoading}
                  className="bg-white border-2 border-black hover:bg-gray-200 px-3 py-2 font-black text-black text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full active:translate-y-1"
                >
                  {t('gameTicTacToe.joinAs', { side: 'O' })}
                </button>
              )}
            </div>
          </div>
          <p className="text-black font-bold bg-white border-2 border-black px-4 py-1 mt-4">
            {isVsBot ? t('gameTicTacToe.bot.playVsBotAs') : t('gameTicTacToe.waitingJoin')}
          </p>
          <FirstRoundGuide gameType={GameType.TIC_TAC_TOE} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="flex justify-between w-full items-center">
            <div
              className={`flex flex-col items-center bg-cyan-300 border-4 border-black p-3 min-w-[110px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform ${ttt.currentTurn === 'X' ? 'scale-110 -' : 'opacity-70 scale-90'}`}
            >
              <span className="text-black font-black text-4xl">X</span>
              <span className="text-black font-bold text-xs truncate max-w-[100px]">
                {playerXName}
              </span>
              <span className="text-black text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
                {t('gameTicTacToe.score')}:{' '}
                {room.players.find((p) => p.socketId === ttt.playerXId)?.score || 0}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div
                data-testid="ttt-current-mode-badge"
                className="text-[10px] sm:text-xs font-black px-2 py-0.5 border-2 border-black bg-yellow-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider text-center"
              >
                {t('gameTicTacToe.currentMode', { mode: t('gameTicTacToe.modes.classic') })}
              </div>
              <div className="text-sm font-black tracking-widest uppercase text-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10">
                {room.status === RoomStatus.RESULT
                  ? t('gameTicTacToe.gameOver')
                  : t('gameTicTacToe.playing')}
              </div>
              {isBotTurn && (
                <div className="text-xs font-black text-black bg-yellow-300 border-2 border-black px-2 py-0.5 animate-pulse">
                  {t('gameTicTacToe.bot.thinking')}
                </div>
              )}
            </div>

            <div
              className={`flex flex-col items-center bg-pink-300 border-4 border-black p-3 min-w-[110px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform ${ttt.currentTurn === 'O' ? 'scale-110 ' : 'opacity-70 scale-90'}`}
            >
              <span className="text-black font-black text-4xl">O</span>
              <span className="text-black font-bold text-xs truncate max-w-[100px]">
                {playerOName}
              </span>
              <span className="text-black text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
                {t('gameTicTacToe.score')}:{' '}
                {room.players.find((p) => p.socketId === ttt.playerOId)?.score || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-black p-2 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
            {ttt.board.map((cell, index) => {
              const isWinningCell = ttt.winningLine?.includes(index);
              const row = Math.floor(index / 3) + 1;
              const col = (index % 3) + 1;
              const status = cell ? cell : t('gameTicTacToe.cellEmpty');

              let disabledReason = '';
              if (room.status !== RoomStatus.PLAYING) {
                disabledReason = t('gameTicTacToe.disabledGameOver');
              } else if (!mySide) {
                disabledReason = t('gameTicTacToe.disabledViewer');
              } else if (!isMyTurn) {
                disabledReason = t('gameTicTacToe.disabledNotYourTurn');
              } else if (actionLoading) {
                disabledReason = t('gameTicTacToe.disabledBusy');
              } else if (cell !== null) {
                disabledReason = t('gameTicTacToe.disabledOccupied', { owner: cell });
              }

              const ariaLabel = disabledReason
                ? `${t('gameTicTacToe.cellAria', { row, col, status })} (${disabledReason})`
                : t('gameTicTacToe.cellAria', { row, col, status });

              return (
                <button
                  type="button"
                  key={index}
                  data-testid={`ttt-cell-${index}`}
                  aria-label={ariaLabel}
                  disabled={
                    room.status !== RoomStatus.PLAYING ||
                    !isMyTurn ||
                    cell !== null ||
                    actionLoading
                  }
                  onClick={() => {
                    tttMakeMove(index);
                    audioManager.playPlaceMark(mySide ?? 'X');
                  }}
                  className={`
 w-20 h-20 sm:w-24 sm:h-24 bg-white flex items-center justify-center text-6xl font-black transition-colors relative group
 ${cell === null && isMyTurn && room.status === RoomStatus.PLAYING && !actionLoading ? 'hover:bg-yellow-200 cursor-pointer active:bg-yellow-400' : 'cursor-default'}
 ${cell === 'X' ? 'text-cyan-500' : cell === 'O' ? 'text-pink-500' : ''}
 ${isWinningCell ? 'bg-green-300 animate-pulse' : ''}
 `}
                >
                  <span>{cell}</span>
                  {cell === null && isMyTurn && room.status === RoomStatus.PLAYING && (
                    <span className="absolute top-1 left-1.5 text-[10px] text-zinc-400 font-mono font-bold select-none opacity-40 group-hover:opacity-100">
                      {index + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {room.status === RoomStatus.RESULT && (
            <div className="flex flex-col items-center gap-4 animate-in zoom-in slide-in-from-bottom-4 mt-4 w-full">
              {ttt.winner === 'DRAW' ? (
                <div
                  data-testid="ttt-result-draw"
                  className="text-3xl font-black text-black bg-gray-300 px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center w-full"
                >
                  {t('gameTicTacToe.draw')}
                </div>
              ) : (
                <div
                  data-testid="ttt-result-winner"
                  className={`text-2xl sm:text-4xl text-center font-black text-black px-4 sm:px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full ${ttt.winner === 'X' ? 'bg-cyan-300' : 'bg-pink-300'}`}
                >
                  {t('gameTicTacToe.wins', { winner: ttt.winner || '' })}
                </div>
              )}

              {(room.roomHostId === socketId || mySide) && (
                <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto items-center justify-center">
                  <button
                    type="button"
                    data-testid="ttt-rematch-btn"
                    onClick={() => tttReset(false)}
                    disabled={actionLoading}
                    className="bg-yellow-300 hover:bg-yellow-200 text-black font-black px-8 py-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm sm:text-base w-full sm:w-auto"
                  >
                    {t('gameTicTacToe.playAgain')}
                  </button>
                  {room.roomHostId === socketId && (
                    <button
                      type="button"
                      data-testid="ttt-change-mode-btn"
                      onClick={() => tttReset(true)}
                      disabled={actionLoading}
                      className="bg-white hover:bg-gray-100 text-black font-black px-6 py-4 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm sm:text-base w-full sm:w-auto"
                    >
                      {t('gameTicTacToe.modes.changeMode')}
                    </button>
                  )}
                </div>
              )}
              {room.roomHostId !== socketId && (
                <p
                  data-testid="ttt-waiting-host"
                  className="text-xs sm:text-sm font-bold text-gray-700 bg-white border-2 border-black px-4 py-1.5 text-center mt-2"
                >
                  {t('gameTicTacToe.waitingForHostRematch')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
