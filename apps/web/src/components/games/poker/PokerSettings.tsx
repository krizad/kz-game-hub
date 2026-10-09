'use client';

import { GameType, PokerMode, RoomStatus } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

const MODES: PokerMode[] = ['ONLINE', 'CHIPS_LEDGER'];

/** Waiting-room config for POKER: mode, blinds/stack/ante and the turn timer. */
export function PokerSettings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();

  if (!room || room.gameType !== GameType.POKER || room.status !== RoomStatus.LOBBY) return null;

  const isHost = socketId === room.roomHostId;
  const disabled = !isHost;
  const mode = room.config.pokerMode ?? 'ONLINE';

  const numberClass =
    'w-24 border-4 border-black px-2 py-1 font-black text-sm bg-white focus:outline-none';

  const updateNumber = (
    key: 'pokerSmallBlind' | 'pokerBigBlind' | 'pokerStartingStack' | 'pokerAnte',
    value: number,
    min: number,
  ) => {
    if (!Number.isInteger(value) || value < min) return;
    updateConfig({ [key]: value });
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-3" data-testid="poker-settings">
      <h5 className="text-sm font-black uppercase tracking-widest text-center">
        {t('poker.modeTitle')}
      </h5>

      <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              data-testid={`poker-mode-${option}`}
              disabled={disabled}
              className={`px-3 py-1 border-4 border-black font-black uppercase text-xs transition-all ${
                mode === option
                  ? 'bg-lime-300 shadow-[2px_2px_0_0_#000]'
                  : 'bg-white hover:bg-amber-100'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => updateConfig({ pokerMode: option })}
            >
              {option === 'ONLINE' ? t('poker.modeOnline') : t('poker.modeLedger')}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold opacity-70">
          {mode === 'ONLINE' ? t('poker.modeHintOnline') : t('poker.modeHintLedger')}
        </p>
      </div>

      <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('poker.settingsSmallBlind')}
          <input
            type="number"
            data-testid="poker-sb"
            className={numberClass}
            min={1}
            disabled={disabled}
            value={room.config.pokerSmallBlind ?? 10}
            onChange={(e) => updateNumber('pokerSmallBlind', Number(e.target.value), 1)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('poker.settingsBigBlind')}
          <input
            type="number"
            data-testid="poker-bb"
            className={numberClass}
            min={1}
            disabled={disabled}
            value={room.config.pokerBigBlind ?? 20}
            onChange={(e) => updateNumber('pokerBigBlind', Number(e.target.value), 1)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('poker.settingsStack')}
          <input
            type="number"
            data-testid="poker-stack"
            className={numberClass}
            min={10}
            disabled={disabled}
            value={room.config.pokerStartingStack ?? 1000}
            onChange={(e) => updateNumber('pokerStartingStack', Number(e.target.value), 10)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('poker.settingsAnte')}
          <input
            type="number"
            data-testid="poker-ante"
            className={numberClass}
            min={0}
            disabled={disabled}
            value={room.config.pokerAnte ?? 0}
            onChange={(e) => updateNumber('pokerAnte', Number(e.target.value), 0)}
          />
        </label>
      </div>

      <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex items-center gap-3 flex-wrap">
        <button
          type="button"
          data-testid="poker-timer-toggle"
          disabled={disabled}
          className={`px-3 py-1 border-4 border-black font-black uppercase text-xs transition-all ${
            room.config.pokerTurnTimerEnabled !== false
              ? 'bg-lime-300 shadow-[2px_2px_0_0_#000]'
              : 'bg-white hover:bg-amber-100'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() =>
            updateConfig({ pokerTurnTimerEnabled: room.config.pokerTurnTimerEnabled === false })
          }
        >
          {t('poker.settingsTimer')}
        </button>
        <label className="flex items-center gap-2 text-xs font-black uppercase">
          {t('poker.settingsTimerSeconds')}
          <input
            type="number"
            data-testid="poker-timer-seconds"
            className={numberClass}
            min={5}
            max={300}
            disabled={disabled || room.config.pokerTurnTimerEnabled === false}
            value={room.config.pokerTurnTimerSeconds ?? 30}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isInteger(value) && value >= 5 && value <= 300) {
                updateConfig({ pokerTurnTimerSeconds: value });
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
