'use client';

import React from 'react';
import { TheMindPhase } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { TheMindView } from './TheMindView';

export function TheMindGameView() {
  const { room, playerId, socketId, myName, privateState } = useGameStore();
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
  const myHand = (privateState.theMindHand as number[] | undefined) ?? [];
  const showSetupHand = state?.phase === TheMindPhase.SETUP;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {showSetupHand && (
        <div className="mx-auto w-full max-w-lg px-4 pt-4">
          <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 -">
            <h3 className="text-sm font-black text-black uppercase tracking-widest mb-3 text-center bg-yellow-300 inline-block px-2 border-2 border-black ">
              {t('gameTheMind.game.yourHand')} ({myHand.length})
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {myHand.map((card, idx) => {
                const isDownCard = card < 0;

                return (
                  <div
                    key={card}
                    className={`w-16 h-20 font-black text-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center ${
                      isDownCard ? 'bg-rose-400 text-black' : 'bg-indigo-400 text-white'
                    } ${idx % 2 === 0 ? '' : '-'}`}
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
