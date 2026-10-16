'use client';

import { RoomStatus, type DogRelayLeaderSelection } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function DogRelaySettings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();
  if (!room) return null;
  return (
    <div className="space-y-2">
      <label htmlFor="dog-relay-leader-selection" className="block font-bold">
        {t('dogRelay.leaderSelection')}
      </label>
      <select
        id="dog-relay-leader-selection"
        data-testid="dog-relay-leader-selection"
        value={room.config.dogRelayLeaderSelection ?? 'RANDOM'}
        disabled={room.roomHostId !== socketId || room.status !== RoomStatus.LOBBY}
        onChange={(event) =>
          updateConfig({ dogRelayLeaderSelection: event.target.value as DogRelayLeaderSelection })
        }
        className="w-full min-h-11 border-2 border-black bg-white p-2 font-bold text-black disabled:opacity-60"
      >
        <option value="RANDOM">{t('dogRelay.leaderRandom')}</option>
        <option value="ROUND_ROBIN">{t('dogRelay.leaderRoundRobin')}</option>
      </select>
      <p className="text-sm">{t('dogRelay.leaderSelectionHint')}</p>
    </div>
  );
}
