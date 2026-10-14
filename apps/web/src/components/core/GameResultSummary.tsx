'use client';

import React from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export interface PlayerScoreDelta {
  playerId: string;
  name: string;
  score: number;
  delta?: number;
  isWinner?: boolean;
  avatar?: string;
}

export interface GameResultSummaryProps {
  title?: string;
  winnerName?: string | null;
  winnerNames?: string[];
  subtitle?: string;
  scoreDeltas?: PlayerScoreDelta[];
  isHost?: boolean;
  onRematch?: () => void;
  rematchLabel?: string;
  waitingHostMessage?: string;
  onBackToLobby?: () => void;
  backToLobbyLabel?: string;
  actionLoading?: boolean;
  children?: React.ReactNode;
  className?: string;
  testId?: string;
}

export function GameResultSummary({
  title,
  winnerName,
  winnerNames,
  subtitle,
  scoreDeltas,
  isHost = false,
  onRematch,
  rematchLabel,
  waitingHostMessage,
  onBackToLobby,
  backToLobbyLabel,
  actionLoading = false,
  children,
  className = '',
  testId = 'game-result-summary',
}: GameResultSummaryProps) {
  const { t } = useTranslate();

  const resolvedWinners =
    winnerNames && winnerNames.length > 0 ? winnerNames : winnerName ? [winnerName] : [];

  const sortedScores = scoreDeltas
    ? [...scoreDeltas].sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1;
        if (!a.isWinner && b.isWinner) return 1;
        return b.score - a.score;
      })
    : [];

  return (
    <div
      data-testid={testId}
      className={`w-full max-w-2xl mx-auto flex flex-col items-center gap-4 p-4 sm:p-6 bg-white border-4 border-black shadow-[6px_6px_0_0_#000] text-black ${className}`}
    >
      <h2
        data-testid="game-result-title"
        className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-center bg-yellow-300 border-4 border-black px-6 py-2 shadow-[3px_3px_0_0_#000] w-full"
      >
        {title || t('result.gameOver')}
      </h2>

      {resolvedWinners.length > 0 && (
        <div
          data-testid="game-result-winner"
          className="w-full text-center font-black text-xl sm:text-2xl py-3 px-4 bg-emerald-300 border-4 border-black shadow-[4px_4px_0_0_#000] break-words"
        >
          🏆 {resolvedWinners.join(', ')}{' '}
          {resolvedWinners.length > 1 ? t('result.winners') : t('result.winner')}! 🏆
        </div>
      )}

      {subtitle && (
        <p
          data-testid="game-result-subtitle"
          className="text-sm sm:text-base font-bold text-center text-slate-700 bg-slate-100 border-2 border-black px-4 py-2 w-full"
        >
          {subtitle}
        </p>
      )}

      {sortedScores.length > 0 && (
        <div
          data-testid="game-result-scores"
          className="w-full border-4 border-black bg-slate-50 shadow-[4px_4px_0_0_#000] overflow-hidden"
        >
          <div className="flex items-center justify-between border-b-4 border-black bg-amber-200 px-4 py-2 font-black text-xs sm:text-sm uppercase">
            <span>
              {t('result.rank')} & {t('lobby.players')}
            </span>
            <span>{t('result.scores')}</span>
          </div>
          <ul className="divide-y-2 divide-black">
            {sortedScores.map((p, idx) => (
              <li
                key={p.playerId}
                data-testid={`game-result-player-${p.playerId}`}
                className={`flex items-center justify-between px-4 py-2.5 ${
                  p.isWinner ? 'bg-yellow-100 font-black' : 'bg-white font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs bg-black text-white px-1.5 py-0.5 rounded-sm">
                    #{idx + 1}
                  </span>
                  {p.avatar && <span className="text-base">{p.avatar}</span>}
                  <span className="truncate max-w-[140px] sm:max-w-[200px] text-sm">{p.name}</span>
                  {p.isWinner && (
                    <span className="border-2 border-black bg-yellow-300 px-1.5 py-0.2 text-[10px] font-black uppercase">
                      👑
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm">{p.score}</span>
                  {p.delta !== undefined && p.delta !== 0 && (
                    <span
                      className={`text-xs font-black px-1.5 py-0.5 border border-black ${
                        p.delta > 0
                          ? 'bg-emerald-200 text-emerald-950'
                          : 'bg-rose-200 text-rose-950'
                      }`}
                    >
                      {p.delta > 0 ? `+${p.delta}` : p.delta}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}

      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
        {isHost ? (
          onRematch && (
            <button
              data-testid="game-result-rematch-btn"
              onClick={onRematch}
              disabled={actionLoading}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-400 hover:bg-emerald-300 border-4 border-black font-black text-base sm:text-lg uppercase tracking-wider shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rematchLabel || t('result.playAgain')}
            </button>
          )
        ) : (
          <div
            data-testid="game-result-waiting-host"
            className="w-full text-center font-bold text-xs sm:text-sm bg-amber-100 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]"
          >
            {waitingHostMessage || t('result.waitingForHost')}
          </div>
        )}

        {onBackToLobby && (
          <button
            data-testid="game-result-back-lobby-btn"
            onClick={onBackToLobby}
            disabled={actionLoading}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-200 hover:bg-slate-300 border-4 border-black font-black text-sm sm:text-base uppercase tracking-wider shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all"
          >
            {backToLobbyLabel || t('result.backToLobby')}
          </button>
        )}
      </div>
    </div>
  );
}
