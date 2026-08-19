import { useTranslate } from '@/hooks/useTranslate';

export function WhoAmIRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.whoAmI.setupTitle')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.whoAmI.setupDesc')}</p>
      </div>

      <div className="bg-yellow-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.whoAmI.gameplayTitle')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.whoAmI.gameplayDesc')}</p>
      </div>

      <div className="bg-pink-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.whoAmI.guessingTitle')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.whoAmI.guessingDesc')}</p>
      </div>

      <div className="bg-cyan-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.whoAmI.endgameTitle')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.whoAmI.endgameDesc')}</p>
      </div>
    </div>
  );
}
