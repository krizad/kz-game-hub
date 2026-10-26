'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RoomState,
  WerewolfPhase,
  WerewolfRole,
  WerewolfState,
  type WerewolfNightSlot,
} from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { useServerClock } from '@/hooks/useServerClock';
import { CountdownBadge } from '@/components/core/CountdownBadge';

interface WerewolfNarratorProps {
  room: RoomState;
  language: 'th' | 'en';
  onClose: () => void;
}

/** Slots whose line is only spoken while the role group is not publicly dead. */
const SLOT_ROLE: Partial<Record<WerewolfNightSlot, WerewolfRole>> = {
  SEER: WerewolfRole.SEER,
  DOCTOR: WerewolfRole.DOCTOR,
  WITCH: WerewolfRole.WITCH,
  HUNTER_SHOT: WerewolfRole.HUNTER,
};

const SLOT_LINE: Record<WerewolfNightSlot, string> = {
  WOLVES: 'gameWerewolf.narratorLineWolvesEye',
  SEER: 'gameWerewolf.narratorLineSeer',
  DOCTOR: 'gameWerewolf.narratorLineDoctor',
  WITCH: 'gameWerewolf.narratorLineWitch',
  HUNTER_SHOT: 'gameWerewolf.narratorLineHunter',
};

/**
 * Shared narrator device (ADR 0015): a secret-free full-screen view any room
 * member can open on a table device. It announces phases aloud via
 * speechSynthesis with on-screen captions, offers a readiness check, and
 * never blocks or gates play — a TTS failure only silences the voice.
 * Every line is derived from public state only.
 */
export function WerewolfNarrator({ room, language, onClose }: WerewolfNarratorProps) {
  const { t } = useTranslate();
  const { serverOffset } = useServerClock();
  const [caption, setCaption] = useState<string | null>(null);
  const [ttsAvailable] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );
  const lastEventRef = useRef('');

  const state = room.werewolfState as WerewolfState;

  const speak = (key: string, params?: Record<string, string | number>) => {
    const text = t(key, params);
    setCaption(text);
    if (!ttsAvailable) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'th' ? 'th-TH' : 'en-US';
      utterance.rate = 0.95;
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.lang.toLowerCase().startsWith(language));
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Narration must never stall the game loop.
    }
  };

  const playerName = (key: string | null | undefined) =>
    room.players.find((p) => p.socketId === key)?.name ?? '?';

  const roleLabel = (role: WerewolfRole) =>
    t(`gameWerewolf.role${role.charAt(0)}${role.slice(1).toLowerCase()}`);

  const eventKey = useMemo(() => {
    if (state.phase === WerewolfPhase.NIGHT) {
      return `night:${state.night}:${state.nightSlotIndex}`;
    }
    if (state.phase === WerewolfPhase.DAY_DISCUSSION) return `disc:${state.night}`;
    if (state.phase === WerewolfPhase.DAY_VOTE) return `vote:${state.night}`;
    if (state.phase === WerewolfPhase.DAY_RESULT) {
      return `result:${state.night}:${state.voteResult?.lynchedPlayerId ?? 'none'}`;
    }
    if (state.phase === WerewolfPhase.DAY_HUNTER_SHOT) return `shot:${state.night}`;
    if (state.phase === WerewolfPhase.GAME_OVER) return `over:${state.winner}`;
    return '';
  }, [state.phase, state.night, state.nightSlotIndex, state.voteResult, state.winner]);

  useEffect(() => {
    if (!eventKey || eventKey === lastEventRef.current) return;
    lastEventRef.current = eventKey;

    const publiclyDead = (role: WerewolfRole) =>
      Object.values(state.players).some((view) => view.revealedRole === role);

    if (state.phase === WerewolfPhase.NIGHT) {
      const slot = state.nightSlots[state.nightSlotIndex];
      if (!slot) return;
      if (state.nightSlotIndex === 0) {
        speak('gameWerewolf.narratorLineEveryoneSleep');
      }
      const role = SLOT_ROLE[slot];
      if (role && publiclyDead(role)) {
        // Everyone already knows this role is out; stay silent (no info leak).
        return;
      }
      speak(SLOT_LINE[slot]);
      return;
    }

    if (state.phase === WerewolfPhase.DAY_DISCUSSION) {
      const deaths = state.dawn?.deaths ?? [];
      if (deaths.length > 0) {
        speak('gameWerewolf.narratorLineDawnDeaths', {
          names: deaths.map((death) => death.name).join(', '),
        });
      } else {
        speak('gameWerewolf.narratorLineDawnNone');
      }
      return;
    }

    if (state.phase === WerewolfPhase.DAY_VOTE) {
      speak('gameWerewolf.narratorLineVote');
      return;
    }

    if (state.phase === WerewolfPhase.DAY_HUNTER_SHOT) {
      speak('gameWerewolf.narratorLineHunterTime');
      return;
    }

    if (state.phase === WerewolfPhase.DAY_RESULT) {
      const shot = state.dawn?.deaths.find((death) => death.cause === 'SHOT');
      if (shot) {
        speak('gameWerewolf.narratorLineShot', {
          name: shot.name,
          role: roleLabel(shot.role),
        });
        return;
      }
      const lynchedId = state.voteResult?.lynchedPlayerId;
      const lynchedRole = lynchedId ? state.players[lynchedId]?.revealedRole : undefined;
      if (lynchedId && lynchedRole) {
        speak('gameWerewolf.narratorLineLynched', {
          name: playerName(lynchedId),
          role: roleLabel(lynchedRole),
        });
        return;
      }
      speak('gameWerewolf.narratorLineNoLynch');
      return;
    }

    if (state.phase === WerewolfPhase.GAME_OVER) {
      speak(
        state.winner === 'WOLVES'
          ? 'gameWerewolf.narratorLineWolvesWin'
          : 'gameWerewolf.narratorLineVillageWin',
      );
    }
  }, [eventKey]);

  return (
    <div
      data-testid="werewolf-narrator-screen"
      className="fixed inset-0 z-50 bg-indigo-950 text-white flex flex-col items-center justify-center gap-6 p-6 overflow-y-auto"
    >
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className="font-black text-2xl border-4 border-white px-4 py-1">
          {state.phase === WerewolfPhase.NIGHT
            ? t('gameWerewolf.nightLabel', { n: state.night })
            : state.phase === WerewolfPhase.GAME_OVER
              ? t('gameWerewolf.phaseGameOver')
              : t('gameWerewolf.dayLabel', { n: state.night })}
        </span>
        {state.phaseEndsAt != null && state.phase !== WerewolfPhase.GAME_OVER && (
          <CountdownBadge
            deadline={state.phaseEndsAt}
            serverOffset={serverOffset}
            format={state.phase === WerewolfPhase.NIGHT ? 'seconds' : 'mm:ss'}
            className="font-black text-3xl border-4 border-white px-3 py-1 bg-yellow-300 text-black"
          />
        )}
        {state.paused && (
          <span className="font-black text-xl border-4 border-white px-3 py-1 bg-yellow-300 text-black">
            ⏸ {t('gameWerewolf.paused')}
          </span>
        )}
      </div>

      {state.phase === WerewolfPhase.NIGHT && (
        <div className="flex flex-wrap gap-2 justify-center max-w-xl">
          {state.nightSlots.map((slot, index) => (
            <span
              key={slot}
              className={`px-3 py-1 text-sm font-black border-2 border-white ${
                index === state.nightSlotIndex
                  ? 'bg-white text-indigo-950'
                  : index < state.nightSlotIndex
                    ? 'opacity-40 line-through'
                    : 'opacity-80'
              }`}
            >
              {t(`gameWerewolf.slot${slot.charAt(0)}${slot.slice(1).toLowerCase()}`)}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white text-black border-4 border-black max-w-2xl w-full p-8 text-center shadow-[8px_8px_0_0_#000]">
        <p
          data-testid="werewolf-narrator-caption"
          className="font-black text-2xl sm:text-3xl leading-snug"
        >
          {caption ?? t('gameWerewolf.narratorCaptionNone')}
        </p>
      </div>

      {!ttsAvailable && (
        <p className="font-bold text-yellow-300 text-sm text-center max-w-md">
          🔇 {t('gameWerewolf.narratorUnavailable')}
        </p>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        <button
          data-testid="werewolf-narrator-test"
          onClick={() => speak('gameWerewolf.narratorLineDiscussion')}
          className="bg-white text-black border-4 border-black px-4 py-2 font-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
        >
          🔊 {t('gameWerewolf.narratorTestSound')}
        </button>
        <button
          data-testid="werewolf-narrator-close"
          onClick={onClose}
          className="bg-yellow-300 text-black border-4 border-black px-4 py-2 font-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
        >
          ✕ {t('gameWerewolf.narratorClose')}
        </button>
      </div>
    </div>
  );
}
