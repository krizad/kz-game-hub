'use client';

import { PlayingCard } from '@repo/types';

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
  return (
    <div className="flex gap-2 min-h-24" data-testid="card-hand">
      {cards.map((card) => {
        const className = `w-16 h-20 border-4 border-black bg-white p-2 font-black text-xl ${
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
  );
}
