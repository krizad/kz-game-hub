'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function RPSView() {
  const { room, socketId, privateState, rpsMakeChoice, rpsNextRound, actionLoading } =
    useGameStore();
  const { t } = useTranslate();

  if (!room || !room.rpsState) return null;
  const rps = room.rpsState;

  const isMyTurn = rps.activePlayers.includes(socketId);
  const mySideIndex = rps.activePlayers.indexOf(socketId);
  const myChoice = privateState.rpsChoice as string | undefined;
  const isHost = room.roomHostId === socketId;

  const bestOf = room.config.rpsBestOf || 3;
  const targetScore = Math.floor(bestOf / 2) + 1;

  const getEmoji = (choice: string | null) => {
    if (choice === 'ROCK') return '✊';
    if (choice === 'PAPER') return '✋';
    if (choice === 'SCISSORS') return '✌️';
    return '?';
  };

  const isWinnerId = (winner: string | string[] | undefined, playerId: string): boolean => {
    if (!winner) return false;
    if (Array.isArray(winner)) return winner.includes(playerId);
    return winner === playerId;
  };

  const getWinnerNames = (winnerIds: string | string[] | undefined): string => {
    if (!winnerIds) return '';
    if (Array.isArray(winnerIds)) {
      return winnerIds
        .map((id) => room.players.find((p) => p.socketId === id)?.name)
        .filter(Boolean)
        .join(', ');
    }
    return room.players.find((p) => p.socketId === winnerIds)?.name || '';
  };

  const renderActivePlayer = (playerId: string | undefined, index: number) => {
    if (!playerId) return null;
    const player = room.players.find((p) => p.socketId === playerId);
    if (!player) return null;

    const choice = rps.choices[playerId];
    const score = rps.scores[playerId] || 0;
    const isWinner =
      room.status === RoomStatus.RESULT &&
      (isWinnerId(rps.gameWinner, playerId) || isWinnerId(rps.roundWinner, playerId));

    const colors = ['bg-cyan-300', 'bg-pink-300', 'bg-emerald-300', 'bg-purple-300'];
    const bgColor = colors[index % colors.length];

    return (
      <div
        key={`active-${playerId}`}
        className={`flex flex-col items-center transition-all ${mySideIndex !== -1 && mySideIndex !== index ? 'opacity-70' : ''} ${isWinner ? 'scale-110 z-10' : ''}`}
      >
        <div
          className={`flex flex-col items-center border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${bgColor} ${index % 2 === 0 ? '' : '-'}`}
        >
          <span className="font-black text-2xl text-black">P{index + 1}</span>
          <span className="text-black font-bold text-sm text-center truncate max-w-[100px]">
            {player.name}
          </span>
          <span className="text-black text-xs mt-1 bg-white px-2 py-0.5 border-2 border-black font-black">
            {score} / {targetScore}
          </span>
        </div>

        {room.status === RoomStatus.RESULT && choice && (
          <div
            className={`mt-4 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isWinner ? 'bg-yellow-300 animate-bounce' : rps.roundWinner === 'DRAW' ? 'bg-gray-300' : 'bg-white opacity-50'} ${index % 2 === 0 ? '-' : ''}`}
          >
            <span className="text-5xl sm:text-7xl drop-">{getEmoji(choice)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative font-mono h-full overflow-y-auto overflow-x-hidden w-full">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-6 relative my-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-center w-full items-center gap-4 mb-4">
          <div className="text-xs font-black text-black bg-cyan-300 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
            {room.config.rpsMode === 'ALL_AT_ONCE'
              ? t('gameRps.allAtOnce')
              : t('gameRps.oneVOneRoundRobin')}
          </div>
          <div className="text-sm font-black tracking-widest uppercase text-black bg-yellow-300 px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10 ">
            {room.status === RoomStatus.RESULT
              ? rps.gameWinner
                ? t('gameRps.matchOver')
                : t('gameRps.roundOver')
              : t('gameRps.playing')}
          </div>
          <div className="text-xs font-black text-black bg-pink-300 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameRps.firstTo', { score: targetScore })}
          </div>
        </div>

        {/* Players / Arena */}
        {room.config.rpsMode === 'ALL_AT_ONCE' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full items-end justify-center min-h-[150px] mt-4">
            {rps.activePlayers.map((id, idx) => renderActivePlayer(id, idx))}
          </div>
        ) : (
          <div className="flex justify-between w-full items-end min-h-[150px] px-2 sm:px-10 mt-4">
            {renderActivePlayer(rps.activePlayers[0], 0)}
            {room.status === RoomStatus.RESULT && (
              <div className="hidden sm:block text-5xl font-black text-black px-4 pb-10 ">
                {t('gameRps.vs')}
              </div>
            )}
            {renderActivePlayer(rps.activePlayers[1], 1)}
          </div>
        )}

        {/* Playing Controls */}
        {room.status === RoomStatus.PLAYING && (
          <div className="w-full flex flex-col items-center gap-6 mt-8">
            {!isMyTurn ? (
              <div className="text-2xl font-black text-black uppercase tracking-widest bg-gray-300 px-8 py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                {t('gameRps.spectating')}
              </div>
            ) : myChoice ? (
              <div className="text-xl font-black text-black text-center bg-yellow-300 px-8 py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                {t('gameRps.choiceLocked')}
                <br />
                <span className="text-sm font-bold mt-2 block bg-white border-2 border-black px-2 py-1">
                  {t('gameRps.waitingOpponent')}
                </span>
              </div>
            ) : (
              <div className="flex gap-4 flex-wrap justify-center">
                {(['ROCK', 'PAPER', 'SCISSORS'] as const).map((choice) => (
                  <button
                    key={choice}
                    disabled={actionLoading}
                    onClick={() => rpsMakeChoice(choice)}
                    className="w-20 h-20 sm:w-28 sm:h-28 bg-white hover:bg-yellow-200 flex items-center justify-center text-5xl sm:text-6xl transition-all hover:scale-105 active:translate-y-1 active:shadow-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="drop-">{getEmoji(choice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results & Transitions */}
        {room.status === RoomStatus.RESULT && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in slide-in-from-bottom-4 w-full mt-8">
            {rps.roundWinner === 'DRAW' ? (
              <div className="text-2xl sm:text-3xl font-black text-black bg-gray-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                {t('gameRps.draw')}
              </div>
            ) : rps.gameWinner ? (
              <div className="text-xl sm:text-3xl text-center font-black px-4 sm:px-8 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black bg-yellow-300 - w-full break-words">
                🏆 {t('gameRps.winsMatch', { winner: getWinnerNames(rps.gameWinner) })} 🏆
              </div>
            ) : (
              <div className="text-lg sm:text-2xl text-center font-black px-4 sm:px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black bg-cyan-300 w-full break-words">
                {t('gameRps.winsRound', { winner: getWinnerNames(rps.roundWinner) })}
              </div>
            )}

            {isHost && (
              <button
                onClick={rpsNextRound}
                disabled={actionLoading}
                className={`font-black px-10 py-4 border-4 border-black mt-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${rps.gameWinner ? 'bg-pink-300 hover:bg-pink-400 text-black -' : 'bg-emerald-300 hover:bg-emerald-400 text-black '}`}
              >
                {rps.gameWinner ? t('gameRps.playAgain') : t('gameRps.nextRound')}
              </button>
            )}
          </div>
        )}

        {/* 1V1 Queue Display */}
        {room.config.rpsMode === '1V1_ROUND_ROBIN' && rps.queue.length > 0 && (
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 -translate-x-full hidden xl:flex flex-col gap-2">
            <h4 className="text-sm font-black text-black bg-white border-2 border-black px-2 py-1 uppercase tracking-widest inline-block self-end">
              {t('gameRps.queue')}
            </h4>
            {rps.queue.map((id, idx) => {
              const p = room.players.find((p) => p.socketId === id);
              if (!p) return null;
              return (
                <div
                  key={`queue-${id}`}
                  className="bg-yellow-300 border-4 border-black px-4 py-2 text-sm font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between min-w-[120px] "
                >
                  <span className="truncate max-w-[80px]">{p.name}</span>
                  <span className="text-xs text-black bg-white border-2 border-black px-1.5 py-0.5 ml-2">
                    #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
