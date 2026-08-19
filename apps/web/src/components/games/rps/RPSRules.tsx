import { useTranslate } from '@/hooks/useTranslate';

export function RPSRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.rps.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.rps.desc')}</p>
      </div>

      <div className="bg-cyan-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.rps.basicsTitle')}
        </h3>
        <div className="bg-white p-4 border-4 border-black flex justify-around text-center mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <div className="text-4xl mb-2 drop-">✊</div>
            <div className="text-sm font-black text-black bg-yellow-300 px-2 py-1 border-2 border-black">
              {t('rules.rps.beats')} ✌️
            </div>
          </div>
          <div>
            <div className="text-4xl mb-2 drop-">✋</div>
            <div className="text-sm font-black text-black bg-pink-300 px-2 py-1 border-2 border-black">
              {t('rules.rps.beats')} ✊
            </div>
          </div>
          <div>
            <div className="text-4xl mb-2 drop-">✌️</div>
            <div className="text-sm font-black text-black bg-emerald-300 px-2 py-1 border-2 border-black">
              {t('rules.rps.beats')} ✋
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.rps.modesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3 items-start bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none">🤺</span>
            <div>
              <strong className="text-black block mb-1 font-black uppercase">
                {t('rules.rps.mode1v1Title')}
              </strong>
              <span className="font-bold text-black">{t('rules.rps.mode1v1Desc')}</span>
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <span className="mt-0.5 flex-shrink-0 text-2xl leading-none">⚔️</span>
            <div>
              <strong className="text-black block mb-1 font-black uppercase">
                {t('rules.rps.modeAllTitle')}
              </strong>
              <span className="font-bold text-black">{t('rules.rps.modeAllDesc')}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
