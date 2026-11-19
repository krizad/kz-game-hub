'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

interface TurnTimerSelectProps {
  /** RoomConfig field this select edits (e.g. 'rpsTurnSeconds'). */
  configKey:
    | 'ticTacToeTurnSeconds'
    | 'rpsTurnSeconds'
    | 'whoAmITurnSeconds'
    | 'soundsFishyTurnSeconds'
    | 'detectiveClubTurnSeconds';
}

const TIMER_OPTIONS = [0, 15, 30, 60, 90, 120];

/** Host-facing turn-timer length picker shared by the previously timerless games. */
export function TurnTimerSelect({ configKey }: TurnTimerSelectProps) {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (!room) return null;
  const isHost = useGameStore.getState().socketId === room.roomHostId;
  const current = room.config?.[configKey] ?? 0;

  const formatValue = (sec: number) =>
    sec === 0 ? t('lobby.turnTimerOff') : t('lobby.turnTimerSeconds', { seconds: sec });

  const options = TIMER_OPTIONS.map((sec) => ({
    value: String(sec),
    label: formatValue(sec),
  }));

  return (
    <div className="font-mono">
      <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
        {t('lobby.turnTimer')}
      </label>
      {isHost ? (
        <NeobrutalismSelect
          value={String(current)}
          options={options}
          onChange={(val) => {
            useGameStore.getState().updateConfig({ [configKey]: Number.parseInt(val, 10) });
          }}
          className="bg-slate-200"
        />
      ) : (
        <div className="text-black font-bold px-3 py-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {formatValue(current)}
        </div>
      )}
    </div>
  );
}
