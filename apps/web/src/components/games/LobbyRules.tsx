import { useTranslate } from '@/hooks/useTranslate';

export function LobbyRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-black bg-purple-300 inline-block px-3 py-1 border-2 border-black font-black uppercase tracking-wider text-sm mb-4 shadow-[2px_2px_0_0_#000]">
          {t('rules.lobby.welcomeTitle')}
        </h3>
        <p className="leading-relaxed font-bold text-black bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000]">
          {t('rules.lobby.welcomeDesc')}
        </p>
      </div>
      <div>
        <h3 className="text-black bg-indigo-300 inline-block px-3 py-1 border-2 border-black font-black uppercase tracking-wider text-sm mb-4 shadow-[2px_2px_0_0_#000]">
          {t('rules.lobby.modesTitle')}
        </h3>
        <ul className="space-y-4">
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🕵️</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-yellow-200 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.whoKnow')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.whoKnowDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🤔</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-pink-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.whoAmI')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.whoAmIDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">❌⭕️</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-blue-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.gobbler')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.gobblerDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">❌⭕️</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-zinc-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.ticTacToe')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.ticTacToeDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">✌️✊✋</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-amber-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.handDuel')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.handDuelDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🔍</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-slate-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.detectiveClub')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.detectiveClubDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🐟</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-purple-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.soundsFishy')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.soundsFishyDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🛎️</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-red-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.whoFirst')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.whoFirstDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🎵</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-orange-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.musicTrivia')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.musicTriviaDesc')}</p>
            </div>
          </li>
          <li className="flex gap-4 items-start bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <span className="mt-0.5 flex-shrink-0 text-3xl leading-none">🧠</span>
            <div>
              <strong className="text-black font-black block mb-1 text-lg uppercase bg-cyan-300 inline-block px-2 border-2 border-black shadow-[2px_2px_0_0_#000]">
                {t('lobby.gameNames.theMind')}
              </strong>
              <p className="mt-2 font-bold">{t('rules.lobby.theMindDesc')}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
