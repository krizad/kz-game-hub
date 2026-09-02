'use client';

import { useTranslate } from '@/hooks/useTranslate';

export function CoupRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-4 text-sm font-bold">
      <div>
        <h4 className="font-black uppercase">{t('rules.coup.setupTitle')}</h4>
        <p className="opacity-80">{t('rules.coup.setupDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.coup.rolesTitle')}</h4>
        <ul className="list-disc list-inside opacity-80 space-y-1">
          <li>{t('rules.coup.roleDuke')}</li>
          <li>{t('rules.coup.roleAssassin')}</li>
          <li>{t('rules.coup.roleCaptain')}</li>
          <li>{t('rules.coup.roleAmbassador')}</li>
          <li>{t('rules.coup.roleContessa')}</li>
        </ul>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.coup.flowTitle')}</h4>
        <p className="opacity-80">{t('rules.coup.flowDesc')}</p>
      </div>
    </div>
  );
}
