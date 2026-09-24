'use client';

import { useEffect, useRef } from 'react';
import { DetectiveClubPhase, type DetectiveClubState } from '@repo/types';
import type { DetectiveClubSound } from '@/hooks/useDetectiveClubSounds';

/**
 * Derives sound cues from Detective Club server-state deltas:
 * - phase change → word / discussion / vote / scoring stings
 * - a card lands on the table (any player's playedCards grows) → card snap
 * - SCORING reached → role-reveal sting; the winner line plays one more cue
 *   via scoreDeltas sign (detective vs conspirator victory)
 */
export function useDetectiveClubSoundCues(
  state: DetectiveClubState | null | undefined,
  playSound: (sound: DetectiveClubSound) => void,
) {
  const last = useRef<{
    phase: string | null;
    playedTotal: number | null;
    scored: boolean;
  }>({ phase: null, playedTotal: null, scored: false });

  useEffect(() => {
    if (!state) return;
    const phase = state.currentPhase;
    const playedTotal = Object.values(state.players).reduce(
      (sum, p) => sum + p.playedCards.length,
      0,
    );
    const scored = Boolean(state.scoreDeltas && Object.keys(state.scoreDeltas).length > 0);

    const prev = last.current;
    const first = prev.phase === null && prev.playedTotal === null;

    if (!first) {
      if (phase !== prev.phase) {
        if (
          phase === DetectiveClubPhase.PLAYING_ROUND_1 ||
          phase === DetectiveClubPhase.PLAYING_ROUND_2
        ) {
          playSound('word');
        } else if (phase === DetectiveClubPhase.DISCUSSION) {
          playSound('discussion');
        } else if (phase === DetectiveClubPhase.VOTING) {
          playSound('vote');
        } else if (phase === DetectiveClubPhase.SCORING) {
          playSound('scoring');
        }
      } else if (playedTotal > (prev.playedTotal ?? 0)) {
        playSound('card');
      }
    }

    last.current = { phase, playedTotal, scored };
  }, [state, playSound]);
}
