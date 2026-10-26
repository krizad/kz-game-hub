'use client';

import {
  getWerewolfRoleTable,
  WerewolfWolfCoordinationMode,
  WerewolfWolfRevealMode,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

/** Host-tunable Werewolf lobby settings (ADR 0015): modes, pacing, role toggles. */
export function WerewolfSettings() {
  const { room, socketId, updateConfig } = useGameStore();
  const { t } = useTranslate();
  if (!room) return null;

  const isHost = socketId === room.roomHostId;
  const seated = room.players.filter((p) => !p.isViewer && p.connected !== false).length;

  const reveal = room.config.werewolfWolfReveal ?? WerewolfWolfRevealMode.EYE_CONTACT;
  const coordination =
    room.config.werewolfWolfCoordination ?? WerewolfWolfCoordinationMode.SECRET_BALLOT;
  const witchEnabled = room.config.werewolfWitchEnabled !== false;
  const hunterEnabled = room.config.werewolfHunterEnabled !== false;

  const { wolves, roles } = getWerewolfRoleTable(seated, {
    witchEnabled,
    hunterEnabled,
  });
  const specials = roles.length - wolves - roles.filter((r) => r === 'VILLAGER').length;
  const villagers = roles.filter((r) => r === 'VILLAGER').length;

  const numberInput = (
    key: 'werewolfNightSeconds' | 'werewolfDiscussionSeconds' | 'werewolfVoteSeconds',
    value: number,
    min: number,
    max: number,
    labelKey: string,
  ) => (
    <label className="flex items-center justify-between gap-3 w-full">
      <span className="font-black text-sm">{t(labelKey)}</span>
      <input
        type="number"
        data-testid={`werewolf-setting-${key}`}
        min={min}
        max={max}
        disabled={!isHost}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next >= min && next <= max) {
            updateConfig({ [key]: next });
          }
        }}
        className="w-20 border-4 border-black px-2 py-1 font-black bg-white disabled:opacity-50"
      />
    </label>
  );

  return (
    <div
      data-testid="werewolf-settings"
      className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] w-full max-w-md flex flex-col gap-3"
    >
      <h3 className="font-black uppercase tracking-widest text-sm">
        {t('gameWerewolf.settingsTitle')}
      </h3>

      <NeobrutalismSelect
        id="werewolfRevealSelect"
        data-testid="werewolf-setting-reveal"
        value={reveal}
        disabled={!isHost}
        onChange={(value) => updateConfig({ werewolfWolfReveal: value as WerewolfWolfRevealMode })}
        options={[
          { value: WerewolfWolfRevealMode.EYE_CONTACT, label: t('gameWerewolf.settingsRevealEye') },
          {
            value: WerewolfWolfRevealMode.PRIVATE_ROSTER,
            label: t('gameWerewolf.settingsRevealRoster'),
          },
        ]}
      />

      <NeobrutalismSelect
        id="werewolfCoordinationSelect"
        data-testid="werewolf-setting-coordination"
        value={coordination}
        disabled={!isHost}
        onChange={(value) =>
          updateConfig({ werewolfWolfCoordination: value as WerewolfWolfCoordinationMode })
        }
        options={[
          {
            value: WerewolfWolfCoordinationMode.SECRET_BALLOT,
            label: t('gameWerewolf.settingsCoordBallot'),
          },
          {
            value: WerewolfWolfCoordinationMode.LIVE_TALLY,
            label: t('gameWerewolf.settingsCoordTally'),
          },
          {
            value: WerewolfWolfCoordinationMode.SILENT_CONSENSUS,
            label: t('gameWerewolf.settingsCoordConsensus'),
          },
        ]}
      />

      {numberInput(
        'werewolfNightSeconds',
        room.config.werewolfNightSeconds ?? 20,
        5,
        90,
        'gameWerewolf.settingsNightSeconds',
      )}
      {numberInput(
        'werewolfDiscussionSeconds',
        room.config.werewolfDiscussionSeconds ?? 180,
        30,
        600,
        'gameWerewolf.settingsDiscussionSeconds',
      )}
      {numberInput(
        'werewolfVoteSeconds',
        room.config.werewolfVoteSeconds ?? 60,
        15,
        180,
        'gameWerewolf.settingsVoteSeconds',
      )}

      <label className="flex items-center justify-between gap-3">
        <span className="font-black text-sm">
          🧪 {t('gameWerewolf.settingsWitch')}{' '}
          <span className="font-bold text-slate-500">(8+)</span>
        </span>
        <input
          type="checkbox"
          data-testid="werewolf-setting-witch"
          disabled={!isHost}
          checked={witchEnabled}
          onChange={(event) => updateConfig({ werewolfWitchEnabled: event.target.checked })}
          className="w-6 h-6 accent-black disabled:opacity-50"
        />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span className="font-black text-sm">
          🏹 {t('gameWerewolf.settingsHunter')}{' '}
          <span className="font-bold text-slate-500">(9+)</span>
        </span>
        <input
          type="checkbox"
          data-testid="werewolf-setting-hunter"
          disabled={!isHost}
          checked={hunterEnabled}
          onChange={(event) => updateConfig({ werewolfHunterEnabled: event.target.checked })}
          className="w-6 h-6 accent-black disabled:opacity-50"
        />
      </label>

      <p
        data-testid="werewolf-composition"
        className="text-xs font-black bg-yellow-200 border-2 border-black px-2 py-1 text-center"
      >
        {t('gameWerewolf.settingsComposition', {
          wolves,
          specials,
          villagers,
        })}
      </p>
      {!isHost && (
        <p className="text-[10px] font-bold text-slate-500 text-center">
          {t('gameWerewolf.settingsHostOnly')}
        </p>
      )}
    </div>
  );
}
