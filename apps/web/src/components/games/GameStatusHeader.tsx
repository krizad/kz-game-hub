'use client';

import { useTranslate } from '@/hooks/useTranslate';

interface GameStatusHeaderProps {
  phase: string;
  activePlayerName?: string;
  isMyTurn?: boolean;
  progress?: { current: number; total: number };
  accentClass: string;
  promptKey?: string;
}

export function GameStatusHeader({
  phase,
  activePlayerName,
  isMyTurn = false,
  progress,
  accentClass,
  promptKey,
}: GameStatusHeaderProps) {
  const { t } = useTranslate();
  const phaseLabel = t(`gameStatus.phaseNames.${phase}`);
  const prompt = promptKey
    ? t(promptKey)
    : activePlayerName
      ? isMyTurn
        ? t('gameStatus.yourTurn')
        : t('gameStatus.waitingFor', { name: activePlayerName })
      : t('gameStatus.groupAction');

  return (
    <section
      aria-live="polite"
      className="mb-3 border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-3 w-3 shrink-0 border-2 border-black ${accentClass}`}
            aria-hidden="true"
          />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            {t('gameStatus.phase')}
          </span>
          <span className="border-2 border-black bg-[#FEF08A] px-2 py-1 text-xs font-black text-black sm:text-sm">
            {phaseLabel === `gameStatus.phaseNames.${phase}`
              ? phase.replaceAll('_', ' ')
              : phaseLabel}
          </span>
        </div>
        {progress && progress.total > 0 && (
          <span className="text-xs font-black text-slate-700">
            {t('gameStatus.progress')} {Math.min(progress.current, progress.total)}/{progress.total}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-bold leading-snug text-black">{prompt}</p>
      {progress && progress.total > 0 && (
        <div
          className="mt-2 h-2 overflow-hidden border-2 border-black bg-slate-100"
          role="progressbar"
          aria-label={t('gameStatus.progress')}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={Math.min(progress.current, progress.total)}
        >
          <div
            className={`h-full border-r-2 border-black ${accentClass}`}
            style={{
              width: `${Math.max(0, Math.min((progress.current / progress.total) * 100, 100))}%`,
            }}
          />
        </div>
      )}
    </section>
  );
}
