'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

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

  const hostSelectionOptions = [
    { value: 'ROUND_ROBIN', label: t('lobby.roundRobin') },
    { value: 'RANDOM', label: t('lobby.random') },
    { value: 'FIXED', label: t('lobby.roomCreatorFixed') },
  ];

  return (
    <>
      <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - mb-6">
        <label className="block text-black font-black uppercase tracking-widest mb-2 text-lg">
          {t('lobby.hostSelection')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            value={room.config?.hostSelection || 'ROUND_ROBIN'}
            options={hostSelectionOptions}
            onChange={(val) =>
              useGameStore.getState().updateConfig({
                hostSelection: val as 'ROUND_ROBIN' | 'RANDOM' | 'FIXED',
              })
            }
            className="bg-yellow-300"
          />
        ) : (
          <div className="bg-yellow-300 border-4 border-black px-4 py-3 text-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            {getHostSelectionLabel(room.config?.hostSelection)}
          </div>
        )}
      </div>
      <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <label className="block text-black font-black uppercase tracking-widest mb-2 text-lg">
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
            className="w-full bg-cyan-300 border-4 border-black px-4 py-3 text-black font-black focus:outline-none focus:bg-cyan-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          />
        ) : (
          <div className="bg-cyan-300 border-4 border-black px-4 py-3 text-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            {room.config?.timerMin || 5} {t('lobby.minutes')}
          </div>
        )}
      </div>
    </>
  );
}
