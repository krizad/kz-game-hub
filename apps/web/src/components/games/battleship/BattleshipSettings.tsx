'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';
import { BattleshipMode, BattleshipTeamFleetMode, BattleshipGridPreset } from '@repo/types';

export function BattleshipSettings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();
  if (!room) return null;

  const isHost = socketId === room.roomHostId;
  const mode = (room.config.battleshipMode as BattleshipMode) ?? 'FREE_FOR_ALL';
  const fleetMode =
    (room.config.battleshipTeamFleetMode as BattleshipTeamFleetMode) ?? 'SHARED_BOARD';
  const preset = (room.config.battleshipGridPreset as BattleshipGridPreset) ?? 'CLASSIC_10x10';
  const hitStreak = room.config.battleshipHitStreak ?? true;
  const turnSeconds = room.config.battleshipTurnSeconds ?? 20;

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#7dd3fc] border-4 border-black shadow-[4px_4px_0_0_#000] rounded-xl">
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
          ⚓ {t('battleship.settingsTitle')}
        </h3>
        {!isHost && (
          <span className="text-xs font-bold text-slate-700 bg-white/70 px-2 py-0.5 border border-black rounded">
            {t('battleship.settingsHostOnly')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Game Mode */}
        <div className="flex flex-col gap-1.5">
          <label className="font-black text-sm text-slate-900">{t('battleship.mode')}</label>
          <NeobrutalismSelect
            value={mode}
            disabled={!isHost}
            onChange={(val) => updateConfig({ battleshipMode: val as BattleshipMode })}
            options={[
              { value: 'FREE_FOR_ALL', label: t('battleship.ffaMode') },
              { value: 'TEAM_VS_TEAM', label: t('battleship.teamMode') },
            ]}
          />
        </div>

        {/* Fleet Architecture (Only if Team vs Team) */}
        {mode === 'TEAM_VS_TEAM' && (
          <div className="flex flex-col gap-1.5">
            <label className="font-black text-sm text-slate-900">{t('battleship.teamMode')}</label>
            <NeobrutalismSelect
              value={fleetMode}
              disabled={!isHost}
              onChange={(val) =>
                updateConfig({ battleshipTeamFleetMode: val as BattleshipTeamFleetMode })
              }
              options={[
                { value: 'SHARED_BOARD', label: t('battleship.sharedBoard') },
                { value: 'MULTI_BOARD', label: t('battleship.multiBoard') },
              ]}
            />
          </div>
        )}

        {/* Grid Preset */}
        <div className="flex flex-col gap-1.5">
          <label className="font-black text-sm text-slate-900">{t('battleship.gridPreset')}</label>
          <NeobrutalismSelect
            value={preset}
            disabled={!isHost}
            onChange={(val) => updateConfig({ battleshipGridPreset: val as BattleshipGridPreset })}
            options={[
              { value: 'CLASSIC_10x10', label: t('battleship.classic10') },
              { value: 'QUICK_8x8', label: t('battleship.quick8') },
            ]}
          />
        </div>

        {/* Turn Countdown */}
        <div className="flex flex-col gap-1.5">
          <label className="font-black text-sm text-slate-900 flex justify-between">
            <span>{t('battleship.turnSeconds')}</span>
            <span className="font-mono">{turnSeconds}s</span>
          </label>
          <input
            type="number"
            min={5}
            max={120}
            disabled={!isHost}
            value={turnSeconds}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (Number.isInteger(val) && val >= 5 && val <= 120) {
                updateConfig({ battleshipTurnSeconds: val });
              }
            }}
            className="border-4 border-black px-3 py-2 font-black bg-white rounded shadow-[2px_2px_0_0_#000] disabled:opacity-50"
          />
        </div>

        {/* Hit Streak (Only in sequential modes) */}
        {mode === 'TEAM_VS_TEAM' && (
          <div className="sm:col-span-2 flex items-center justify-between p-3 bg-white border-3 border-black rounded-lg">
            <span className="font-black text-sm text-slate-900">{t('battleship.hitStreak')}</span>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={hitStreak}
              onChange={(e) => updateConfig({ battleshipHitStreak: e.target.checked })}
              className="w-6 h-6 border-2 border-black accent-blue-600 rounded cursor-pointer disabled:opacity-50"
            />
          </div>
        )}
      </div>
    </div>
  );
}
