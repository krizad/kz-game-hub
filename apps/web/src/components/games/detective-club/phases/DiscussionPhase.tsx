import { useGameStore } from '@/store/useGameStore';
import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';
import { CardViewerModal } from '../CardViewerModal';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function DiscussionPhase() {
  const { room, socketId, detectiveClubNextPhase, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [viewCardUrl, setViewCardUrl] = useState<string | null>(null);

  if (!room || !room.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const isHost = socketId === room.roomHostId;

  return (
    <div className="flex-1 flex flex-col space-y-6 relative font-mono">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h2 className="text-3xl sm:text-4xl font-black text-black mb-4 uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameDetectiveClub.discussionPhase')}
        </h2>
        <p className="text-black font-bold text-lg mb-2">
          {t('gameDetectiveClub.informerExplain')}{' '}
          <span className="text-black bg-cyan-300 font-black px-2 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {state.word}
          </span>
        </p>
        <p className="text-black font-bold bg-pink-300 px-3 py-1 border-2 border-black inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.everyoneExplain')}
        </p>
      </div>

      {/* Table / Played Cards Area (View Only) */}
      <div className="flex-1 bg-yellow-300 border-4 border-black p-4 sm:p-6 overflow-x-auto min-h-[300px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-sm mb-6 text-center bg-white px-3 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.playedCards')}
        </h3>
        <div className="flex flex-wrap gap-6 justify-center items-center">
          {state.playOrder.map((pid) => {
            const player = state.players[pid];
            const pName = room.players.find((p) => p.socketId === pid)?.name || 'Unknown';
            const isMe = socketId === pid;
            return (
              <div
                key={pid}
                className={`flex flex-col items-center p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[120px] bg-white ${isMe ? ' scale-105' : '-'}`}
              >
                <span
                  className={`text-md font-black mb-3 truncate max-w-[100px] bg-white px-2 py-1 border-2 border-black ${isMe ? 'text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'text-black'}`}
                >
                  {pName} {isMe && `(${t('lobby.you')})`}
                </span>
                <div className="flex gap-3 min-h-[140px]">
                  {player.playedCards.map((cardUrl, idx) => (
                    <div
                      key={idx}
                      className="relative group w-24 h-32 sm:w-28 sm:h-40 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer bg-white "
                      onClick={() => setViewCardUrl(cardUrl)}
                    >
                      <img
                        src={cardUrl}
                        alt="Played Card"
                        className="w-full h-full object-cover border-4 border-white"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ZoomIn className="text-white w-8 h-8 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isHost && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => detectiveClubNextPhase()}
            disabled={actionLoading}
            className="w-full max-w-md bg-emerald-400 hover:bg-emerald-300 text-black font-black px-6 py-4 border-4 border-black transition-transform shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
          >
            {t('gameDetectiveClub.startVoting')}
          </button>
        </div>
      )}
      {!isHost && (
        <div className="text-center mt-6 text-black font-black uppercase tracking-widest bg-purple-300 px-4 py-2 border-4 border-black inline-block mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameDetectiveClub.waitingForHostVoting')}
        </div>
      )}
      <CardViewerModal cardUrl={viewCardUrl} onClose={() => setViewCardUrl(null)} />
    </div>
  );
}
