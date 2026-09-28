'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CheeseThiefSpecial, getCheeseThiefRequiredPlayerCount } from '@repo/types';

interface SpecialRoleDef {
  id: CheeseThiefSpecial;
  nameKey: 'roleDetective' | 'roleTwins' | 'roleSycophant' | 'roleScapegoat';
  descKey: 'dlcDetective' | 'dlcTwins' | 'dlcSycophant' | 'dlcScapegoat';
  playersCount: number;
}

const SPECIAL_ROLES: SpecialRoleDef[] = [
  {
    id: CheeseThiefSpecial.DETECTIVE,
    nameKey: 'roleDetective',
    descKey: 'dlcDetective',
    playersCount: 1,
  },
  {
    id: CheeseThiefSpecial.TWINS,
    nameKey: 'roleTwins',
    descKey: 'dlcTwins',
    playersCount: 2,
  },
  {
    id: CheeseThiefSpecial.SYCOPHANT,
    nameKey: 'roleSycophant',
    descKey: 'dlcSycophant',
    playersCount: 1,
  },
  {
    id: CheeseThiefSpecial.SCAPEGOAT,
    nameKey: 'roleScapegoat',
    descKey: 'dlcScapegoat',
    playersCount: 1,
  },
];

/** Host-tunable Cheese Thief pacing, roles configuration, and live balance calculation. */
export function CheeseThiefSettings() {
  const { room, updateConfig } = useGameStore();
  const { t } = useTranslate();
  if (!room) return null;

  const selectCls =
    'w-full bg-white border-2 border-black px-2 py-2 text-sm font-black text-black focus:outline-none';

  const followerCount = room.config.cheeseThiefFollowerCount ?? 1;
  const selectedSpecials = room.config.cheeseThiefSelectedSpecials ?? [];

  const handleFollowerChange = (count: number) => {
    updateConfig({ cheeseThiefFollowerCount: count });
  };

  const handleToggleSpecial = (special: CheeseThiefSpecial) => {
    const nextSpecials = selectedSpecials.includes(special)
      ? selectedSpecials.filter((s) => s !== special)
      : [...selectedSpecials, special];

    updateConfig({
      cheeseThiefSelectedSpecials: nextSpecials,
      cheeseThiefDlc: nextSpecials.length > 0,
    });
  };

  // Live calculation of required players
  const {
    min,
    followerCount: reqFollowers,
    specialsCount,
    plainMiceCount,
  } = getCheeseThiefRequiredPlayerCount(room.config);

  const currentPlayers = room.players.length;
  const isEnoughPlayers = currentPlayers >= min;

  return (
    <div className="space-y-4">
      {/* Live Player Requirement & Role Calculation Box */}
      <div
        className={`p-3 border-3 border-black shadow-[3px_3px_0_0_#000] rounded-none transition-colors ${
          isEnoughPlayers ? 'bg-emerald-50 border-emerald-900' : 'bg-amber-50 border-amber-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs font-black uppercase tracking-wider text-black">
            {t('gameCheeseThief.settingsMinPlayersRequired', { count: min })}
          </div>
          <span
            className={`text-[11px] font-black px-2 py-0.5 border border-black ${
              isEnoughPlayers
                ? 'bg-emerald-300 text-black'
                : 'bg-amber-300 text-black animate-pulse'
            }`}
          >
            {currentPlayers}/{min} {isEnoughPlayers ? '✅' : '⚠️'}
          </span>
        </div>

        {/* Breakdown Tags */}
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="px-2 py-0.5 bg-red-100 border border-black text-red-900">
            🦹 {t('gameCheeseThief.settingsBreakdownThief')}
          </span>
          {reqFollowers > 0 && (
            <span className="px-2 py-0.5 bg-purple-100 border border-black text-purple-900">
              🤝 {t('gameCheeseThief.settingsBreakdownFollower', { count: reqFollowers })}
            </span>
          )}
          {specialsCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 border border-black text-blue-900">
              ⭐{' '}
              {t('gameCheeseThief.settingsBreakdownSpecials', {
                count: specialsCount,
                roles: selectedSpecials
                  .map(
                    (s) => t(`gameCheeseThief.role${s[0]}${s.slice(1).toLowerCase()}` as any) || s,
                  )
                  .join(', '),
              })}
            </span>
          )}
          <span className="px-2 py-0.5 bg-yellow-100 border border-black text-yellow-900">
            🐭 {t('gameCheeseThief.settingsBreakdownInnocent', { count: plainMiceCount })}
          </span>
        </div>
      </div>

      {/* Follower Selection */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          🤝 {t('gameCheeseThief.settingsFollowers')}
        </label>
        <select
          id="cheeseThiefFollowerSelect"
          className={selectCls}
          value={followerCount}
          onChange={(e) => handleFollowerChange(Number(e.target.value))}
        >
          <option value={0}>{t('gameCheeseThief.settingsFollowersNone')}</option>
          <option value={1}>{t('gameCheeseThief.settingsFollowersOne')}</option>
          <option value={2}>{t('gameCheeseThief.settingsFollowersTwo')}</option>
        </select>
        <p className="text-[10px] font-bold text-gray-600 mt-1">
          {t('gameCheeseThief.settingsFollowersHint')}
        </p>
      </div>

      {/* Specials Multi-Select */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-black uppercase tracking-wider">
            ⭐ {t('gameCheeseThief.settingsSpecialsSelect')}
          </label>
        </div>
        <p className="text-[10px] font-bold text-gray-600 mb-2">
          {t('gameCheeseThief.settingsSpecialsHint')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SPECIAL_ROLES.map((role) => {
            const isSelected = selectedSpecials.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleToggleSpecial(role.id)}
                className={`p-2.5 text-left border-2 border-black transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-300 text-black shadow-[3px_3px_0_0_#000] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-white text-gray-800 hover:bg-gray-50 shadow-[1px_1px_0_0_#000]'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-black">{t(`gameCheeseThief.${role.nameKey}`)}</span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 border border-black ${
                      isSelected ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    +{role.playersCount} คน
                  </span>
                </div>
                <div className="text-[10px] leading-tight font-medium text-gray-700">
                  {t(`rules.cheeseThief.${role.descKey}`)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Narrator Settings */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          🎙️ {t('gameCheeseThief.settingsNarrator')}
        </label>
        <select
          id="cheeseThiefNarratorSelect"
          className={selectCls}
          value={room.config.cheeseThiefNarrator ?? 'AUTO'}
          onChange={(e) =>
            updateConfig({
              cheeseThiefNarrator: e.target.value as 'AUTO' | 'HOST',
            })
          }
        >
          <option value="AUTO">{t('gameCheeseThief.settingsNarratorAuto')}</option>
          <option value="HOST">{t('gameCheeseThief.settingsNarratorHost')}</option>
        </select>
      </div>

      {/* Night Tick Seconds */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          ⏱️ {t('gameCheeseThief.settingsTick')}
        </label>
        <select
          id="cheeseThiefTickSelect"
          className={selectCls}
          value={room.config.cheeseThiefTickSeconds ?? 6}
          onChange={(e) => updateConfig({ cheeseThiefTickSeconds: Number(e.target.value) })}
        >
          <option value={3}>{t('gameCheeseThief.settingsTickFast')}</option>
          <option value={6}>{t('gameCheeseThief.settingsTickNormal')}</option>
          <option value={9}>{t('gameCheeseThief.settingsTickSlow')}</option>
          <option value={12}>12 {t('lobby.seconds')}</option>
          <option value={15}>15 {t('lobby.seconds')}</option>
        </select>
      </div>

      {/* Discussion Seconds */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          💬 {t('gameCheeseThief.settingsDiscussion')}
        </label>
        <select
          className={selectCls}
          value={room.config.cheeseThiefDiscussionSeconds ?? 180}
          onChange={(e) => updateConfig({ cheeseThiefDiscussionSeconds: Number(e.target.value) })}
        >
          <option value={60}>{t('gameCheeseThief.settingsMin', { count: 1 })}</option>
          <option value={120}>{t('gameCheeseThief.settingsMin', { count: 2 })}</option>
          <option value={180}>{t('gameCheeseThief.settingsMin', { count: 3 })}</option>
          <option value={300}>{t('gameCheeseThief.settingsMin', { count: 5 })}</option>
        </select>
      </div>

      {/* Vote Seconds */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          🗳️ {t('gameCheeseThief.settingsVote')}
        </label>
        <select
          className={selectCls}
          value={room.config.cheeseThiefVoteSeconds ?? 15}
          onChange={(e) => updateConfig({ cheeseThiefVoteSeconds: Number(e.target.value) })}
        >
          <option value={15}>15 {t('lobby.seconds')}</option>
          <option value={30}>30 {t('lobby.seconds')}</option>
          <option value={45}>45 {t('lobby.seconds')}</option>
          <option value={60}>60 {t('lobby.seconds')}</option>
        </select>
      </div>
    </div>
  );
}
