import { useGameStore } from '@/store/useGameStore';
import { useState } from 'react';
import { useTranslate } from '@/hooks/useTranslate';
import { DetectiveClubRole } from '@repo/types';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function SetupPhase() {
  const { room, privateState, detectiveClubSubmitWord, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [wordInput, setWordInput] = useState('');

  if (!room?.detectiveClubState) return null;
  const myHand = (privateState.dcHand as string[] | undefined) ?? [];
  const isInformer = privateState.dcRole === DetectiveClubRole.INFORMER;

  return (
    <div className="flex-1 flex flex-col space-y-6 relative font-mono">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border-4 border-black p-6 text-center w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h2 className="text-3xl sm:text-4xl font-black text-black mb-2 uppercase tracking-widest bg-yellow-300 px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameDetectiveClub.setupPhase')}
        </h2>
        <p className="text-black font-bold mt-4 bg-cyan-300 px-3 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          {isInformer
            ? t('gameDetectiveClub.informerSetup')
            : t('gameDetectiveClub.waitingInformer')}
        </p>
      </div>

      {/* Your Hand - shown for ALL players */}
      {myHand.length > 0 && (
        <div className="bg-white border-4 border-black p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
          <h3 className="text-black font-black uppercase tracking-widest text-sm mb-4 text-center bg-pink-300 px-3 py-1 border-2 border-black inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
            {t('gameDetectiveClub.yourHandCards')}
          </h3>
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 justify-start sm:justify-center items-center px-4">
            {myHand.map((cardUrl, idx) => (
              <div
                key={`hand-${idx}`}
                className="relative flex-shrink-0 w-24 h-36 sm:w-32 sm:h-48 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
              >
                <img
                  src={cardUrl}
                  alt={`Card ${idx + 1}`}
                  className="w-full h-full object-cover border-4 border-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informer word input */}
      {isInformer ? (
        <div className="w-full max-w-md mx-auto space-y-6 bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
          <p className="text-black font-black text-center text-lg bg-yellow-300 px-3 py-1 border-2 border-black inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {t('gameDetectiveClub.typeWordConnectedToCards')}
          </p>
          <input
            id="wordInput"
            name="word"
            autoComplete="off"
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            placeholder={t('gameDetectiveClub.wordPlaceholder')}
            className="w-full bg-white border-4 border-black text-black px-4 py-3 outline-none focus:ring-4 focus:ring-black font-black text-center text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            onKeyDown={(e) =>
              e.key === 'Enter' && wordInput.trim() && detectiveClubSubmitWord(wordInput)
            }
          />
          <button
            onClick={() => detectiveClubSubmitWord(wordInput)}
            disabled={!wordInput.trim() || actionLoading}
            className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale text-black font-black px-4 py-4 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-lg"
          >
            {t('gameDetectiveClub.confirmWord')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4 py-6 bg-purple-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] - max-w-md mx-auto w-full">
          <div className="text-4xl animate-bounce drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">🕵️‍♂️</div>
          <p className="text-black font-black uppercase tracking-widest bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {t('gameDetectiveClub.waitingForInformer')}
          </p>
        </div>
      )}
    </div>
  );
}
