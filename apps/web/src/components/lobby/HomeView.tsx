'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { toast } from 'react-hot-toast';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';
import { RulesModal } from '@/components/RulesModal';

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
    case GameType.THE_MIND:
      return 'THE MIND';
    default:
      return t('lobby.gameNames.whoKnow').toUpperCase();
  }
};

export function HomeView() {
  const { connected, myName, setName, createRoom, joinRoom, availableRooms } = useGameStore();
  const { t } = useTranslate();

  const [joinCode, setJoinCode] = useState('');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-[#FEF08A] text-black relative font-black overflow-x-hidden">
      <div className="w-full max-w-md lg:max-w-5xl flex justify-between items-center mb-4 sm:mb-6 z-10 px-2 sm:px-0">
        <div className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000]">
          <LanguageSwitcher />
        </div>
        <div className="flex">
          <RulesModal triggerClassName="text-sm font-black text-black hover:bg-gray-100 transition-colors flex items-center gap-2 px-4 py-2 border-4 border-black bg-white shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] text-nowrap" />
        </div>
      </div>
      <div className="w-full max-w-md lg:max-w-5xl p-6 sm:p-8 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] lg:p-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
        {/* Left Column (PC) / Top Section (Mobile) */}
        <div className="flex flex-col h-full lg:justify-center">
          <div className="flex justify-center mb-6">
            <img
              src="/icon.png"
              alt="KZ Game Hub Logo"
              className="w-24 h-24 sm:w-28 sm:h-28 shadow-[4px_4px_0_0_#000] border-4 border-black"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-center mb-8 tracking-tighter text-black uppercase">
            {t('lobby.gameLobbyTitle')}
          </h1>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="lobbyNameInput"
                className="block text-sm font-black text-black mb-2 uppercase"
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
                className="w-full bg-white border-4 border-black px-4 py-3 text-black focus:outline-none focus:ring-4 focus:ring-[#8B5CF6] transition-all font-black shadow-[4px_4px_0_0_#000]"
                placeholder={t('lobby.enterNameShort')}
              />
            </div>

            <div className="relative flex items-center py-2 lg:py-4">
              <div className="flex-grow border-t-4 border-black"></div>
              <span className="flex-shrink-0 mx-4 text-black text-sm font-black uppercase bg-white border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
                {t('lobby.or')}
              </span>
              <div className="flex-grow border-t-4 border-black"></div>
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
                className="flex-1 bg-white border-4 border-black px-4 py-3 text-black focus:outline-none focus:ring-4 focus:ring-[#8B5CF6] transition-all uppercase font-black text-center shadow-[4px_4px_0_0_#000]"
                placeholder={t('lobby.roomCodePlaceholder')}
                maxLength={6}
              />
              <button
                onClick={() => joinRoom(joinCode)}
                disabled={!myName || joinCode.length < 4}
                className="bg-[#A855F7] hover:bg-[#9333EA] disabled:bg-gray-400 text-white font-black px-6 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black uppercase tracking-widest disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
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
              className="w-full bg-[#818CF8] hover:bg-[#6366F1] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🕵️</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                {t('lobby.gameNames.whoKnow')}
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.SOUNDS_FISHY)}
              disabled={!connected || !myName}
              className="w-full bg-[#C084FC] hover:bg-[#A855F7] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🐟</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                Sounds Fishy
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.GOBBLER_TIC_TAC_TOE)}
              disabled={!connected || !myName}
              className="w-full bg-[#60A5FA] hover:bg-[#3B82F6] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <div className="flex items-end justify-center gap-1.5 h-7">
                <span className="text-[10px] leading-none mb-1">❌⭕️</span>
                <span className="text-sm leading-none mb-0.5">❌⭕️</span>
                <span className="text-xl leading-none">❌⭕️</span>
              </div>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                {t('lobby.gameNames.gobbler')}
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.TIC_TAC_TOE)}
              disabled={!connected || !myName}
              className="w-full bg-[#A1A1AA] hover:bg-[#71717A] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">❌⭕️</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                {t('lobby.gameNames.ticTacToe')}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.RPS)}
              disabled={!connected || !myName}
              className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] disabled:bg-gray-400 text-black font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">✌️✊✋</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                {t('lobby.gameNames.handDuel')}
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.DETECTIVE_CLUB)}
              disabled={!connected || !myName}
              className="w-full bg-[#FDE047] hover:bg-[#FACC15] disabled:bg-gray-400 text-black font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🔍</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                Detective Club
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.WHO_AM_I)}
              disabled={!connected || !myName}
              className="w-full bg-[#F472B6] hover:bg-[#EC4899] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🤔❓</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">Who Am I</span>
            </button>
            <button
              onClick={() => createRoom(GameType.WHO_FIRST)}
              disabled={!connected || !myName}
              className="w-full bg-[#34D399] hover:bg-[#10B981] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🛎️</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">Who First</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => createRoom(GameType.MUSIC_TRIVIA)}
              disabled={!connected || !myName}
              className="w-full bg-[#818CF8] hover:bg-[#6366F1] disabled:bg-gray-400 text-white font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🎵</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">
                Music Trivia
              </span>
            </button>
            <button
              onClick={() => createRoom(GameType.THE_MIND)}
              disabled={!connected || !myName}
              className="w-full bg-[#22D3EE] hover:bg-[#06B6D4] disabled:bg-gray-400 text-black font-black py-3 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] border-4 border-black flex flex-col items-center justify-center gap-1 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
            >
              <span className="text-xl">🧠</span>
              <span className="text-xs tracking-wider text-center px-1 uppercase">The Mind</span>
            </button>
          </div>

          {availableRooms.length > 0 && (
            <div className="mt-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px bg-black flex-1 border-t-2 border-black"></div>
                <h3 className="text-xs font-black text-black uppercase tracking-widest flex items-center gap-2">
                  {t('lobby.publicLobbies')}
                  <span className="bg-[#FEF08A] text-black border-2 border-black px-2 py-0.5 rounded-md shadow-[2px_2px_0_0_#000]">
                    {availableRooms.length}
                  </span>
                </h3>
                <div className="h-px bg-black flex-1 border-t-2 border-black"></div>
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
                    className="w-full bg-white border-2 border-black hover:bg-[#FEF08A] p-4 text-left transition-all flex items-center justify-between group shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]"
                  >
                    <div>
                      <div className="text-black font-black tracking-widest text-lg leading-none mb-1 flex items-center gap-2">
                        {r.code}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border border-black leading-none ml-2 tracking-normal font-sans text-black font-bold bg-[#A3E635]`}
                        >
                          {getGameName(r.gameType, t)}
                        </span>
                      </div>
                      <div className="text-black text-[10px] font-black uppercase mt-0.5 tracking-wider flex items-center gap-1.5">
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
                          className="text-black"
                        >
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        {t('lobby.host')}{' '}
                        <span className="text-black normal-case font-black">{r.hostName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-1.5 text-xs font-black text-black bg-white px-2.5 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000] group-hover:shadow-[1px_1px_0_0_#000]"
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
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-black"
                        >
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="bg-[#A855F7] text-white border-2 border-black text-[10px] uppercase font-black px-4 py-2 shadow-[2px_2px_0_0_#000] opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
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
    </main>
  );
}
