import { useTranslate } from '@/hooks/useTranslate';

export function LobbyRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.lobby.welcomeTitle')}
        </h3>
        <p className="leading-relaxed">{t('rules.lobby.welcomeDesc')}</p>
      </div>
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">
          {t('rules.lobby.modesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-indigo-400 mt-0.5 flex-shrink-0 text-xl leading-none">🕵️</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('lobby.gameNames.whoKnow')}</strong>
              {t('rules.lobby.whoKnowDesc')}
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-pink-400 mt-0.5 flex-shrink-0 text-xl leading-none">🤔</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('lobby.gameNames.whoAmI')}</strong>
              {t('rules.lobby.whoAmIDesc')}
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-blue-400 mt-0.5 flex-shrink-0 text-xl leading-none">❌⭕️</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('lobby.gameNames.gobbler')}</strong>
              {t('rules.lobby.gobblerDesc')}
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-zinc-400 mt-0.5 flex-shrink-0 text-xl leading-none">❌⭕️</span>
            <div>
              <strong className="text-slate-800 block mb-1">
                {t('lobby.gameNames.ticTacToe')}
              </strong>
              {t('rules.lobby.ticTacToeDesc')}
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-amber-400 mt-0.5 flex-shrink-0 text-xl leading-none">✌️✊✋</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('lobby.gameNames.handDuel')}</strong>
              {t('rules.lobby.handDuelDesc')}
            </div>
          </li>
          <li className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-200">
            <span className="text-slate-700 mt-0.5 flex-shrink-0 text-xl leading-none">🔍</span>
            <div>
              <strong className="text-slate-800 block mb-1">Detective Club</strong>
              เกมแนว Bluffing + Dixit ใช้ภาพตีความ ทุกคนรู้คำศัพท์ ยกเว้น Conspirator
              ที่ต้องเนียนตามน้ำ!
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
