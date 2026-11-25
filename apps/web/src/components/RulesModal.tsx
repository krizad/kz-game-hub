import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { GameType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { useGameStore } from '@/store/useGameStore';
import { GameDialog } from './core/GameDialog';

const DynamicRulesModalContent = dynamic(
  () => import('./RulesModalContent').then((m) => m.RulesModalContent),
  { ssr: false },
);

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
  const isGameEnabled = useGameStore((s) => s.isGameEnabled);

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
    if (!isOpen) return null;
    return <DynamicRulesModalContent activeTab={activeTab} />;
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
        <GameDialog open={isOpen} onClose={() => setIsOpen(false)} title={t('rules.modal.title')}>
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
                data-testid="rules-close"
                aria-label={t('rules.modal.closeLabel')}
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
                  {isGameEnabled(GameType.TIC_TAC_TOE) && (
                    <button
                      onClick={() => setActiveTab(GameType.TIC_TAC_TOE)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.TIC_TAC_TOE ? 'bg-zinc-300 text-black border-2 border-black border border-zinc-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.ticTacToe')}
                    </button>
                  )}
                  {isGameEnabled(GameType.RPS) && (
                    <button
                      onClick={() => setActiveTab(GameType.RPS)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.RPS ? 'bg-amber-300 text-black border-2 border-black border border-amber-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.handDuel')}
                    </button>
                  )}
                  {isGameEnabled(GameType.SOUNDS_FISHY) && (
                    <button
                      onClick={() => setActiveTab(GameType.SOUNDS_FISHY)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.SOUNDS_FISHY ? 'bg-purple-300 text-black border-2 border-black border border-purple-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.soundsFishy')}
                    </button>
                  )}
                  {isGameEnabled(GameType.WHO_AM_I) && (
                    <button
                      onClick={() => setActiveTab(GameType.WHO_AM_I)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_AM_I ? 'bg-pink-300 text-black border-2 border-black border border-pink-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.whoAmI')}
                    </button>
                  )}
                  {isGameEnabled(GameType.DETECTIVE_CLUB) && (
                    <button
                      onClick={() => setActiveTab(GameType.DETECTIVE_CLUB)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.DETECTIVE_CLUB ? 'bg-slate-300 text-black border-2 border-black border border-slate-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.detectiveClub')}
                    </button>
                  )}
                  {isGameEnabled(GameType.WHO_FIRST) && (
                    <button
                      onClick={() => setActiveTab(GameType.WHO_FIRST)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_FIRST ? 'bg-red-300 text-black border-2 border-black border border-red-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.whoFirst')}
                    </button>
                  )}
                  {isGameEnabled(GameType.MUSIC_TRIVIA) && (
                    <button
                      onClick={() => setActiveTab(GameType.MUSIC_TRIVIA)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.MUSIC_TRIVIA ? 'bg-orange-300 text-black border-2 border-black border border-orange-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.musicTrivia')}
                    </button>
                  )}
                  {isGameEnabled(GameType.THE_MIND) && (
                    <button
                      onClick={() => setActiveTab(GameType.THE_MIND)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.THE_MIND ? 'bg-cyan-300 text-black border-2 border-black border border-cyan-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.theMind')}
                    </button>
                  )}
                  {isGameEnabled(GameType.SABOTEUR) && (
                    <button
                      onClick={() => setActiveTab(GameType.SABOTEUR)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.SABOTEUR ? 'bg-orange-300 text-black border-2 border-black border border-orange-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.saboteur')}
                    </button>
                  )}
                  {isGameEnabled(GameType.COUP) && (
                    <button
                      onClick={() => setActiveTab(GameType.COUP)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.COUP ? 'bg-red-300 text-black border-2 border-black border border-red-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.coup')}
                    </button>
                  )}
                  {isGameEnabled(GameType.CARD_GAME) && (
                    <button
                      onClick={() => setActiveTab(GameType.CARD_GAME)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.CARD_GAME ? 'bg-lime-300 text-black border-2 border-black border border-lime-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.pokDeng')}
                    </button>
                  )}
                  {isGameEnabled(GameType.BANANA_THIEF) && (
                    <button
                      onClick={() => setActiveTab(GameType.BANANA_THIEF)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.BANANA_THIEF ? 'bg-yellow-300 text-black border-2 border-black border border-yellow-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.bananaThief')}
                    </button>
                  )}
                  {isGameEnabled(GameType.POKER) && (
                    <button
                      onClick={() => setActiveTab(GameType.POKER)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.POKER ? 'bg-emerald-300 text-black border-2 border-black border border-emerald-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.poker')}
                    </button>
                  )}
                  {isGameEnabled(GameType.POKER_V2) && (
                    <button
                      onClick={() => setActiveTab(GameType.POKER_V2)}
                      className={`px-4 py-2  text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.POKER_V2 ? 'bg-emerald-300 text-black border-2 border-black border border-emerald-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.pokerV2')}
                    </button>
                  )}
                  {isGameEnabled(GameType.DOG_RELAY) && (
                    <button
                      onClick={() => setActiveTab(GameType.DOG_RELAY)}
                      className="px-4 py-2 border-2 border-black font-bold bg-amber-200"
                    >
                      {t('lobby.gameNames.dogRelay')}
                    </button>
                  )}
                  {isGameEnabled(GameType.CIPHER_GRID) && (
                    <button
                      onClick={() => setActiveTab(GameType.CIPHER_GRID)}
                      className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.CIPHER_GRID ? 'bg-cyan-300 text-black border-2 border-black border border-cyan-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.cipherGrid')}
                    </button>
                  )}
                  {isGameEnabled(GameType.WEREWOLF) && (
                    <button
                      onClick={() => setActiveTab(GameType.WEREWOLF)}
                      className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WEREWOLF ? 'bg-indigo-300 text-black border-2 border-black border border-indigo-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.werewolf')}
                    </button>
                  )}
                  {isGameEnabled(GameType.BATTLESHIP) && (
                    <button
                      onClick={() => setActiveTab(GameType.BATTLESHIP)}
                      className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.BATTLESHIP ? 'bg-sky-400 text-black border-2 border-black border border-sky-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.battleship')}
                    </button>
                  )}
                  {isGameEnabled(GameType.THIRTY_ONE) && (
                    <button
                      onClick={() => setActiveTab(GameType.THIRTY_ONE)}
                      className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.THIRTY_ONE ? 'bg-amber-300 text-black border-2 border-black border border-amber-500/20' : 'text-black bg-white border-2 border-black hover:bg-yellow-300'}`}
                    >
                      {t('rules.modal.tabs.thirtyOne')}
                    </button>
                  )}
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
        </GameDialog>
      )}
    </>
  );
}
