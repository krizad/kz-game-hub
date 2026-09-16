'use client';

import { useGameStore } from '@/store/useGameStore';
import { CardGameRuleSummary } from './CardGameRuleSummary';

export function CardGameRules() {
  const { room } = useGameStore();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <CardGameRuleSummary config={room?.cardGameConfig} />
    </div>
  );
}
