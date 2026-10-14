import { useGameStore } from '@/store/useGameStore';
import { DetectiveClubPhase, DetectiveClubRole } from '@repo/types';
import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';
import { CardViewerModal } from '../CardViewerModal';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';
import { GameDialog } from '@/components/core/GameDialog';

export function PlayingPhase() {
  const { room, socketId, privateState, detectiveClubPlayCard, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [viewCardUrl, setViewCardUrl] = useState<string | null>(null);
  const [confirmPlayIndex, setConfirmPlayIndex] = useState<number | null>(null);

  if (!room || !room.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const isMyTurn = state.activePlayerId === socketId;
  const isConspirator = privateState.dcRole === DetectiveClubRole.CONSPIRATOR;
  const myHand = (privateState.dcHand as string[] | undefined) ?? [];
  const secretWord = privateState.dcWord as string | undefined;

  const activePlayerName =
    room.players.find((p) => p.socketId === state.activePlayerId)?.name ||
    t('gameDetectiveClub.unknownRole');

  return (
    <div className="flex-1 flex flex-col space-y-6 relative font-mono">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <span className="text-sm font-black text-black bg-pink-300 px-3 py-1 border-2 border-black inline-block uppercase tracking-widest mb-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.theSecretWord')}
        </span>
        {isConspirator ? (
          <div className="flex items-center justify-center">
            <span className="text-2xl font-black bg-black text-white px-6 py-3 border-4 border-black tracking-[0.5em] select-none pointer-events-none transform - shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              ????????
            </span>
          </div>
        ) : (
          <p className="text-3xl sm:text-4xl font-black text-black bg-cyan-300 inline-block px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            {secretWord}
          </p>
        )}
        <p className="text-md text-black font-bold mt-6 bg-white px-2 py-1 border-2 border-black inline-block -">
          {t('gameDetectiveClub.roundOf', {
            current: state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1 ? 1 : 2,
            total: 2,
          })}
        </p>
      </div>

      {/* Table / Played Cards Area */}
      <div className="flex-1 bg-yellow-300 border-4 border-black p-4 sm:p-6 overflow-x-auto min-h-[300px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-sm mb-6 text-center bg-white px-3 py-1 border-2 border-black inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.playedCards')}
        </h3>
        <div className="flex flex-wrap gap-6 justify-center items-center">
          {state.playOrder.map((pid) => {
            const player = state.players[pid];
            const pName =
              room.players.find((p) => p.socketId === pid)?.name ||
              t('gameDetectiveClub.unknownRole');
            const isActive = state.activePlayerId === pid;
            return (
              <div
                key={pid}
                className={`flex flex-col items-center p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[120px] bg-white ${isActive ? 'scale-105 bg-cyan-200' : '-'}`}
              >
                <span
                  className={`text-md font-black mb-3 truncate max-w-[100px] bg-white px-2 py-1 border-2 border-black ${isActive ? 'text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'text-black'}`}
                >
                  {pName}
                </span>
                <div className="flex gap-3 min-h-[140px]">
                  {player.playedCards.map((cardUrl, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="relative group w-20 h-28 sm:w-24 sm:h-32 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                      onClick={() => setViewCardUrl(cardUrl)}
                      aria-label={t('gameDetectiveClub.inspectPlayedCard', {
                        name: pName,
                        number: idx + 1,
                      })}
                    >
                      <img
                        src={cardUrl}
                        alt={t('gameDetectiveClub.playedCardAlt')}
                        className="w-full h-full object-cover border-4 border-white"
                      />
                      <ZoomIn
                        aria-hidden="true"
                        className="absolute right-1 top-1 h-6 w-6 border border-black bg-white p-0.5 text-black"
                      />
                    </button>
                  ))}
                  {Array.from({
                    length:
                      (state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1 ? 1 : 2) -
                      player.playedCards.length,
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className={`w-20 h-28 sm:w-24 sm:h-32 border-4 border-black border-dashed flex items-center justify-center bg-gray-100`}
                    >
                      {isActive && <div className="w-8 h-8 bg-black animate-spin"></div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Your Hand */}
      <div className="bg-white border-4 border-black p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden - mt-6">
        <div
          className={`absolute top-0 left-0 w-full py-2 text-center text-sm font-black uppercase tracking-widest border-b-4 border-black ${isMyTurn ? 'bg-emerald-400 text-black shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-gray-300 text-black'}`}
        >
          {isMyTurn
            ? t('gameDetectiveClub.yourTurnPlayCard')
            : t('gameDetectiveClub.waitingFor', { name: activePlayerName })}
        </div>

        <h3 className="text-black font-black uppercase tracking-widest text-sm mb-6 text-center mt-10 bg-pink-300 px-3 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.yourHand')}
        </h3>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 justify-start sm:justify-center items-center px-4">
          {myHand.map((cardUrl, idx) => (
            <div
              key={idx}
              className={`relative flex-shrink-0 w-32 border-4 border-black transition-all bg-white ${
                isMyTurn
                  ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <img
                src={cardUrl}
                alt={t('gameDetectiveClub.handCardAlt')}
                className="w-full h-36 sm:h-44 object-cover border-4 border-white"
              />
              <div className="flex flex-col gap-1 p-1">
                <button
                  type="button"
                  onClick={() => setViewCardUrl(cardUrl)}
                  className="flex min-h-11 items-center justify-center gap-1 bg-white text-black border-2 border-black font-bold text-sm hover:bg-yellow-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-500"
                  aria-label={t('gameDetectiveClub.inspectHandCard', { number: idx + 1 })}
                >
                  <ZoomIn aria-hidden="true" className="w-5 h-5" />
                  {t('gameDetectiveClub.viewLarger')}
                </button>
                {isMyTurn && (
                  <button
                    type="button"
                    onClick={() => setConfirmPlayIndex(idx)}
                    disabled={actionLoading}
                    className="min-h-11 bg-yellow-300 text-black border-2 border-black font-black uppercase text-sm hover:bg-yellow-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-500 disabled:opacity-50"
                    aria-label={t('gameDetectiveClub.selectHandCard', { number: idx + 1 })}
                  >
                    {t('gameDetectiveClub.play')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmPlayIndex !== null && (
        <GameDialog
          open={confirmPlayIndex !== null}
          onClose={() => setConfirmPlayIndex(null)}
          title={t('gameDetectiveClub.confirmCardPlay')}
        >
          <div className="bg-white border-8 border-black max-w-sm w-full p-8 text-center shadow-[16px_16px_0px_0px_rgba(255,255,255,1)]">
            <h2 className="text-2xl font-black text-black mb-6 uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block -">
              {t('gameDetectiveClub.confirmCardPlay')}
            </h2>
            <div className="flex justify-center mb-8">
              <div className="w-40 h-56 border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <img
                  src={myHand[confirmPlayIndex]}
                  alt={t('gameDetectiveClub.selectedCardAlt')}
                  className="w-full h-full object-cover border-4 border-white"
                />
              </div>
            </div>
            <p className="text-black mb-8 font-bold text-lg bg-cyan-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {t('gameDetectiveClub.confirmPlayDescription')}
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setConfirmPlayIndex(null)}
                className="flex-1 py-4 px-4 bg-gray-300 hover:bg-gray-400 text-black font-black border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest text-lg"
              >
                {t('gameDetectiveClub.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  detectiveClubPlayCard(confirmPlayIndex);
                  setConfirmPlayIndex(null);
                }}
                disabled={actionLoading}
                className="flex-1 py-4 px-4 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-black font-black border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest text-lg"
              >
                {t('gameDetectiveClub.playCard')}
              </button>
            </div>
          </div>
        </GameDialog>
      )}

      <CardViewerModal cardUrl={viewCardUrl} onClose={() => setViewCardUrl(null)} />
    </div>
  );
}
