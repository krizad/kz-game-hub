import React from 'react';
import { useTranslate } from '@/hooks/useTranslate';

export function UltimateTicTacToeRules() {
  const { t } = useTranslate();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      {/* Intro Card */}
      <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.ultimateTTT.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black text-sm">
          {t('rules.ultimateTTT.desc')}
        </p>
      </div>

      {/* 4 Core Rules */}
      <div className="bg-yellow-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-3 border-b-4 border-black border-dashed pb-1">
          {t('rules.ultimateTTT.rulesTitle')}
        </h3>
        <ul className="space-y-3 font-bold text-black text-sm">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 text-xl leading-none">📐</span>
            <span>
              <strong className="bg-white px-1 border-2 border-black mr-1">
                1. {t('rules.ultimateTTT.rule1Title')}:
              </strong>{' '}
              {t('rules.ultimateTTT.rule1Desc')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 text-xl leading-none">🎯</span>
            <span>
              <strong className="bg-white px-1 border-2 border-black mr-1">
                2. {t('rules.ultimateTTT.rule2Title')}:
              </strong>{' '}
              {t('rules.ultimateTTT.rule2Desc')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 text-xl leading-none">🚩</span>
            <span>
              <strong className="bg-white px-1 border-2 border-black mr-1">
                3. {t('rules.ultimateTTT.rule3Title')}:
              </strong>{' '}
              {t('rules.ultimateTTT.rule3Desc')}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 text-xl leading-none">⚡</span>
            <span>
              <strong className="bg-white px-1 border-2 border-black mr-1">
                4. {t('rules.ultimateTTT.rule4Title')}:
              </strong>{' '}
              {t('rules.ultimateTTT.rule4Desc')}
            </span>
          </li>
        </ul>
      </div>

      {/* Visual Diagram of Turn Forwarding */}
      <div className="bg-purple-100 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1 flex items-center gap-2">
          <span>💡</span> {t('rules.ultimateTTT.diagramTitle')}
        </h3>
        <p className="text-xs font-bold text-slate-800 mb-4 leading-relaxed">
          {t('rules.ultimateTTT.diagramDesc')}
        </p>

        {/* Mini Visual Grid */}
        <div className="flex flex-col items-center justify-center p-3 bg-white border-2 border-black">
          <div className="grid grid-cols-3 gap-1.5 w-56 h-56 p-1.5 bg-black border-2 border-black">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((macroIdx) => {
              const isTargetBoard = macroIdx === 2;
              const isSourceBoard = macroIdx === 4;

              let boardBgClass = 'bg-white opacity-60';
              if (isTargetBoard) {
                boardBgClass = 'bg-yellow-300 ring-2 ring-yellow-500 animate-pulse';
              } else if (isSourceBoard) {
                boardBgClass = 'bg-cyan-100 ring-2 ring-cyan-500';
              }

              let boardContent: React.ReactNode = (
                <div className="text-[10px] font-black text-slate-300">{macroIdx + 1}</div>
              );

              if (isSourceBoard) {
                boardContent = (
                  <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((microIdx) => {
                      const isMoveCell = microIdx === 2;
                      return (
                        <div
                          key={microIdx}
                          className={`flex items-center justify-center text-[9px] font-black ${
                            isMoveCell
                              ? 'bg-cyan-400 text-black border border-black animate-bounce'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isMoveCell ? 'X' : ''}
                        </div>
                      );
                    })}
                  </div>
                );
              } else if (isTargetBoard) {
                boardContent = (
                  <div className="flex flex-col items-center justify-center text-center p-1">
                    <span className="text-lg leading-none">🎯</span>
                    <span className="text-[8px] font-black text-black leading-tight mt-0.5">
                      NEXT TURN
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={macroIdx}
                  className={`relative flex flex-col items-center justify-center transition-all ${boardBgClass}`}
                >
                  {boardContent}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs font-black text-black bg-yellow-200 border border-black px-3 py-1 text-center">
            <span>🎯</span>
            <span>{t('rules.ultimateTTT.diagramTargetNotice')}</span>
          </div>
        </div>
      </div>

      {/* Win Condition Card */}
      <div className="bg-cyan-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('rules.ultimateTTT.winTitle')}
        </h3>
        <p className="leading-relaxed font-bold text-black text-sm">
          {t('rules.ultimateTTT.winDesc')}
        </p>
      </div>
    </div>
  );
}
