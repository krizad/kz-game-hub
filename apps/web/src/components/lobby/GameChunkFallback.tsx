'use client';

import { useTranslate } from '@/hooks/useTranslate';

/**
 * Lightweight Neo-brutalist placeholder shown while a dynamically imported
 * game view or settings chunk is being fetched (ADR 0018).
 */
export function GameChunkFallback() {
  const { t } = useTranslate();
  return (
    <div
      data-testid="game-chunk-fallback"
      role="status"
      aria-live="polite"
      className="flex-1 flex flex-col items-center justify-center gap-4 bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] min-h-[300px]"
    >
      <div className="w-10 h-10 border-4 border-black border-t-amber-300 rounded-full animate-spin" />
      <p className="text-sm font-black uppercase tracking-wider text-black">
        {t('errorBoundary.loadingGame')}
      </p>
    </div>
  );
}
