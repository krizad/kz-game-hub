import { useGameStore } from "@/store/useGameStore";
import { useState } from "react";
import { useTranslate } from "@/hooks/useTranslate";
import { ZoomIn } from "lucide-react";
import { CardViewerModal } from "../CardViewerModal";

export function VotingPhase() {
  const { room, socketId, detectiveClubVote } = useGameStore();
  const { t } = useTranslate();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [viewCardUrl, setViewCardUrl] = useState<string | null>(null);

  if (!room || !room.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const myPlayer = state.players[socketId];
  const hasVoted = myPlayer?.votedFor != null;

  // Informer doesn't vote
  if (myPlayer?.role === 'INFORMER') {
    return (
      <div className="flex-1 flex flex-col space-y-6 items-center justify-center">
        <div className="bg-white border border-amber-200 rounded-xl p-8 text-center max-w-lg shadow-2xl">
           <h2 className="text-3xl font-black text-indigo-400 mb-4 uppercase tracking-widest">Voting Phase</h2>
           <p className="text-slate-700 text-lg mb-6">Detectives are voting on who they think the Conspirator is.</p>
           <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
           <p className="text-slate-500 mt-6 font-medium">You are the Informer, sit tight!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="bg-white border border-amber-200 rounded-xl p-6 text-center w-full shadow-lg">
        <h2 className="text-2xl sm:text-3xl font-black text-rose-400 mb-2">Who is the Conspirator?</h2>
        <p className="text-slate-600">
          Review the played cards below and vote for the player you think did NOT know the word: <span className="text-emerald-400 font-bold">{state.word}</span>
        </p>
      </div>

      {hasVoted ? (
        <div className="flex-1 flex flex-col items-center justify-center">
           <div className="bg-emerald-950/30 p-6 rounded-xl border border-emerald-900/50 text-center">
              <p className="text-emerald-400 font-bold text-xl mb-2">Vote Locked In</p>
              <p className="text-slate-600">Waiting for other players...</p>
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-4 max-w-2xl mx-auto w-full">
          {state.playOrder.map(pid => {
            const player = state.players[pid];
            const pName = room.players.find(p => p.socketId === pid)?.name || 'Unknown';
            const isMe = socketId === pid;
            const isInformer = player.role === 'INFORMER';

            // CANNOT vote for yourself, nor can you vote for the Informer (wait, nobody knows who the Informer is except the Conspirator and Informer! Actually players DO know who the informer is, they are the one who picks the word and plays first)
            // Wait, yes, the first player to play in Round 1 is the Informer. Wait, does the backend assign play order nicely?
            // Actually, we should just let them vote for anyone except themselves and the known Informer.
            // Let's ensure role === INFORMER is filtered out if they know them? The UI doesn't necessarily transmit role='INFORMER' to everyone unless we filter that. 
            // Right now, 'role' might be broadcasted, so players technically could cheat if they inspect network, but visually we just don't show the Informer as a voting option.
            
            if (isMe || isInformer) return null;

            return (
              <button 
                key={pid}
                onClick={() => setSelectedPlayer(pid)}
                className={`flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPlayer === pid 
                    ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                    : 'bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-100'
                }`}
              >
                <div className="flex-1">
                   <span className={`text-lg font-bold ${selectedPlayer === pid ? 'text-rose-400' : 'text-slate-800'}`}>{pName}</span>
                </div>
                <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {player.playedCards.map((cardUrl, idx) => (
                    <div 
                      key={idx} 
                      className="relative w-10 h-14 sm:w-16 sm:h-24 rounded overflow-hidden border border-amber-300 cursor-pointer transform hover:scale-110 transition-transform origin-bottom z-10"
                      onClick={(e) => { e.stopPropagation(); setViewCardUrl(cardUrl); }}
                    >
                      <img src={cardUrl} alt={`Card ${idx}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                         <ZoomIn className="text-white w-4 h-4 shadow-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}

          <div className="pt-6 mt-auto">
            <button 
              onClick={() => selectedPlayer && detectiveClubVote(selectedPlayer)}
              disabled={!selectedPlayer}
              className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-4 rounded-xl transition-all shadow-lg shadow-rose-900/20 active:scale-[0.98] uppercase tracking-wider text-xl"
            >
              Confirm Vote
            </button>
          </div>
        </div>
      )}
      
      <CardViewerModal cardUrl={viewCardUrl} onClose={() => setViewCardUrl(null)} />
    </div>
  );
}
