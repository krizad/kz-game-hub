'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';

const GAME_TYPES: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'All Games' },
  { value: GameType.WHO_KNOW, label: 'Who Know!' },
  { value: GameType.TIC_TAC_TOE, label: 'Tic Tac Toe' },
  { value: GameType.GOBBLER_TIC_TAC_TOE, label: 'Gobbler' },
  { value: GameType.RPS, label: 'Hand Duel' },
  { value: GameType.SOUNDS_FISHY, label: 'Sounds Fishy' },
  { value: GameType.DETECTIVE_CLUB, label: 'Detective Club' },
  { value: GameType.WHO_AM_I, label: 'Who Am I' },
];

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const { leaderboard, getLeaderboard } = useGameStore();
  const [filter, setFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      getLeaderboard(filter);
    }
  }, [isOpen, filter, getLeaderboard]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-amber-300 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-2 border-b border-amber-200 bg-white shrink-0">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">
            Leaderboard
          </h2>
        </div>

        <div className="px-6 py-3 border-b border-amber-100 bg-amber-50/50 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {GAME_TYPES.map((gt) => (
              <button
                key={gt.value || 'all'}
                onClick={() => setFilter(gt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  filter === gt.value
                    ? 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/20'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-amber-100 border border-transparent'
                }`}
              >
                {gt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {leaderboard.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              No games played yet. Start playing to see the leaderboard!
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry: any, idx: number) => (
                <div
                  key={entry.playerName}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    idx === 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-amber-200'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                      idx === 0
                        ? 'bg-amber-400 text-white'
                        : idx === 1
                          ? 'bg-slate-300 text-slate-700'
                          : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-800">{entry.playerName}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {entry.gamesPlayed} game{entry.gamesPlayed !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-indigo-500">{entry.totalScore}</span>
                    <span className="text-xs text-slate-400 block">pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-amber-200 bg-white shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-amber-100 hover:bg-amber-200 text-slate-800 font-bold text-lg py-4 rounded-xl transition-colors shadow-lg active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
