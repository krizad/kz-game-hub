'use client';

import { CardGamePrivateState, PlayingCard } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameLog } from './CardGameLog';

const CARD_VALUES: Record<PlayingCard['rank'], number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
};

export function SamSipView() {
  const { room, socketId, privateState, cardGameAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;

  if (!room || !state) return null;

  const myTurn = state.phase === 'PLAYER_TURNS' && state.activePlayerId === socketId;
  const decision = state.decisions[socketId ?? ''] ?? 'PENDING';
  const discardTop = state.discardTop ?? null;
  const cards = privateCardState?.hand ?? [];
  const canClaim =
    !!discardTop &&
    cards.some((card) => CARD_VALUES[card.rank] + CARD_VALUES[discardTop.rank] === 10);
  const canDiscard = myTurn && (decision === 'DRAWN' || decision === 'CLAIMED');
  const winnerNames = (state.result?.winnerIds ?? [])
    .map((id) => room.players.find((player) => player.socketId === id)?.name ?? id)
    .join(', ');

  const discardCard = (card: PlayingCard) => {
    if (!canDiscard) return;
    cardGameAction({ type: 'DISCARD', cardId: card.id });
  };

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <CardGameLog />
      <div className="border-b-4 border-black pb-3">
        <h2 className="text-xl font-black">{t('gameSamSip.title')}</h2>
        <span className="inline-block mt-1 px-2 py-0.5 border-2 border-black bg-white text-xs font-black uppercase">
          {state.phase}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {room.players
          .filter((player) => !player.isViewer)
          .map((player) => {
            const chipBalance = state.chips[player.socketId] ?? 0;
            return (
              <div
                key={player.socketId}
                className="border-4 border-black bg-white p-2 font-black text-sm"
              >
                <div className="flex items-center gap-1">
                  <span>{player.name}</span>
                  {player.socketId === state.activePlayerId && <span>⏳</span>}
                </div>
                <div className="text-xs">
                  🂠 {state.handCounts[player.socketId] ?? 0} {t('gamePokDeng.cards')}
                </div>
                <div className={`text-xs ${chipBalance < 0 ? 'text-red-600' : ''}`}>
                  {chipBalance} {t('gamePokDeng.chips')}
                </div>
              </div>
            );
          })}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-2">{t('gameSamSip.discard')}</h3>
        {discardTop ? (
          <CardHand cards={[discardTop]} />
        ) : (
          <p className="text-sm font-bold">{t('gameSamSip.noDiscard')}</p>
        )}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-2">{t('gameSamSip.yourHand')}</h3>
        <CardHand cards={cards} onToggle={canDiscard ? discardCard : undefined} />
      </div>

      {state.phase === 'RESULT' ? (
        <div
          data-testid="card-game-result"
          className="border-4 border-black bg-[#86EFAC] p-4 font-black"
        >
          <p>{t('gameSamSip.resultLine', { winners: winnerNames })}</p>
          {socketId === room.roomHostId && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => cardGameAction({ type: 'NEXT_ROUND' })}
              className="mt-2 px-3 py-1 border-4 border-black bg-white font-black uppercase text-sm disabled:opacity-50"
            >
              {t('gamePokDeng.nextRound')}
            </button>
          )}
        </div>
      ) : myTurn && decision === 'PENDING' ? (
        <div className="flex gap-3" data-testid="card-game-actions">
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => cardGameAction({ type: 'DRAW' })}
            className="px-4 py-2 border-4 border-black bg-red-400 font-black uppercase disabled:opacity-50"
          >
            {t('gameSamSip.draw')}
          </button>
          <button
            type="button"
            disabled={!canClaim || actionLoading}
            onClick={() => cardGameAction({ type: 'CLAIM' })}
            className="px-4 py-2 border-4 border-black bg-white font-black uppercase disabled:opacity-50"
          >
            {t('gameSamSip.claim')}
          </button>
        </div>
      ) : myTurn ? (
        <p className="font-black">{t('gameSamSip.pickDiscard')}</p>
      ) : (
        <p className="font-black">{t('gameSamSip.waiting')}</p>
      )}
    </section>
  );
}
