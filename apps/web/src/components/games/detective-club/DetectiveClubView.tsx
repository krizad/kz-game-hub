'use client';

import { useGameStore } from '@/store/useGameStore';
import { GameType, DetectiveClubPhase } from '@repo/types';
import { SetupPhase } from './phases/SetupPhase';
import { PlayingPhase } from './phases/PlayingPhase';
import { DiscussionPhase } from './phases/DiscussionPhase';
import { VotingPhase } from './phases/VotingPhase';
import { ScoringPhase } from './phases/ScoringPhase';

export function DetectiveClubView() {
  const { room, socketId } = useGameStore();

  if (!room || room.gameType !== GameType.DETECTIVE_CLUB) return null;

  const state = room.detectiveClubState;

  if (!state) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-600">
        Loading Detective Club...
      </div>
    );
  }

  const myPlayer = state.players[socketId];

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 overflow-y-auto max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center shadow-lg w-full gap-4">
        <div className="text-center sm:text-left">
          <p className="text-slate-600 uppercase tracking-widest text-xs font-bold mb-1">
            Your Role
          </p>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span
              className={`text-xl font-black ${myPlayer?.role === 'INFORMER' ? 'text-indigo-400' : myPlayer?.role === 'CONSPIRATOR' ? 'text-rose-400' : 'text-emerald-400'}`}
            >
              {myPlayer?.role || 'UNKNOWN'}
            </span>
          </div>
        </div>

        <div className="text-center sm:text-right">
          <p className="text-slate-600 uppercase tracking-widest text-xs font-bold mb-1">
            Your Score
          </p>
          <span className="text-2xl font-black text-amber-400">
            {myPlayer?.score || 0} <span className="text-sm text-slate-500">pts</span>
          </span>
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
