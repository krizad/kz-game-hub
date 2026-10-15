'use client';

import { useEffect, useState } from 'react';
import { CardGamePrivateState, PlayingCard } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameLog } from './CardGameLog';

const SLAVE_RANK_ORDER: PlayingCard['rank'][] = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2',
];

export function SlaveView() {
  const { room, socketId, privateState, cardGameAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [selected, setSelected] = useState<string[]>([]);
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;

  const myTurn = state?.phase === 'PLAYER_TURNS' && state?.activePlayerId === socketId;

  // Clear selection only when the turn passes to another player
  useEffect(() => {
    if (!myTurn) setSelected([]);
  }, [myTurn]);

  // Remove cards that are no longer in our hand (e.g. accepted by the server)
  const cards = privateCardState?.hand ?? [];
  useEffect(() => {
    setSelected((current) => current.filter((id) => cards.some((c) => c.id === id)));
  }, [cards]);

  if (!room || !state) return null;

  const trick = state.trick;
  const leading = !trick || trick.playedById === null;
  const leaderName =
    room.players.find((player) => player.socketId === (trick?.leaderId ?? state.dealerId))?.name ??
    '—';
  const playedByName = room.players.find((player) => player.socketId === trick?.playedById)?.name;
  const winnerNames = (state.result?.winnerIds ?? [])
    .map((id) => room.players.find((player) => player.socketId === id)?.name ?? id)
    .join(', ');

  const selectedCards = cards.filter((card) => selected.includes(card.id));

  // Determine if this is the first play of the game which requires 3♣
  const isOpeningLead =
    (!room.cardGameLog || !room.cardGameLog.some((e) => e.kind === 'PLAYED')) &&
    cards.some((c) => c.id === '3-CLUBS');

  let selectionReason = '';
  let isValidPlay = false;

  if (selectedCards.length === 0) {
    selectionReason = t('gameSlave.reasons.selectCards');
  } else if (selectedCards.length > 3) {
    selectionReason = t('gameSlave.reasons.maxThree');
  } else if (!selectedCards.every((card) => card.rank === selectedCards[0]?.rank)) {
    selectionReason = t('gameSlave.reasons.sameRank');
  } else if (isOpeningLead && leading && !selectedCards.some((c) => c.id === '3-CLUBS')) {
    selectionReason = t('gameSlave.reasons.threeOfClubs');
  } else if (!leading && trick && trick.playedById) {
    if (selectedCards.length !== trick.cards.length) {
      selectionReason = t('gameSlave.reasons.matchCount', { count: trick.cards.length });
    } else if (
      SLAVE_RANK_ORDER.indexOf(selectedCards[0].rank) <=
      SLAVE_RANK_ORDER.indexOf(trick.cards[0].rank)
    ) {
      selectionReason = t('gameSlave.reasons.higherRank', { rank: trick.cards[0].rank });
    } else {
      isValidPlay = true;
      selectionReason = t('gameSlave.reasons.validPlay', {
        rank: selectedCards[0].rank,
        count: selectedCards.length,
      });
    }
  } else {
    isValidPlay = true;
    selectionReason = t('gameSlave.reasons.validPlay', {
      rank: selectedCards[0].rank,
      count: selectedCards.length,
    });
  }

  const toggleCard = (card: PlayingCard) => {
    if (!myTurn) return;
    setSelected((current) =>
      current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id],
    );
  };

  const playSelected = () => {
    // Preserve selection in case the server rejects the move;
    // successful plays will remove cards from hand and trigger useEffect.
    cardGameAction({ type: 'PLAY', cards: selected });
  };

  const handlePass = () => {
    cardGameAction({ type: 'PASS' });
    setSelected([]);
  };

  const phaseLabel = t(`gameStatus.phaseNames.${state.phase}` as any) || state.phase;

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <CardGameLog />
      <div className="border-b-4 border-black pb-3">
        <h2 className="text-xl font-black">{t('gameSlave.title')}</h2>
        <p className="text-sm font-bold">{t('gameSlave.leaderLine', { name: leaderName })}</p>
        <span className="inline-block mt-1 px-2 py-0.5 border-2 border-black bg-white text-xs font-black uppercase">
          {phaseLabel}
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black uppercase text-sm">{t('gameSlave.trick')}</h3>
          <span
            data-testid="slave-trick-info"
            className="text-xs font-bold px-2 py-0.5 bg-amber-100 border-2 border-black"
          >
            {trick && trick.playedById
              ? t('gameSlave.trickInfo', {
                  rank: trick.cards[0]?.rank ?? '',
                  count: trick.cards.length,
                })
              : isOpeningLead
                ? t('gameSlave.reasons.threeOfClubs')
                : t('gameSlave.reasons.passLeading')}
          </span>
        </div>
        {trick && trick.playedById ? (
          <div className="space-y-2">
            <p className="text-xs font-bold">{playedByName}</p>
            <CardHand cards={trick.cards} allowSort={false} preset="SLAVE" />
          </div>
        ) : (
          <p className="text-sm font-bold">{t('gameSlave.noTrick')}</p>
        )}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-2">{t('gameSlave.yourHand')}</h3>
        <CardHand
          cards={cards}
          selectedIds={selected}
          onToggle={myTurn ? toggleCard : undefined}
          preset="SLAVE"
        />
      </div>

      {state.phase === 'RESULT' ? (
        <div
          data-testid="card-game-result"
          className="border-4 border-black bg-[#86EFAC] p-4 font-black space-y-3"
        >
          <p>{t('gameSlave.resultLine', { winners: winnerNames })}</p>

          {state.result?.placements && (
            <div data-testid="slave-finish-order" className="border-t-2 border-black pt-2">
              <h4 className="text-sm font-black mb-1">{t('gameSlave.finishOrder')}</h4>
              <ol className="list-decimal list-inside text-xs font-bold space-y-1">
                {state.result.placements.map((id) => {
                  const player = room.players.find((p) => p.socketId === id);
                  return <li key={id}>{player?.name ?? id}</li>;
                })}
              </ol>
            </div>
          )}

          {socketId === room.roomHostId && (
            <button
              type="button"
              data-testid="card-game-next-round"
              disabled={actionLoading}
              onClick={() => cardGameAction({ type: 'NEXT_ROUND' })}
              className="mt-2 px-3 py-1 border-4 border-black bg-white font-black uppercase text-sm disabled:opacity-50 shadow-[2px_2px_0_0_#000]"
            >
              {t('gamePokDeng.nextRound')}
            </button>
          )}
        </div>
      ) : myTurn ? (
        <div className="space-y-2">
          <div
            data-testid="slave-selection-reason"
            className={`text-xs font-bold p-2 border-2 border-black ${
              isValidPlay ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {selectionReason}
          </div>

          {state.turnDeadline && (
            <div data-testid="card-game-timer" className="text-xs font-bold text-zinc-600">
              {t('cardGameRules.timer.autoAction', {
                action: t('cardGameRules.actionNames.PASS'),
              })}
            </div>
          )}

          <div className="flex gap-3" data-testid="card-game-actions">
            <button
              type="button"
              disabled={!isValidPlay || actionLoading}
              onClick={playSelected}
              className="px-4 py-2 border-4 border-black bg-red-400 font-black uppercase disabled:opacity-50 shadow-[2px_2px_0_0_#000]"
            >
              {t('gameSlave.play')}
            </button>
            <button
              type="button"
              disabled={leading || actionLoading}
              onClick={handlePass}
              className="px-4 py-2 border-4 border-black bg-white font-black uppercase disabled:opacity-50 shadow-[2px_2px_0_0_#000]"
            >
              {t('gameSlave.pass')}
            </button>
          </div>
        </div>
      ) : (
        <p className="font-black">{t('gameSlave.waiting')}</p>
      )}
    </section>
  );
}
