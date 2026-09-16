'use client';

import { CardGamePrivateState, PlayingCard } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

const suitSymbol: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

export function PokDengView() {
  const { room, socketId, privateState, cardGameAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;
  if (!room || !state) return null;

  const myTurn = state.phase === 'PLAYER_TURNS' && state.activePlayerId === socketId;
  const dealer = room.players.find((player) => player.socketId === state.dealerId);
  const winnerLabel = state.result?.winnerIds.length
    ? state.result.winnerIds
        .map((id) => room.players.find((p) => p.socketId === id)?.name)
        .join(', ')
    : t('gamePokDeng.dealerWins');

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
        <div className="flex gap-2 min-h-24">
          {privateCardState?.hand.map((card) => (
            <div
              key={card.id}
              className={`w-16 h-20 border-4 border-black bg-white p-2 font-black text-xl ${card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-black'}`}
            >
              <div>{card.rank}</div>
              <div className="text-right">{suitSymbol[card.suit]}</div>
            </div>
          ))}
        </div>
      </div>

      {state.phase === 'RESULT' && state.result ? (
        <div className="border-4 border-black bg-[#86EFAC] p-4 font-black">
          {t('gamePokDeng.resultLine', {
            score: state.result.dealerScore,
            winners: winnerLabel,
          })}
          {socketId === room.roomHostId && (
            <button
              onClick={() => cardGameAction({ type: 'NEXT_ROUND' })}
              className="ml-3 border-4 border-black bg-white px-3 py-1 shadow-[2px_2px_0_0_#000]"
            >
              {t('gamePokDeng.nextRound')}
            </button>
          )}
        </div>
      ) : myTurn ? (
        <div className="flex gap-3">
          <button
            disabled={actionLoading}
            onClick={() => cardGameAction({ type: 'DRAW' })}
            className="border-4 border-black bg-red-400 px-5 py-3 font-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
          >
            {t('gamePokDeng.draw')}
          </button>
          <button
            disabled={actionLoading}
            onClick={() => cardGameAction({ type: 'STAND' })}
            className="border-4 border-black bg-white px-5 py-3 font-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
          >
            {t('gamePokDeng.stand')}
          </button>
        </div>
      ) : (
        <p className="font-black">
          {state.phase === 'PLAYER_TURNS' ? t('gamePokDeng.waiting') : t('gamePokDeng.revealing')}
        </p>
      )}
    </section>
  );
}
