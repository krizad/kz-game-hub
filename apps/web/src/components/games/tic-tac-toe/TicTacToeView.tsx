'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function TicTacToeView() {
  const { room, socketId, tttJoinSide, tttMakeMove, tttReset, actionLoading } = useGameStore();
  const { t } = useTranslate();

  if (!room || !room.ticTacToeState) return null;
  const ttt = room.ticTacToeState;

  const isX = ttt.playerXId === socketId;
  const isO = ttt.playerOId === socketId;
  const mySide = isX ? 'X' : isO ? 'O' : null;
  const isMyTurn = mySide === ttt.currentTurn;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      {actionLoading && <ActionLoadingOverlay />}
      {room.status === RoomStatus.LOBBY ? (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-black text-indigo-400 uppercase tracking-widest">
            {t('gameTicTacToe.lobby')}
          </h2>
          <div className="flex gap-4">
            <div
              className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-4 ${ttt.playerXId ? 'border-amber-300 bg-white/50' : 'border-indigo-500 bg-indigo-950/20'}`}
            >
              <div className="text-4xl font-black text-blue-400">X</div>
              {ttt.playerXId ? (
                <div className="text-slate-700 font-bold">
                  {room.players.find((p) => p.socketId === ttt.playerXId)?.name}
                </div>
              ) : (
                <button
                  onClick={() => tttJoinSide('X')}
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('gameTicTacToe.joinAs', { side: 'X' })}
                </button>
              )}
            </div>

            <div
              className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-4 ${ttt.playerOId ? 'border-amber-300 bg-white/50' : 'border-rose-500 bg-rose-950/20'}`}
            >
              <div className="text-4xl font-black text-rose-400">O</div>
              {ttt.playerOId ? (
                <div className="text-slate-700 font-bold">
                  {room.players.find((p) => p.socketId === ttt.playerOId)?.name}
                </div>
              ) : (
                <button
                  onClick={() => tttJoinSide('O')}
                  disabled={actionLoading}
                  className="bg-rose-600 hover:bg-rose-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('gameTicTacToe.joinAs', { side: 'O' })}
                </button>
              )}
            </div>
          </div>
          <p className="text-slate-600 font-medium">{t('gameTicTacToe.waitingJoin')}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 w-full max-w-md bg-white border border-amber-200 rounded-3xl p-6 shadow-2xl">
          <div className="flex justify-between w-full items-center px-4">
            <div
              className={`flex flex-col items-center ${ttt.currentTurn === 'X' ? 'scale-110 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'opacity-50'} transition-all`}
            >
              <span className="text-blue-400 font-black text-2xl">X</span>
              <span className="text-slate-700 font-medium text-sm">
                {room.players.find((p) => p.socketId === ttt.playerXId)?.name}
              </span>
              <span className="text-blue-300 text-xs mt-1 bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-900/50 shadow-inner">
                {t('gameTicTacToe.score')}:{' '}
                {room.players.find((p) => p.socketId === ttt.playerXId)?.score || 0}
              </span>
            </div>

            <div className="text-sm font-black tracking-widest uppercase text-slate-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              {room.status === RoomStatus.RESULT
                ? t('gameTicTacToe.gameOver')
                : t('gameTicTacToe.playing')}
            </div>

            <div
              className={`flex flex-col items-center ${ttt.currentTurn === 'O' ? 'scale-110 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'opacity-50'} transition-all`}
            >
              <span className="text-rose-400 font-black text-2xl">O</span>
              <span className="text-slate-700 font-medium text-sm">
                {room.players.find((p) => p.socketId === ttt.playerOId)?.name}
              </span>
              <span className="text-rose-300 text-xs mt-1 bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-900/50 shadow-inner">
                {t('gameTicTacToe.score')}:{' '}
                {room.players.find((p) => p.socketId === ttt.playerOId)?.score || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-amber-100 p-3 rounded-2xl border border-amber-300 shadow-inner">
            {ttt.board.map((cell, index) => {
              const isWinningCell = ttt.winningLine?.includes(index);

              return (
                <button
                  key={index}
                  disabled={
                    room.status !== RoomStatus.PLAYING ||
                    !isMyTurn ||
                    cell !== null ||
                    actionLoading
                  }
                  onClick={() => tttMakeMove(index)}
                  className={`
                    w-20 h-20 sm:w-24 sm:h-24 bg-amber-50 rounded-xl flex items-center justify-center text-5xl font-black transition-all
                    ${cell === null && isMyTurn && room.status === RoomStatus.PLAYING && !actionLoading ? 'hover:bg-white cursor-pointer active:scale-95' : 'cursor-default'}
                    ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-rose-400' : ''}
                    ${isWinningCell ? (cell === 'X' ? 'bg-blue-950/40 shadow-[inset_0_0_20px_rgba(96,165,250,0.2)]' : 'bg-rose-950/40 shadow-[inset_0_0_20px_rgba(244,63,94,0.2)]') : ''}
                  `}
                >
                  <span className={isWinningCell ? 'animate-pulse' : ''}>{cell}</span>
                </button>
              );
            })}
          </div>

          {room.status === RoomStatus.RESULT && (
            <div className="flex flex-col items-center gap-4 animate-in zoom-in slide-in-from-bottom-4">
              {ttt.winner === 'DRAW' ? (
                <div className="text-2xl font-black text-slate-600 bg-amber-100 px-6 py-2 rounded-xl border border-amber-300">
                  {t('gameTicTacToe.draw')}
                </div>
              ) : (
                <div
                  className={`text-3xl font-black px-6 py-2 rounded-xl border ${ttt.winner === 'X' ? 'text-blue-400 bg-blue-950/30 border-blue-900' : 'text-rose-400 bg-rose-950/30 border-rose-900'} drop-shadow-xl`}
                >
                  {t('gameTicTacToe.wins', { winner: ttt.winner || '' })}
                </div>
              )}

              {(room.roomHostId === socketId || mySide) && (
                <button
                  onClick={tttReset}
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl mt-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
