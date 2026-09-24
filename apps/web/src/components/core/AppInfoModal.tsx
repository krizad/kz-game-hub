'use client';

import { useState } from 'react';
import { APP_VERSION, GameType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

interface AppInfoModalProps {
  triggerClassName?: string;
}

/** "About this site" modal: version, creator, and product details. */
export function AppInfoModal({ triggerClassName }: AppInfoModalProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslate();

  const gamesCount = Object.values(GameType).length;
  const year = new Date().getFullYear();

  const infoRows: { label: string; value: string }[] = [
    { label: t('appInfo.version'), value: APP_VERSION },
    { label: t('appInfo.creator'), value: 'KriZad' },
    { label: t('appInfo.games'), value: String(gamesCount) },
    { label: t('appInfo.languages'), value: 'ไทย / English' },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={triggerClassName}
        title={t('appInfo.title')}
        data-testid="app-info-button"
        aria-label={t('appInfo.title')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span className="hidden sm:inline">{t('appInfo.button')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            data-testid="app-info-modal"
          >
            <div className="p-6 pb-4 text-center border-b-4 border-black">
              <div className="text-4xl mb-2" aria-hidden="true">
                🎮
              </div>
              <h2 className="text-2xl font-black text-black uppercase tracking-tight">
                KZ Game Hub
              </h2>
              <p className="text-xs font-bold text-slate-500 mt-1">{t('appInfo.tagline')}</p>
            </div>

            <div className="p-6 flex flex-col gap-3">
              {infoRows.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between bg-[#FEF08A] border-2 border-black px-3 py-2 shadow-[2px_2px_0_0_#000]"
                >
                  <span className="text-xs font-black uppercase tracking-wider text-black">
                    {label}
                  </span>
                  <span className="text-sm font-black text-black">{value}</span>
                </div>
              ))}
              <p className="text-xs font-bold text-slate-600 leading-relaxed text-center pt-1">
                {t('appInfo.description')}
              </p>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setOpen(false)}
                className="w-full bg-red-400 hover:bg-red-300 text-black border-4 border-black font-black py-3 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest"
                data-testid="app-info-close"
              >
                {t('appInfo.close')}
              </button>
              <p className="text-center text-[10px] font-bold text-slate-400 mt-3">
                © {year} KriZad · Next.js · NestJS · Socket.io
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
