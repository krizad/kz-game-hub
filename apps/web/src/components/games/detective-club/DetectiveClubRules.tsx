import { useTranslate } from '@/hooks/useTranslate';

export function DetectiveClubRules() {
  const { t } = useTranslate();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <div className="bg-yellow-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-2 bg-white inline-block px-2 py-1 border-2 border-black -">
          🔍 {t('rules.detectiveClub.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.detectiveClub.desc')}</p>
      </div>

      <div className="bg-cyan-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-3 bg-white inline-block px-2 py-1 border-2 border-black ">
          {t('rules.detectiveClub.rolesTitle')}
        </h3>
        <ul className="space-y-3">
          <li className="flex gap-3 bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              📝
            </span>
            <div>
              <strong className="text-black block mb-1 uppercase tracking-widest bg-indigo-300 px-1 border-2 border-black inline-block">
                Informer
              </strong>
              <div className="font-bold">{t('rules.detectiveClub.informerDesc')}</div>
            </div>
          </li>
          <li className="flex gap-3 bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              🕵️
            </span>
            <div>
              <strong className="text-black block mb-1 uppercase tracking-widest bg-rose-300 px-1 border-2 border-black inline-block">
                Conspirator
              </strong>
              <div className="font-bold">{t('rules.detectiveClub.conspiratorDesc')}</div>
            </div>
          </li>
          <li className="flex gap-3 bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              🔎
            </span>
            <div>
              <strong className="text-black block mb-1 uppercase tracking-widest bg-emerald-300 px-1 border-2 border-black inline-block">
                Detective
              </strong>
              <div className="font-bold">{t('rules.detectiveClub.detectiveDesc')}</div>
            </div>
          </li>
        </ul>
      </div>

      <div className="bg-pink-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-3 bg-white inline-block px-2 py-1 border-2 border-black -">
          {t('rules.detectiveClub.stepsTitle')}
        </h3>
        <ul className="space-y-3">
          <li className="flex gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold items-start">
            <span className="bg-black text-white px-2 py-1 font-black shrink-0 mt-0.5">1</span>
            <div>
              <strong className="text-black block mb-1">Setup</strong>
              {t('rules.detectiveClub.step1Setup')}
            </div>
          </li>
          <li className="flex gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] - font-bold items-start">
            <span className="bg-black text-white px-2 py-1 font-black shrink-0 mt-0.5">2</span>
            <div>
              <strong className="text-black block mb-1">Card Playing</strong>
              {t('rules.detectiveClub.step2Playing')}
            </div>
          </li>
          <li className="flex gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold items-start">
            <span className="bg-black text-white px-2 py-1 font-black shrink-0 mt-0.5">3</span>
            <div>
              <strong className="text-black block mb-1">Discussion</strong>
              {t('rules.detectiveClub.step3Discussion')}
            </div>
          </li>
          <li className="flex gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] - font-bold items-start">
            <span className="bg-black text-white px-2 py-1 font-black shrink-0 mt-0.5">4</span>
            <div>
              <strong className="text-black block mb-1">Voting</strong>
              {t('rules.detectiveClub.step4Voting')}
            </div>
          </li>
          <li className="flex gap-3 bg-white p-2 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold items-start">
            <span className="bg-black text-white px-2 py-1 font-black shrink-0 mt-0.5">5</span>
            <div>
              <strong className="text-black block mb-1">Scoring</strong>
              {t('rules.detectiveClub.step5Scoring')}
            </div>
          </li>
        </ul>
      </div>

      <div className="bg-emerald-300 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-3 bg-white inline-block px-2 py-1 border-2 border-black ">
          {t('rules.detectiveClub.scoringTitle')}
        </h3>
        <ul className="space-y-3">
          <li className="bg-white p-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3 font-bold ">
            <span className="text-2xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0 mt-0.5">
              ✅
            </span>
            <div>{t('rules.detectiveClub.caughtScoring')}</div>
          </li>
          <li className="bg-white p-3 border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3 font-bold -">
            <span className="text-2xl drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0 mt-0.5">
              ❌
            </span>
            <div>{t('rules.detectiveClub.escapedScoring')}</div>
          </li>
        </ul>
      </div>
    </div>
  );
}
