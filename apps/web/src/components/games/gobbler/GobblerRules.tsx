import { useTranslate } from '@/hooks/useTranslate';

export function GobblerRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-blue-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.gobbler.title')}
        </h3>
        <p className="leading-relaxed">{t('rules.gobbler.desc')}</p>
      </div>
      <div>
        <h3 className="text-blue-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.gobbler.rulesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">📏</span>
            <div>
              <strong className="text-slate-800 block mb-1">
                {t('rules.gobbler.pieceSizesTitle')}
              </strong>
              {t('rules.gobbler.pieceSizesDesc')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 mt-0.5 flex-shrink-0 text-xl leading-none">👄</span>
            <div>
              <strong className="text-slate-800 block mb-1">
                {t('rules.gobbler.gobblingTitle')}
              </strong>
              {t('rules.gobbler.gobblingDesc1')}
              <strong>{t('rules.gobbler.gobblingDesc2')}</strong>
              {t('rules.gobbler.gobblingDesc3')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-indigo-400 mt-0.5 flex-shrink-0 text-xl leading-none">🔄</span>
            <div>
              <strong className="text-slate-800 block mb-1">
                {t('rules.gobbler.movingTitle')}
              </strong>
              {t('rules.gobbler.movingDesc')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400 mt-0.5 flex-shrink-0 text-xl leading-none">🎯</span>
            <div>
              <strong className="text-slate-800 block mb-1">
                {t('rules.gobbler.winningTitle')}
              </strong>
              {t('rules.gobbler.winningDesc')}
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
