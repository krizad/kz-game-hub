'use client';

import { useMemo, useState } from 'react';
import { CardGamePreset, PlayingCard } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

const suitSymbol: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

const SUIT_ORDER: PlayingCard['suit'][] = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];
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
const STANDARD_RANK_ORDER: PlayingCard['rank'][] = [
  'A',
  '2',
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
];

interface CardHandProps {
  cards: PlayingCard[];
  selectedIds?: string[];
  onToggle?: (card: PlayingCard) => void;
  allowSort?: boolean;
  preset?: CardGamePreset;
}

export function CardHand({
  cards,
  selectedIds = [],
  onToggle,
  allowSort = true,
  preset,
}: CardHandProps) {
  const { t } = useTranslate();
  const [sortMode, setSortMode] = useState<'default' | 'rank' | 'suit'>('default');

  const rankOrder = preset === 'SLAVE' ? SLAVE_RANK_ORDER : STANDARD_RANK_ORDER;

  const displayCards = useMemo(() => {
    if (sortMode === 'default') return cards;
    const sorted = [...cards];
    if (sortMode === 'rank') {
      sorted.sort((a, b) => {
        const rankDiff = rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
        if (rankDiff !== 0) return rankDiff;
        return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
      });
    } else if (sortMode === 'suit') {
      sorted.sort((a, b) => {
        const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
        if (suitDiff !== 0) return suitDiff;
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
      });
    }
    return sorted;
  }, [cards, sortMode, rankOrder]);

  const showControls = allowSort && Boolean(onToggle) && cards.length > 0;

  return (
    <div className="space-y-2">
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black">
          <span data-testid="card-hand-count" className="text-zinc-700">
            {t('cardGameRules.sort.totalCount', { count: cards.length })}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-zinc-600 mr-1">{t('cardGameRules.sort.sortBy')}:</span>
            <button
              type="button"
              data-testid="card-hand-sort-rank"
              onClick={() => setSortMode('rank')}
              className={`px-2 py-0.5 border-2 border-black ${
                sortMode === 'rank' ? 'bg-amber-300 shadow-[2px_2px_0_0_#000]' : 'bg-white'
              }`}
            >
              {t('cardGameRules.sort.rank')}
            </button>
            <button
              type="button"
              data-testid="card-hand-sort-suit"
              onClick={() => setSortMode('suit')}
              className={`px-2 py-0.5 border-2 border-black ${
                sortMode === 'suit' ? 'bg-amber-300 shadow-[2px_2px_0_0_#000]' : 'bg-white'
              }`}
            >
              {t('cardGameRules.sort.suit')}
            </button>
            <button
              type="button"
              data-testid="card-hand-sort-reset"
              onClick={() => setSortMode('default')}
              className={`px-2 py-0.5 border-2 border-black ${
                sortMode === 'default' ? 'bg-amber-300 shadow-[2px_2px_0_0_#000]' : 'bg-white'
              }`}
            >
              {t('cardGameRules.sort.default')}
            </button>
          </div>
        </div>
      )}

      <div
        className="w-full min-w-0 overflow-x-auto py-2"
        data-testid="card-hand-scroll"
        role="region"
        aria-label={t('gamePokDeng.cards')}
        tabIndex={0}
      >
        <div className="flex w-max gap-2 min-h-24" data-testid="card-hand">
          {displayCards.map((card) => {
            const suitName = t(`cardGameRules.suits.${card.suit}`) || card.suit;
            const ariaLabel = `${card.rank} ${suitName}`;
            const className = `shrink-0 w-16 h-20 border-4 border-black bg-white p-2 font-black text-xl ${
              card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-black'
            }`;
            if (!onToggle) {
              return (
                <div key={card.id} className={className} aria-label={ariaLabel} role="img">
                  <div>{card.rank}</div>
                  <div className="text-right">{suitSymbol[card.suit]}</div>
                </div>
              );
            }
            const selected = selectedIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                data-testid={`card-${card.id}`}
                aria-pressed={selected}
                aria-label={ariaLabel}
                onClick={() => onToggle(card)}
                className={`${className} transition-all ${
                  selected ? '-translate-y-1 bg-lime-200 shadow-[4px_4px_0_0_#000]' : ''
                }`}
              >
                <div>{card.rank}</div>
                <div className="text-right">{suitSymbol[card.suit]}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
