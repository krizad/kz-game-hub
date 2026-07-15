import { useTranslate } from '@/hooks/useTranslate';

export function TheMindRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.overviewTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.overviewDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.objectiveTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.objectiveDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.gameplayTitle')}
        </h3>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed">
          <li>{t('gameTheMind.rules.gameplay1')}</li>
          <li>{t('gameTheMind.rules.gameplay2')}</li>
          <li>{t('gameTheMind.rules.gameplay3')}</li>
          <li>{t('gameTheMind.rules.gameplay4')}</li>
        </ul>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.livesTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.livesDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.shurikenTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.shurikenDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.extremeTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.extremeDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.timeAttackTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.timeAttackDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-2">
          {t('gameTheMind.rules.winTitle')}
        </h3>
        <p className="leading-relaxed">{t('gameTheMind.rules.winDesc')}</p>
      </div>
    </div>
  );
}
