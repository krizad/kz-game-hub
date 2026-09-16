'use client';

import { CardGamePrivateState } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameActionPanel } from './CardGameActionPanel';

export function PokDengView() {
  const { room, privateState } = useGameStore();
  const { t } = useTranslate();
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;
  if (!room || !state) return null;

  const dealer = room.players.find((player) => player.socketId === state.dealerId);

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <div className="flex items-center justify-between gap-3 border-b-4 border-black pb-3">
        <div>
          <h2 className="font-black text-2xl uppercase">{t('gamePokDeng.title')}</h2>
          <p className="font-bold text-sm">
            {t('gamePokDeng.dealerLine', { name: dealer?.name ?? '—' })}
          </p>
        </div>
        <span className="border-4 border-black bg-white px-3 py-1 font-black uppercase">
          {state.phase}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {room.players
          .filter((player) => !player.isViewer)
          .map((player) => {
            const chipBalance = state.chips[player.socketId] ?? 0;
            return (
              <div
                key={player.socketId}
                className="border-4 border-black bg-white p-2 font-black text-sm"
              >
                <div>
                  {player.name}
                  {player.socketId === state.dealerId ? ` · ${t('gamePokDeng.dealerBadge')}` : ''}
                </div>
                <div className={chipBalance < 0 ? 'text-red-600' : undefined}>
                  🂠 {state.handCounts[player.socketId] ?? 0} {t('gamePokDeng.cards')} ·{' '}
                  {chipBalance} {t('gamePokDeng.chips')}
                </div>
              </div>
            );
          })}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase mb-2">{t('gamePokDeng.yourHand')}</h3>
        <CardHand cards={privateCardState?.hand ?? []} />
      </div>

      <CardGameActionPanel />
    </section>
  );
}
