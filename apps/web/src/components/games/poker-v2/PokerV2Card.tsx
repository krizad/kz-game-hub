'use client';

import { motion } from 'framer-motion';
import { PlayingCard } from '@repo/types';

export const SUIT_SYMBOLS: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

export const isRedSuit = (suit: PlayingCard['suit']): boolean =>
  suit === 'HEARTS' || suit === 'DIAMONDS';

const SIZES = {
  xs: { box: 'w-[34px] h-[48px] rounded-md', rank: 'text-[11px]', pip: 'text-[13px]' },
  sm: { box: 'w-[42px] h-[60px] rounded-md', rank: 'text-[13px]', pip: 'text-[16px]' },
  md: { box: 'w-[54px] h-[76px] rounded-lg', rank: 'text-[17px]', pip: 'text-[22px]' },
  lg: { box: 'w-[68px] h-[96px] rounded-xl', rank: 'text-[22px]', pip: 'text-[28px]' },
} as const;

export type PokerV2CardSize = keyof typeof SIZES;

interface PokerV2CardProps {
  card?: PlayingCard;
  size?: PokerV2CardSize;
  faceDown?: boolean;
  /** Flip-in animation delay (seconds). */
  delay?: number;
  highlight?: boolean;
  dimmed?: boolean;
  className?: string;
}

/** A single playing card with a neo-brutalist face and a card-back variant. */
export function PokerV2Card({
  card,
  size = 'sm',
  faceDown = false,
  delay = 0,
  highlight = false,
  dimmed = false,
  className = '',
}: PokerV2CardProps) {
  const dims = SIZES[size];

  if (faceDown || !card) {
    return (
      <div
        className={`${dims.box} ${className} shrink-0 select-none border-2 border-black bg-gradient-to-br from-indigo-600 to-violet-800 shadow-[2px_2px_0_0_#000] ${
          card ? '' : 'border-dashed border-black/40 bg-black/10 shadow-none'
        }`}
        aria-hidden
      >
        {!card ? null : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-white/70 text-lg font-black">♠</span>
          </div>
        )}
      </div>
    );
  }

  const red = isRedSuit(card.suit);

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22, delay }}
      className={`${dims.box} ${className} relative shrink-0 select-none border-2 border-black bg-white shadow-[2px_2px_0_0_#000] ${
        highlight ? 'ring-4 ring-yellow-400' : ''
      } ${dimmed ? 'opacity-40 grayscale' : ''}`}
    >
      <div
        className={`absolute left-0.5 top-0 flex flex-col items-center leading-none font-black ${dims.rank} ${
          red ? 'text-red-600' : 'text-black'
        }`}
      >
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div
        className={`absolute bottom-0.5 right-0.5 rotate-180 leading-none font-black ${dims.rank} ${
          red ? 'text-red-600' : 'text-black'
        }`}
      >
        <span className="flex flex-col items-center">
          <span>{card.rank}</span>
          <span>{SUIT_SYMBOLS[card.suit]}</span>
        </span>
      </div>
      <div
        className={`flex h-full w-full items-center justify-center ${dims.pip} ${
          red ? 'text-red-600' : 'text-black'
        }`}
      >
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </motion.div>
  );
}

/** A row of hole / best cards. */
export function PokerV2CardRow({
  cards,
  size = 'sm',
  faceDown = false,
  dimmed = false,
  highlightIds,
}: {
  cards: PlayingCard[];
  size?: PokerV2CardSize;
  faceDown?: boolean;
  dimmed?: boolean;
  highlightIds?: Set<string>;
}) {
  return (
    <div className="flex gap-1">
      {cards.map((card, i) => (
        <PokerV2Card
          key={card.id}
          card={card}
          size={size}
          faceDown={faceDown}
          dimmed={dimmed}
          delay={i * 0.08}
          highlight={highlightIds?.has(card.id)}
        />
      ))}
    </div>
  );
}

/** Round chip stack badge used for stacks, bets and the pot. */
export function PokerV2Chips({
  amount,
  label,
  tone = 'amber',
  className = '',
}: {
  amount: number;
  label?: string;
  tone?: 'amber' | 'emerald' | 'sky' | 'rose';
  className?: string;
}) {
  const tones = {
    amber: 'bg-amber-300',
    emerald: 'bg-emerald-300',
    sky: 'bg-sky-300',
    rose: 'bg-rose-300',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-2 border-black px-2 py-0.5 text-xs font-black text-black shadow-[2px_2px_0_0_#000] ${tones[tone]} ${className}`}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full border border-black bg-white/60" />
      {amount.toLocaleString()}
      {label ? <span className="font-bold opacity-70">{label}</span> : null}
    </span>
  );
}
