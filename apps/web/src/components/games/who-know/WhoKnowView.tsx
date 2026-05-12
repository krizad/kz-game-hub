"use client";

import { useGameStore } from "@/store/useGameStore";
import { RoomStatus, Role, GameType } from "@repo/types";
import { CountdownTimer } from "@/components/core/CountdownTimer";

export function WhoKnowView() {
  const { room, socketId, myRole, myName } = useGameStore();

  if (!room || room.gameType !== GameType.WHO_KNOW) return null;

  return (
    <>
      {room.status === RoomStatus.WORD_SETTING && (
        <div className="flex-1 flex flex-col items-center justify-center py-6 gap-4 min-h-[150px]">
          {myRole === "Host" ? (
            <p className="text-slate-700 font-medium">Please set the secret word using the popup.</p>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <p className="text-slate-700 font-medium animate-pulse">Waiting for the Game Host to pick a word...</p>
            </>
          )}
        </div>
      )}
      {room.status === RoomStatus.QUESTIONING && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0 py-2 sm:py-4">
          <div className="text-center space-y-1 sm:space-y-2">
            <h4 className="text-base sm:text-lg font-black uppercase text-teal-400 tracking-widest bg-teal-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-teal-500/20 inline-block mb-1 sm:mb-2">Questioning Phase</h4>
            {myRole === Role.Host ? <p className="text-slate-700 font-medium text-xs sm:text-sm">Answer the players' Yes/No questions.</p> : <p className="text-slate-700 font-medium text-xs sm:text-sm">Ask the Game Host Yes or No questions to find the Secret Word!</p>}
          </div>

          <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-800 bg-amber-50 px-6 py-4 rounded-2xl border-2 sm:border-4 border-amber-200 shadow-inner tracking-widest w-full max-w-sm text-center">{room.endTime ? <CountdownTimer endTime={room.endTime} /> : <span>--:--</span>}</div>

          {myRole === Role.Host && (
            <div className="flex flex-col gap-3 mt-2 w-full max-w-md">
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => useGameStore.getState().endQuestioning(false)} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black px-4 py-4 rounded-xl transition-all shadow-lg shadow-teal-900/20 active:scale-[0.98] uppercase tracking-wider text-sm sm:text-base border border-teal-500/30">
                  Word Guessed (Vote)
                </button>
                <button onClick={() => useGameStore.getState().endQuestioning(true)} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-4 rounded-xl transition-all shadow-lg shadow-rose-900/20 active:scale-[0.98] uppercase tracking-wider text-sm sm:text-base border border-rose-500/30">
                  Time's Up (Fail)
                </button>
              </div>
              {room.endTime && (
                <button onClick={() => useGameStore.getState().stopTimer()} className="w-full bg-amber-100 hover:bg-amber-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-all shadow-md active:scale-[0.98] uppercase tracking-wider text-sm border border-amber-300">
                  Stop Timer
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {room.status === RoomStatus.VOTING && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0 py-2 sm:py-4">
          <div className="text-center space-y-1 sm:space-y-2">
            <h4 className="text-base sm:text-lg font-black uppercase text-orange-400 tracking-widest bg-orange-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-orange-500/20 inline-block mb-1 sm:mb-2">Voting Phase</h4>
            {myRole === Role.Host ? (
              <p className="text-slate-700 text-center font-medium text-xs sm:text-sm">
                Wait for the players to vote for the <span className="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20">Insider</span>.
              </p>
            ) : (
              <p className="text-slate-700 text-center font-medium text-xs sm:text-sm">Who was secretly guiding the group? Cast your vote:</p>
            )}
          </div>

          {myRole !== Role.Host && (
            <div className="flex flex-wrap gap-3 justify-center w-full max-w-md">
              {room.players.map((p) => {
                if (p.role === Role.Host || p.socketId === socketId) return null;

                const hasVotedTarget = room.votes?.[socketId] === p.socketId;

                return (
                  <button key={p.id} onClick={() => useGameStore.getState().submitVote(p.socketId)} className={`px-4 py-4 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] w-full sm:w-auto flex-1 basis-[45%] border ${hasVotedTarget ? "bg-orange-600 text-white border-orange-500 shadow-orange-900/50" : "bg-amber-100 hover:bg-amber-200 text-slate-700 border-amber-300 hover:text-slate-800"}`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {room.status === RoomStatus.RESULT && (
        <div className="flex-1 flex flex-col items-center justify-start gap-4 sm:gap-6 min-h-0 py-4 sm:py-6 w-full overflow-y-auto px-2">
          <h4 className="text-base sm:text-lg flex-none font-black uppercase text-yellow-400 tracking-widest bg-yellow-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-yellow-500/20">Game Results</h4>

          {room.winner === "TIMEOUT" ? (
            <div className="text-center bg-rose-950/50 p-6 rounded-2xl border border-rose-900 w-full max-w-sm animate-in zoom-in-95">
              <h5 className="text-2xl font-black text-rose-500 mb-2 uppercase tracking-wider">Time's Up!</h5>
              <p className="text-rose-200/80 font-medium text-sm">The group failed to guess the secret word in time. Everyone loses.</p>
            </div>
          ) : room.winner === "INSIDER" ? (
            <div className="text-center bg-rose-950/50 p-6 rounded-2xl border border-rose-900 w-full max-w-sm shadow-xl animate-in zoom-in-95">
              <h5 className="text-2xl font-black text-rose-500 mb-2 uppercase tracking-wider">Insider Wins!</h5>
              <p className="text-rose-200/80 font-medium text-sm">The group guessed the word, but failed to catch the Insider. The Insider scored 2 points!</p>
            </div>
          ) : room.winner === "COMMONERS" ? (
            <div className="text-center bg-emerald-950/50 p-6 rounded-2xl border border-emerald-900 w-full max-w-sm shadow-xl animate-in zoom-in-95">
              <h5 className="text-2xl font-black text-emerald-500 mb-2 uppercase tracking-wider">Commoners Win!</h5>
              <p className="text-emerald-200/80 font-medium text-sm">The group guessed the word and correctly caught the Insider. Commoners + Host scored +1 point!</p>
            </div>
          ) : null}

          <div className="text-center flex-none bg-white/50 p-5 rounded-2xl border border-amber-200 w-full max-w-sm">
            <p className="text-slate-600 mb-1 uppercase tracking-wide text-xs font-bold">The Secret Word was</p>
            <p className="text-2xl font-black text-rose-400 mb-4">{useGameStore.getState().secretWord || "Unknown"}</p>

            <p className="text-slate-600 mb-1 uppercase tracking-wide text-xs font-bold">The Insider was</p>
            <p className="text-xl font-black text-slate-800">{room.players.find((p) => p.role === Role.Know)?.name || "Unknown"}</p>
          </div>

          {room.votes && Object.keys(room.votes).length > 0 && (
            <div className="w-full flex-none max-w-sm bg-white/50 p-4 rounded-2xl border border-amber-200">
              <h5 className="text-xs font-bold text-slate-600 uppercase tracking-widest text-center mb-3">Voting Results</h5>
              <div className="space-y-2">
                {(() => {
                  const targetToVoters: Record<string, string[]> = {};
                  Object.entries(room.votes || {}).forEach(([voterId, targetId]) => {
                    if (!targetToVoters[targetId]) targetToVoters[targetId] = [];
                    targetToVoters[targetId].push(voterId);
                  });

                  const sortedTargets = Object.entries(targetToVoters).sort((a, b) => b[1].length - a[1].length);
                  const maxVotes = sortedTargets.length > 0 ? sortedTargets[0][1].length : 0;

                  return sortedTargets.map(([targetId, voterIds]) => {
                    const targetPlayer = room.players.find((p) => p.socketId === targetId);
                    if (!targetPlayer) return null;
                    const isMostVoted = voterIds.length === maxVotes && maxVotes > 0;
                    return (
                      <div key={targetId} className={`flex flex-col gap-1.5 p-2.5 rounded-xl border ${isMostVoted ? "bg-orange-950/30 border-orange-900/50" : "bg-amber-50/50 border-amber-200/80"}`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold text-sm ${isMostVoted ? "text-orange-400" : "text-slate-800"}`}>
                            {targetPlayer.name}
                            {isMostVoted && <span className="ml-1.5 text-[9px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded uppercase tracking-wider font-black">Most Voted</span>}
                          </span>
                          <span className={`text-[10px] font-black border px-1.5 py-0.5 rounded ${isMostVoted ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"}`}>
                            {voterIds.length} {voterIds.length === 1 ? "VOTE" : "VOTES"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {voterIds.map((voterId) => {
                            const voter = room.players.find((p) => p.socketId === voterId);
                            return voter ? (
                              <span key={voterId} className="text-[10px] text-slate-600 bg-white/80 border border-amber-300/80 px-1.5 py-0.5 rounded flex items-center gap-1">
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
            <div className="w-full flex-none max-w-sm mt-4">
              <button onClick={() => useGameStore.getState().resetRoom()} className="w-full bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-black text-lg py-4 rounded-xl transition-all uppercase tracking-widest shadow-xl shadow-yellow-900/20 active:scale-[0.98]">
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
