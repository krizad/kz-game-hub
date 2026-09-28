'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { BananaThiefSpecial, getBananaThiefRequiredPlayerCount } from '@repo/types';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

interface SpecialRoleDef {
  id: BananaThiefSpecial;
  nameKey: 'roleDetective' | 'roleTwins' | 'roleSycophant' | 'roleScapegoat';
  descKey: 'dlcDetective' | 'dlcTwins' | 'dlcSycophant' | 'dlcScapegoat';
  playersCount: number;
}

const SPECIAL_ROLES: SpecialRoleDef[] = [
  {
    id: BananaThiefSpecial.DETECTIVE,
    nameKey: 'roleDetective',
    descKey: 'dlcDetective',
    playersCount: 1,
  },
  {
    id: BananaThiefSpecial.TWINS,
    nameKey: 'roleTwins',
    descKey: 'dlcTwins',
    playersCount: 2,
  },
  {
    id: BananaThiefSpecial.SYCOPHANT,
    nameKey: 'roleSycophant',
    descKey: 'dlcSycophant',
    playersCount: 1,
  },
  {
    id: BananaThiefSpecial.SCAPEGOAT,
    nameKey: 'roleScapegoat',
    descKey: 'dlcScapegoat',
    playersCount: 1,
  },
];

/** Host-tunable Banana Thief pacing, roles configuration, and live balance calculation. */
export function BananaThiefSettings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();
  if (!room) return null;

  const isHost = socketId === room.roomHostId;

  const followerCount = room.config.bananaThiefFollowerCount ?? 1;
  const selectedSpecials = room.config.bananaThiefSelectedSpecials ?? [];

  const handleFollowerChange = (count: number) => {
    updateConfig({ bananaThiefFollowerCount: count });
  };

  const handleToggleSpecial = (special: BananaThiefSpecial) => {
    const nextSpecials = selectedSpecials.includes(special)
      ? selectedSpecials.filter((s) => s !== special)
      : [...selectedSpecials, special];

    updateConfig({
      bananaThiefSelectedSpecials: nextSpecials,
      bananaThiefDlc: nextSpecials.length > 0,
    });
  };

  // Live calculation of required players
  const {
    min,
    followerCount: reqFollowers,
    specialsCount,
    plainMiceCount,
  } = getBananaThiefRequiredPlayerCount(room.config);

  const currentPlayers = room.players.length;
  const isEnoughPlayers = currentPlayers >= min;

  const followerOptions = [
    { value: '0', label: t('gameBananaThief.settingsFollowersNone') },
    { value: '1', label: t('gameBananaThief.settingsFollowersOne') },
    { value: '2', label: t('gameBananaThief.settingsFollowersTwo') },
  ];

  const narratorOptions = [
    { value: 'AUTO', label: t('gameBananaThief.settingsNarratorAuto') },
    { value: 'HOST', label: t('gameBananaThief.settingsNarratorHost') },
  ];

  const tickOptions = [
    { value: '3', label: t('gameBananaThief.settingsTickFast') },
    { value: '6', label: t('gameBananaThief.settingsTickNormal') },
    { value: '9', label: t('gameBananaThief.settingsTickSlow') },
    { value: '12', label: `12 ${t('lobby.seconds')}` },
    { value: '15', label: `15 ${t('lobby.seconds')}` },
  ];

  const discussionOptions = [
    { value: '60', label: t('gameBananaThief.settingsMin', { count: 1 }) },
    { value: '120', label: t('gameBananaThief.settingsMin', { count: 2 }) },
    { value: '180', label: t('gameBananaThief.settingsMin', { count: 3 }) },
    { value: '300', label: t('gameBananaThief.settingsMin', { count: 5 }) },
  ];

  const voteOptions = [
    { value: '15', label: `15 ${t('lobby.seconds')}` },
    { value: '30', label: `30 ${t('lobby.seconds')}` },
    { value: '45', label: `45 ${t('lobby.seconds')}` },
    { value: '60', label: `60 ${t('lobby.seconds')}` },
  ];

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
            {t('gameBananaThief.settingsMinPlayersRequired', { count: min })}
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
            🦹 {t('gameBananaThief.settingsBreakdownThief')}
          </span>
          {reqFollowers > 0 && (
            <span className="px-2 py-0.5 bg-purple-100 border border-black text-purple-900">
              🤝 {t('gameBananaThief.settingsBreakdownFollower', { count: reqFollowers })}
            </span>
          )}
          {specialsCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 border border-black text-blue-900">
              ⭐{' '}
              {t('gameBananaThief.settingsBreakdownSpecials', {
                count: specialsCount,
                roles: selectedSpecials
                  .map(
                    (s) => t(`gameBananaThief.role${s[0]}${s.slice(1).toLowerCase()}` as any) || s,
                  )
                  .join(', '),
              })}
            </span>
          )}
          <span className="px-2 py-0.5 bg-yellow-100 border border-black text-yellow-900">
            🐭 {t('gameBananaThief.settingsBreakdownInnocent', { count: plainMiceCount })}
          </span>
        </div>
      </div>

      {/* Follower Selection */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          🤝 {t('gameBananaThief.settingsFollowers')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            id="bananaThiefFollowerSelect"
            value={followerCount}
            options={followerOptions}
            onChange={(val) => handleFollowerChange(Number(val))}
            className="bg-white hover:bg-gray-100"
          />
        ) : (
          <div className="text-black font-black text-sm px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {followerOptions.find((opt) => opt.value === String(followerCount))?.label}
          </div>
        )}
        <p className="text-[10px] font-bold text-gray-600 mt-1">
          {t('gameBananaThief.settingsFollowersHint')}
        </p>
      </div>

      {/* Specials Multi-Select */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-black uppercase tracking-wider">
            ⭐ {t('gameBananaThief.settingsSpecialsSelect')}
          </label>
        </div>
        <p className="text-[10px] font-bold text-gray-600 mb-2">
          {t('gameBananaThief.settingsSpecialsHint')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SPECIAL_ROLES.map((role) => {
            const isSelected = selectedSpecials.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                disabled={!isHost}
                onClick={() => isHost && handleToggleSpecial(role.id)}
                className={`p-2.5 text-left border-2 border-black transition-all ${
                  !isHost ? 'cursor-default opacity-80' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'bg-amber-300 text-black shadow-[3px_3px_0_0_#000] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-white text-gray-800 hover:bg-gray-50 shadow-[1px_1px_0_0_#000]'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-black">{t(`gameBananaThief.${role.nameKey}`)}</span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 border border-black ${
                      isSelected ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    +{role.playersCount} คน
                  </span>
                </div>
                <div className="text-[10px] leading-tight font-medium text-gray-700">
                  {t(`rules.bananaThief.${role.descKey}`)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Narrator Settings */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          🎙️ {t('gameBananaThief.settingsNarrator')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            id="bananaThiefNarratorSelect"
            value={room.config.bananaThiefNarrator ?? 'AUTO'}
            options={narratorOptions}
            onChange={(val) =>
              updateConfig({
                bananaThiefNarrator: val as 'AUTO' | 'HOST',
              })
            }
            className="bg-white hover:bg-gray-100"
          />
        ) : (
          <div className="text-black font-black text-sm px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {narratorOptions.find((opt) => opt.value === (room.config.bananaThiefNarrator ?? 'AUTO'))?.label}
          </div>
        )}
      </div>

      {/* Night Tick Seconds */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          ⏱️ {t('gameBananaThief.settingsTick')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            id="bananaThiefTickSelect"
            value={String(room.config.bananaThiefTickSeconds ?? 6)}
            options={tickOptions}
            onChange={(val) => updateConfig({ bananaThiefTickSeconds: Number(val) })}
            className="bg-white hover:bg-gray-100"
          />
        ) : (
          <div className="text-black font-black text-sm px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {tickOptions.find((opt) => opt.value === String(room.config.bananaThiefTickSeconds ?? 6))?.label}
          </div>
        )}
      </div>

      {/* Discussion Seconds */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          💬 {t('gameBananaThief.settingsDiscussion')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            id="bananaThiefDiscussionSelect"
            value={String(room.config.bananaThiefDiscussionSeconds ?? 180)}
            options={discussionOptions}
            onChange={(val) => updateConfig({ bananaThiefDiscussionSeconds: Number(val) })}
            className="bg-white hover:bg-gray-100"
          />
        ) : (
          <div className="text-black font-black text-sm px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {discussionOptions.find((opt) => opt.value === String(room.config.bananaThiefDiscussionSeconds ?? 180))?.label}
          </div>
        )}
      </div>

      {/* Vote Seconds */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider mb-1">
          🗳️ {t('gameBananaThief.settingsVote')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            id="bananaThiefVoteSelect"
            value={String(room.config.bananaThiefVoteSeconds ?? 15)}
            options={voteOptions}
            onChange={(val) => updateConfig({ bananaThiefVoteSeconds: Number(val) })}
            className="bg-white hover:bg-gray-100"
          />
        ) : (
          <div className="text-black font-black text-sm px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {voteOptions.find((opt) => opt.value === String(room.config.bananaThiefVoteSeconds ?? 15))?.label}
          </div>
        )}
      </div>
    </div>
  );
}
