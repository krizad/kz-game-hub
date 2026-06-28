'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function WhoKnowSettings() {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (room?.gameType !== 'WHO_KNOW') return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  const getHostSelectionLabel = (selection: string | undefined) => {
    switch (selection) {
      case 'RANDOM':
        return t('lobby.random');
      case 'FIXED':
        return t('lobby.roomCreatorFixed');
      case 'ROUND_ROBIN':
      default:
        return t('lobby.roundRobin');
    }
  };

  return (
    <>
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('lobby.hostSelection')}
        </label>
        {isHost ? (
          <select
            id="hostSelectionSelect"
            name="hostSelection"
            title="Host Selection"
            aria-label="Host Selection"
            value={room.config?.hostSelection || 'ROUND_ROBIN'}
            onChange={(e) =>
              useGameStore
                .getState()
                .updateConfig({
                  hostSelection: e.target.value as 'ROUND_ROBIN' | 'RANDOM' | 'FIXED',
                })
            }
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value="ROUND_ROBIN">{t('lobby.roundRobin')}</option>
            <option value="RANDOM">{t('lobby.random')}</option>
            <option value="FIXED">{t('lobby.roomCreatorFixed')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {getHostSelectionLabel(room.config?.hostSelection)}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('lobby.timerMinutes')}
        </label>
        {isHost ? (
          <input
            id="timerMinInput"
            name="timerMin"
            title="Timer Minutes"
            aria-label="Timer Minutes"
            autoComplete="off"
            type="number"
            min="1"
            max="10"
            value={room.config?.timerMin === undefined ? 5 : room.config?.timerMin}
            onChange={(e) => {
              const val = e.target.value;
              useGameStore.getState().updateConfig({
                timerMin: val === '' ? undefined : Number.parseInt(val, 10),
              });
            }}
            onBlur={() => {
              if (!room.config?.timerMin) {
                useGameStore.getState().updateConfig({ timerMin: 5 });
              }
            }}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
          />
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {room.config?.timerMin || 5} {t('lobby.minutes')}
          </div>
        )}
      </div>
    </>
  );
}
