'use client';

import { GameType, RoomStatus } from '@repo/types';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

const TIMER_OPTIONS = [0, 20, 30, 45, 60] as const;

export function ThirtyOneSettings() {
  const { room, socketId, updateConfig } = useGameStore(
    useShallow((s) => ({
      room: s.room,
      socketId: s.socketId,
      updateConfig: s.updateConfig,
    })),
  );
  const { t } = useTranslate();

  if (!room || room.gameType !== GameType.THIRTY_ONE || room.status !== RoomStatus.LOBBY) {
    return null;
  }

  const isHost = socketId === room.roomHostId;
  const currentTimer = room.config.thirtyOneTurnSeconds ?? 0;

  return (
    <div
      className="flex w-full max-w-md flex-col gap-3 rounded-xl border-4 border-black bg-[#FDE68A] p-4 shadow-[4px_4px_0_0_#000]"
      data-testid="thirty-one-settings"
    >
      <div className="text-center">
        <h5 className="text-sm font-black uppercase tracking-widest text-black">
          🃏 {t('lobby.gameNames.thirtyOne')}
        </h5>
        <p className="mt-1 text-xs font-bold text-slate-700">{t('thirtyOne.lobbyHint')}</p>
      </div>

      <div className="flex flex-col gap-2 border-2 border-black bg-white p-3 shadow-[2px_2px_0_0_#000]">
        <span className="text-xs font-black uppercase text-black">
          ⏱️ {t('thirtyOne.settingsTurnTimer')}
        </span>
        <div className="flex flex-wrap gap-2">
          {TIMER_OPTIONS.map((sec) => {
            const active = currentTimer === sec;
            return (
              <button
                key={sec}
                type="button"
                disabled={!isHost}
                data-testid={`thirty-one-timer-${sec}`}
                onClick={() => updateConfig({ thirtyOneTurnSeconds: sec })}
                className={`border-2 border-black px-3 py-1.5 text-xs font-black transition-all shadow-[2px_2px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-60 ${
                  active ? 'bg-[#A3E635] text-black' : 'bg-white text-black hover:bg-amber-100'
                }`}
              >
                {sec === 0 ? t('thirtyOne.timerOff') : t('thirtyOne.timerSeconds', { sec })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
