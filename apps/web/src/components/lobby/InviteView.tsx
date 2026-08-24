'use client';

import { useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';

import { RulesModal } from '@/components/RulesModal';

export function InviteView() {
  const { connected, myName, setName, joinRoom } = useGameStore();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room') || '';
  const { t } = useTranslate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-amber-50 text-black font-mono relative overflow-x-hidden">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-between items-center mb-4 sm:mb-6 z-10 px-2 sm:px-0">
        <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ">
          <LanguageSwitcher />
        </div>
        <div className="flex gap-2">
          <RulesModal triggerClassName="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-2 px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white hover:bg-white hover:border-indigo-300 hover:bg-yellow-300 text-nowrap" />
        </div>
      </div>
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl p-6 sm:p-8 md:p-10 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400 border-b-4 border-black"></div>
        <div className="flex justify-center mb-4 mt-2">
          <img
            src="/icon.png"
            alt="KZ Game Hub Logo"
            className="w-20 h-20 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-center mb-2 tracking-tighter text-slate-800">
          {t('lobby.invited')}
        </h1>
        <p className="text-center text-black mb-8 font-medium">
          {t('lobby.joinRoomInfo')}{' '}
          <span className="text-indigo-400 font-bold">{roomQuery.toUpperCase()}</span>
        </p>

        <div className="space-y-6">
          <div>
            <label htmlFor="inviteNameInput" className="block text-sm font-medium text-black mb-2">
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
              className="w-full bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center text-lg "
              placeholder={t('lobby.enterNamePlaceholder')}
              autoFocus
            />
          </div>

          <button
            onClick={() => joinRoom(roomQuery)}
            disabled={!connected || !myName || roomQuery.length < 4}
            className="w-full bg-indigo-400 hover:bg-indigo-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black uppercase tracking-widest active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 transition-all"
          >
            {t('lobby.enterGame')}
          </button>

          <button
            onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              // Instead of managing joinCode here, we force a page reload without query params
              window.location.reload();
            }}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none uppercase tracking-widest mt-4 font-bold text-lg py-3 transition-all"
          >
            {t('lobby.returnToHome')}
          </button>
        </div>
      </div>
    </main>
  );
}
