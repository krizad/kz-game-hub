import { useGameStore } from '@/store/useGameStore';
import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';
import { DetectiveClubRole } from '@repo/types';
import { CardViewerModal } from '../CardViewerModal';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function VotingPhase() {
  const { room, socketId, privateState, detectiveClubVote, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [viewCardUrl, setViewCardUrl] = useState<string | null>(null);

  if (!room || !room.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const myPlayer = state.players[socketId];
  const hasVoted = myPlayer?.votedFor != null;
  const isInformer = privateState.dcRole === DetectiveClubRole.INFORMER;

  if (isInformer) {
    return (
      <div className="flex-1 flex flex-col space-y-6 items-center justify-center font-mono">
        <div className="bg-white border-8 border-black p-8 text-center max-w-lg shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] -">
          <h2 className="text-3xl font-black text-black mb-6 uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {t('gameDetectiveClub.votingPhase')}
          </h2>
          <p className="text-black text-xl font-bold mb-8 bg-cyan-300 px-3 py-1 border-2 border-black inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {t('gameDetectiveClub.detectivesVoting')}
          </p>
          <div className="w-16 h-16 border-8 border-black border-t-pink-400 animate-spin mx-auto mb-8"></div>
          <p className="text-black bg-pink-300 px-4 py-2 border-4 border-black font-black uppercase tracking-widest inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {t('gameDetectiveClub.informerSitTight')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-6 relative font-mono">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h2 className="text-2xl sm:text-3xl font-black text-black mb-4 uppercase tracking-widest bg-rose-400 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameDetectiveClub.whoIsConspirator')}
        </h2>
        <p className="text-black font-bold text-lg mb-2">
          {t('gameDetectiveClub.reviewCardsAndVote')}{' '}
          <span className="text-black bg-cyan-300 font-black px-2 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {state.word}
          </span>
        </p>
      </div>

      {hasVoted ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-emerald-400 p-8 border-8 border-black text-center shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] -">
            <p className="text-black font-black text-2xl mb-4 uppercase tracking-widest bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {t('gameDetectiveClub.voteLockedIn')}
            </p>
            <p className="text-black font-bold text-lg bg-yellow-300 px-3 py-1 border-2 border-black inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {t('gameDetectiveClub.waitingForOtherPlayers')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-6 max-w-2xl mx-auto w-full">
          {state.playOrder.map((pid) => {
            const player = state.players[pid];
            const pName = room.players.find((p) => p.socketId === pid)?.name || 'Unknown';
            const isMe = socketId === pid;
            const isInformerPlayer = state.informerId === pid;

            if (isMe || isInformerPlayer) return null;

            return (
              <button
                key={pid}
                onClick={() => setSelectedPlayer(pid)}
                className={`flex items-center p-4 border-4 border-black transition-all text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                  selectedPlayer === pid
                    ? 'bg-rose-400 scale-105'
                    : 'bg-white hover:bg-yellow-300 hover:-'
                }`}
              >
                <div className="flex-1">
                  <span
                    className={`text-xl font-black bg-white px-3 py-1 border-2 border-black inline-block ${selectedPlayer === pid ? 'text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'text-black'}`}
                  >
                    {pName}
                  </span>
                </div>
                <div className="flex gap-2">
                  {player.playedCards.map((cardUrl, idx) => (
                    <div
                      key={idx}
                      className="relative w-12 h-16 sm:w-16 sm:h-24 border-4 border-black cursor-pointer transform hover:scale-110 transition-transform origin-bottom z-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white "
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewCardUrl(cardUrl);
                      }}
                    >
                      <img
                        src={cardUrl}
                        alt={`Card ${idx}`}
                        className="w-full h-full object-cover border-2 border-white"
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                        <ZoomIn className="text-white w-6 h-6 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}

          <div className="pt-6 mt-auto">
            <button
              onClick={() => selectedPlayer && detectiveClubVote(selectedPlayer)}
              disabled={!selectedPlayer || actionLoading}
              className="w-full bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-black font-black px-6 py-4 border-4 border-black transition-transform shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-2xl -"
            >
              {t('gameDetectiveClub.confirmVote')}
            </button>
          </div>
        </div>
      )}

      <CardViewerModal cardUrl={viewCardUrl} onClose={() => setViewCardUrl(null)} />
    </div>
  );
}
