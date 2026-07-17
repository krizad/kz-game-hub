'use client';

import React from 'react';
import { TheMindPhase } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { TheMindView } from './TheMindView';

export function TheMindGameView() {
  const { room, playerId, socketId, myName } = useGameStore();
  const { t } = useTranslate();

  const currentPlayerId = React.useMemo(() => {
    if (!room) return playerId;

    const currentPlayer = room.players.find(
      (player) => player.id === playerId || player.socketId === socketId || player.name === myName,
    );

    return currentPlayer?.id ?? playerId;
  }, [room, playerId, socketId, myName]);

  React.useEffect(() => {
    if (currentPlayerId && currentPlayerId !== playerId) {
      useGameStore.setState({ playerId: currentPlayerId });
    }
  }, [currentPlayerId, playerId]);

  const state = room?.theMindState;
  const myHand = state?.playerHands[currentPlayerId] ?? [];
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
              {myHand.map((card) => {
                const isDownCard = card < 0;

                return (
                  <div
                    key={card}
                    className={`w-16 h-20 rounded-xl font-black text-xl border-2 shadow-md flex items-center justify-center ${
                      isDownCard
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-indigo-600 text-white border-indigo-700'
                    }`}
                  >
                    {Math.abs(card)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <TheMindView />
    </div>
  );
}
