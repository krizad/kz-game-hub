'use client';

import { useEffect } from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslate();

  useEffect(() => {
    console.error('[AppErrorBoundary]', error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-6 bg-[#FEF08A] text-black">
      <section
        data-testid="app-error-boundary"
        role="alert"
        className="w-full max-w-md bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] text-center space-y-4"
      >
        <div className="text-4xl" aria-hidden="true">
          💥
        </div>
        <h1 className="text-xl font-black uppercase tracking-wide">
          {t('errorBoundary.appTitle')}
        </h1>
        <p className="text-sm font-medium text-slate-700">{t('errorBoundary.appDesc')}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            data-testid="app-error-reload-btn"
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="min-h-11 px-5 py-2.5 bg-amber-300 hover:bg-amber-400 border-2 border-black font-black shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          >
            {t('errorBoundary.reloadApp')}
          </button>
        </div>
      </section>
    </main>
  );
}
