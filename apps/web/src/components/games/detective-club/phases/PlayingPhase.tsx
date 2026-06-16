import { useGameStore } from '@/store/useGameStore';
import { DetectiveClubPhase } from '@repo/types';
import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';
import { CardViewerModal } from '../CardViewerModal';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function PlayingPhase() {
  const { room, socketId, detectiveClubPlayCard, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [viewCardUrl, setViewCardUrl] = useState<string | null>(null);
  const [confirmPlayIndex, setConfirmPlayIndex] = useState<number | null>(null);

  if (!room || !room.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const myPlayer = state.players[socketId];
  const isMyTurn = state.activePlayerId === socketId;
  const isConspirator = myPlayer?.role === 'CONSPIRATOR';

  const activePlayerName =
    room.players.find((p) => p.socketId === state.activePlayerId)?.name || 'Unknown';

  return (
    <div className="flex-1 flex flex-col space-y-6 relative">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border border-amber-200 rounded-xl p-6 text-center w-full shadow-lg">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
          {t('gameDetectiveClub.theSecretWord')}
        </span>
        {isConspirator ? (
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold bg-amber-50 text-slate-500 px-6 py-2 rounded-lg border border-amber-200 tracking-[0.5em] blur-[2px] select-none pointer-events-none">
              ????????
            </span>
          </div>
        ) : (
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 bg-emerald-500/10 inline-block px-6 py-2 rounded-lg border border-emerald-500/20 shadow-inner">
            {state.word}
          </p>
        )}
        <p className="text-sm text-slate-600 mt-4">
          {t('gameDetectiveClub.roundOf', {
            current: state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1 ? 1 : 2,
            total: 2,
          })}
        </p>
      </div>

      {/* Table / Played Cards Area */}
      <div className="flex-1 bg-amber-50/50 border border-amber-200 rounded-xl p-4 sm:p-6 overflow-x-auto min-h-[300px]">
        <h3 className="text-slate-600 font-bold uppercase tracking-widest text-xs mb-4 text-center">
          {t('gameDetectiveClub.playedCards')}
        </h3>
        <div className="flex flex-wrap gap-4 justify-center items-center">
          {state.playOrder.map((pid) => {
            const player = state.players[pid];
            const pName = room.players.find((p) => p.socketId === pid)?.name || 'Unknown';
            const isActive = state.activePlayerId === pid;
            return (
              <div
                key={pid}
                className={`flex flex-col items-center p-3 rounded-xl border ${isActive ? 'bg-indigo-950/30 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-white/50 border-amber-200'} transition-all min-w-[120px]`}
              >
                <span
                  className={`text-sm font-bold mb-2 truncate max-w-[100px] ${isActive ? 'text-indigo-400' : 'text-slate-700'}`}
                >
                  {pName}
                </span>
                <div className="flex gap-2 min-h-[140px]">
                  {player.playedCards.map((cardUrl, idx) => (
                    <div
                      key={idx}
                      className="relative group w-20 h-28 sm:w-24 sm:h-32 rounded-lg overflow-hidden border-2 border-amber-300 shadow-md transform hover:scale-105 transition-transform cursor-pointer"
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
                  {Array.from({
                    length:
                      (state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1 ? 1 : 2) -
                      player.playedCards.length,
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className={`w-20 h-28 sm:w-24 sm:h-32 rounded-lg border-2 border-dashed flex items-center justify-center ${isActive ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-amber-200/80 bg-white/20'}`}
                    >
                      {isActive && (
                        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin opacity-50"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Your Hand */}
      <div className="bg-white border border-amber-200 rounded-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-full py-1 text-center text-xs font-bold uppercase tracking-widest ${isMyTurn ? 'bg-indigo-600 text-white' : 'bg-amber-100 text-slate-600'}`}
        >
          {isMyTurn ? t('gameDetectiveClub.yourTurnPlayCard') : t('gameDetectiveClub.waitingFor', { name: activePlayerName })}
        </div>

        <h3 className="text-slate-600 font-bold uppercase tracking-widest text-xs mb-4 text-center mt-6">
          {t('gameDetectiveClub.yourHand')}
        </h3>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 justify-start sm:justify-center items-center px-4">
          {myPlayer?.hand.map((cardUrl, idx) => (
            <div
              key={idx}
              className={`relative group flex-shrink-0 w-24 h-36 sm:w-32 sm:h-48 rounded-xl overflow-hidden border-2 transition-all ${
                isMyTurn
                  ? 'border-indigo-500/50 hover:border-indigo-400 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:-translate-y-2'
                  : 'border-amber-300 opacity-80'
              }`}
            >
              <img
                src={cardUrl}
                alt="Hand Card"
                className="w-full h-full object-cover border-4 border-white rounded-lg"
              />

              {isMyTurn && (
                <div
                  className="absolute inset-0 bg-transparent group-hover:bg-indigo-900/40 transition-colors flex items-center justify-center backdrop-blur-[0px] group-hover:backdrop-blur-[2px] cursor-pointer"
                  onClick={() => setConfirmPlayIndex(idx)}
                >
                  <span className="opacity-0 group-hover:opacity-100 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                    {t('gameDetectiveClub.play')}
                  </span>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewCardUrl(cardUrl);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-amber-200 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md z-10"
                title="View larger"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmPlayIndex !== null && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmPlayIndex(null)}
        >
          <div
            className="bg-white border-2 border-amber-300 rounded-xl max-w-sm w-full p-6 text-center shadow-2xl transform scale-100 transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-slate-800 mb-4">{t('gameDetectiveClub.confirmCardPlay')}</h2>
            <div className="flex justify-center mb-6">
              <div className="w-32 h-44 rounded-lg overflow-hidden border-4 border-indigo-500 shadow-lg">
                <img
                  src={myPlayer?.hand[confirmPlayIndex]}
                  alt="Selected Card"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <p className="text-slate-600 mb-6 font-medium">
              {t('gameDetectiveClub.confirmPlayDescription')}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmPlayIndex(null)}
                className="flex-1 py-3 px-4 bg-amber-100 hover:bg-amber-200 text-slate-800 font-bold rounded-lg transition-colors border border-amber-400"
              >
                {t('gameDetectiveClub.cancel')}
              </button>
              <button
                onClick={() => {
                  detectiveClubPlayCard(confirmPlayIndex);
                  setConfirmPlayIndex(null);
                }}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-lg transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400"
              >
                {t('gameDetectiveClub.playCard')}
              </button>
            </div>
          </div>
        </div>
      )}

      <CardViewerModal cardUrl={viewCardUrl} onClose={() => setViewCardUrl(null)} />
    </div>
  );
}
