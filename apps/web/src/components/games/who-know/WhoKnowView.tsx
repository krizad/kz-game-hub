'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, Role, GameType } from '@repo/types';
import { CountdownTimer } from '@/components/core/CountdownTimer';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { useTranslate } from '@/hooks/useTranslate';

export function WhoKnowView() {
  const { room, socketId, myRole, privateState, actionLoading } = useGameStore();
  const { t } = useTranslate();

  if (!room || room.gameType !== GameType.WHO_KNOW) return null;

  const myVote = privateState.wkVote as string | undefined;

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {actionLoading && <ActionLoadingOverlay />}
      {room.status === RoomStatus.WORD_SETTING && (
        <div className="flex-1 flex flex-col items-center justify-center py-6 gap-6 min-h-[150px]">
          {myRole === Role.Host ? (
            <div className="bg-yellow-300 p-8 sm:p-10 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md text-center">
              <p className="text-black font-black uppercase tracking-widest text-xl sm:text-2xl leading-tight">
                {t('gameWhoKnow.wordSettingHost')}
              </p>
            </div>
          ) : (
            <div className="bg-cyan-300 p-8 sm:p-10 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full text-center flex flex-col items-center gap-4">
              <div className="text-5xl sm:text-6xl animate-bounce mb-2">⏳</div>
              <p className="text-black font-black uppercase tracking-widest text-xl sm:text-2xl animate-pulse leading-tight">
                {t('gameWhoKnow.wordSettingWaiting')}
              </p>
            </div>
          )}
        </div>
      )}
      {room.status === RoomStatus.QUESTIONING && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-0 py-6">
          <div className="text-center space-y-4">
            <h4 className="text-3xl font-black uppercase text-black tracking-widest bg-emerald-400 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block mb-2 -">
              {t('gameWhoKnow.questioningPhase')}
            </h4>
            {myRole === Role.Host ? (
              <p className="text-black font-bold text-xl bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                {t('gameWhoKnow.questioningHost')}
              </p>
            ) : (
              <p className="text-black font-bold text-xl bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                {t('gameWhoKnow.questioningPlayers')}
              </p>
            )}
          </div>

          <div className="text-6xl sm:text-7xl md:text-8xl font-black text-black bg-pink-300 px-8 py-6 border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] tracking-widest w-full max-w-sm text-center animate-pulse">
            {room.endTime ? <CountdownTimer endTime={room.endTime} /> : <span>--:--</span>}
          </div>

          {myRole === Role.Host && (
            <div className="flex flex-col gap-4 mt-6 w-full max-w-md">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => useGameStore.getState().endQuestioning(false)}
                  disabled={actionLoading}
                  className="flex-1 bg-emerald-400 hover:bg-emerald-300 text-black font-black px-4 py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest text-lg sm:text-xl transition-all -"
                >
                  {t('gameWhoKnow.wordGuessedVote')}
                </button>
                <button
                  onClick={() => useGameStore.getState().endQuestioning(true)}
                  disabled={actionLoading}
                  className="flex-1 bg-rose-400 hover:bg-rose-300 text-black font-black px-4 py-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest text-lg sm:text-xl transition-all "
                >
                  {t('gameWhoKnow.timesUpFail')}
                </button>
              </div>
              {room.endTime && (
                <button
                  onClick={() => useGameStore.getState().stopTimer()}
                  disabled={actionLoading}
                  className="w-full bg-yellow-300 hover:bg-yellow-200 text-black font-black px-4 py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest text-lg transition-all"
                >
                  {t('gameWhoKnow.stopTimer')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {room.status === RoomStatus.VOTING && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0 py-6">
          <div className="text-center space-y-4">
            <h4 className="text-3xl font-black uppercase text-black tracking-widest bg-yellow-300 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block mb-2 ">
              {t('gameWhoKnow.votingPhase')}
            </h4>
            {myRole === Role.Host ? (
              <p className="text-black font-bold text-xl bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                {t('gameWhoKnow.votingHostWait')}
              </p>
            ) : (
              <p className="text-black font-bold text-xl bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                {t('gameWhoKnow.votingPrompt')}
              </p>
            )}
          </div>

          {myRole !== Role.Host && (
            <div className="flex flex-col gap-4 justify-center w-full max-w-sm mt-4">
              {room.players.map((p) => {
                if (p.socketId === room.hostPlayerId || p.socketId === socketId) return null;

                const hasVotedTarget = myVote === p.socketId;

                return (
                  <button
                    key={p.id}
                    onClick={() => useGameStore.getState().submitVote(p.socketId)}
                    disabled={actionLoading}
                    className={`px-6 py-4 border-4 border-black font-black text-2xl uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none w-full disabled:opacity-50 disabled:cursor-not-allowed ${hasVotedTarget ? 'bg-cyan-300 text-black ' : 'bg-white hover:bg-slate-200 text-black -'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {room.status === RoomStatus.RESULT && (
        <div className="flex-1 flex flex-col items-center justify-start gap-8 min-h-0 py-6 w-full overflow-y-auto px-4">
          <h4 className="text-3xl flex-none font-black uppercase text-black tracking-widest bg-emerald-400 px-6 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {t('gameWhoKnow.resultsTitle')}
          </h4>

          {room.winner === 'TIMEOUT' ? (
            <div className="text-center bg-rose-400 p-8 border-4 border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
              <h5 className="text-3xl font-black text-black mb-4 uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                {t('gameWhoKnow.timeoutTitle')}
              </h5>
              <p className="text-black font-bold text-lg bg-white px-2 py-1 border-2 border-black inline-block">
                {t('gameWhoKnow.timeoutDesc')}
              </p>
            </div>
          ) : room.winner === 'INSIDER' ? (
            <div className="text-center bg-rose-400 p-8 border-4 border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
              <h5 className="text-3xl font-black text-black mb-4 uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                {t('gameWhoKnow.insiderWinsTitle')}
              </h5>
              <p className="text-black font-bold text-lg bg-white px-2 py-1 border-2 border-black inline-block">
                {t('gameWhoKnow.insiderWinsDesc')}
              </p>
            </div>
          ) : room.winner === 'COMMONERS' ? (
            <div className="text-center bg-cyan-300 p-8 border-4 border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
              <h5 className="text-3xl font-black text-black mb-4 uppercase tracking-widest bg-white border-4 border-black inline-block px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
                {t('gameWhoKnow.commonersWinTitle')}
              </h5>
              <p className="text-black font-bold text-lg bg-white px-2 py-1 border-2 border-black - inline-block">
                {t('gameWhoKnow.commonersWinDesc')}
              </p>
            </div>
          ) : null}

          <div className="text-center flex-none bg-yellow-300 p-6 border-4 border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mt-4">
            <p className="text-black mb-2 uppercase tracking-widest text-sm font-black bg-white inline-block px-2 py-1 border-2 border-black -">
              {t('gameWhoKnow.secretWordWas')}
            </p>
            <p className="text-4xl font-black text-black mb-6 uppercase bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
              {useGameStore.getState().secretWord || 'Unknown'}
            </p>

            <p className="text-black mb-2 uppercase tracking-widest text-sm font-black bg-white inline-block px-2 py-1 border-2 border-black ">
              {t('gameWhoKnow.insiderWas')}
            </p>
            <p className="text-3xl font-black text-black uppercase bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
              {room.players.find((p) => p.role === Role.Know)?.name || 'Unknown'}
            </p>
          </div>

          {room.votes && Object.keys(room.votes).length > 0 && (
            <div className="w-full flex-none max-w-sm bg-pink-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] - mt-4">
              <h5 className="text-lg font-black text-black uppercase tracking-widest text-center mb-6 bg-white border-4 border-black px-2 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block mx-auto block w-fit">
                {t('gameWhoKnow.votingResults')}
              </h5>
              <div className="space-y-4">
                {(() => {
                  const targetToVoters: Record<string, string[]> = {};
                  Object.entries(room.votes || {}).forEach(([voterId, targetId]) => {
                    if (!targetToVoters[targetId]) targetToVoters[targetId] = [];
                    targetToVoters[targetId].push(voterId);
                  });

                  const sortedTargets = Object.entries(targetToVoters).sort(
                    (a, b) => b[1].length - a[1].length,
                  );
                  const maxVotes = sortedTargets.length > 0 ? sortedTargets[0][1].length : 0;

                  return sortedTargets.map(([targetId, voterIds]) => {
                    const targetPlayer = room.players.find((p) => p.socketId === targetId);
                    if (!targetPlayer) return null;
                    const isMostVoted = voterIds.length === maxVotes && maxVotes > 0;
                    return (
                      <div
                        key={targetId}
                        className={`flex flex-col gap-2 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isMostVoted ? 'bg-cyan-300 ' : 'bg-white -'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span
                            className={`font-black text-xl uppercase ${isMostVoted ? 'text-black' : 'text-black'}`}
                          >
                            {targetPlayer.name}
                            {isMostVoted && (
                              <span className="ml-3 text-sm bg-yellow-300 text-black border-2 border-black px-2 py-1 uppercase tracking-widest font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] - inline-block">
                                {t('gameWhoKnow.mostVoted')}
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-sm font-black border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isMostVoted ? 'bg-white text-black ' : 'bg-emerald-400 text-black -'}`}
                          >
                            {voterIds.length}{' '}
                            {voterIds.length === 1 ? t('gameWhoKnow.vote') : t('gameWhoKnow.votes')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {voterIds.map((voterId) => {
                            const voter = room.players.find((p) => p.socketId === voterId);
                            return voter ? (
                              <span
                                key={voterId}
                                className="text-xs font-bold text-black uppercase bg-white border-2 border-black px-2 py-1"
                              >
                                {voter.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {socketId === room.roomHostId && (
            <div className="w-full flex-none max-w-sm mt-8">
              <button
                onClick={() => useGameStore.getState().resetRoom()}
                disabled={actionLoading}
                className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black text-2xl py-6 border-4 border-black transition-all uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('gameWhoKnow.playAgain')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
