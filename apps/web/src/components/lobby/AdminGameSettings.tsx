'use client';

import { useEffect, useState } from 'react';
import { GameType, TttModeFlag } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

/** Flags, in lobby order. TTT mode flags gate individual modes, not whole games. */
const ALL_FLAGS: { type: GameType | TttModeFlag; labelKey: string }[] = [
  { type: GameType.WHO_KNOW, labelKey: 'rules.modal.tabs.whoKnow' },
  { type: GameType.SOUNDS_FISHY, labelKey: 'rules.modal.tabs.soundsFishy' },
  { type: GameType.TIC_TAC_TOE, labelKey: 'rules.modal.tabs.ticTacToe' },
  { type: 'GOBBLER_MODE', labelKey: 'adminSettings.gobblerMode' },
  { type: 'ULTIMATE_MODE', labelKey: 'adminSettings.ultimateMode' },
  { type: GameType.RPS, labelKey: 'rules.modal.tabs.handDuel' },
  { type: GameType.DETECTIVE_CLUB, labelKey: 'rules.modal.tabs.detectiveClub' },
  { type: GameType.WHO_AM_I, labelKey: 'rules.modal.tabs.whoAmI' },
  { type: GameType.WHO_FIRST, labelKey: 'rules.modal.tabs.whoFirst' },
  { type: GameType.MUSIC_TRIVIA, labelKey: 'rules.modal.tabs.musicTrivia' },
  { type: GameType.THE_MIND, labelKey: 'rules.modal.tabs.theMind' },
  { type: GameType.SABOTEUR, labelKey: 'rules.modal.tabs.saboteur' },
  { type: GameType.COUP, labelKey: 'rules.modal.tabs.coup' },
  { type: GameType.CARD_GAME, labelKey: 'rules.modal.tabs.pokDeng' },
];

interface AdminGameSettingsProps {
  triggerClassName?: string;
}

/**
 * Admin panel for per-game enable/disable flags. The key stays in component
 * state (never persisted); the server re-validates it on every toggle via
 * ADMIN_SECRET.
 */
export function AdminGameSettings({ triggerClassName }: AdminGameSettingsProps) {
  const [open, setOpen] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const { t } = useTranslate();
  const {
    gameSettings,
    setGameEnabled,
    artistPresets,
    getArtistPresets,
    setArtistEnabled,
    deleteArtist,
  } = useGameStore();

  const isEnabled = (flag: GameType | TttModeFlag) => gameSettings[flag] ?? true;

  // Once unlocked, fetch the full artist list (incl. disabled) with the key.
  useEffect(() => {
    if (unlocked) getArtistPresets(adminKey);
  }, [unlocked]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={triggerClassName}
        title={t('adminSettings.title')}
        data-testid="admin-settings-button"
      >
        <span className="text-base leading-none">⚙️</span>
        <span className="hidden sm:inline">{t('adminSettings.button')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b-4 border-black flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black text-black uppercase tracking-widest">
                ⚙️ {t('adminSettings.title')}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-700 hover:bg-amber-100 p-2 rounded-full transition-colors"
                aria-label="Close admin settings"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              {!unlocked ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (adminKey.trim()) setUnlocked(true);
                  }}
                >
                  <label className="text-xs font-black uppercase text-black" htmlFor="adminKey">
                    {t('adminSettings.keyLabel')}
                  </label>
                  <input
                    id="adminKey"
                    type="password"
                    autoComplete="off"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="w-full bg-white border-4 border-black px-3 py-2 text-black focus:outline-none focus:ring-4 focus:ring-[#8B5CF6] font-black"
                    placeholder={t('adminSettings.keyPlaceholder')}
                    data-testid="admin-key-input"
                  />
                  <button
                    type="submit"
                    disabled={!adminKey.trim()}
                    className="bg-[#A855F7] hover:bg-[#9333EA] disabled:bg-gray-400 text-white font-black px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000] transition-all uppercase tracking-widest"
                    data-testid="admin-unlock"
                  >
                    {t('adminSettings.unlock')}
                  </button>
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                    {t('adminSettings.hint')}
                  </p>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <ul className="flex flex-col gap-2">
                    {ALL_FLAGS.map(({ type, labelKey }) => (
                      <li key={type}>
                        <label className="flex items-center justify-between gap-3 bg-white border-2 border-black px-3 py-2 cursor-pointer hover:bg-amber-50 transition-colors">
                          <span className="text-sm font-black text-black uppercase">
                            {t(labelKey)}
                          </span>
                          <input
                            type="checkbox"
                            checked={isEnabled(type)}
                            onChange={(e) => setGameEnabled(type, e.target.checked, adminKey)}
                            className="w-5 h-5 accent-[#A855F7]"
                            data-testid={`admin-game-toggle-${type}`}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">
                      🎤 {t('adminSettings.artistsTitle')}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 mb-2">
                      {t('adminSettings.artistsHint')}
                    </p>
                    {artistPresets.length === 0 ? (
                      <p className="text-xs font-bold text-black bg-yellow-300 border-2 border-black px-2 py-1 inline-block">
                        {t('adminSettings.artistsEmpty')}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {artistPresets.map((artist) => (
                          <li key={artist.id}>
                            <div className="flex items-center justify-between gap-2 bg-white border-2 border-black px-3 py-2">
                              <label className="flex items-center gap-2 cursor-pointer grow">
                                <input
                                  type="checkbox"
                                  checked={artist.enabled}
                                  onChange={(e) =>
                                    setArtistEnabled(artist.id, e.target.checked, adminKey)
                                  }
                                  className="w-5 h-5 accent-[#A855F7]"
                                  data-testid={`admin-artist-toggle-${artist.name}`}
                                />
                                <span className="text-sm font-black text-black truncate">
                                  {artist.name}
                                </span>
                              </label>
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                {t('adminSettings.artistTrackCount', {
                                  total: artist.trackCounts.total,
                                })}
                              </span>
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      t('adminSettings.artistDeleteConfirm', { name: artist.name }),
                                    )
                                  ) {
                                    deleteArtist(artist.id, adminKey);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-100 border-2 border-black px-2 py-1 text-xs font-black uppercase transition-colors shrink-0"
                                data-testid={`admin-artist-delete-${artist.name}`}
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
