'use client';

import React, { useState, useEffect } from 'react';
import { GameType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export interface FirstRoundGuideProps {
  gameType?: GameType;
  triggerClassName?: string;
}

export function FirstRoundGuide({
  gameType = GameType.TIC_TAC_TOE,
  triggerClassName,
}: FirstRoundGuideProps) {
  const { t } = useTranslate();
  const [isOpen, setIsOpen] = useState(false);

  // Local illustration practice states (zero socket emissions)
  const [rpsPracticeChoice, setRpsPracticeChoice] = useState<string | null>(null);
  const [tttPracticeGrid, setTttPracticeGrid] = useState<Array<string | null>>(Array(9).fill(null));

  // Reset practice state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setRpsPracticeChoice(null);
      setTttPracticeGrid(Array(9).fill(null));
    }
  }, [isOpen]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Only RPS and TIC_TAC_TOE have dedicated first-round interactive illustrations
  const isRps = gameType === GameType.RPS;
  const isTtt = gameType === GameType.TIC_TAC_TOE;

  if (!isRps && !isTtt) {
    return null;
  }

  const handleTttCellClick = (idx: number) => {
    if (tttPracticeGrid[idx]) return;
    const next = [...tttPracticeGrid];
    next[idx] = 'X';
    setTttPracticeGrid(next);
  };

  return (
    <>
      <button
        type="button"
        data-testid="first-round-guide-btn"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ||
          'text-xs font-black bg-cyan-200 hover:bg-cyan-300 text-black border-2 border-black px-3 py-1.5 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'
        }
      >
        <span>📖</span>
        <span>{t('lobby.firstRoundGuide')}</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
        >
          <div className="bg-white border-4 border-black w-full max-w-lg shadow-[8px_8px_0_0_#000] p-4 sm:p-6 my-8 flex flex-col gap-4 text-black animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b-4 border-black pb-3">
              <h2
                id="guide-title"
                data-testid="first-round-guide-title"
                className="text-lg sm:text-xl font-black uppercase tracking-wider flex items-center gap-2"
              >
                <span>{isRps ? '✊' : '❌'}</span>
                <span>
                  {isRps ? t('lobby.gameNames.handDuel') : t('lobby.gameNames.ticTacToe')} —{' '}
                  {t('lobby.firstRoundGuide')}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 font-black text-lg border-2 border-black bg-rose-300 hover:bg-rose-400 flex items-center justify-center shadow-[2px_2px_0_0_#000]"
                aria-label={t('lobby.close')}
              >
                ✕
              </button>
            </div>

            {/* 3 Step Guidance: Goal -> First Action -> Expected Result */}
            <div className="flex flex-col gap-3">
              {/* 1. Goal */}
              <div
                data-testid="guide-step-goal"
                className="bg-yellow-100 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]"
              >
                <div className="text-xs font-black uppercase text-amber-900 tracking-wider mb-1">
                  🎯 {t('lobby.guideGoal')}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {isRps ? t('lobby.guideRpsGoal') : t('lobby.guideTttGoal')}
                </p>
              </div>

              {/* 2. First Action */}
              <div
                data-testid="guide-step-action"
                className="bg-emerald-100 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]"
              >
                <div className="text-xs font-black uppercase text-emerald-900 tracking-wider mb-1">
                  ⚡ {t('lobby.guideFirstAction')}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {isRps ? t('lobby.guideRpsAction') : t('lobby.guideTttAction')}
                </p>
              </div>

              {/* 3. Expected Result */}
              <div
                data-testid="guide-step-result"
                className="bg-cyan-100 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]"
              >
                <div className="text-xs font-black uppercase text-cyan-900 tracking-wider mb-1">
                  ✨ {t('lobby.guideExpectedResult')}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {isRps ? t('lobby.guideRpsResult') : t('lobby.guideTttResult')}
                </p>
              </div>
            </div>

            {/* Interactive Local Practice (Does NOT send socket actions) */}
            <div
              data-testid="guide-interactive-practice"
              className="border-2 border-black p-3 bg-slate-50 flex flex-col items-center gap-2"
            >
              <div className="text-xs font-black uppercase text-slate-700 tracking-wider text-center">
                🎮 {t('lobby.guidePractice')}
              </div>

              {isRps && (
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="flex gap-2 justify-center">
                    {(
                      [
                        { id: 'ROCK', emoji: '✊', label: t('gameRps.rock') },
                        { id: 'PAPER', emoji: '📄', label: t('gameRps.paper') },
                        { id: 'SCISSORS', emoji: '✂️', label: t('gameRps.scissors') },
                      ] as const
                    ).map(({ id, emoji, label }) => (
                      <button
                        key={id}
                        type="button"
                        data-testid={`guide-practice-${id.toLowerCase()}`}
                        onClick={() => setRpsPracticeChoice(id)}
                        className={`px-3 py-2 border-2 border-black text-xs font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1 active:translate-y-0.5 active:shadow-none transition-all ${
                          rpsPracticeChoice === id
                            ? 'bg-yellow-300'
                            : 'bg-white hover:bg-yellow-100'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  {rpsPracticeChoice && (
                    <div
                      data-testid="guide-practice-feedback"
                      className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-400 p-2 text-center w-full"
                    >
                      ✓ {t('gameRps.choiceLocked')} ({rpsPracticeChoice})
                    </div>
                  )}
                </div>
              )}

              {isTtt && (
                <div className="flex flex-col items-center gap-2">
                  <div className="grid grid-cols-3 gap-1 bg-black p-1 border-2 border-black">
                    {tttPracticeGrid.map((mark, idx) => (
                      <button
                        key={`practice-cell-${idx}`}
                        type="button"
                        data-testid={`guide-practice-cell-${idx}`}
                        onClick={() => handleTttCellClick(idx)}
                        className="w-10 h-10 bg-white font-black text-lg flex items-center justify-center hover:bg-slate-100 active:bg-yellow-200"
                        aria-label={`Practice cell ${idx + 1}`}
                      >
                        {mark}
                      </button>
                    ))}
                  </div>
                  {tttPracticeGrid.some((c) => c !== null) && (
                    <div
                      data-testid="guide-practice-feedback"
                      className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-400 p-2 text-center w-full"
                    >
                      ✓ {t('lobby.guideTttResult')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              data-testid="first-round-guide-dismiss"
              onClick={() => setIsOpen(false)}
              className="w-full bg-[#A3E635] hover:bg-[#84cc16] text-black border-4 border-black font-black py-3 px-4 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all text-sm uppercase tracking-wider"
            >
              {t('lobby.guideDismiss')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
