'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function RpsSettings() {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (room?.gameType !== 'RPS') return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  return (
    <>
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('lobby.mode')}
        </label>
        {isHost ? (
          <select
            id="rpsModeSelect"
            name="rpsMode"
            title="RPS Mode"
            aria-label="RPS Mode"
            onChange={(e) => {
              useGameStore
                .getState()
                .updateConfig({ rpsMode: e.target.value as '1V1_ROUND_ROBIN' | 'ALL_AT_ONCE' });
            }}
            value={room.config?.rpsMode || '1V1_ROUND_ROBIN'}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value="1V1_ROUND_ROBIN">{t('lobby.oneVOneRoundRobin')}</option>
            <option value="ALL_AT_ONCE">{t('lobby.allAtOnce')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {room.config?.rpsMode === 'ALL_AT_ONCE'
              ? t('lobby.allAtOnce')
              : t('lobby.oneVOneRoundRobin')}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('lobby.targetScore')}
        </label>
        {isHost ? (
          <select
            id="rpsBestOfSelect"
            name="rpsBestOf"
            title="Best of Target Score"
            aria-label="Best of Target Score"
            value={room.config?.rpsBestOf || 3}
            onChange={(e) => {
              useGameStore
                .getState()
                .updateConfig({ rpsBestOf: Number.parseInt(e.target.value, 10) });
            }}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value={1}>{t('lobby.bo1')}</option>
            <option value={3}>{t('lobby.bo3')}</option>
            <option value={5}>{t('lobby.bo5')}</option>
            <option value={7}>{t('lobby.bo7')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {t('lobby.bestOf')} {room.config?.rpsBestOf || 3}
          </div>
        )}
      </div>
    </>
  );
}
