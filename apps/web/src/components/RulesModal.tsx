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
import { TheMindRules } from './games/the-mind/TheMindRules';
import { SaboteurRules } from './games/saboteur/SaboteurRules';
import { useTranslate } from '@/hooks/useTranslate';

interface RulesModalProps {
  defaultGameType?: GameType;
  isGameRoom?: boolean;
  triggerClassName?: string;
}

export function RulesModal({ defaultGameType, isGameRoom, triggerClassName }: RulesModalProps) {
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
      case GameType.THE_MIND:
        return <TheMindRules />;
      case GameType.SABOTEUR:
        return <SaboteurRules />;
      default:
        return null;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ||
          'text-sm font-black text-black hover:bg-amber-200 bg-white transition-colors flex items-center gap-2 px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none text-nowrap'
        }
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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 pt-4 sm:p-4 text-left overflow-y-auto">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b-4 border-black flex justify-between items-center bg-white z-10 shrink-0">
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
              <div className="bg-white pt-3 border-b-4 border-black shrink-0">
                <div className="flex gap-2 overflow-x-auto px-6 pb-3 no-scrollbar shrink-0">
                  <button
                    onClick={() => setActiveTab('LOBBY')}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'LOBBY' ? 'bg-purple-300 text-black border-2 border-black border border-purple-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.overview')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.WHO_KNOW)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_KNOW ? 'bg-indigo-300 text-black border-2 border-black border border-indigo-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.whoKnow')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.GOBBLER_TIC_TAC_TOE)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.GOBBLER_TIC_TAC_TOE ? 'bg-blue-300 text-black border-2 border-black border border-blue-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.gobbler')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.TIC_TAC_TOE)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.TIC_TAC_TOE ? 'bg-zinc-300 text-black border-2 border-black border border-zinc-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.ticTacToe')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.RPS)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.RPS ? 'bg-amber-300 text-black border-2 border-black border border-amber-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.handDuel')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.SOUNDS_FISHY)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.SOUNDS_FISHY ? 'bg-purple-300 text-black border-2 border-black border border-purple-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.soundsFishy')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.WHO_AM_I)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_AM_I ? 'bg-pink-300 text-black border-2 border-black border border-pink-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.whoAmI')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.DETECTIVE_CLUB)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.DETECTIVE_CLUB ? 'bg-slate-300 text-black border-2 border-black border border-slate-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.detectiveClub')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.WHO_FIRST)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_FIRST ? 'bg-red-300 text-black border-2 border-black border border-red-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.whoFirst')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.MUSIC_TRIVIA)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.MUSIC_TRIVIA ? 'bg-orange-300 text-black border-2 border-black border border-orange-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    {t('rules.modal.tabs.musicTrivia')}
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.THE_MIND)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.THE_MIND ? 'bg-cyan-300 text-black border-2 border-black border border-cyan-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    The Mind
                  </button>
                  <button
                    onClick={() => setActiveTab(GameType.SABOTEUR)}
                    className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.SABOTEUR ? 'bg-orange-300 text-black border-2 border-black border border-orange-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                  >
                    Saboteur
                  </button>
                </div>
              </div>
            )}

            <div ref={contentRef} className="p-6 overflow-y-auto text-slate-700 bg-white flex-1">
              {renderContent()}
            </div>

            <div className="p-6 border-t-4 border-black bg-white shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-red-400 hover:bg-red-300 text-black border-4 border-black font-black text-xl py-4 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest"
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
