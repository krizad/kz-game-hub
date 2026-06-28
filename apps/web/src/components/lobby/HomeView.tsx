'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { toast } from 'react-hot-toast';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';
import { RulesModal } from '@/components/RulesModal';
import { LeaderboardModal } from '@/components/LeaderboardModal';

const getBadgeStyle = (gameType: GameType) => {
  if (gameType === GameType.GOBBLER_TIC_TAC_TOE || gameType === GameType.TIC_TAC_TOE) {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
  if (gameType === GameType.RPS) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
};

const getGameName = (gameType: GameType, t: any) => {
  switch (gameType) {
    case GameType.GOBBLER_TIC_TAC_TOE:
      return t('lobby.gameNames.gobbler').toUpperCase();
    case GameType.TIC_TAC_TOE:
      return t('lobby.gameNames.ticTacToe').toUpperCase();
    case GameType.RPS:
      return t('lobby.gameNames.handDuel').toUpperCase();
    case GameType.DETECTIVE_CLUB:
      return 'DETECTIVE CLUB';
    case GameType.SOUNDS_FISHY:
      return 'SOUNDS FISHY';
    case GameType.MUSIC_TRIVIA:
      return 'MUSIC TRIVIA';
    case GameType.WHO_AM_I:
      return 'WHO AM I';
    case GameType.WHO_FIRST:
      return 'WHO FIRST';
    default:
      return t('lobby.gameNames.whoKnow').toUpperCase();
  }
};

export function HomeView() {
  const { connected, myName, setName, createRoom, joinRoom, availableRooms } = useGameStore();
  const { t } = useTranslate();

  const [joinCode, setJoinCode] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-amber-50 text-slate-800 relative">
      <div className="w-full max-w-md lg:max-w-5xl flex justify-between items-center mb-4 sm:mb-6 z-10 px-2 sm:px-0">
        <div className="bg-white/60 backdrop-blur-md border border-amber-200/50 rounded-xl shadow-sm">
          <LanguageSwitcher />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200/50 bg-white/60 backdrop-blur-md shadow-sm hover:bg-white hover:border-indigo-200 hover:shadow-indigo-500/20 text-nowrap"
          >
            🏆
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
          <div className="bg-white/60 backdrop-blur-md border border-amber-200/50 rounded-xl shadow-sm hover:bg-white hover:border-indigo-200 hover:shadow-indigo-500/20 transition-all">
            <RulesModal />
          </div>
        </div>
      </div>
      <div className="w-full max-w-md lg:max-w-5xl p-6 sm:p-8 bg-white border border-amber-200 rounded-3xl shadow-2xl lg:p-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
        {/* Left Column (PC) / Top Section (Mobile) */}
        <div className="flex flex-col h-full lg:justify-center">
          <div className="flex justify-center mb-6">
            <img
              src="/icon.png"
              alt="KZ Game Hub Logo"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] shadow-2xl shadow-indigo-500/20 border border-amber-300"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-center mb-8 tracking-tighter bg-gradient-to-br from-indigo-400 to-purple-500 bg-clip-text text-transparent">
            {t('lobby.gameLobbyTitle')}
          </h1>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="lobbyNameInput"
                className="block text-sm font-medium text-slate-600 mb-2"
              >
                {t('lobby.displayName')}
              </label>
              <input
                id="lobbyNameInput"
                name="displayName"
                autoComplete="name"
                type="text"
                value={myName}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder={t('lobby.enterNameShort')}
              />
            </div>

            <div className="relative flex items-center py-2 lg:py-4">
              <div className="flex-grow border-t border-amber-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium">
                {t('lobby.or')}
              </span>
              <div className="flex-grow border-t border-amber-200"></div>
            </div>

            <div className="flex gap-3 mb-8 lg:mb-0">
              <input
                id="roomCodeInput"
                name="roomCode"
                autoComplete="off"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && myName && joinCode.length >= 4) {
                    joinRoom(joinCode);
                  }
                }}
                className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all uppercase font-bold text-center"
                placeholder={t('lobby.roomCodePlaceholder')}
                maxLength={6}
              />
              <button
                onClick={() => joinRoom(joinCode)}
                disabled={!myName || joinCode.length < 4}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 rounded-xl transition-colors shadow-md"
              >
                {t('lobby.join')}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (PC) / Bottom Section (Mobile) */}
        <div className="flex flex-col mt-8 lg:mt-0">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.WHO_KNOW)}
              disabled={!connected || !myName}
              className="w-full bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-indigo-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🕵️</span>
              <span className="text-xs tracking-wider text-center px-1">
                {t('lobby.gameNames.whoKnow')}
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.SOUNDS_FISHY)}
              disabled={!connected || !myName}
              className="w-full bg-purple-600/80 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-purple-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🐟</span>
              <span className="text-xs tracking-wider text-center px-1">Sounds Fishy</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.GOBBLER_TIC_TAC_TOE)}
              disabled={!connected || !myName}
              className="w-full bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-blue-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <div className="flex items-end justify-center gap-1.5 group-hover:scale-110 transition-transform h-7">
                <span className="text-[10px] leading-none mb-1">❌⭕️</span>
                <span className="text-sm leading-none mb-0.5">❌⭕️</span>
                <span className="text-xl leading-none">❌⭕️</span>
              </div>
              <span className="text-xs tracking-wider text-center px-1">
                {t('lobby.gameNames.gobbler')}
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.TIC_TAC_TOE)}
              disabled={!connected || !myName}
              className="w-full bg-zinc-600/80 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-zinc-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">❌⭕️</span>
              <span className="text-xs tracking-wider text-center px-1">
                {t('lobby.gameNames.ticTacToe')}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.RPS)}
              disabled={!connected || !myName}
              className="w-full bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-amber-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">✌️✊✋</span>
              <span className="text-xs tracking-wider text-center px-1">
                {t('lobby.gameNames.handDuel')}
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.DETECTIVE_CLUB)}
              disabled={!connected || !myName}
              className="w-full bg-amber-200/80 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 font-bold py-3 rounded-xl transition-colors shadow-lg border border-amber-400/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🔍</span>
              <span className="text-xs tracking-wider text-center px-1">Detective Club</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.WHO_AM_I)}
              disabled={!connected || !myName}
              className="w-full bg-pink-600/80 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-pink-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🤔❓</span>
              <span className="text-xs tracking-wider text-center px-1">Who Am I</span>
            </button>
            <button
              onClick={() => createRoom(GameType.WHO_FIRST)}
              disabled={!connected || !myName}
              className="w-full bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-emerald-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🛎️</span>
              <span className="text-xs tracking-wider text-center px-1">Who First</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.MUSIC_TRIVIA)}
              disabled={!connected || !myName}
              className="w-full bg-indigo-500/80 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg border border-indigo-500/50 flex flex-col items-center justify-center gap-1 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🎵</span>
              <span className="text-xs tracking-wider text-center px-1">Music Trivia</span>
            </button>
          </div>

          {availableRooms.length > 0 && (
            <div className="mt-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px bg-amber-100 flex-1"></div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  {t('lobby.publicLobbies')}
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md shadow-sm">
                    {availableRooms.length}
                  </span>
                </h3>
                <div className="h-px bg-amber-100 flex-1"></div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {availableRooms.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => {
                      if (!myName) {
                        toast.error(t('errors.enterNameFirst'));
                        return;
                      }
                      setJoinCode(r.code);
                      joinRoom(r.code);
                    }}
                    className="w-full bg-slate-50/50 border border-amber-200/80 hover:border-indigo-500/50 hover:bg-white rounded-2xl p-4 text-left transition-all flex items-center justify-between group shadow-sm hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="text-slate-800 font-bold tracking-widest text-lg leading-none mb-1 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                        {r.code}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border leading-none ml-2 tracking-normal font-sans ${getBadgeStyle(r.gameType)}`}
                        >
                          {getGameName(r.gameType, t)}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[10px] font-medium uppercase mt-0.5 tracking-wider flex items-center gap-1.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-indigo-400"
                        >
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        {t('lobby.host')}{' '}
                        <span className="text-slate-700 normal-case font-bold">{r.hostName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm group-hover:border-indigo-500/30 transition-colors"
                        title={t('lobby.playersInRoom')}
                      >
                        {r.playerCount}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-slate-500 group-hover:text-indigo-500 transition-colors"
                        >
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] uppercase font-black px-4 py-2 rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 border border-indigo-500/50">
                        {t('lobby.join')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} isOpen={showLeaderboard} />
      )}
    </main>
  );
}
