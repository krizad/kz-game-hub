import { useTranslate } from '@/hooks/useTranslate';

export function SaboteurRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-amber-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameSaboteur.rules.overviewTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameSaboteur.rules.overviewDesc')}
        </p>
      </div>
      <div className="bg-lime-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameSaboteur.rules.rolesTitle')}
        </h3>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed text-black font-bold text-lg">
          <li>{t('gameSaboteur.rules.minerRole')}</li>
          <li>{t('gameSaboteur.rules.saboteurRole')}</li>
          <li>{t('gameSaboteur.rules.hiddenRoles')}</li>
        </ul>
      </div>
      <div className="bg-sky-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameSaboteur.rules.turnTitle')}
        </h3>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed text-black font-bold text-lg">
          <li>{t('gameSaboteur.rules.turnPath')}</li>
          <li>{t('gameSaboteur.rules.turnAction')}</li>
          <li>{t('gameSaboteur.rules.turnDiscard')}</li>
        </ul>
      </div>
      <div className="bg-orange-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameSaboteur.rules.actionTitle')}
        </h3>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed text-black font-bold text-lg">
          <li>{t('gameSaboteur.rules.actionBreak')}</li>
          <li>{t('gameSaboteur.rules.actionRepair')}</li>
          <li>{t('gameSaboteur.rules.actionMap')}</li>
          <li>{t('gameSaboteur.rules.actionRockfall')}</li>
        </ul>
      </div>
      <div className="bg-yellow-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameSaboteur.rules.scoringTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameSaboteur.rules.scoringDesc')}
        </p>
      </div>
    </div>
  );
}
