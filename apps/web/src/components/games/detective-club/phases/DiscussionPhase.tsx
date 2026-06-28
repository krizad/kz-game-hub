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
    <div className="flex-1 flex flex-col space-y-6 relative">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border border-amber-200 rounded-xl p-6 text-center w-full shadow-lg">
        <h2 className="text-2xl sm:text-3xl font-black text-indigo-400 mb-2">
          {t('gameDetectiveClub.discussionPhase')}
        </h2>
        <p className="text-slate-600">
          {t('gameDetectiveClub.informerExplain')}{' '}
          <span className="text-emerald-400 font-bold">{state.word}</span>
        </p>
        <p className="text-slate-600 mt-2">{t('gameDetectiveClub.everyoneExplain')}</p>
      </div>

      {/* Table / Played Cards Area (View Only) */}
      <div className="flex-1 bg-amber-50/50 border border-amber-200 rounded-xl p-4 sm:p-6 overflow-x-auto min-h-[300px]">
        <h3 className="text-slate-600 font-bold uppercase tracking-widest text-xs mb-4 text-center">
          {t('gameDetectiveClub.playedCards')}
        </h3>
        <div className="flex flex-wrap gap-4 justify-center items-center">
          {state.playOrder.map((pid) => {
            const player = state.players[pid];
            const pName = room.players.find((p) => p.socketId === pid)?.name || 'Unknown';
            const isMe = socketId === pid;
            return (
              <div
                key={pid}
                className={`flex flex-col items-center p-3 rounded-xl border ${isMe ? 'bg-indigo-950/30 border-indigo-500/50' : 'bg-white/50 border-amber-200'} transition-all min-w-[120px]`}
              >
                <span
                  className={`text-sm font-bold mb-2 truncate max-w-[100px] ${isMe ? 'text-indigo-400' : 'text-slate-700'}`}
                >
                  {pName} {isMe && `(${t('lobby.you')})`}
                </span>
                <div className="flex gap-2 min-h-[140px]">
                  {player.playedCards.map((cardUrl, idx) => (
                    <div
                      key={idx}
                      className="relative group w-24 h-32 sm:w-28 sm:h-40 rounded-lg overflow-hidden border-2 border-amber-300 shadow-md transform hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => setViewCardUrl(cardUrl)}
                    >
                      <img
                        src={cardUrl}
                        alt="Played Card"
                        className="w-full h-full object-cover border-4 border-white rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ZoomIn className="text-white w-6 h-6 shadow-sm" />
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
            className="w-full max-w-md bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('gameDetectiveClub.startVoting')}
          </button>
        </div>
      )}
      {!isHost && (
        <div className="text-center mt-6 text-slate-500 font-medium">
          {t('gameDetectiveClub.waitingForHostVoting')}
        </div>
      )}
      <CardViewerModal cardUrl={viewCardUrl} onClose={() => setViewCardUrl(null)} />
    </div>
  );
}
