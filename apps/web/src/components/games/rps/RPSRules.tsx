import { useTranslate } from '@/hooks/useTranslate';

export function RPSRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-amber-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.rps.title')}
        </h3>
        <p className="leading-relaxed">{t('rules.rps.desc')}</p>
      </div>
      <div>
        <h3 className="text-amber-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.rps.basicsTitle')}
        </h3>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-around text-center mt-2">
          <div>
            <div className="text-4xl mb-2">✊</div>
            <div className="text-sm font-bold text-slate-600">{t('rules.rps.beats')} ✌️</div>
          </div>
          <div>
            <div className="text-4xl mb-2">✋</div>
            <div className="text-sm font-bold text-slate-600">{t('rules.rps.beats')} ✊</div>
          </div>
          <div>
            <div className="text-4xl mb-2">✌️</div>
            <div className="text-sm font-bold text-slate-600">{t('rules.rps.beats')} ✋</div>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-amber-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.rps.modesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-indigo-400 mt-0.5 flex-shrink-0 text-xl leading-none">🤺</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.rps.mode1v1Title')}</strong>
              {t('rules.rps.mode1v1Desc')}
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-rose-400 mt-0.5 flex-shrink-0 text-xl leading-none">⚔️</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.rps.modeAllTitle')}</strong>
              {t('rules.rps.modeAllDesc')}
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
