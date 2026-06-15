'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus } from '@repo/types';

export function RPSView() {
  const { room, socketId, rpsMakeChoice, rpsNextRound } = useGameStore();

  if (!room || !room.rpsState) return null;
  const rps = room.rpsState;

  const isMyTurn = rps.activePlayers.includes(socketId);
  const mySideIndex = rps.activePlayers.indexOf(socketId);

  const bestOf = room.config.rpsBestOf || 3;
  const targetScore = Math.floor(bestOf / 2) + 1;

  const getEmoji = (choice: string | null) => {
    if (choice === 'ROCK') return '✊';
    if (choice === 'PAPER') return '✋';
    if (choice === 'SCISSORS') return '✌️';
    return '?';
  };

  const renderActivePlayer = (playerId: string | undefined, index: number) => {
    if (!playerId) return null;
    const player = room.players.find((p) => p.socketId === playerId);
    if (!player) return null;

    const choice = rps.choices[playerId];
    const score = rps.scores[playerId] || 0;
    const isWinner =
      room.status === RoomStatus.RESULT &&
      (rps.gameWinner?.includes(playerId) || rps.roundWinner?.includes(playerId));

    return (
      <div
        key={`active-${playerId}`}
        className={`flex flex-col items-center transition-all ${mySideIndex !== -1 && mySideIndex !== index ? 'opacity-50' : ''} ${isWinner ? 'scale-110' : ''}`}
      >
        <span
          className={`font-black text-2xl ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-orange-400' : 'text-indigo-400'}`}
        >
          P{index + 1}
        </span>
        <span className="text-slate-700 font-medium text-sm text-center truncate max-w-[100px]">
          {player.name}
        </span>
        <span
          className={`text-xs mt-1 px-2 py-0.5 rounded-md border shadow-inner ${index === 0 ? 'text-amber-300 bg-amber-950/50 border-amber-900/50' : index === 1 ? 'text-orange-300 bg-orange-950/50 border-orange-900/50' : 'text-indigo-300 bg-indigo-950/50 border-indigo-900/50'}`}
        >
          {score} / {targetScore}
        </span>
        {room.status === RoomStatus.RESULT && choice && (
          <div
            className={`mt-4 p-4 rounded-3xl border-4 ${isWinner ? (index === 0 ? 'border-amber-500 bg-amber-900/20 shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-bounce' : index === 1 ? 'border-orange-500 bg-orange-900/20 shadow-[0_0_30px_rgba(249,115,22,0.3)] animate-bounce' : 'border-indigo-500 bg-indigo-900/20 shadow-[0_0_30px_rgba(99,102,241,0.3)] animate-bounce') : rps.roundWinner === 'DRAW' ? 'border-slate-500 bg-amber-100' : 'border-amber-200 bg-white opacity-50'}`}
          >
            <span className="text-5xl sm:text-7xl">{getEmoji(choice)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl bg-white border border-amber-200 rounded-3xl p-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex justify-between w-full items-center px-2 sm:px-4 mb-4">
          <div className="text-xs font-bold text-slate-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            {room.config.rpsMode === 'ALL_AT_ONCE' ? 'ALL AT ONCE' : '1V1 ROUND ROBIN'}
          </div>
          <div className="text-sm font-black tracking-widest uppercase text-slate-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 shadow-inner">
            {room.status === RoomStatus.RESULT
              ? rps.gameWinner
                ? 'Match Over'
                : 'Round Over'
              : 'Playing'}
          </div>
          <div className="text-xs font-bold text-amber-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            FIRST TO {targetScore}
          </div>
        </div>

        {/* Players / Arena */}
        {room.config.rpsMode === 'ALL_AT_ONCE' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full items-end justify-center min-h-[150px]">
            {rps.activePlayers.map((id, idx) => renderActivePlayer(id, idx))}
          </div>
        ) : (
          <div className="flex justify-between w-full items-end min-h-[150px] px-2 sm:px-10">
            {renderActivePlayer(rps.activePlayers[0], 0)}
            {room.status === RoomStatus.RESULT && (
              <div className="hidden sm:block text-4xl font-black text-slate-600 italic px-4 pb-10">
                VS
              </div>
            )}
            {renderActivePlayer(rps.activePlayers[1], 1)}
          </div>
        )}

        {/* Playing Controls */}
        {room.status === RoomStatus.PLAYING && (
          <div className="w-full flex flex-col items-center gap-6 mt-8">
            {!isMyTurn ? (
              <div className="text-2xl font-black text-slate-500 uppercase tracking-widest bg-amber-50 px-8 py-4 rounded-2xl border border-amber-200">
                Spectating...
              </div>
            ) : rps.choices[socketId] ? (
              <div className="text-2xl font-black text-amber-500 animate-pulse text-center bg-amber-950/30 px-8 py-4 rounded-2xl border border-amber-900/50">
                Choice locked!
                <br />
                <span className="text-base text-amber-500/50 mt-2 block">
                  Waiting for opponent...
                </span>
              </div>
            ) : (
              <div className="flex gap-4">
                {(['ROCK', 'PAPER', 'SCISSORS'] as const).map((choice) => (
                  <button
                    key={choice}
                    onClick={() => rpsMakeChoice(choice)}
                    className="w-20 h-20 sm:w-28 sm:h-28 bg-amber-100 hover:bg-amber-200 rounded-2xl flex items-center justify-center text-5xl sm:text-6xl transition-all hover:scale-105 active:scale-95 border-2 border-amber-300 hover:border-amber-500 shadow-xl"
                  >
                    {getEmoji(choice)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results & Transitions */}
        {room.status === RoomStatus.RESULT && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in slide-in-from-bottom-4 w-full mt-4">
            {/* Announcement */}
            {rps.roundWinner === 'DRAW' ? (
              <div className="text-2xl sm:text-3xl font-black text-slate-600 bg-amber-100 px-6 py-2 rounded-2xl border-2 border-amber-400 shadow-lg">
                It's a Draw!
              </div>
            ) : rps.gameWinner ? (
              <div className="text-3xl sm:text-4xl font-black px-8 py-4 rounded-2xl border-2 shadow-2xl text-amber-400 bg-amber-950 border-amber-500 animate-pulse text-center">
                🏆{' '}
                {Array.isArray(rps.gameWinner)
                  ? rps.gameWinner
                      .map((id) => room.players.find((p) => p.socketId === id)?.name)
                      .join(', ')
                  : room.players.find((p) => p.socketId === rps.gameWinner)?.name}{' '}
                Wins the Match! 🏆
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-black px-6 py-2 rounded-2xl border-2 shadow-lg text-indigo-400 bg-indigo-950/50 border-indigo-500/50">
                {Array.isArray(rps.roundWinner)
                  ? rps.roundWinner
                      .map((id) => room.players.find((p) => p.socketId === id)?.name)
                      .join(', ')
                  : room.players.find((p) => p.socketId === rps.roundWinner)?.name}{' '}
                Wins the Round!
              </div>
            )}

            {(room.roomHostId === socketId || isMyTurn) && (
              <button
                onClick={rpsNextRound}
                className={`font-bold px-10 py-4 rounded-xl mt-2 transition-all shadow-lg active:scale-95 text-lg uppercase tracking-wider ${rps.gameWinner ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-slate-800'}`}
              >
                {rps.gameWinner ? 'Play Again' : 'Next Round'}
              </button>
            )}
          </div>
        )}

        {/* 1V1 Queue Display */}
        {room.config.rpsMode === '1V1_ROUND_ROBIN' && rps.queue.length > 0 && (
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 -translate-x-full hidden lg:flex flex-col gap-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">
              Queue
            </h4>
            {rps.queue.map((id, idx) => {
              const p = room.players.find((p) => p.socketId === id);
              if (!p) return null;
              return (
                <div
                  key={`queue-${id}`}
                  className="bg-amber-100 border border-amber-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 shadow-lg flex items-center justify-between min-w-[120px]"
                >
                  <span className="truncate max-w-[80px]">{p.name}</span>
                  <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded ml-2">
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
