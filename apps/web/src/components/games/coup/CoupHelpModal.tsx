'use client';

import { useState } from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export function CoupHelpModal() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslate();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border-4 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
        aria-label="help"
      >
        ? {t('gameCoup.helpButton')}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black uppercase tracking-widest">{t('gameCoup.helpTitle')}</h2>
              <button onClick={() => setOpen(false)} className="border-2 border-black px-2 py-1 text-xs font-black">✕</button>
            </div>

            <h3 className="font-black text-sm uppercase mb-2">{t('gameCoup.actionsTitle')}</h3>
            <div className="space-y-1 text-xs font-bold mb-4">
              <div className="flex justify-between border-2 border-black px-2 py-1 bg-[#FEF08A]"><span>{t('gameCoup.actionIncome')}</span><span>—</span></div>
              <div className="flex justify-between border-2 border-black px-2 py-1"><span>{t('gameCoup.actionForeignAid')}</span><span>Duke blocks</span></div>
              <div className="flex justify-between border-2 border-black px-2 py-1 bg-red-100"><span>{t('gameCoup.actionCoup')}</span><span>no block</span></div>
            </div>

            <h3 className="font-black text-sm uppercase mb-2">Roles</h3>
            <div className="grid gap-2 text-xs">
              <div className="border-2 border-black p-2 bg-[#E0E7FF]"><div className="font-black">{t('gameCoup.roleDuke')}</div><div className="opacity-80">{t('gameCoup.roleDukeDesc')}</div></div>
              <div className="border-2 border-black p-2 bg-[#FECACA]"><div className="font-black">{t('gameCoup.roleAssassin')}</div><div className="opacity-80">{t('gameCoup.roleAssassinDesc')}</div></div>
              <div className="border-2 border-black p-2 bg-[#A7F3D0]"><div className="font-black">{t('gameCoup.roleCaptain')}</div><div className="opacity-80">{t('gameCoup.roleCaptainDesc')}</div></div>
              <div className="border-2 border-black p-2 bg-[#FDE68A]"><div className="font-black">{t('gameCoup.roleAmbassador')}</div><div className="opacity-80">{t('gameCoup.roleAmbassadorDesc')}</div></div>
              <div className="border-2 border-black p-2 bg-[#DDD6FE]"><div className="font-black">{t('gameCoup.roleContessa')}</div><div className="opacity-80">{t('gameCoup.roleContessaDesc')}</div></div>
            </div>

            <button onClick={() => setOpen(false)} className="mt-4 w-full bg-black text-white font-black py-2 uppercase">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
