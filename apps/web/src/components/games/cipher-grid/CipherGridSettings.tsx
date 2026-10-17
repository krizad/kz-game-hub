'use client';
import { RoomStatus, type CipherGridMode, type CipherGridPicturePack } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function CipherGridSettings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();
  if (!room) return null;
  const isHost = room.roomHostId === socketId && room.status === RoomStatus.LOBBY;
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="font-black">{t('cipherGrid.mode')}</legend>
        <select
          data-testid="cipher-grid-mode"
          aria-label={t('cipherGrid.mode')}
          value={room.config.cipherGridMode ?? 'WORDS'}
          disabled={!isHost}
          onChange={(e) => updateConfig({ cipherGridMode: e.target.value as CipherGridMode })}
          className="w-full min-h-11 bg-white border-2 border-black p-2 font-bold disabled:opacity-60"
        >
          <option value="WORDS">{t('cipherGrid.wordsMode')}</option>
          <option value="PICTURES">{t('cipherGrid.picturesMode')}</option>
        </select>
        <p className="text-xs">{t('cipherGrid.modeHint')}</p>
      </fieldset>

      {room.config.cipherGridMode === 'PICTURES' && (
        <fieldset className="space-y-2">
          <legend className="font-black">{t('cipherGrid.pictureTheme')}</legend>
          <select
            data-testid="cipher-grid-picture-pack"
            aria-label={t('cipherGrid.pictureTheme')}
            value={room.config.cipherGridPicturePack ?? 'MINIMAL'}
            disabled={!isHost}
            onChange={(e) =>
              updateConfig({ cipherGridPicturePack: e.target.value as CipherGridPicturePack })
            }
            className="w-full min-h-11 bg-white border-2 border-black p-2 font-bold disabled:opacity-60"
          >
            <option value="MINIMAL">{t('cipherGrid.packMinimal')}</option>
            <option value="CLASSIC">{t('cipherGrid.packClassic')}</option>
          </select>
          <p className="text-xs">{t('cipherGrid.pictureThemeHint')}</p>
        </fieldset>
      )}
    </div>
  );
}
