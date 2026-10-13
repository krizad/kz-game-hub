'use client';

import { PlayingCard } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

const suitSymbol: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

interface CardHandProps {
  cards: PlayingCard[];
  selectedIds?: string[];
  onToggle?: (card: PlayingCard) => void;
}

export function CardHand({ cards, selectedIds = [], onToggle }: CardHandProps) {
  const { t } = useTranslate();
  return (
    <div
      className="w-full min-w-0 overflow-x-auto py-2"
      data-testid="card-hand-scroll"
      role="region"
      aria-label={t('gamePokDeng.cards')}
      tabIndex={0}
    >
      <div className="flex w-max gap-2 min-h-24" data-testid="card-hand">
        {cards.map((card) => {
          const className = `shrink-0 w-16 h-20 border-4 border-black bg-white p-2 font-black text-xl ${
            card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-black'
          }`;
          if (!onToggle) {
            return (
              <div key={card.id} className={className}>
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
  );
}
