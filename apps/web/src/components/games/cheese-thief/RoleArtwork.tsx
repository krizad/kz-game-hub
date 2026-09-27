'use client';

import { useState } from 'react';
import { CheeseThiefRole, CheeseThiefSpecial } from '@repo/types';

/**
 * Role card artwork (AI-generated, see PROMPTS.md in /images/banana-thief/).
 * The AI art leaves the bottom banner EMPTY on purpose — the role name is
 * overlaid here in code, so every card gets identical, correctly-spelled
 * Thai/English typography no matter which generator produced the art.
 */
const ROLE_ART: Record<
  string,
  { src: string; emoji: string; alt: string; nameTh: string; nameEn: string; banner: string }
> = {
  [CheeseThiefRole.THIEF]: {
    src: '/images/banana-thief/thief.png',
    emoji: '🍌🐒',
    alt: 'ลิงขโมยกล้วย',
    nameTh: 'ลิงขโมยกล้วย',
    nameEn: 'BANANA THIEF',
    banner: '#EF4444',
  },
  [CheeseThiefRole.MOUSE]: {
    src: '/images/banana-thief/mouse.png',
    emoji: '🐒',
    alt: 'ลิงขี้เซา',
    nameTh: 'ลิงขี้เซา',
    nameEn: 'SLEEPY MONKEY',
    banner: '#64748B',
  },
  [CheeseThiefRole.FOLLOWER]: {
    src: '/images/banana-thief/follower.png',
    emoji: '🐒🐒',
    alt: 'สมุนโจร',
    nameTh: 'สมุนโจร',
    nameEn: 'FOLLOWER',
    banner: '#A855F7',
  },
  [CheeseThiefSpecial.DETECTIVE]: {
    src: '/images/banana-thief/detective.png',
    emoji: '🕵️',
    alt: 'นักสืบ',
    nameTh: 'นักสืบ',
    nameEn: 'DETECTIVE · DLC',
    banner: '#06B6D4',
  },
  [CheeseThiefSpecial.SYCOPHANT]: {
    src: '/images/banana-thief/sycophant.png',
    emoji: '🎭',
    alt: 'แกะดำ',
    nameTh: 'แกะดำ',
    nameEn: 'SYCOPHANT · DLC',
    banner: '#F59E0B',
  },
  [CheeseThiefSpecial.TWINS]: {
    src: '/images/banana-thief/twins.png',
    emoji: '👬',
    alt: 'ลิงแฝด',
    nameTh: 'ลิงแฝด',
    nameEn: 'TWINS · DLC',
    banner: '#EC4899',
  },
  [CheeseThiefSpecial.SCAPEGOAT]: {
    src: '/images/banana-thief/goat.png',
    emoji: '🐐',
    alt: 'แพะรับบาป',
    nameTh: 'แพะรับบาป',
    nameEn: 'SCAPEGOAT · DLC',
    banner: '#10B981',
  },
};

interface RoleArtworkProps {
  /** CheeseThiefRole or CheeseThiefSpecial. */
  role: string;
  /** Tailwind height classes for the card. */
  className?: string;
  /** Small thumbnails (rules modal): hide the EN subtitle, shrink the name. */
  compact?: boolean;
}

/** Neo-brutalist role card with an overlaid name banner; emoji fallback if art is missing. */
export function RoleArtwork({ role, className = 'h-40', compact = false }: RoleArtworkProps) {
  const [failed, setFailed] = useState(false);
  const art = ROLE_ART[role];
  if (!art || failed) {
    return (
      <div className="flex items-center justify-center border-4 border-black bg-slate-800 text-5xl">
        {art?.emoji ?? '🐒'}
      </div>
    );
  }
  return (
    <div
      className={`relative inline-block overflow-hidden border-4 border-black bg-slate-900 shadow-[4px_4px_0_0_#000] ${className}`}
    >
      <img
        src={art.src}
        alt={art.alt}
        onError={() => setFailed(true)}
        className="block h-full w-auto object-contain"
        draggable={false}
      />
      {/* Name banner overlaid on the art's reserved bottom space */}
      <div
        className="absolute inset-x-0 bottom-0 border-t-4 border-black px-1 py-0.5 text-center leading-tight"
        style={{ backgroundColor: art.banner }}
      >
        <div className={`font-black text-white ${compact ? 'text-[9px]' : 'text-sm sm:text-base'}`}>
          {art.nameTh}
        </div>
        {!compact && (
          <div className="text-[8px] font-bold tracking-[0.25em] text-white/85 sm:text-[10px]">
            {art.nameEn}
          </div>
        )}
      </div>
    </div>
  );
}

export { ROLE_ART };
