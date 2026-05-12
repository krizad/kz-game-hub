import { useTranslate } from "@/hooks/useTranslate";

export function TicTacToeRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-zinc-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.ticTacToe.title')}</h3>
        <p className="leading-relaxed">
          {t('rules.ticTacToe.desc')}
        </p>
      </div>
      <div>
        <h3 className="text-zinc-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.ticTacToe.winTitle')}</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="text-amber-500 flex-shrink-0 text-xl leading-none">🏆</span>
            <span>
              {t('rules.ticTacToe.winDesc1A')}<strong>{t('rules.ticTacToe.winDesc1B')}</strong>{t('rules.ticTacToe.winDesc1C')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-slate-600 flex-shrink-0 text-xl leading-none">🤝</span>
            <span>
              {t('rules.ticTacToe.winDesc2A')}<strong>{t('rules.ticTacToe.winDesc2B')}</strong>.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
