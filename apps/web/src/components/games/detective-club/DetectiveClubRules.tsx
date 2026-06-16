import { useTranslate } from '@/hooks/useTranslate';

export function DetectiveClubRules() {
  const { t } = useTranslate();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">
          🔍 {t('rules.detectiveClub.title')}
        </h3>
        <p className="leading-relaxed">{t('rules.detectiveClub.desc')}</p>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.detectiveClub.rolesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-indigo-400 mt-0.5 flex-shrink-0 text-xl leading-none">📝</span>
            <div>
              <strong className="text-slate-800 block mb-1">Informer</strong>
              {t('rules.detectiveClub.informerDesc')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-rose-400 mt-0.5 flex-shrink-0 text-xl leading-none">🕵️</span>
            <div>
              <strong className="text-slate-800 block mb-1">Conspirator</strong>
              {t('rules.detectiveClub.conspiratorDesc')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0 text-xl leading-none">🔎</span>
            <div>
              <strong className="text-slate-800 block mb-1">Detective</strong>
              {t('rules.detectiveClub.detectiveDesc')}
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.detectiveClub.stepsTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">1</span>
            <div>
              <strong className="text-slate-800 block mb-1">Setup</strong>
              {t('rules.detectiveClub.step1Setup')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">2</span>
            <div>
              <strong className="text-slate-800 block mb-1">Card Playing</strong>
              {t('rules.detectiveClub.step2Playing')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">3</span>
            <div>
              <strong className="text-slate-800 block mb-1">Discussion</strong>
              {t('rules.detectiveClub.step3Discussion')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">4</span>
            <div>
              <strong className="text-slate-800 block mb-1">Voting</strong>
              {t('rules.detectiveClub.step4Voting')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">5</span>
            <div>
              <strong className="text-slate-800 block mb-1">Scoring</strong>
              {t('rules.detectiveClub.step5Scoring')}
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.detectiveClub.scoringTitle')}
        </h3>
        <ul className="space-y-4 border-l-2 border-amber-200 pl-4 py-1">
          <li className="text-slate-700">
            <span className="text-emerald-400 font-bold">✅</span>{' '}
            {t('rules.detectiveClub.caughtScoring')}
          </li>
          <li className="text-slate-700">
            <span className="text-rose-400 font-bold">❌</span>{' '}
            {t('rules.detectiveClub.escapedScoring')}
          </li>
        </ul>
      </div>
    </div>
  );
}
