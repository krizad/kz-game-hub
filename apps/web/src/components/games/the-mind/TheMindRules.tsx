import { useTranslate } from '@/hooks/useTranslate';

export function TheMindRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-purple-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('gameTheMind.rules.overviewTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.overviewDesc')}
        </p>
      </div>
      <div className="bg-yellow-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameTheMind.rules.objectiveTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.objectiveDesc')}
        </p>
      </div>
      <div className="bg-cyan-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('gameTheMind.rules.gameplayTitle')}
        </h3>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed text-black font-bold text-lg">
          <li>{t('gameTheMind.rules.gameplay1')}</li>
          <li>{t('gameTheMind.rules.gameplay2')}</li>
          <li>{t('gameTheMind.rules.gameplay3')}</li>
          <li>{t('gameTheMind.rules.gameplay4')}</li>
        </ul>
      </div>
      <div className="bg-rose-400 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameTheMind.rules.livesTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.livesDesc')}
        </p>
      </div>
      <div className="bg-emerald-400 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('gameTheMind.rules.shurikenTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.shurikenDesc')}
        </p>
      </div>
      <div className="bg-pink-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameTheMind.rules.extremeTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.extremeDesc')}
        </p>
      </div>
      <div className="bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-yellow-300 inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('gameTheMind.rules.timeAttackTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.timeAttackDesc')}
        </p>
      </div>
      <div className="bg-purple-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('gameTheMind.rules.winTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('gameTheMind.rules.winDesc')}
        </p>
      </div>
    </div>
  );
}
