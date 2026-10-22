'use client';

import { useEffect, useRef, useState } from 'react';
import { CardGamePrivateState, PlayingCard } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameLog } from './CardGameLog';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';

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
  const [isDragOverTrick, setIsDragOverTrick] = useState(false);
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

  const prevPhaseRef = useRef(state?.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'RESULT' && state?.phase === 'RESULT') {
      if (state.result?.winnerIds?.includes(socketId)) {
        void gameFeel.celebrate();
        gameFeel.flash('gold');
        gameFeel.haptic([100, 50, 150]);
      }
    }
    prevPhaseRef.current = state?.phase;
  }, [state?.phase, state?.result?.winnerIds, socketId]);

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

  const checkPlayValidity = (candidateCards: PlayingCard[]) => {
    if (candidateCards.length === 0) {
      return { isValid: false, reason: t('gameSlave.reasons.selectCards') };
    }
    if (candidateCards.length > 3) {
      return { isValid: false, reason: t('gameSlave.reasons.maxThree') };
    }
    if (!candidateCards.every((card) => card.rank === candidateCards[0]?.rank)) {
      return { isValid: false, reason: t('gameSlave.reasons.sameRank') };
    }
    if (isOpeningLead && leading && !candidateCards.some((c) => c.id === '3-CLUBS')) {
      return { isValid: false, reason: t('gameSlave.reasons.threeOfClubs') };
    }
    if (!leading && trick && trick.playedById) {
      if (candidateCards.length !== trick.cards.length) {
        return {
          isValid: false,
          reason: t('gameSlave.reasons.matchCount', { count: trick.cards.length }),
        };
      }
      if (
        SLAVE_RANK_ORDER.indexOf(candidateCards[0].rank) <=
        SLAVE_RANK_ORDER.indexOf(trick.cards[0].rank)
      ) {
        return {
          isValid: false,
          reason: t('gameSlave.reasons.higherRank', { rank: trick.cards[0].rank }),
        };
      }
    }
    return {
      isValid: true,
      reason: t('gameSlave.reasons.validPlay', {
        rank: candidateCards[0].rank,
        count: candidateCards.length,
      }),
    };
  };

  const { isValid: isValidPlay, reason: selectionReason } = checkPlayValidity(selectedCards);

  const toggleCard = (card: PlayingCard) => {
    if (!myTurn) return;
    setSelected((current) =>
      current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id],
    );
  };

  const playCards = (cardIds: string[]) => {
    cardGameAction({ type: 'PLAY', cards: cardIds });
    audioManager.playCardSnap();
    if (cardIds.length >= 3 || cardIds.some((id) => id.startsWith('2-'))) {
      gameFeel.shake(0.4);
      gameFeel.flash('white');
      gameFeel.haptic([60, 40, 80]);
    }
  };

  const playSelected = () => {
    playCards(selected);
  };

  const handleDropOnTrick = (e: React.DragEvent) => {
    if (!myTurn) return;
    e.preventDefault();
    setIsDragOverTrick(false);

    try {
      const json = e.dataTransfer.getData('application/json');
      const data = json ? JSON.parse(json) : null;
      const cardIdsToPlay: string[] =
        data?.selectedIds && data.selectedIds.length > 0
          ? data.selectedIds
          : [e.dataTransfer.getData('text/plain')].filter(Boolean);

      if (cardIdsToPlay.length === 0) return;

      const candidateCards = cards.filter((c) => cardIdsToPlay.includes(c.id));
      const { isValid } = checkPlayValidity(candidateCards);

      if (isValid) {
        playCards(cardIdsToPlay);
      } else {
        setSelected(cardIdsToPlay);
      }
    } catch {
      // Fallback
    }
  };

  const handlePass = () => {
    cardGameAction({ type: 'PASS' });
    audioManager.playChipClink();
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

      <div
        data-testid="slave-trick-area"
        onDragOver={(e) => {
          if (!myTurn) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsDragOverTrick(true);
        }}
        onDragLeave={() => setIsDragOverTrick(false)}
        onDrop={handleDropOnTrick}
        className={`border-4 border-black p-4 transition-all ${
          isDragOverTrick
            ? 'bg-lime-100 border-lime-600 scale-[1.01] shadow-[6px_6px_0_0_#16a34a]'
            : 'bg-white'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-black uppercase text-sm">{t('gameSlave.trick')}</h3>
            {isDragOverTrick ? (
              <span className="text-xs font-black bg-lime-400 border-2 border-black px-2 py-0.5 animate-bounce">
                {t('gameSlave.dropToPlay')}
              </span>
            ) : myTurn ? (
              <span className="text-[10px] font-bold text-zinc-500 hidden sm:inline">
                {t('gameSlave.dragHint')}
              </span>
            ) : null}
          </div>
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
              onDragOver={(e) => {
                if (!myTurn) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={handleDropOnTrick}
              className="px-4 py-2 border-4 border-black bg-red-400 font-black uppercase disabled:opacity-50 shadow-[2px_2px_0_0_#000] active:translate-y-0.5"
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
