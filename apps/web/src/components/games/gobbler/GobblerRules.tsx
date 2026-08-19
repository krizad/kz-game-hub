import { useTranslate } from '@/hooks/useTranslate';

export function GobblerRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.gobbler.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.gobbler.desc')}</p>
      </div>
      <div className="bg-yellow-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.gobbler.rulesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3 items-start bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none">📏</span>
            <div>
              <strong className="text-black block mb-1 font-black uppercase">
                {t('rules.gobbler.pieceSizesTitle')}
              </strong>
              <span className="font-bold text-black">{t('rules.gobbler.pieceSizesDesc')}</span>
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none">👄</span>
            <div>
              <strong className="text-black block mb-1 font-black uppercase">
                {t('rules.gobbler.gobblingTitle')}
              </strong>
              <span className="font-bold text-black">
                {t('rules.gobbler.gobblingDesc1')}
                <strong className="bg-black text-white px-1 ml-1 mr-1">
                  {t('rules.gobbler.gobblingDesc2')}
                </strong>
                {t('rules.gobbler.gobblingDesc3')}
              </span>
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none">🔄</span>
            <div>
              <strong className="text-black block mb-1 font-black uppercase">
                {t('rules.gobbler.movingTitle')}
              </strong>
              <span className="font-bold text-black">{t('rules.gobbler.movingDesc')}</span>
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none">🎯</span>
            <div>
              <strong className="text-black block mb-1 font-black uppercase">
                {t('rules.gobbler.winningTitle')}
              </strong>
              <span className="font-bold text-black">{t('rules.gobbler.winningDesc')}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
