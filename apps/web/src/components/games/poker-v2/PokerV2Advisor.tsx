'use client';

import { TrendingUp, Sparkles, Target } from 'lucide-react';
import { PokerV2Advisor } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { PokerV2Card, PokerV2CardRow } from './PokerV2Card';

/** Colour ramp for the win-chance bar (red → yellow → green). */
function equityTone(p: number): string {
  if (p >= 0.6) return 'bg-emerald-400';
  if (p >= 0.35) return 'bg-amber-300';
  return 'bg-rose-400';
}

interface PokerV2AdvisorPanelProps {
  advisor?: PokerV2Advisor;
  opponentCount: number;
  /** Compact variant for narrow screens. */
  compact?: boolean;
}

/**
 * The "win conditions" panel: what you hold right now and which stronger
 * hands are still within reach, with outs and the odds of hitting them.
 */
export function PokerV2AdvisorPanel({
  advisor,
  opponentCount,
  compact = false,
}: PokerV2AdvisorPanelProps) {
  const { t } = useTranslate();
  if (!advisor) return null;

  const winPct = Math.round(advisor.winProbability * 100);
  const improvePct = Math.round(advisor.improveProbByRiver * 100);

  return (
    <div
      data-testid="poker-v2-advisor"
      className="flex flex-col gap-3 rounded-2xl border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wide">
          <Sparkles className="h-4 w-4 text-violet-600" />
          {t('pokerV2.advisor.title')}
        </h3>
        <span className="rounded-full border-2 border-black bg-sky-300 px-2 py-0.5 text-[11px] font-black">
          {t('pokerV2.advisor.vsPlayers', { count: opponentCount })}
        </span>
      </div>

      {/* Current made hand */}
      <section className="rounded-xl border-2 border-black bg-emerald-50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wide text-emerald-800">
            {t('pokerV2.advisor.currentHand')}
          </span>
          <span className="rounded-full border-2 border-black bg-emerald-300 px-2 py-0.5 text-[11px] font-black">
            {t(`pokerV2.hands.${advisor.currentCategory}`)}
          </span>
        </div>
        {!compact && advisor.currentBest.length > 0 && (
          <PokerV2CardRow cards={advisor.currentBest} size="xs" />
        )}
      </section>

      {/* Win chance bar */}
      <section>
        <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wide">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('pokerV2.advisor.winChance')}
          </span>
          <span data-testid="poker-v2-win-pct" className="text-sm">
            {winPct}%
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full border-2 border-black bg-black/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${equityTone(advisor.winProbability)}`}
            style={{ width: `${Math.max(4, winPct)}%` }}
          />
        </div>
      </section>

      {/* Potential hands */}
      <section className="rounded-xl border-2 border-black bg-amber-50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
            <Target className="h-3.5 w-3.5" />
            {t('pokerV2.advisor.potential')}
          </span>
          {advisor.outs > 0 && (
            <span className="rounded-full border-2 border-black bg-amber-300 px-2 py-0.5 text-[11px] font-black">
              {t('pokerV2.advisor.outs')}: {advisor.outs}
            </span>
          )}
        </div>

        {advisor.draws.length === 0 ? (
          <p className="text-xs font-bold text-black/50">{t('pokerV2.advisor.none')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {advisor.draws.map((draw) => (
              <li
                key={draw.id}
                className="flex items-center justify-between gap-2 rounded-lg border-2 border-black bg-white px-2 py-1"
              >
                <span className="text-xs font-black">{t(`pokerV2.draws.${draw.id}`)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full border-2 border-black bg-sky-300 px-1.5 text-[10px] font-black">
                    {draw.outs} {t('pokerV2.advisor.outs')}
                  </span>
                  <span
                    className="rounded-full border-2 border-black bg-emerald-300 px-1.5 text-[10px] font-black"
                    title={t('pokerV2.advisor.improveByRiver')}
                  >
                    {Math.round(draw.probByRiver * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {advisor.improveProbByRiver > 0 && (
          <p className="mt-1.5 text-[11px] font-bold text-black/60">
            {t('pokerV2.advisor.improveByRiver')}: <strong>{improvePct}%</strong>
          </p>
        )}
      </section>
    </div>
  );
}
