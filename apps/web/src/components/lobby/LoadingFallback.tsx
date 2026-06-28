'use client';

import { useTranslate } from '@/hooks/useTranslate';

export function LoadingFallback() {
  const { t } = useTranslate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-amber-50">
      <h1 className="text-4xl font-bold animate-pulse text-slate-600">{t('lobby.connecting')}</h1>
    </main>
  );
}
