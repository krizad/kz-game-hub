import { useEffect, useState } from 'react';
import { useTranslate } from '@/hooks/useTranslate';
import { useGameStore } from '@/store/useGameStore';
import { TicTacToeMode } from '@repo/types';
import { GobblerRules } from '../gobbler/GobblerRules';
import { UltimateTicTacToeRules } from '../ultimate-tic-tac-toe/UltimateTicTacToeRules';
import clsx from 'clsx';

export function TicTacToeRules() {
  const { t } = useTranslate();
  const { room } = useGameStore();

  const [activeMode, setActiveMode] = useState<TicTacToeMode>(
    room?.config?.ticTacToeMode || 'CLASSIC',
  );

  const configuredMode = room?.config?.ticTacToeMode || 'CLASSIC';
  useEffect(() => {
    setActiveMode(configuredMode);
  }, [configuredMode]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 font-mono">
      {/* Mode Sub-tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveMode('CLASSIC')}
          className={clsx(
            'p-2 text-xs font-black uppercase border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
            activeMode === 'CLASSIC'
              ? 'bg-yellow-300 text-black'
              : 'bg-white text-black hover:bg-gray-100',
          )}
        >
          {t('gameTicTacToe.modes.classic')}
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('GOBBLER')}
          className={clsx(
            'p-2 text-xs font-black uppercase border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
            activeMode === 'GOBBLER'
              ? 'bg-cyan-300 text-black'
              : 'bg-white text-black hover:bg-gray-100',
          )}
        >
          {t('gameTicTacToe.modes.gobbler')}
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('ULTIMATE')}
          className={clsx(
            'p-2 text-xs font-black uppercase border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
            activeMode === 'ULTIMATE'
              ? 'bg-pink-300 text-black'
              : 'bg-white text-black hover:bg-gray-100',
          )}
        >
          {t('gameTicTacToe.modes.ultimate')}
        </button>
      </div>

      {activeMode === 'GOBBLER' && <GobblerRules />}
      {activeMode === 'ULTIMATE' && <UltimateTicTacToeRules />}
      {activeMode === 'CLASSIC' && (
        <div className="space-y-6">
          <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
              {t('rules.ticTacToe.title')}
            </h3>
            <p className="leading-relaxed font-bold text-black">{t('rules.ticTacToe.desc')}</p>
          </div>
          <div className="bg-yellow-300 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
              {t('rules.ticTacToe.winTitle')}
            </h3>
            <ul className="space-y-3 font-bold text-black">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 text-xl leading-none">🏆</span>
                <span>
                  {t('rules.ticTacToe.winDesc1A')}
                  <strong className="bg-white px-1 border-2 border-black">
                    {t('rules.ticTacToe.winDesc1B')}
                  </strong>
                  {t('rules.ticTacToe.winDesc1C')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 text-xl leading-none">🤝</span>
                <span>
                  {t('rules.ticTacToe.winDesc2A')}
                  <strong className="bg-white px-1 border-2 border-black">
                    {t('rules.ticTacToe.winDesc2B')}
                  </strong>
                  .
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
