'use client';

import { useTranslate } from '@/hooks/useTranslate';

export function CipherGridRules() {
  const { t } = useTranslate();

  return (
    <div className="space-y-4 text-sm font-bold">
      <div>
        <h4 className="font-black uppercase text-base text-cyan-600">
          {t('rules.cipherGrid.title')}
        </h4>
        <p className="opacity-80 mt-1">{t('rules.cipherGrid.overview')}</p>
        <p className="opacity-80 mt-1">{t('cipherGrid.rulesMode')}</p>
      </div>

      <div className="border-2 border-black p-3 bg-cyan-50 shadow-[2px_2px_0_0_#000]">
        <h5 className="font-black uppercase mb-1">{t('rules.cipherGrid.rolesTitle')}</h5>
        <ul className="list-disc list-inside space-y-1 opacity-90 text-xs sm:text-sm">
          <li>
            <span className="font-black text-amber-600">
              {t('rules.cipherGrid.leadRoleTitle')}:
            </span>{' '}
            {t('rules.cipherGrid.leadRoleDesc')}
          </li>
          <li>
            <span className="font-black text-indigo-600">
              {t('rules.cipherGrid.trackerRoleTitle')}:
            </span>{' '}
            {t('rules.cipherGrid.trackerRoleDesc')}
          </li>
        </ul>
      </div>

      <div>
        <h5 className="font-black uppercase mb-2">{t('rules.cipherGrid.cardsTitle')}</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
          <div className="border-2 border-black p-2 bg-amber-100 shadow-[2px_2px_0_0_#000]">
            <div className="font-black text-amber-700">{t('rules.cipherGrid.cardSolarTitle')}</div>
            <p className="opacity-80 text-xs">{t('rules.cipherGrid.cardSolarDesc')}</p>
          </div>
          <div className="border-2 border-black p-2 bg-indigo-100 shadow-[2px_2px_0_0_#000]">
            <div className="font-black text-indigo-700">{t('rules.cipherGrid.cardLunarTitle')}</div>
            <p className="opacity-80 text-xs">{t('rules.cipherGrid.cardLunarDesc')}</p>
          </div>
          <div className="border-2 border-black p-2 bg-slate-100 shadow-[2px_2px_0_0_#000]">
            <div className="font-black text-slate-700">{t('rules.cipherGrid.cardDecoyTitle')}</div>
            <p className="opacity-80 text-xs">{t('rules.cipherGrid.cardDecoyDesc')}</p>
          </div>
          <div className="border-2 border-black p-2 bg-rose-100 shadow-[2px_2px_0_0_#000]">
            <div className="font-black text-rose-700">{t('rules.cipherGrid.cardVirusTitle')}</div>
            <p className="opacity-80 text-xs">{t('rules.cipherGrid.cardVirusDesc')}</p>
          </div>
        </div>
      </div>

      <div className="border-2 border-black p-3 bg-amber-50 shadow-[2px_2px_0_0_#000]">
        <h5 className="font-black uppercase mb-1 text-amber-800">
          {t('rules.cipherGrid.challengeTitle')}
        </h5>
        <p className="opacity-90 text-xs sm:text-sm">{t('cipherGrid.challengePolicy')}</p>
      </div>

      <div>
        <h5 className="font-black uppercase mb-1">{t('rules.cipherGrid.winTitle')}</h5>
        <p className="opacity-80 text-xs sm:text-sm">{t('rules.cipherGrid.winDesc')}</p>
      </div>
    </div>
  );
}
