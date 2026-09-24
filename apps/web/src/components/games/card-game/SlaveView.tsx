'use client';

import { useEffect, useState } from 'react';
import { CardGamePrivateState, PlayingCard } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameLog } from './CardGameLog';

export function SlaveView() {
  const { room, socketId, privateState, cardGameAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [selected, setSelected] = useState<string[]>([]);
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;

  const myTurn = state?.phase === 'PLAYER_TURNS' && state?.activePlayerId === socketId;

  // Card ids are deterministic per deal, so a selection left over from a
  // passed trick would resurface pre-highlighted on the next deal — drop it
  // as soon as the turn is no longer ours.
  useEffect(() => {
    if (!myTurn) setSelected([]);
  }, [myTurn]);

  if (!room || !state) return null;

  const trick = state.trick;
  const leading = !trick || trick.playedById === null;
  const cards = privateCardState?.hand ?? [];
  const leaderName =
    room.players.find((player) => player.socketId === (trick?.leaderId ?? state.dealerId))?.name ??
    '—';
  const playedByName = room.players.find((player) => player.socketId === trick?.playedById)?.name;
  const winnerNames = (state.result?.winnerIds ?? [])
    .map((id) => room.players.find((player) => player.socketId === id)?.name ?? id)
    .join(', ');

  const selectedCards = cards.filter((card) => selected.includes(card.id));
  const validSelection =
    selectedCards.length >= 1 &&
    selectedCards.length <= 3 &&
    selectedCards.every((card) => card.rank === selectedCards[0]?.rank);

  const toggleCard = (card: PlayingCard) => {
    if (!myTurn) return;
    setSelected((current) =>
      current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id],
    );
  };

  const playSelected = () => {
    cardGameAction({ type: 'PLAY', cards: selected });
    setSelected([]);
  };

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <CardGameLog />
      <div className="border-b-4 border-black pb-3">
        <h2 className="text-xl font-black">{t('gameSlave.title')}</h2>
        <p className="text-sm font-bold">{t('gameSlave.leaderLine', { name: leaderName })}</p>
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
        <h3 className="font-black uppercase text-sm mb-2">{t('gameSlave.trick')}</h3>
        {trick && trick.playedById ? (
          <div className="space-y-2">
            <p className="text-xs font-bold">{playedByName}</p>
            <CardHand cards={trick.cards} />
          </div>
        ) : (
          <p className="text-sm font-bold">{t('gameSlave.noTrick')}</p>
        )}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-2">{t('gameSlave.yourHand')}</h3>
        <CardHand cards={cards} selectedIds={selected} onToggle={myTurn ? toggleCard : undefined} />
      </div>

      {state.phase === 'RESULT' ? (
        <div
          data-testid="card-game-result"
          className="border-4 border-black bg-[#86EFAC] p-4 font-black"
        >
          <p>{t('gameSlave.resultLine', { winners: winnerNames })}</p>
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
      ) : myTurn ? (
        <div className="flex gap-3" data-testid="card-game-actions">
          <button
            type="button"
            disabled={!validSelection || actionLoading}
            onClick={playSelected}
            className="px-4 py-2 border-4 border-black bg-red-400 font-black uppercase disabled:opacity-50"
          >
            {t('gameSlave.play')}
          </button>
          <button
            type="button"
            disabled={leading || actionLoading}
            onClick={() => {
              cardGameAction({ type: 'PASS' });
              setSelected([]);
            }}
            className="px-4 py-2 border-4 border-black bg-white font-black uppercase disabled:opacity-50"
          >
            {t('gameSlave.pass')}
          </button>
        </div>
      ) : (
        <p className="font-black">{t('gameSlave.waiting')}</p>
      )}
    </section>
  );
}
