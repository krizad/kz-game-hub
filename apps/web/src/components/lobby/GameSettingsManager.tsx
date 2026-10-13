'use client';

import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

import { WhoKnowSettings } from '@/components/games/who-know/WhoKnowSettings';
import { RpsSettings } from '@/components/games/rps/RpsSettings';
import { WhoAmISettings } from '@/components/games/who-am-i/WhoAmISettings';
import { MusicTriviaSettings } from '@/components/games/music-trivia/MusicTriviaSettings';
import { SaboteurSettings } from '@/components/games/saboteur/SaboteurSettings';
import { BananaThiefSettings } from '@/components/games/banana-thief/BananaThiefSettings';

export function GameSettingsManager() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();

  if (!room) return null;

  const hasSettings =
    room.gameType === GameType.WHO_KNOW ||
    room.gameType === GameType.RPS ||
    room.gameType === GameType.WHO_AM_I ||
    room.gameType === GameType.MUSIC_TRIVIA ||
    room.gameType === GameType.SABOTEUR ||
    room.gameType === GameType.BANANA_THIEF;

  const isHost = room.roomHostId === socketId;
  const visibility = room.config.visibility ?? 'PUBLIC';
  const allowSpectators = room.config.allowSpectators ?? true;

  return (
    <div className="w-full max-w-sm bg-amber-50 border border-amber-200 p-4 space-y-4">
      <fieldset className="space-y-2">
        <legend className="font-bold text-sm text-slate-900">{t('lobby.roomVisibility')}</legend>
        <div className="flex flex-wrap gap-2">
          {(['UNLISTED', 'PUBLIC'] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={!isHost}
              aria-pressed={visibility === option}
              onClick={() => updateConfig({ visibility: option })}
              className={`px-3 py-2 border-2 border-black font-bold text-sm disabled:cursor-not-allowed ${
                visibility === option ? 'bg-indigo-300' : 'bg-white'
              }`}
            >
              {t(option === 'UNLISTED' ? 'lobby.unlistedRoom' : 'lobby.publicRoom')}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-700">{t('lobby.visibilityHint')}</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-bold text-sm text-slate-900">{t('lobby.spectatorPolicy')}</legend>
        <div className="flex flex-wrap gap-2">
          {([false, true] as const).map((allowed) => (
            <button
              key={String(allowed)}
              type="button"
              disabled={!isHost}
              aria-pressed={allowSpectators === allowed}
              onClick={() => updateConfig({ allowSpectators: allowed })}
              className={`px-3 py-2 border-2 border-black font-bold text-sm disabled:cursor-not-allowed ${
                allowSpectators === allowed ? 'bg-indigo-300' : 'bg-white'
              }`}
            >
              {t(allowed ? 'lobby.spectatorsAllowed' : 'lobby.spectatorsDisabled')}
            </button>
          ))}
        </div>
      </fieldset>
      {hasSettings && (
        <div className="space-y-4 border-t border-amber-300 pt-4">
          {room.gameType === GameType.WHO_KNOW && <WhoKnowSettings />}
          {room.gameType === GameType.RPS && <RpsSettings />}
          {room.gameType === GameType.WHO_AM_I && <WhoAmISettings />}
          {room.gameType === GameType.MUSIC_TRIVIA && <MusicTriviaSettings />}
          {room.gameType === GameType.SABOTEUR && <SaboteurSettings />}
          {room.gameType === GameType.BANANA_THIEF && <BananaThiefSettings />}
        </div>
      )}
    </div>
  );
}
