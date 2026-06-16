import React from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export const WhoFirstRules = () => {
  const { t } = useTranslate();

  return (
    <div className="space-y-4 text-slate-300">
      <h3 className="text-lg font-bold text-slate-100">{t('whoFirst.rules.title')}</h3>
      <p>{t('whoFirst.rules.desc1')}</p>
      
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-slate-200">{t('whoFirst.rules.rule1Title')}:</strong>{' '}
          {t('whoFirst.rules.rule1Desc')}
        </li>
        <li>
          <strong className="text-slate-200">{t('whoFirst.rules.rule2Title')}:</strong>{' '}
          {t('whoFirst.rules.rule2Desc')}
        </li>
        <li>
          <strong className="text-slate-200">{t('whoFirst.rules.rule3Title')}:</strong>{' '}
          {t('whoFirst.rules.rule3Desc')}
        </li>
      </ul>

      <p className="pt-2 text-sm text-slate-400">
        {t('whoFirst.rules.footer')}
      </p>
    </div>
  );
};
