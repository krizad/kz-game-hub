import { useTranslate } from '@/hooks/useTranslate';

export function SoundsFishyRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <div className="bg-yellow-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-2 bg-white inline-block px-2 py-1 border-2 border-black -">
          {t('rules.soundsFishy.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.soundsFishy.desc')}</p>
      </div>

      <div className="bg-cyan-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-3 bg-white inline-block px-2 py-1 border-2 border-black ">
          {t('rules.soundsFishy.rolesTitle')}
        </h3>
        <ul className="space-y-3">
          <li className="flex gap-3 bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              🧐
            </span>
            <div>
              <strong className="text-black block mb-1 uppercase tracking-widest bg-purple-300 px-1 border-2 border-black inline-block">
                {t('rules.soundsFishy.rolePicker')}
              </strong>
              <div className="font-bold">{t('rules.soundsFishy.rolePickerDesc')}</div>
            </div>
          </li>
          <li className="flex gap-3 bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              🐟
            </span>
            <div>
              <strong className="text-black block mb-1 uppercase tracking-widest bg-blue-300 px-1 border-2 border-black inline-block">
                {t('rules.soundsFishy.roleBlueFish')}
              </strong>
              <div className="font-bold">{t('rules.soundsFishy.roleBlueFishDesc')}</div>
            </div>
          </li>
          <li className="flex gap-3 bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              🐠
            </span>
            <div>
              <strong className="text-black block mb-1 uppercase tracking-widest bg-rose-300 px-1 border-2 border-black inline-block">
                {t('rules.soundsFishy.roleRedHerring')}
              </strong>
              <div className="font-bold">{t('rules.soundsFishy.roleRedHerringDesc')}</div>
            </div>
          </li>
        </ul>
      </div>

      <div className="bg-pink-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-3 bg-white inline-block px-2 py-1 border-2 border-black -">
          {t('rules.soundsFishy.flowTitle')}
        </h3>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
            <span className="bg-black text-white px-2 py-1 font-black">1</span>
            <div>{t('rules.soundsFishy.flowSetup')}</div>
          </li>
          <li className="flex items-center gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] - font-bold">
            <span className="bg-black text-white px-2 py-1 font-black">2</span>
            <div>{t('rules.soundsFishy.flowPitch')}</div>
          </li>
          <li className="flex items-center gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
            <span className="bg-black text-white px-2 py-1 font-black">3</span>
            <div>{t('rules.soundsFishy.flowHunt')}</div>
          </li>
          <li className="flex items-center gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] - font-bold">
            <span className="bg-black text-white px-2 py-1 font-black">4</span>
            <div>{t('rules.soundsFishy.flowScore')}</div>
          </li>
        </ul>
      </div>

      <div className="bg-emerald-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-3 bg-white inline-block px-2 py-1 border-2 border-black ">
          {t('rules.soundsFishy.scoringTitle')}
        </h3>
        <ul className="space-y-3">
          <li className="bg-white p-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 font-bold ">
            <span className="text-2xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">🎣</span>
            <div>{t('rules.soundsFishy.scoreRedHerring')}</div>
          </li>
          <li className="bg-white p-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 font-bold -">
            <span className="text-2xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">💰</span>
            <div>{t('rules.soundsFishy.scoreBank')}</div>
          </li>
          <li className="bg-white p-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 font-bold ">
            <span className="text-2xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">💀</span>
            <div>{t('rules.soundsFishy.scoreBlueFish')}</div>
          </li>
        </ul>
      </div>
    </div>
  );
}
