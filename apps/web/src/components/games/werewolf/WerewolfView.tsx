'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GameType,
  RoomStatus,
  WerewolfNightActionKind,
  WerewolfNightSlot,
  WerewolfPhase,
  WerewolfPrivateState,
  WerewolfRole,
  WerewolfState,
  WerewolfVision,
  WerewolfWolfRevealMode,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { useServerClock } from '@/hooks/useServerClock';
import { useGameFeel } from '@/hooks/useGameFeel';
import { audioManager } from '@/lib/audioManager';
import { CountdownBadge } from '@/components/core/CountdownBadge';
import { WerewolfNarrator } from './WerewolfNarrator';

const roleEmoji: Record<WerewolfRole, string> = {
  [WerewolfRole.WEREWOLF]: '🐺',
  [WerewolfRole.VILLAGER]: '👨‍🌾',
  [WerewolfRole.SEER]: '🔮',
  [WerewolfRole.DOCTOR]: '💉',
  [WerewolfRole.WITCH]: '🧪',
  [WerewolfRole.HUNTER]: '🏹',
};

const roleKey: Record<WerewolfRole, string> = {
  [WerewolfRole.WEREWOLF]: 'gameWerewolf.roleWerewolf',
  [WerewolfRole.VILLAGER]: 'gameWerewolf.roleVillager',
  [WerewolfRole.SEER]: 'gameWerewolf.roleSeer',
  [WerewolfRole.DOCTOR]: 'gameWerewolf.roleDoctor',
  [WerewolfRole.WITCH]: 'gameWerewolf.roleWitch',
  [WerewolfRole.HUNTER]: 'gameWerewolf.roleHunter',
};

const slotKey: Record<WerewolfNightSlot, string> = {
  WOLVES: 'gameWerewolf.slotWolves',
  SEER: 'gameWerewolf.slotSeer',
  DOCTOR: 'gameWerewolf.slotDoctor',
  WITCH: 'gameWerewolf.slotWitch',
  HUNTER_SHOT: 'gameWerewolf.slotHunterShot',
};

function PlayerTargetButton({
  id,
  name,
  disabled,
  selected,
  onClick,
  testid,
}: {
  id: string;
  name: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button
      key={id}
      data-testid={testid ?? 'werewolf-target-btn'}
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-2 border-4 border-black font-black shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base ${
        selected ? 'bg-yellow-300' : 'bg-white hover:bg-yellow-100'
      }`}
    >
      {name}
    </button>
  );
}

export function WerewolfView() {
  const { room, socketId, privateState, resetRoom } = useGameStore();
  const { t, language } = useTranslate();
  const { serverOffset } = useServerClock();
  const { shake, flash, celebrate } = useGameFeel();
  const prevPhaseRef = useRef<WerewolfPhase | undefined>(undefined);
  const werewolfNightAction = useGameStore((s) => s.werewolfNightAction);
  const werewolfDayVote = useGameStore((s) => s.werewolfDayVote);
  const werewolfSkipDiscussion = useGameStore((s) => s.werewolfSkipDiscussion);
  const [showNarrator, setShowNarrator] = useState(false);

  const state = room?.werewolfState as WerewolfState | undefined;

  useEffect(() => {
    if (!state) return;
    if (prevPhaseRef.current === state.phase) return;
    prevPhaseRef.current = state.phase;

    if (state.phase === WerewolfPhase.DAY_DISCUSSION && (state.dawn?.deaths.length ?? 0) > 0) {
      shake(0.45);
      flash('red', 350);
    } else if (state.phase === WerewolfPhase.DAY_RESULT && state.voteResult?.lynchedPlayerId) {
      shake(0.5);
      flash('red', 350);
    } else if (state.phase === WerewolfPhase.GAME_OVER) {
      audioManager.playSuccessChime();
      celebrate({ particleCount: 70, spread: 70 });
      flash('gold', 400);
    }
  }, [state, shake, flash, celebrate]);
  const me = useMemo(() => room?.players.find((p) => p.socketId === socketId), [room, socketId]);
  const isHost = room?.roomHostId === socketId;
  const isSpectator = me?.isViewer === true;

  const role = (privateState?.wwRole as WerewolfRole | undefined) ?? undefined;
  const night = (privateState?.wwNight ?? null) as WerewolfPrivateState['night'];
  const wolves = (privateState?.wwWolves ?? null) as string[] | null;
  const tally = (privateState?.wwTally ?? null) as Record<string, string> | null;
  const visions = (privateState?.wwVisions ?? null) as WerewolfVision[] | null;
  const myDayVote = (privateState?.wwDayVote ?? null) as string | null;

  if (!room || !state || room.gameType !== GameType.WEREWOLF) return null;
  if (room.status === RoomStatus.LOBBY) return null;

  const myView = state.players[socketId];
  const dead = myView ? !myView.alive : false;
  const isNight = state.phase === WerewolfPhase.NIGHT;
  const currentSlot = isNight ? state.nightSlots[state.nightSlotIndex] : null;

  const playerName = (key: string) => room.players.find((p) => p.socketId === key)?.name ?? '?';

  /** My wake prompt is live when it matches the running slot. */
  const promptLive =
    !!night &&
    isNight &&
    !state.paused &&
    ((night.kind === WerewolfNightActionKind.KILL && currentSlot === 'WOLVES') ||
      (night.kind === WerewolfNightActionKind.CHECK && currentSlot === 'SEER') ||
      (night.kind === WerewolfNightActionKind.HEAL &&
        (currentSlot === 'DOCTOR' || currentSlot === 'WITCH')) ||
      (night.kind === WerewolfNightActionKind.SHOT &&
        (currentSlot === 'HUNTER_SHOT' || state.phase === WerewolfPhase.DAY_HUNTER_SHOT)));

  const livingTargets = Object.keys(state.players)
    .filter((key) => state.players[key].alive)
    .map((key) => ({ id: key, name: playerName(key) }));

  const renderNight = () => {
    const isWolf = role === WerewolfRole.WEREWOLF;
    const revealMode = room.config.werewolfWolfReveal ?? WerewolfWolfRevealMode.EYE_CONTACT;

    return (
      <div data-testid="werewolf-night-screen" className="flex flex-col gap-4">
        {/* Public night schedule (fixed order, no activity hints) */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {state.nightSlots.map((slot, index) => (
            <span
              key={slot}
              className={`px-2 py-1 text-[10px] sm:text-xs font-black border-2 border-black ${
                index === state.nightSlotIndex
                  ? 'bg-indigo-900 text-white'
                  : index < state.nightSlotIndex
                    ? 'bg-slate-200 text-slate-500 line-through'
                    : 'bg-white text-black'
              }`}
            >
              {t(slotKey[slot])}
            </span>
          ))}
        </div>

        {state.paused && (
          <div className="bg-yellow-300 border-4 border-black p-3 text-center font-black shadow-[4px_4px_0_0_#000]">
            ⏸ {t('gameWerewolf.paused')}
          </div>
        )}

        {isWolf && wolves && wolves.length > 0 && (
          <div className="bg-red-100 border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
            <p className="font-black text-sm">🐺 {t('gameWerewolf.wolfRosterTitle')}</p>
            <p className="text-sm font-bold">
              {wolves.filter((name) => name !== me?.name).join(', ')}
            </p>
          </div>
        )}
        {isWolf && revealMode === WerewolfWolfRevealMode.EYE_CONTACT && wolves == null && (
          <div className="bg-red-100 border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
            <p className="text-sm font-bold">👀 {t('gameWerewolf.eyeContactNote')}</p>
          </div>
        )}

        {promptLive && night ? (
          <div
            data-testid="werewolf-night-action-area"
            className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-lg">
                {roleEmoji[role ?? WerewolfRole.VILLAGER]}{' '}
                {t(`gameWerewolf.actionTitle.${night.kind.toLowerCase()}`)}
              </h3>
              <CountdownBadge
                deadline={state.phaseEndsAt}
                serverOffset={serverOffset}
                format="seconds"
                className="font-black text-lg border-2 border-black px-2 py-0.5 bg-yellow-300"
              />
            </div>

            {night.kind === WerewolfNightActionKind.HEAL && night.victimId != null && (
              <p className="font-bold text-sm bg-red-100 border-2 border-black px-2 py-1">
                {t('gameWerewolf.witchVictim', { name: night.victimName ?? '?' })}
              </p>
            )}
            {night.kind === WerewolfNightActionKind.HEAL &&
              night.victimId == null &&
              currentSlot === 'WITCH' && (
                <p className="font-bold text-sm">{t('gameWerewolf.witchNoVictim')}</p>
              )}

            {night.kind === WerewolfNightActionKind.KILL && night.showTally && tally && (
              <div className="bg-indigo-50 border-2 border-black p-2 text-xs font-bold">
                <p className="font-black mb-1">{t('gameWerewolf.tallyTitle')}</p>
                {Object.entries(tally).map(([voter, target]) => (
                  <p key={voter}>
                    {voter} → {target}
                  </p>
                ))}
                {Object.keys(tally).length === 0 && (
                  <p className="text-slate-500">{t('gameWerewolf.tallyEmpty')}</p>
                )}
              </div>
            )}

            {night.submittedTargetName != null && (
              <p
                data-testid="werewolf-submitted"
                className="font-black text-sm bg-green-200 border-2 border-black px-2 py-1"
              >
                ✓ {t('gameWerewolf.submitted', { name: night.submittedTargetName })}
              </p>
            )}

            {/* Witch: save the victim */}
            {night.kind === WerewolfNightActionKind.HEAL &&
              currentSlot === 'WITCH' &&
              night.healRemaining &&
              night.victimId != null &&
              night.submittedTargetName == null && (
                <button
                  data-testid="werewolf-witch-save"
                  onClick={() => werewolfNightAction(WerewolfNightActionKind.HEAL, night.victimId!)}
                  className="bg-green-400 border-4 border-black px-4 py-3 font-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
                >
                  💚 {t('gameWerewolf.witchSave', { name: night.victimName ?? '?' })}
                </button>
              )}

            {/* Poison / kill / check / doctor heal / shot: target grids */}
            {night.kind !== WerewolfNightActionKind.HEAL && night.submittedTargetName == null && (
              <div className="flex flex-wrap gap-2">
                {night.targets.map((target) => (
                  <PlayerTargetButton
                    key={target.id}
                    id={target.id}
                    name={target.name}
                    onClick={() => werewolfNightAction(night.kind, target.id)}
                  />
                ))}
              </div>
            )}
            {night.kind === WerewolfNightActionKind.HEAL &&
              currentSlot === 'DOCTOR' &&
              night.submittedTargetName == null && (
                <div className="flex flex-wrap gap-2">
                  {night.targets.map((target) => (
                    <PlayerTargetButton
                      key={target.id}
                      id={target.id}
                      name={target.name}
                      onClick={() => werewolfNightAction(WerewolfNightActionKind.HEAL, target.id)}
                    />
                  ))}
                </div>
              )}

            {/* Witch poison picker */}
            {night.kind === WerewolfNightActionKind.HEAL &&
              currentSlot === 'WITCH' &&
              night.poisonRemaining &&
              night.submittedTargetName == null && (
                <div className="border-t-4 border-dashed border-black pt-3">
                  <p className="font-black text-sm mb-2">☠️ {t('gameWerewolf.witchPoisonTitle')}</p>
                  <div className="flex flex-wrap gap-2">
                    {night.targets.map((target) => (
                      <PlayerTargetButton
                        key={target.id}
                        id={target.id}
                        name={target.name}
                        onClick={() =>
                          werewolfNightAction(WerewolfNightActionKind.POISON, target.id)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <div className="bg-indigo-950 text-white border-4 border-black p-8 text-center shadow-[4px_4px_0_0_#000]">
            <p className="text-5xl mb-3">😴</p>
            <p className="font-black text-xl">{t('gameWerewolf.eyesClosed')}</p>
            <p className="text-sm font-bold text-indigo-200 mt-1">
              {t('gameWerewolf.eyesClosedHint')}
            </p>
          </div>
        )}

        {/* Seer vision history */}
        {role === WerewolfRole.SEER && visions && visions.length > 0 && (
          <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
            <p className="font-black text-sm mb-1">🔮 {t('gameWerewolf.visionsTitle')}</p>
            {visions.map((vision, index) => (
              <p key={index} className="text-sm font-bold">
                {vision.isWolf ? '🐺' : '✅'} {vision.targetName}{' '}
                <span className="text-slate-500">
                  ({t('gameWerewolf.nightN', { n: vision.night })})
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDay = () => {
    if (state.phase === WerewolfPhase.DAY_DISCUSSION) {
      return (
        <div data-testid="werewolf-discussion" className="flex flex-col gap-3">
          {state.dawn && state.dawn.deaths.length > 0 ? (
            <div className="bg-red-100 border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
              <p className="font-black text-lg mb-2">🌅 {t('gameWerewolf.dawnDeaths')}</p>
              {state.dawn.deaths.map((death) => (
                <p key={death.playerId} className="font-bold">
                  💀 {death.name} — {t(roleKey[death.role])}
                </p>
              ))}
            </div>
          ) : (
            <div className="bg-green-100 border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
              <p className="font-black text-lg">🌅 {t('gameWerewolf.dawnNoDeaths')}</p>
            </div>
          )}
          <div className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_#000]">
            <p className="font-black text-lg">🗣 {t('gameWerewolf.discussionTitle')}</p>
            <p className="text-sm font-bold text-slate-600">{t('gameWerewolf.discussionHint')}</p>
            <CountdownBadge
              deadline={state.phaseEndsAt}
              serverOffset={serverOffset}
              format="mm:ss"
              className="inline-block mt-2 font-black text-2xl border-2 border-black px-3 py-1 bg-yellow-300"
            />
            {room?.roomHostId === socketId && !state.paused && (
              <button
                data-testid="werewolf-skip-discussion"
                onClick={() => werewolfSkipDiscussion()}
                className="block mx-auto mt-3 text-sm font-black bg-indigo-200 border-4 border-black px-4 py-2 shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                ⏭ {t('gameWerewolf.skipDiscussion')}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (state.phase === WerewolfPhase.DAY_VOTE) {
      const voted = myDayVote != null;
      return (
        <div data-testid="werewolf-day-vote" className="flex flex-col gap-3">
          <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-black text-lg">🗳 {t('gameWerewolf.voteTitle')}</h3>
              <CountdownBadge
                deadline={state.phaseEndsAt}
                serverOffset={serverOffset}
                format="seconds"
                className="font-black text-lg border-2 border-black px-2 py-0.5 bg-yellow-300"
              />
            </div>
            <p className="text-sm font-bold text-slate-600 mb-3">{t('gameWerewolf.voteHint')}</p>
            {state.voteProgress && (
              <p data-testid="werewolf-vote-progress" className="font-black text-sm mb-2">
                {t('gameWerewolf.voteProgress', {
                  cast: state.voteProgress.cast,
                  total: state.voteProgress.total,
                })}
              </p>
            )}
            {dead || isSpectator ? (
              <p className="font-bold text-sm">{t('gameWerewolf.voteDead')}</p>
            ) : voted ? (
              <p
                data-testid="werewolf-voted-waiting"
                className="font-black text-sm bg-green-200 border-2 border-black px-2 py-1"
              >
                ✓{' '}
                {t('gameWerewolf.votedWaiting', {
                  name: myDayVote === 'ABSTAIN' ? t('gameWerewolf.abstain') : myDayVote,
                })}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {livingTargets
                  .filter((target) => target.id !== socketId)
                  .map((target) => (
                    <PlayerTargetButton
                      key={target.id}
                      id={target.id}
                      name={target.name}
                      testid="werewolf-vote-btn"
                      onClick={() => werewolfDayVote(target.id)}
                    />
                  ))}
                <button
                  data-testid="werewolf-abstain-btn"
                  onClick={() => werewolfDayVote('ABSTAIN')}
                  className="px-3 py-2 border-4 border-black font-black bg-slate-200 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none text-sm"
                >
                  {t('gameWerewolf.abstain')}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (state.phase === WerewolfPhase.DAY_RESULT) {
      const lynchId = state.voteResult?.lynchedPlayerId ?? null;
      return (
        <div data-testid="werewolf-day-result" className="flex flex-col gap-3">
          {lynchId ? (
            <div className="bg-red-100 border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
              <p className="font-black text-lg">
                ⚖️{' '}
                {t('gameWerewolf.resultLynched', {
                  name: playerName(lynchId),
                  role: t(roleKey[state.players[lynchId]?.revealedRole ?? WerewolfRole.VILLAGER]),
                })}
              </p>
            </div>
          ) : (
            <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
              <p className="font-black text-lg">⚖️ {t('gameWerewolf.resultNoLynch')}</p>
            </div>
          )}
          {state.dawn?.deaths.some((death) => death.cause === 'SHOT') && (
            <div className="bg-orange-100 border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
              {state.dawn.deaths
                .filter((death) => death.cause === 'SHOT')
                .map((death) => (
                  <p key={death.playerId} className="font-black text-lg">
                    🏹{' '}
                    {t('gameWerewolf.resultShot', {
                      name: death.name,
                      role: t(roleKey[death.role]),
                    })}
                  </p>
                ))}
            </div>
          )}
          {state.voteResult && (
            <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
              <p className="font-black text-sm mb-1">{t('gameWerewolf.votesRevealTitle')}</p>
              {Object.entries(state.voteResult.votes).map(([voter, target]) => (
                <p key={voter} className="text-sm font-bold">
                  {playerName(voter)} →{' '}
                  {target === 'ABSTAIN' ? t('gameWerewolf.abstain') : playerName(target)}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (state.phase === WerewolfPhase.DAY_HUNTER_SHOT) {
      const isShooter = state.hunterShot?.hunterId === socketId;
      return (
        <div
          data-testid="werewolf-hunter-shot"
          className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]"
        >
          <h3 className="font-black text-lg mb-2">🏹 {t('gameWerewolf.shotTitle')}</h3>
          {isShooter && night && night.submittedTargetName == null ? (
            <div className="flex flex-wrap gap-2">
              {livingTargets
                .filter((target) => target.id !== socketId)
                .map((target) => (
                  <PlayerTargetButton
                    key={target.id}
                    id={target.id}
                    name={target.name}
                    onClick={() => werewolfNightAction(WerewolfNightActionKind.SHOT, target.id)}
                  />
                ))}
            </div>
          ) : (
            <p className="font-bold text-sm">
              {night?.submittedTargetName
                ? `✓ ${t('gameWerewolf.submitted', { name: night.submittedTargetName })}`
                : t('gameWerewolf.shotWaiting', { name: state.hunterShot?.hunterName ?? '' })}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  const renderGameOver = () => {
    const wolvesWin = state.winner === 'WOLVES';
    return (
      <div data-testid="werewolf-winner-banner" className="flex flex-col gap-3">
        <div
          className={`border-4 border-black p-6 text-center shadow-[4px_4px_0_0_#000] ${
            wolvesWin ? 'bg-red-400' : 'bg-green-300'
          }`}
        >
          <p className="text-5xl mb-2">{wolvesWin ? '🐺' : '🌾'}</p>
          <p className="font-black text-2xl">
            {wolvesWin ? t('gameWerewolf.winnerWolves') : t('gameWerewolf.winnerVillage')}
          </p>
        </div>
        <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
          <p className="font-black text-sm mb-1">{t('gameWerewolf.rolesRevealedTitle')}</p>
          {Object.entries(state.players).map(([key, view]) => (
            <p key={key} className="text-sm font-bold">
              {roleEmoji[view.finalRole ?? WerewolfRole.VILLAGER]} {playerName(key)} —{' '}
              {t(roleKey[view.finalRole ?? WerewolfRole.VILLAGER])}
              {!view.alive && ' 💀'}
            </p>
          ))}
        </div>
        {isHost && (
          <button
            onClick={() => resetRoom()}
            className="bg-yellow-300 border-4 border-black px-4 py-3 font-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          >
            {t('gameWerewolf.backToLobby')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-3 bg-gradient-to-b from-indigo-100 to-white border-4 border-black p-3 sm:p-4 shadow-[4px_4px_0_0_#000] min-h-[300px] overflow-y-auto">
      {/* Header: phase + countdown + narrator */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-sm border-2 border-black px-2 py-1 bg-indigo-900 text-white">
            {isNight
              ? t('gameWerewolf.nightLabel', { n: state.night })
              : state.phase === WerewolfPhase.GAME_OVER
                ? t('gameWerewolf.phaseGameOver')
                : t('gameWerewolf.dayLabel', { n: state.night })}
          </span>
          {state.phaseEndsAt != null && state.phase !== WerewolfPhase.GAME_OVER && (
            <CountdownBadge
              deadline={state.phaseEndsAt}
              serverOffset={serverOffset}
              format={isNight ? 'seconds' : 'mm:ss'}
              className="font-black text-sm border-2 border-black px-2 py-1 bg-yellow-300"
            />
          )}
          {state.paused && (
            <span className="font-black text-sm border-2 border-black px-2 py-1 bg-yellow-300">
              ⏸ {t('gameWerewolf.paused')}
            </span>
          )}
        </div>
        {state.phase !== WerewolfPhase.GAME_OVER && (
          <button
            data-testid="werewolf-narrator-btn"
            onClick={() => setShowNarrator(true)}
            className="text-xs font-black bg-white border-2 border-black px-2.5 py-1 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          >
            📢 {t('gameWerewolf.narratorOpen')}
          </button>
        )}
      </div>

      {/* Private role card */}
      {role && !isSpectator && (
        <div
          data-testid="werewolf-role-card"
          className={`border-4 border-black p-3 shadow-[4px_4px_0_0_#000] ${
            role === WerewolfRole.WEREWOLF ? 'bg-red-400' : 'bg-amber-100'
          }`}
        >
          <p className="text-xs font-black uppercase tracking-widest">
            {t('gameWerewolf.yourRole')}
          </p>
          <p className="font-black text-xl">
            {roleEmoji[role]} {t(roleKey[role])}
          </p>
          {dead && (
            <p className="text-sm font-black mt-1">
              💀 {t('gameWerewolf.youAreDead')} —{' '}
              <span className="font-bold">{t('gameWerewolf.ghostNote')}</span>
            </p>
          )}
        </div>
      )}
      {isSpectator && (
        <p className="text-sm font-bold text-center bg-white border-2 border-black px-2 py-1">
          👀 {t('gameWerewolf.spectatorNote')}
        </p>
      )}

      {state.phase === WerewolfPhase.NIGHT && renderNight()}
      {(state.phase === WerewolfPhase.DAY_DISCUSSION ||
        state.phase === WerewolfPhase.DAY_VOTE ||
        state.phase === WerewolfPhase.DAY_RESULT ||
        state.phase === WerewolfPhase.DAY_HUNTER_SHOT) &&
        renderDay()}
      {state.phase === WerewolfPhase.GAME_OVER && renderGameOver()}

      {showNarrator && (
        <WerewolfNarrator room={room} language={language} onClose={() => setShowNarrator(false)} />
      )}
    </div>
  );
}
