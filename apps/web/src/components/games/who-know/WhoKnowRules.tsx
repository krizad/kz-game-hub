import { useTranslate } from '@/hooks/useTranslate';

export function WhoKnowRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-yellow-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('rules.whoKnow.setupTitle')}
        </h3>
        <p className="leading-relaxed text-black font-bold text-lg">
          {t('rules.whoKnow.setupDesc1')}
          <strong className="bg-white px-1 border-2 border-black mx-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
            {t('rules.whoKnow.setupDescGameHost')}
          </strong>
          {t('rules.whoKnow.setupDesc2')}
          <strong className="bg-rose-400 px-1 border-2 border-black mx-1 inline-block - shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
            {t('rules.whoKnow.setupDescInsider')}
          </strong>
          {t('rules.whoKnow.setupDesc3')}
          <strong className="bg-cyan-300 px-1 border-2 border-black mx-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
            {t('rules.whoKnow.setupDescCommoners')}
          </strong>
          .
        </p>
      </div>

      <div className="bg-emerald-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          {t('rules.whoKnow.phasesTitle')}
        </h3>
        <ol className="space-y-6">
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="flex-shrink-0 w-10 h-10 border-4 border-black bg-pink-300 text-black font-black text-xl flex items-center justify-center ">
              1
            </span>
            <div>
              <strong className="text-black font-black uppercase tracking-widest block mb-1 text-lg">
                {t('rules.whoKnow.phase1Title')}
              </strong>
              <p className="text-black font-bold">{t('rules.whoKnow.phase1Desc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="flex-shrink-0 w-10 h-10 border-4 border-black bg-yellow-300 text-black font-black text-xl flex items-center justify-center -">
              2
            </span>
            <div>
              <strong className="text-black font-black uppercase tracking-widest block mb-1 text-lg">
                {t('rules.whoKnow.phase2Title')}
              </strong>
              <p className="text-black font-bold">{t('rules.whoKnow.phase2Desc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="flex-shrink-0 w-10 h-10 border-4 border-black bg-cyan-300 text-black font-black text-xl flex items-center justify-center ">
              3
            </span>
            <div>
              <strong className="text-black font-black uppercase tracking-widest block mb-1 text-lg">
                {t('rules.whoKnow.phase3Title')}
              </strong>
              <p className="text-black font-bold">{t('rules.whoKnow.phase3Desc')}</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="bg-pink-300 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-xl mb-4 bg-white inline-block px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('rules.whoKnow.winCondTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex items-start gap-4 bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="text-3xl flex-shrink-0 leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] -">
              ❌
            </span>
            <span className="text-black font-bold text-lg">
              {t('rules.whoKnow.winCond1A')}
              <strong className="uppercase mx-1 bg-yellow-300 border-2 border-black px-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {t('rules.whoKnow.winCond1B')}
              </strong>
              {t('rules.whoKnow.winCond1C')}
            </span>
          </li>
          <li className="flex items-start gap-4 bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="text-3xl flex-shrink-0 leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] ">
              😈
            </span>
            <span className="text-black font-bold text-lg">
              {t('rules.whoKnow.winCond2A')}
              <strong className="uppercase mx-1 bg-rose-400 border-2 border-black px-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {t('rules.whoKnow.winCond2B')}
              </strong>
              {t('rules.whoKnow.winCond2C')}
            </span>
          </li>
          <li className="flex items-start gap-4 bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="text-3xl flex-shrink-0 leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] -">
              ✅
            </span>
            <span className="text-black font-bold text-lg">
              {t('rules.whoKnow.winCond3A')}
              <span className="uppercase mx-1 bg-emerald-400 border-2 border-black px-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black">
                {t('rules.whoKnow.winCond3B')}
              </span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
