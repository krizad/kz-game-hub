import { useTranslate } from '@/hooks/useTranslate';

export function WhoAmIRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-pink-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.whoAmI.setupTitle')}
        </h3>
        <p className="leading-relaxed">{t('rules.whoAmI.setupDesc')}</p>
      </div>

      <div>
        <h3 className="text-pink-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.whoAmI.gameplayTitle')}
        </h3>
        <p className="leading-relaxed">{t('rules.whoAmI.gameplayDesc')}</p>
      </div>

      <div>
        <h3 className="text-pink-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.whoAmI.guessingTitle')}
        </h3>
        <p className="leading-relaxed">{t('rules.whoAmI.guessingDesc')}</p>
      </div>

      <div className="bg-pink-50 p-5 rounded-2xl border border-pink-200">
        <h3 className="text-pink-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.whoAmI.endgameTitle')}
        </h3>
        <p className="leading-relaxed">{t('rules.whoAmI.endgameDesc')}</p>
      </div>
    </div>
  );
}
