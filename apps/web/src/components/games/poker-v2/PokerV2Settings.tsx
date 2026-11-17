'use client';

import { GameType, RoomStatus } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

/** Waiting-room config for POKER_V2: blinds/stack/ante, turn timer, auto-deal. */
export function PokerV2Settings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();

  if (!room || room.gameType !== GameType.POKER_V2 || room.status !== RoomStatus.LOBBY) return null;

  const disabled = socketId !== room.roomHostId;
  const numberClass =
    'w-24 border-4 border-black px-2 py-1 font-black text-sm bg-white focus:outline-none';

  const updateNumber = (
    key:
      | 'pokerV2SmallBlind'
      | 'pokerV2BigBlind'
      | 'pokerV2StartingStack'
      | 'pokerV2Ante'
      | 'pokerV2TurnTimerSeconds'
      | 'pokerV2AutoDealSeconds',
    value: number,
    min: number,
  ) => {
    if (!Number.isInteger(value) || value < min) return;
    updateConfig({ [key]: value });
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3" data-testid="poker-v2-settings">
      <h5 className="text-center text-sm font-black uppercase tracking-widest">
        {t('lobby.gameNames.pokerV2')}
      </h5>
      <p className="text-center text-xs font-bold opacity-70">{t('pokerV2.lobbyHint')}</p>

      <div className="grid grid-cols-2 gap-3 border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]">
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('pokerV2.settingsSmallBlind')}
          <input
            type="number"
            data-testid="poker-v2-sb"
            className={numberClass}
            min={1}
            disabled={disabled}
            value={room.config.pokerV2SmallBlind ?? 10}
            onChange={(e) => updateNumber('pokerV2SmallBlind', Number(e.target.value), 1)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('pokerV2.settingsBigBlind')}
          <input
            type="number"
            data-testid="poker-v2-bb"
            className={numberClass}
            min={1}
            disabled={disabled}
            value={room.config.pokerV2BigBlind ?? 20}
            onChange={(e) => updateNumber('pokerV2BigBlind', Number(e.target.value), 1)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('pokerV2.settingsStack')}
          <input
            type="number"
            data-testid="poker-v2-stack"
            className={numberClass}
            min={10}
            disabled={disabled}
            value={room.config.pokerV2StartingStack ?? 1000}
            onChange={(e) => updateNumber('pokerV2StartingStack', Number(e.target.value), 10)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('pokerV2.settingsAnte')}
          <input
            type="number"
            data-testid="poker-v2-ante"
            className={numberClass}
            min={0}
            disabled={disabled}
            value={room.config.pokerV2Ante ?? 0}
            onChange={(e) => updateNumber('pokerV2Ante', Number(e.target.value), 0)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('pokerV2.settingsTimerSeconds')}
          <input
            type="number"
            data-testid="poker-v2-timer"
            className={numberClass}
            min={5}
            max={300}
            disabled={disabled}
            value={room.config.pokerV2TurnTimerSeconds ?? 20}
            onChange={(e) => updateNumber('pokerV2TurnTimerSeconds', Number(e.target.value), 5)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-black uppercase">
          {t('pokerV2.settingsAutoDealSeconds')}
          <input
            type="number"
            data-testid="poker-v2-autodeal"
            className={numberClass}
            min={3}
            max={30}
            disabled={disabled}
            value={room.config.pokerV2AutoDealSeconds ?? 5}
            onChange={(e) => updateNumber('pokerV2AutoDealSeconds', Number(e.target.value), 3)}
          />
        </label>
      </div>
    </div>
  );
}
