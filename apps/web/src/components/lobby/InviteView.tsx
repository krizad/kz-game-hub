'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';
import { LeaderboardModal } from '@/components/LeaderboardModal';
import { RulesModal } from '@/components/RulesModal';

export function InviteView() {
  const { connected, myName, setName, joinRoom } = useGameStore();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room') || '';
  const { t } = useTranslate();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-amber-50 text-slate-800 relative">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-between items-center mb-4 sm:mb-6 z-10 px-2 sm:px-0">
        <div className="bg-white/60 backdrop-blur-md border border-indigo-200/50 rounded-xl shadow-sm">
          <LanguageSwitcher />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200/50 bg-white/60 backdrop-blur-md shadow-sm hover:bg-white hover:border-indigo-300 hover:shadow-indigo-500/20 text-nowrap"
          >
            🏆
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
          <div className="bg-white/60 backdrop-blur-md border border-indigo-200/50 rounded-xl shadow-sm hover:bg-white hover:border-indigo-300 hover:shadow-indigo-500/20 transition-all">
            <RulesModal />
          </div>
        </div>
      </div>
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl p-6 sm:p-8 md:p-10 bg-white border border-indigo-500/30 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="flex justify-center mb-4 mt-2">
          <img
            src="/icon.png"
            alt="KZ Game Hub Logo"
            className="w-20 h-20 rounded-2xl shadow-lg shadow-indigo-500/20 border border-amber-300"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-center mb-2 tracking-tighter text-slate-800">
          {t('lobby.invited')}
        </h1>
        <p className="text-center text-slate-600 mb-8 font-medium">
          {t('lobby.joinRoomInfo')}{' '}
          <span className="text-indigo-400 font-bold">{roomQuery.toUpperCase()}</span>
        </p>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="inviteNameInput"
              className="block text-sm font-medium text-slate-600 mb-2"
            >
              {t('lobby.displayName')}
            </label>
            <input
              id="inviteNameInput"
              name="displayName"
              autoComplete="name"
              type="text"
              value={myName}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && myName && roomQuery.length >= 4) {
                  joinRoom(roomQuery);
                }
              }}
              className="w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center text-lg shadow-inner"
              placeholder={t('lobby.enterNamePlaceholder')}
              autoFocus
            />
          </div>

          <button
            onClick={() => joinRoom(roomQuery)}
            disabled={!connected || !myName || roomQuery.length < 4}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
          >
            {t('lobby.enterGame')}
          </button>

          <button
            onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              // Instead of managing joinCode here, we force a page reload without query params
              window.location.reload();
            }}
            className="w-full bg-amber-100 hover:bg-amber-200 text-slate-800 font-bold text-lg py-3 rounded-xl transition-all shadow-lg active:scale-[0.98] border border-amber-300"
          >
            {t('lobby.returnToHome')}
          </button>
        </div>
      </div>
      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} isOpen={showLeaderboard} />
      )}
    </main>
  );
}
