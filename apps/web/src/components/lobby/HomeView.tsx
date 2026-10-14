'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { toast } from 'react-hot-toast';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';
import { AppInfoModal } from '@/components/core/AppInfoModal';
import { RulesModal } from '@/components/RulesModal';
import { AdminGameSettings } from './AdminGameSettings';
import { GAME_CATALOG, GameStyle } from './game-catalog';

const getGameName = (gameType: GameType, t: any) => {
  switch (gameType) {
    case GameType.TIC_TAC_TOE:
      return t('lobby.gameNames.ticTacToe').toUpperCase();
    case GameType.RPS:
      return t('lobby.gameNames.handDuel').toUpperCase();
    case GameType.DETECTIVE_CLUB:
      return t('lobby.gameNames.detectiveClub').toUpperCase();
    case GameType.SOUNDS_FISHY:
      return t('lobby.gameNames.soundsFishy').toUpperCase();
    case GameType.MUSIC_TRIVIA:
      return t('lobby.gameNames.musicTrivia').toUpperCase();
    case GameType.WHO_AM_I:
      return t('lobby.gameNames.whoAmI').toUpperCase();
    case GameType.WHO_FIRST:
      return t('lobby.gameNames.whoFirst').toUpperCase();
    case GameType.THE_MIND:
      return t('lobby.gameNames.theMind').toUpperCase();
    case GameType.SABOTEUR:
      return t('lobby.gameNames.saboteur').toUpperCase();
    case GameType.COUP:
      return t('lobby.gameNames.coup').toUpperCase();
    case GameType.CARD_GAME:
      return t('lobby.gameNames.cardGame').toUpperCase();
    case GameType.POKER:
      return t('lobby.gameNames.poker').toUpperCase();
    case GameType.BANANA_THIEF:
      return t('lobby.gameNames.bananaThief').toUpperCase();
    default:
      return t('lobby.gameNames.whoKnow').toUpperCase();
  }
};

export function HomeView() {
  const { connected, myName, setName, createRoom, joinRoom, availableRooms, isGameEnabled } =
    useGameStore();
  const { t } = useTranslate();

  const [joinCode, setJoinCode] = useState('');

  const [groupSizeFilter, setGroupSizeFilter] = useState<'ALL' | '2' | '3-4' | '5+'>('ALL');
  const [styleFilter, setStyleFilter] = useState<'ALL' | GameStyle>('ALL');
  const [audioFilter, setAudioFilter] = useState<'ALL' | 'REQUIRED' | 'NOT_REQUIRED'>('ALL');
  const [textFilter, setTextFilter] = useState<'ALL' | 'REQUIRED' | 'NOT_REQUIRED'>('ALL');

  const hasActiveFilters =
    groupSizeFilter !== 'ALL' ||
    styleFilter !== 'ALL' ||
    audioFilter !== 'ALL' ||
    textFilter !== 'ALL';

  const clearFilters = () => {
    setGroupSizeFilter('ALL');
    setStyleFilter('ALL');
    setAudioFilter('ALL');
    setTextFilter('ALL');
  };

  const filteredGames = GAME_CATALOG.filter((g) => {
    if (groupSizeFilter === '2') {
      if (g.minPlayers > 2 || g.maxPlayers < 2) return false;
    } else if (groupSizeFilter === '3-4') {
      if (g.minPlayers > 4 || g.maxPlayers < 3) return false;
    } else if (groupSizeFilter === '5+') {
      if (g.maxPlayers < 5) return false;
    }

    if (styleFilter !== 'ALL' && !g.styles.includes(styleFilter)) {
      return false;
    }

    if (audioFilter === 'REQUIRED' && !g.audioRequired) return false;
    if (audioFilter === 'NOT_REQUIRED' && g.audioRequired) return false;

    if (textFilter === 'REQUIRED' && !g.textRequired) return false;
    if (textFilter === 'NOT_REQUIRED' && g.textRequired) return false;

    return true;
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-[#FEF08A] text-black relative font-black overflow-x-hidden">
      <div className="w-full max-w-md lg:max-w-5xl flex justify-between items-center mb-4 sm:mb-6 z-10 px-2 sm:px-0">
        <div className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000]">
          <LanguageSwitcher />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <AppInfoModal triggerClassName="text-sm font-black text-black hover:bg-gray-100 transition-colors flex items-center gap-2 px-4 py-2 border-4 border-black bg-white shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] text-nowrap" />
          <RulesModal triggerClassName="text-sm font-black text-black hover:bg-gray-100 transition-colors flex items-center gap-2 px-4 py-2 border-4 border-black bg-white shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] text-nowrap" />
          <AdminGameSettings triggerClassName="text-sm font-black text-black hover:bg-gray-100 transition-colors flex items-center px-3 py-2 border-4 border-black bg-white shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]" />
        </div>
      </div>
      <div className="w-full max-w-md lg:max-w-5xl p-6 sm:p-8 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] lg:p-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
        {/* Left Column (PC) / Top Section (Mobile) */}
        <div className="flex flex-col h-full lg:justify-start">
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
                className="min-w-0 w-0 flex-1 bg-white border-4 border-black px-4 py-3 text-black focus:outline-none focus:ring-4 focus:ring-[#8B5CF6] transition-all uppercase font-black text-center shadow-[4px_4px_0_0_#000]"
                placeholder={t('lobby.roomCodePlaceholder')}
                maxLength={6}
              />
              <button
                type="button"
                data-testid="hub-join-room"
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
          {/* Catalog Filter Bar */}
          <div
            data-testid="catalog-filter-bar"
            className="mb-3 bg-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000] space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-black">
                <span>🔍</span> {t('lobby.filters')}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  data-testid="catalog-clear-filters-btn"
                  onClick={clearFilters}
                  className="text-[10px] font-black bg-rose-200 hover:bg-rose-300 text-black border-2 border-black px-2 py-0.5 shadow-[1px_1px_0_0_#000] active:translate-y-0.5"
                >
                  {t('lobby.clearFilters')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label
                  htmlFor="filter-group-size"
                  className="block text-[10px] font-black uppercase text-slate-600 mb-0.5"
                >
                  {t('lobby.groupSize')}
                </label>
                <select
                  id="filter-group-size"
                  data-testid="filter-group-size"
                  value={groupSizeFilter}
                  onChange={(e) => setGroupSizeFilter(e.target.value as any)}
                  className="w-full bg-amber-50 border-2 border-black p-1 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  <option value="ALL">{t('lobby.groupSizeAll')}</option>
                  <option value="2">{t('lobby.groupSize2')}</option>
                  <option value="3-4">{t('lobby.groupSize3to4')}</option>
                  <option value="5+">{t('lobby.groupSize5plus')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-style"
                  className="block text-[10px] font-black uppercase text-slate-600 mb-0.5"
                >
                  {t('lobby.style')}
                </label>
                <select
                  id="filter-style"
                  data-testid="filter-style"
                  value={styleFilter}
                  onChange={(e) => setStyleFilter(e.target.value as any)}
                  className="w-full bg-amber-50 border-2 border-black p-1 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  <option value="ALL">{t('lobby.styleAll')}</option>
                  <option value="party">{t('lobby.styleParty')}</option>
                  <option value="competitive">{t('lobby.styleCompetitive')}</option>
                  <option value="cooperative">{t('lobby.styleCooperative')}</option>
                  <option value="bluffing">{t('lobby.styleBluffing')}</option>
                  <option value="quick">{t('lobby.styleQuick')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-audio"
                  className="block text-[10px] font-black uppercase text-slate-600 mb-0.5"
                >
                  {t('lobby.audioFilter')}
                </label>
                <select
                  id="filter-audio"
                  data-testid="filter-audio"
                  value={audioFilter}
                  onChange={(e) => setAudioFilter(e.target.value as any)}
                  className="w-full bg-amber-50 border-2 border-black p-1 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  <option value="ALL">{t('lobby.audioAll')}</option>
                  <option value="REQUIRED">{t('lobby.audioRequired')}</option>
                  <option value="NOT_REQUIRED">{t('lobby.audioNotRequired')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-text"
                  className="block text-[10px] font-black uppercase text-slate-600 mb-0.5"
                >
                  {t('lobby.textFilter')}
                </label>
                <select
                  id="filter-text"
                  data-testid="filter-text"
                  value={textFilter}
                  onChange={(e) => setTextFilter(e.target.value as any)}
                  className="w-full bg-amber-50 border-2 border-black p-1 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  <option value="ALL">{t('lobby.textAll')}</option>
                  <option value="REQUIRED">{t('lobby.textRequired')}</option>
                  <option value="NOT_REQUIRED">{t('lobby.textNotRequired')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Game Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {filteredGames.length === 0 ? (
              <div
                data-testid="catalog-no-games"
                className="col-span-full border-4 border-dashed border-black bg-white/70 p-6 text-center"
              >
                <p className="text-sm font-black text-slate-800">{t('lobby.noGamesFound')}</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    data-testid="catalog-no-games-clear-btn"
                    onClick={clearFilters}
                    className="mt-3 inline-block bg-yellow-300 border-2 border-black px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0_0_#000] hover:bg-yellow-400 active:translate-y-0.5"
                  >
                    {t('lobby.clearFilters')}
                  </button>
                )}
              </div>
            ) : (
              filteredGames.map((g) => {
                const enabled = isGameEnabled(g.type);
                const gameName = t(`lobby.gameNames.${g.catalogKey}`);
                return (
                  <button
                    key={g.type}
                    type="button"
                    data-testid={`catalog-card-${g.type}`}
                    onClick={() => enabled && createRoom(g.type)}
                    disabled={!enabled || !connected || !myName}
                    aria-label={`${gameName}. ${t(`lobby.gameCards.${g.catalogKey}.category`)}. ${t(`lobby.gameCards.${g.catalogKey}.players`)}`}
                    className={`group relative w-full overflow-hidden border-4 border-black p-3 text-left shadow-[4px_4px_0_0_#000] transition-all ${
                      !enabled
                        ? 'bg-slate-100 opacity-60 cursor-not-allowed'
                        : 'bg-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]'
                    }`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-2 ${g.color}`}
                      aria-hidden="true"
                    />
                    <span className="flex items-start gap-3 pl-2">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border-2 border-black text-2xl shadow-[2px_2px_0_0_#000] ${g.color}`}
                        aria-hidden="true"
                      >
                        {g.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-600">
                          {t(`lobby.gameCards.${g.catalogKey}.category`)}
                        </span>
                        <span className="block text-sm font-black leading-tight text-black">
                          {gameName}
                        </span>
                        <span className="mt-1 block text-xs font-medium leading-snug text-slate-700">
                          {t(`lobby.gameCards.${g.catalogKey}.description`)}
                        </span>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex border-2 border-black bg-[#FEF08A] px-2 py-0.5 text-[10px] font-black text-black">
                            👥 {t(`lobby.gameCards.${g.catalogKey}.players`)}
                          </span>
                          {!enabled && (
                            <span
                              data-testid={`game-disabled-reason-${g.type}`}
                              className="inline-flex border-2 border-red-500 bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700"
                            >
                              🔒 {t('lobby.disabledReason')}
                            </span>
                          )}
                        </div>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
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
                    type="button"
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
