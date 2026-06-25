import { useState, useEffect, useRef } from 'react';
import { GameType } from '@repo/types';
import { WhoKnowRules } from './games/who-know/WhoKnowRules';
import { TicTacToeRules } from './games/tic-tac-toe/TicTacToeRules';
import { GobblerRules } from './games/gobbler/GobblerRules';
import { RPSRules } from './games/rps/RPSRules';
import { LobbyRules } from './games/LobbyRules';
import { SoundsFishyRules } from './games/sounds-fishy/SoundsFishyRules';
import { DetectiveClubRules } from './games/detective-club/DetectiveClubRules';
import { WhoAmIRules } from './games/who-am-i/WhoAmIRules';
import { WhoFirstRules } from './games/who-first/WhoFirstRules';
import { MusicTriviaRules } from './games/music-trivia/MusicTriviaRules';
import { useTranslate } from '@/hooks/useTranslate';

interface RulesModalProps {
  defaultGameType?: GameType;
  isGameRoom?: boolean;
}

export function RulesModal({ defaultGameType, isGameRoom }: RulesModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GameType | 'LOBBY'>(defaultGameType || 'LOBBY');
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslate();

  // When defaultGameType changes, ensure tab updates if open
  useEffect(() => {
    if (defaultGameType) {
      setActiveTab(defaultGameType);
    }
  }, [defaultGameType, isOpen]);

  // Scroll content to top when tab changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'LOBBY':
        return <LobbyRules />;
      case GameType.WHO_KNOW:
        return <WhoKnowRules />;
      case GameType.TIC_TAC_TOE:
        return <TicTacToeRules />;
      case GameType.GOBBLER_TIC_TAC_TOE:
        return <GobblerRules />;
      case GameType.RPS:
        return <RPSRules />;
      case GameType.SOUNDS_FISHY:
        return <SoundsFishyRules />;
      case GameType.WHO_AM_I:
        return <WhoAmIRules />;
      case GameType.DETECTIVE_CLUB:
        return <DetectiveClubRules />;
      case GameType.WHO_FIRST:
        return <WhoFirstRules />;
      case GameType.MUSIC_TRIVIA:
        return <MusicTriviaRules />;
      default:
        return null;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-amber-200 hover:bg-amber-100/50 text-nowrap"
        title={t('rules.modal.title')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        <span className="hidden sm:inline">{t('rules.button')}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-amber-50/80 backdrop-blur-sm p-2 pt-4 sm:p-4 text-left overflow-y-auto">
          <div className="bg-white border border-amber-300 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b border-amber-200 flex justify-between items-center bg-white z-10 shrink-0">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-500"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                {t('rules.modal.title')}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-700 hover:bg-amber-100 p-2 rounded-full transition-colors"
                aria-label="Close rules"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {!isGameRoom && (
              <div className="bg-white pt-3 border-b border-amber-200 shrink-0">
                <div className="flex gap-2 overflow-x-auto px-6 pb-3 no-scrollbar shrink-0">
                  <button
                    onClick={() => setActiveTab('LOBBY')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'LOBBY' ? 'bg-purple-500/20 text-purple-400 shadow-inner border border-purple-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.overview')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.WHO_KNOW)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_KNOW ? 'bg-indigo-500/20 text-indigo-400 shadow-inner border border-indigo-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.whoKnow')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.GOBBLER_TIC_TAC_TOE)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.GOBBLER_TIC_TAC_TOE ? 'bg-blue-500/20 text-blue-400 shadow-inner border border-blue-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.gobbler')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.TIC_TAC_TOE)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.TIC_TAC_TOE ? 'bg-zinc-500/20 text-zinc-400 shadow-inner border border-zinc-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.ticTacToe')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.RPS)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.RPS ? 'bg-amber-500/20 text-amber-400 shadow-inner border border-amber-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.handDuel')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.SOUNDS_FISHY)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.SOUNDS_FISHY ? 'bg-purple-500/20 text-purple-400 shadow-inner border border-purple-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.soundsFishy')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.WHO_AM_I)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_AM_I ? 'bg-pink-500/20 text-pink-400 shadow-inner border border-pink-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.whoAmI')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.DETECTIVE_CLUB)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.DETECTIVE_CLUB ? 'bg-slate-500/20 text-slate-700 shadow-inner border border-slate-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.detectiveClub')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.WHO_FIRST)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_FIRST ? 'bg-red-500/20 text-red-500 shadow-inner border border-red-500/20' : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100'}`}
                  >
                    {t('rules.modal.tabs.whoFirst')}
                  </button>
                </div>
              </div>
            )}

            <div ref={contentRef} className="p-6 overflow-y-auto text-slate-700 bg-white/50 flex-1">
              {renderContent()}
            </div>

            <div className="p-6 border-t border-amber-200 bg-white shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-amber-100 hover:bg-amber-200 text-slate-800 font-bold text-lg py-4 rounded-xl transition-colors shadow-lg active:scale-[0.98]"
              >
                {t('rules.modal.closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
