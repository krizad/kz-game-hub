'use client';

import { PlayingCard } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

const suitSymbol: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

function card(rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard {
  return { id: `ex-${rank}-${suit}`, rank, suit };
}

interface RankingExample {
  category: string;
  cards: PlayingCard[];
}

const EXAMPLES: RankingExample[] = [
  {
    category: 'ROYAL_FLUSH',
    cards: [
      card('A', 'SPADES'),
      card('K', 'SPADES'),
      card('Q', 'SPADES'),
      card('J', 'SPADES'),
      card('10', 'SPADES'),
    ],
  },
  {
    category: 'STRAIGHT_FLUSH',
    cards: [
      card('9', 'HEARTS'),
      card('8', 'HEARTS'),
      card('7', 'HEARTS'),
      card('6', 'HEARTS'),
      card('5', 'HEARTS'),
    ],
  },
  {
    category: 'FOUR_OF_A_KIND',
    cards: [
      card('Q', 'CLUBS'),
      card('Q', 'DIAMONDS'),
      card('Q', 'HEARTS'),
      card('Q', 'SPADES'),
      card('2', 'CLUBS'),
    ],
  },
  {
    category: 'FULL_HOUSE',
    cards: [
      card('J', 'CLUBS'),
      card('J', 'DIAMONDS'),
      card('J', 'HEARTS'),
      card('8', 'CLUBS'),
      card('8', 'DIAMONDS'),
    ],
  },
  {
    category: 'FLUSH',
    cards: [
      card('A', 'DIAMONDS'),
      card('J', 'DIAMONDS'),
      card('8', 'DIAMONDS'),
      card('6', 'DIAMONDS'),
      card('2', 'DIAMONDS'),
    ],
  },
  {
    category: 'STRAIGHT',
    cards: [
      card('10', 'CLUBS'),
      card('9', 'DIAMONDS'),
      card('8', 'HEARTS'),
      card('7', 'SPADES'),
      card('6', 'CLUBS'),
    ],
  },
  {
    category: 'THREE_OF_A_KIND',
    cards: [
      card('7', 'CLUBS'),
      card('7', 'DIAMONDS'),
      card('7', 'HEARTS'),
      card('K', 'SPADES'),
      card('2', 'DIAMONDS'),
    ],
  },
  {
    category: 'TWO_PAIR',
    cards: [
      card('A', 'CLUBS'),
      card('A', 'DIAMONDS'),
      card('9', 'HEARTS'),
      card('9', 'SPADES'),
      card('Q', 'CLUBS'),
    ],
  },
  {
    category: 'ONE_PAIR',
    cards: [
      card('10', 'CLUBS'),
      card('10', 'DIAMONDS'),
      card('A', 'HEARTS'),
      card('6', 'SPADES'),
      card('2', 'CLUBS'),
    ],
  },
  {
    category: 'HIGH_CARD',
    cards: [
      card('A', 'CLUBS'),
      card('J', 'DIAMONDS'),
      card('8', 'HEARTS'),
      card('6', 'SPADES'),
      card('2', 'DIAMONDS'),
    ],
  },
];

/** Compact example card used in the rankings reference. */
function ExampleCard({ card: playingCard }: { card: PlayingCard }) {
  const isRed = playingCard.suit === 'HEARTS' || playingCard.suit === 'DIAMONDS';
  return (
    <span
      className={`inline-flex flex-col items-center justify-center w-8 h-11 border-2 border-black bg-white font-black text-[11px] leading-none ${
        isRed ? 'text-red-600' : 'text-black'
      }`}
    >
      <span>{playingCard.rank}</span>
      <span>{suitSymbol[playingCard.suit]}</span>
    </span>
  );
}

/**
 * Winning-hand rankings from highest to lowest, each with example cards.
 * Shared by the in-game reference panel and the rules modal.
 */
export function PokerHandRankings() {
  const { t } = useTranslate();

  return (
    <div className="flex flex-col gap-1.5" data-testid="poker-hand-rankings">
      {EXAMPLES.map((example) => (
        <div key={example.category} className="flex items-center gap-2 flex-wrap">
          <span className="w-32 shrink-0 text-xs font-black uppercase">
            {t(`poker.handNames.${example.category}`)}
          </span>
          <span className="flex gap-1">
            {example.cards.map((playingCard) => (
              <ExampleCard key={playingCard.id} card={playingCard} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
