'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType, DetectiveClubPhase, DetectiveClubRole } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { SetupPhase } from './phases/SetupPhase';
import { PlayingPhase } from './phases/PlayingPhase';
import { DiscussionPhase } from './phases/DiscussionPhase';
import { VotingPhase } from './phases/VotingPhase';
import { ScoringPhase } from './phases/ScoringPhase';
import { useDetectiveClubSounds } from '@/hooks/useDetectiveClubSounds';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { SoundToggle } from '@/components/core/SoundToggle';
import { useDetectiveClubSoundCues } from './useDetectiveClubSoundCues';

function getRoleLabel(role: string | undefined, t: ReturnType<typeof useTranslate>['t']): string {
  switch (role) {
    case DetectiveClubRole.INFORMER:
      return t('gameDetectiveClub.informer');
    case DetectiveClubRole.CONSPIRATOR:
      return t('gameDetectiveClub.conspirator');
    case DetectiveClubRole.DETECTIVE:
      return t('gameDetectiveClub.detective');
    default:
      return t('gameDetectiveClub.unknownRole');
  }
}

export function DetectiveClubView() {
  const { room, socketId, privateState } = useGameStore();
  const { t } = useTranslate();
  const { enabled: soundsEnabled, toggle: toggleSound } = useSoundSettings();
  const playSound = useDetectiveClubSounds(soundsEnabled);
  const dcState = room?.detectiveClubState ?? null;
  useDetectiveClubSoundCues(dcState, playSound);

  // Role-reveal cue: fire once when scoring deltas land (detective vs conspirator win)
  const lastScoredRef = useRef(false);
  useEffect(() => {
    if (!dcState?.scoreDeltas || Object.keys(dcState.scoreDeltas).length === 0) return;
    if (lastScoredRef.current) return;
    lastScoredRef.current = true;
    const myRole = (room?.detectiveClubState?.players[socketId]?.role ?? privateState?.dcRole) as
      | string
      | undefined;
    playSound(myRole === 'CONSPIRATOR' ? 'conspirator-win' : 'detective-win');
  }, [dcState?.scoreDeltas, playSound, room, socketId, privateState]);

  if (!room || room.gameType !== GameType.DETECTIVE_CLUB) return null;

  const state = room.detectiveClubState;

  if (!state) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-600">
        {t('gameDetectiveClub.loading')}
      </div>
    );
  }

  const myPlayer = state.players[socketId];
  const myRole = privateState.dcRole as DetectiveClubRole | undefined;
  const roleAtScoring = myPlayer?.role ?? myRole;

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 overflow-y-auto overflow-x-hidden max-w-4xl mx-auto space-y-6 font-mono">
      {/* Header Info */}
      <div className="bg-white border-4 border-black p-4 flex flex-col sm:flex-row justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full gap-4">
        <div className="text-center sm:text-left">
          <p className="text-black uppercase tracking-widest text-xs font-black mb-1">
            {t('gameDetectiveClub.yourRole')}
          </p>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span
              className={`text-xl font-black border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${roleAtScoring === DetectiveClubRole.INFORMER ? 'bg-indigo-300 text-black ' : roleAtScoring === DetectiveClubRole.CONSPIRATOR ? 'bg-rose-300 text-black -' : 'bg-emerald-300 text-black '}`}
            >
              {getRoleLabel(roleAtScoring, t)}
            </span>
          </div>
        </div>

        <div className="text-center sm:text-right flex items-center gap-2">
          <SoundToggle
            enabled={soundsEnabled}
            onToggle={toggleSound}
            titleOn={t('gameDetectiveClub.soundOn')}
            titleOff={t('gameDetectiveClub.soundOff')}
            testId="dc-sound-toggle"
            className="w-8 h-8 shadow-[2px_2px_0_0_#000]"
          />
          <div>
            <p className="text-black uppercase tracking-widest text-xs font-black mb-1">
              {t('gameDetectiveClub.yourScore')}
            </p>
            <span className="text-2xl font-black text-black bg-yellow-300 px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block -">
              {myPlayer?.score || 0}{' '}
              <span className="text-sm text-black font-bold uppercase">
                {t('gameDetectiveClub.pts')}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      {state.currentPhase === DetectiveClubPhase.SETUP && <SetupPhase />}
      {(state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_1 ||
        state.currentPhase === DetectiveClubPhase.PLAYING_ROUND_2) && <PlayingPhase />}
      {state.currentPhase === DetectiveClubPhase.DISCUSSION && <DiscussionPhase />}
      {state.currentPhase === DetectiveClubPhase.VOTING && <VotingPhase />}
      {state.currentPhase === DetectiveClubPhase.SCORING && <ScoringPhase />}
    </div>
  );
}

export { getRoleLabel };
