'use client';

import { PlayingCard } from '@repo/types';

const suitSymbol: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

export function CardHand({ cards }: { cards: PlayingCard[] }) {
  return (
    <div className="flex gap-2 min-h-24" data-testid="card-hand">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`w-16 h-20 border-4 border-black bg-white p-2 font-black text-xl ${card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-black'}`}
        >
          <div>{card.rank}</div>
          <div className="text-right">{suitSymbol[card.suit]}</div>
        </div>
      ))}
    </div>
  );
}
