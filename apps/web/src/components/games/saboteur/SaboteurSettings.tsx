'use client';

import clsx from 'clsx';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

const TIMER_OPTIONS = [
  { value: '30', label: '30s' },
  { value: '60', label: '60s' },
  { value: '90', label: '90s' },
  { value: '120', label: '120s' },
];

export function SaboteurSettings() {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (room?.gameType !== 'SABOTEUR') return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;
  const enabled = room.config?.saboteurTurnTimerEnabled ?? false;

  const setEnabled = (value: boolean) => {
    useGameStore
      .getState()
      .updateConfig({ saboteurTurnTimerEnabled: value, saboteurTurnTimerSeconds: 60 });
  };

  const setSeconds = (seconds: number) => {
    useGameStore.getState().updateConfig({ saboteurTurnTimerSeconds: seconds });
  };

  return (
    <>
      <div className="font-mono">
        <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
          {t('gameSaboteur.turnTimer')}
        </label>
        {isHost ? (
          <div className="flex gap-2">
            {[true, false].map((option) => (
              <button
                key={String(option)}
                onClick={() => setEnabled(option)}
                className={clsx(
                  'flex-1 border-4 border-black py-2 text-sm font-black transition-all',
                  enabled === option
                    ? option
                      ? 'bg-lime-300'
                      : 'bg-red-300'
                    : 'bg-white hover:bg-gray-100',
                  'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
                )}
              >
                {option ? t('gameSaboteur.timerOn') : t('gameSaboteur.timerOff')}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-black font-bold px-3 py-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {enabled ? t('gameSaboteur.timerOn') : t('gameSaboteur.timerOff')}
          </div>
        )}
      </div>

      {enabled && (
        <div className="font-mono">
          <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
            {t('gameSaboteur.secondsPerTurn')}
          </label>
          {isHost ? (
            <div className="flex gap-2 flex-wrap">
              {TIMER_OPTIONS.map((opt) => {
                const active = (room.config?.saboteurTurnTimerSeconds ?? 60) === Number(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSeconds(Number(opt.value))}
                    className={clsx(
                      'flex-1 border-4 border-black py-2 text-sm font-black min-w-14 transition-all',
                      active ? 'bg-sky-300' : 'bg-white hover:bg-gray-100',
                      'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-black font-bold px-3 py-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {room.config?.saboteurTurnTimerSeconds ?? 60}s
            </div>
          )}
        </div>
      )}
    </>
  );
}
