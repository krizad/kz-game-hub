import { useTranslate } from "@/hooks/useTranslate";

export function WhoKnowRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-indigo-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.whoKnow.setupTitle')}</h3>
        <p className="leading-relaxed">
          {t('rules.whoKnow.setupDesc1')}<strong className="text-amber-500">{t('rules.whoKnow.setupDescGameHost')}</strong>{t('rules.whoKnow.setupDesc2')}<strong className="text-rose-400">{t('rules.whoKnow.setupDescInsider')}</strong>{t('rules.whoKnow.setupDesc3')}<strong className="text-slate-800">{t('rules.whoKnow.setupDescCommoners')}</strong>.
        </p>
      </div>

      <div>
        <h3 className="text-indigo-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.whoKnow.phasesTitle')}</h3>
        <ol className="space-y-4">
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-slate-800 font-bold flex items-center justify-center">1</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.whoKnow.phase1Title')}</strong>
              {t('rules.whoKnow.phase1Desc')}
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-slate-800 font-bold flex items-center justify-center">2</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.whoKnow.phase2Title')}</strong>
              {t('rules.whoKnow.phase2Desc')}
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-slate-800 font-bold flex items-center justify-center">3</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.whoKnow.phase3Title')}</strong>
              {t('rules.whoKnow.phase3Desc')}
            </div>
          </li>
        </ol>
      </div>

      <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200">
        <h3 className="text-indigo-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.whoKnow.winCondTitle')}</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="text-red-500 mt-0.5 flex-shrink-0 text-xl leading-none">❌</span>
            <span>
              {t('rules.whoKnow.winCond1A')}<strong>{t('rules.whoKnow.winCond1B')}</strong>{t('rules.whoKnow.winCond1C')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-rose-500 mt-0.5 flex-shrink-0 text-xl leading-none">😈</span>
            <span>
              {t('rules.whoKnow.winCond2A')}<strong>{t('rules.whoKnow.winCond2B')}</strong>{t('rules.whoKnow.winCond2C')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-500 mt-0.5 flex-shrink-0 text-xl leading-none">✅</span>
            <span>
              {t('rules.whoKnow.winCond3A')}<span className="text-green-400 font-bold">{t('rules.whoKnow.winCond3B')}</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
