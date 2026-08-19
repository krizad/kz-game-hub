import React from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export const WhoFirstRules = () => {
  const { t } = useTranslate();

  return (
    <div className="space-y-6 text-black bg-emerald-400 border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
      <h3 className="text-3xl font-black uppercase tracking-widest bg-white inline-block px-3 py-1 border-4 border-black - shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {t('whoFirst.rules.title')}
      </h3>
      <p className="font-bold text-lg bg-yellow-300 p-3 border-2 border-black ">
        {t('whoFirst.rules.desc1')}
      </p>

      <ul className="space-y-4">
        <li className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          <strong className="block text-xl font-black uppercase tracking-widest bg-indigo-400 text-white inline-block px-2 border-2 border-black mb-2 ">
            {t('whoFirst.rules.rule1Title')}:
          </strong>{' '}
          <span className="font-bold">{t('whoFirst.rules.rule1Desc')}</span>
        </li>
        <li className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          <strong className="block text-xl font-black uppercase tracking-widest bg-rose-400 text-white inline-block px-2 border-2 border-black mb-2 -">
            {t('whoFirst.rules.rule2Title')}:
          </strong>{' '}
          <span className="font-bold">{t('whoFirst.rules.rule2Desc')}</span>
        </li>
        <li className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          <strong className="block text-xl font-black uppercase tracking-widest bg-cyan-400 text-black inline-block px-2 border-2 border-black mb-2 ">
            {t('whoFirst.rules.rule3Title')}:
          </strong>{' '}
          <span className="font-bold">{t('whoFirst.rules.rule3Desc')}</span>
        </li>
      </ul>

      <p className="pt-4 text-sm font-black uppercase tracking-widest text-center">
        {t('whoFirst.rules.footer')}
      </p>
    </div>
  );
};
