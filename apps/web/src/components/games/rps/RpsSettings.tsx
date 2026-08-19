'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

export function RpsSettings() {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (room?.gameType !== 'RPS') return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  return (
    <>
      <div className="font-mono">
        <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
          {t('lobby.mode')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            value={room.config?.rpsMode || '1V1_ROUND_ROBIN'}
            options={[
              { value: '1V1_ROUND_ROBIN', label: t('lobby.oneVOneRoundRobin') },
              { value: 'ALL_AT_ONCE', label: t('lobby.allAtOnce') },
            ]}
            onChange={(val) => {
              useGameStore
                .getState()
                .updateConfig({ rpsMode: val as '1V1_ROUND_ROBIN' | 'ALL_AT_ONCE' });
            }}
            className="bg-cyan-300"
          />
        ) : (
          <div className="text-black font-bold px-3 py-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {room.config?.rpsMode === 'ALL_AT_ONCE'
              ? t('lobby.allAtOnce')
              : t('lobby.oneVOneRoundRobin')}
          </div>
        )}
      </div>

      <div className="font-mono">
        <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
          {t('lobby.targetScore')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            value={String(room.config?.rpsBestOf || 3)}
            options={[
              { value: '1', label: t('lobby.bo1') },
              { value: '3', label: t('lobby.bo3') },
              { value: '5', label: t('lobby.bo5') },
              { value: '7', label: t('lobby.bo7') },
            ]}
            onChange={(val) => {
              useGameStore.getState().updateConfig({ rpsBestOf: Number.parseInt(val, 10) });
            }}
            className="bg-pink-300"
          />
        ) : (
          <div className="text-black font-bold px-3 py-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            {t('lobby.bestOf')} {room.config?.rpsBestOf || 3}
          </div>
        )}
      </div>
    </>
  );
}
