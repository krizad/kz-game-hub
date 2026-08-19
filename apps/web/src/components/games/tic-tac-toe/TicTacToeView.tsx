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
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative font-mono h-full overflow-y-auto overflow-x-hidden w-full">
      {actionLoading && <ActionLoadingOverlay />}
      {room.status === RoomStatus.LOBBY ? (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-3xl font-black text-black uppercase tracking-widest bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameTicTacToe.lobby')}
          </h2>
          <div className="flex gap-6 mt-4">
            <div
              className={`p-6 border-4 border-black flex flex-col items-center gap-4 w-40 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform ${ttt.playerXId ? 'bg-cyan-300' : 'bg-white'}`}
            >
              <div className="text-6xl font-black text-black">X</div>
              {ttt.playerXId ? (
                <div className="text-black font-bold text-center truncate w-full px-2">
                  {room.players.find((p) => p.socketId === ttt.playerXId)?.name}
                </div>
              ) : (
                <button
                  onClick={() => tttJoinSide('X')}
                  disabled={actionLoading}
                  className="bg-white border-2 border-black hover:bg-gray-200 px-4 py-2 font-black text-black disabled:opacity-50 disabled:cursor-not-allowed w-full active:translate-y-1"
                >
                  {t('gameTicTacToe.joinAs', { side: 'X' })}
                </button>
              )}
            </div>

            <div
              className={`p-6 border-4 border-black flex flex-col items-center gap-4 w-40 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform - ${ttt.playerOId ? 'bg-pink-300' : 'bg-white'}`}
            >
              <div className="text-6xl font-black text-black">O</div>
              {ttt.playerOId ? (
                <div className="text-black font-bold text-center truncate w-full px-2">
                  {room.players.find((p) => p.socketId === ttt.playerOId)?.name}
                </div>
              ) : (
                <button
                  onClick={() => tttJoinSide('O')}
                  disabled={actionLoading}
                  className="bg-white border-2 border-black hover:bg-gray-200 px-4 py-2 font-black text-black disabled:opacity-50 disabled:cursor-not-allowed w-full active:translate-y-1"
                >
                  {t('gameTicTacToe.joinAs', { side: 'O' })}
                </button>
              )}
            </div>
          </div>
          <p className="text-black font-bold bg-white border-2 border-black px-4 py-1 mt-4 ">
            {t('gameTicTacToe.waitingJoin')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 w-full max-w-md">
          <div className="flex justify-between w-full items-center">
            <div
              className={`flex flex-col items-center bg-cyan-300 border-4 border-black p-3 min-w-[100px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform ${ttt.currentTurn === 'X' ? 'scale-110 -' : 'opacity-70 scale-90'}`}
            >
              <span className="text-black font-black text-4xl">X</span>
              <span className="text-black font-bold text-sm truncate max-w-[90px]">
                {room.players.find((p) => p.socketId === ttt.playerXId)?.name}
              </span>
              <span className="text-black text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
                {t('gameTicTacToe.score')}:{' '}
                {room.players.find((p) => p.socketId === ttt.playerXId)?.score || 0}
              </span>
            </div>

            <div className="text-sm font-black tracking-widest uppercase text-black bg-white px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10">
              {room.status === RoomStatus.RESULT
                ? t('gameTicTacToe.gameOver')
                : t('gameTicTacToe.playing')}
            </div>

            <div
              className={`flex flex-col items-center bg-pink-300 border-4 border-black p-3 min-w-[100px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform ${ttt.currentTurn === 'O' ? 'scale-110 ' : 'opacity-70 scale-90'}`}
            >
              <span className="text-black font-black text-4xl">O</span>
              <span className="text-black font-bold text-sm truncate max-w-[90px]">
                {room.players.find((p) => p.socketId === ttt.playerOId)?.name}
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
 w-20 h-20 sm:w-24 sm:h-24 bg-white flex items-center justify-center text-6xl font-black transition-colors
 ${cell === null && isMyTurn && room.status === RoomStatus.PLAYING && !actionLoading ? 'hover:bg-yellow-200 cursor-pointer active:bg-yellow-400' : 'cursor-default'}
 ${cell === 'X' ? 'text-cyan-500' : cell === 'O' ? 'text-pink-500' : ''}
 ${isWinningCell ? 'bg-green-300 animate-pulse' : ''}
 `}
                >
                  <span className={`${isWinningCell ? '' : ''}`}>{cell}</span>
                </button>
              );
            })}
          </div>

          {room.status === RoomStatus.RESULT && (
            <div className="flex flex-col items-center gap-4 animate-in zoom-in slide-in-from-bottom-4 mt-4">
              {ttt.winner === 'DRAW' ? (
                <div className="text-3xl font-black text-black bg-gray-300 px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
                  {t('gameTicTacToe.draw')}
                </div>
              ) : (
                <div
                  className={`text-2xl sm:text-4xl text-center font-black text-black px-4 sm:px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] - ${ttt.winner === 'X' ? 'bg-cyan-300' : 'bg-pink-300'}`}
                >
                  {t('gameTicTacToe.wins', { winner: ttt.winner || '' })}
                </div>
              )}

              {(room.roomHostId === socketId || mySide) && (
                <button
                  onClick={tttReset}
                  disabled={actionLoading}
                  className="bg-yellow-300 hover:bg-yellow-200 text-black font-black px-8 py-4 border-4 border-black mt-4 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
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
