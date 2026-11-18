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

/**
 * Card geometry: the rank block sits inside a padded corner (no clipping on
 * "10"), the suit is a large watermark in the middle, and a small suit echo
 * anchors the bottom-right corner. No rotated duplicate text.
 */
const SIZES = {
  xs: { box: 'w-[38px] h-[54px] rounded-lg', rank: 'text-[13px]', pip: 'text-[20px]' },
  sm: { box: 'w-[48px] h-[68px] rounded-lg', rank: 'text-[15px]', pip: 'text-[26px]' },
  md: { box: 'w-[60px] h-[86px] rounded-xl', rank: 'text-[19px]', pip: 'text-[34px]' },
  lg: { box: 'w-[74px] h-[106px] rounded-xl', rank: 'text-[24px]', pip: 'text-[42px]' },
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
    if (!card) {
      return (
        <div
          className={`${dims.box} ${className} shrink-0 select-none rounded-lg border-2 border-dashed border-black/30 bg-black/5`}
          aria-hidden
        />
      );
    }
    return (
      <div
        className={`${dims.box} ${className} shrink-0 select-none overflow-hidden border-2 border-black bg-gradient-to-br from-indigo-600 to-violet-800 shadow-[2px_2px_0_0_#000]`}
        aria-hidden
      >
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-lg font-black text-white/80">♠</span>
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const tone = red ? 'text-red-600' : 'text-black';

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22, delay }}
      className={`${dims.box} ${className} relative shrink-0 select-none overflow-hidden border-2 border-black bg-white shadow-[2px_2px_0_0_#000] ${
        highlight ? 'ring-4 ring-yellow-400 ring-offset-0' : ''
      } ${dimmed ? 'opacity-40 grayscale' : ''}`}
    >
      {/* corner index — padded so wide ranks ("10") never touch the edge */}
      <div
        className={`absolute left-[5px] top-[3px] flex flex-col items-center justify-center gap-[1px] leading-none font-black ${dims.rank} ${tone}`}
      >
        <span>{card.rank}</span>
        <span className="opacity-80">{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      {/* centre watermark */}
      <div
        className={`absolute inset-0 flex items-center justify-center ${dims.pip} opacity-90 ${tone}`}
      >
        {SUIT_SYMBOLS[card.suit]}
      </div>
      {/* bottom-right echo */}
      <div className={`absolute bottom-[3px] right-[5px] leading-none ${dims.rank} ${tone}`}>
        <span className="opacity-80">{SUIT_SYMBOLS[card.suit]}</span>
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
    <div className="flex gap-1.5">
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
