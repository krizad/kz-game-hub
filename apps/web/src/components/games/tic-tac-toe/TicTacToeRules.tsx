import { useTranslate } from '@/hooks/useTranslate';

export function TicTacToeRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.ticTacToe.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('rules.ticTacToe.desc')}</p>
      </div>
      <div className="bg-yellow-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.ticTacToe.winTitle')}
        </h3>
        <ul className="space-y-3 font-bold text-black">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 text-xl leading-none">🏆</span>
            <span>
              {t('rules.ticTacToe.winDesc1A')}
              <strong className="bg-white px-1 border-2 border-black">
                {t('rules.ticTacToe.winDesc1B')}
              </strong>
              {t('rules.ticTacToe.winDesc1C')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 text-xl leading-none">🤝</span>
            <span>
              {t('rules.ticTacToe.winDesc2A')}
              <strong className="bg-white px-1 border-2 border-black">
                {t('rules.ticTacToe.winDesc2B')}
              </strong>
              .
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
