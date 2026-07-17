'use client';

import { TheMindPhase } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { TheMindView } from './TheMindView';

export function TheMindGameView() {
  const { room, playerId } = useGameStore();
  const { t } = useTranslate();

  const state = room?.theMindState;
  const myHand = state?.playerHands[playerId] ?? [];
  const showSetupHand = state?.phase === TheMindPhase.SETUP;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {showSetupHand && (
        <div className="mx-auto w-full max-w-lg px-4 pt-4">
          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">
              {t('gameTheMind.game.yourHand')} ({myHand.length})
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {myHand.map((card) => (
                <div
                  key={card}
                  className="w-16 h-20 rounded-xl font-black text-xl border-2 bg-indigo-600 text-white border-indigo-700 shadow-md flex items-center justify-center"
                >
                  {Math.abs(card)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <TheMindView />
    </div>
  );
}
