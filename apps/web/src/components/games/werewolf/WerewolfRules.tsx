'use client';

import { useTranslate } from '@/hooks/useTranslate';

/** Rules modal content for Werewolf (มนุษย์หมาป่า). */
export function WerewolfRules() {
  const { t } = useTranslate();

  const roles = [
    { emoji: '🐺', key: 'roleWerewolf', descKey: 'roleWerewolfDesc' },
    { emoji: '👨‍🌾', key: 'roleVillager', descKey: 'roleVillagerDesc' },
    { emoji: '🔮', key: 'roleSeer', descKey: 'roleSeerDesc' },
    { emoji: '💉', key: 'roleDoctor', descKey: 'roleDoctorDesc' },
    { emoji: '🧪', key: 'roleWitch', descKey: 'roleWitchDesc' },
    { emoji: '🏹', key: 'roleHunter', descKey: 'roleHunterDesc' },
  ];

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="font-bold">{t('gameWerewolf.rulesIntro')}</p>

      <section>
        <h4 className="font-black uppercase tracking-widest mb-1">
          {t('gameWerewolf.rulesNightTitle')}
        </h4>
        <p className="font-bold text-slate-700">{t('gameWerewolf.rulesNightBody')}</p>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest mb-1">
          {t('gameWerewolf.rulesRolesTitle')}
        </h4>
        <ul className="flex flex-col gap-1.5">
          {roles.map(({ emoji, key, descKey }) => (
            <li key={key} className="font-bold">
              {emoji} <span className="font-black">{t(`gameWerewolf.${key}`)}</span> —{' '}
              {t(`gameWerewolf.${descKey}`)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest mb-1">
          {t('gameWerewolf.rulesWolfModesTitle')}
        </h4>
        <p className="font-bold text-slate-700">{t('gameWerewolf.rulesWolfModesBody')}</p>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest mb-1">
          {t('gameWerewolf.rulesDayTitle')}
        </h4>
        <p className="font-bold text-slate-700">{t('gameWerewolf.rulesDayBody')}</p>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest mb-1">
          {t('gameWerewolf.rulesWinTitle')}
        </h4>
        <p className="font-bold text-slate-700">{t('gameWerewolf.rulesWinBody')}</p>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest mb-1">
          {t('gameWerewolf.rulesNarratorTitle')}
        </h4>
        <p className="font-bold text-slate-700">{t('gameWerewolf.rulesNarratorBody')}</p>
      </section>
    </div>
  );
}
