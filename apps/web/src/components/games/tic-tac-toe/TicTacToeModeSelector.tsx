'use client';

import { useGameStore } from '@/store/useGameStore';
import { TicTacToeMode } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import clsx from 'clsx';

const MODES: {
  id: TicTacToeMode;
  icon: string;
  labelKey: 'classic' | 'gobbler' | 'ultimate';
  descKey: 'classicDesc' | 'gobblerDesc' | 'ultimateDesc';
  color: string;
}[] = [
  {
    id: 'CLASSIC',
    icon: '❌⭕️',
    labelKey: 'classic',
    descKey: 'classicDesc',
    color: 'bg-yellow-300',
  },
  {
    id: 'GOBBLER',
    icon: '🦃',
    labelKey: 'gobbler',
    descKey: 'gobblerDesc',
    color: 'bg-cyan-300',
  },
  {
    id: 'ULTIMATE',
    icon: '⚡',
    labelKey: 'ultimate',
    descKey: 'ultimateDesc',
    color: 'bg-pink-300',
  },
];

export function TicTacToeModeSelector() {
  const { room, socketId, updateConfig, actionLoading } = useGameStore();
  const { t } = useTranslate();

  if (!room) return null;

  const isHost = room.roomHostId === socketId;
  const currentMode: TicTacToeMode = room.config?.ticTacToeMode || 'CLASSIC';

  const handleSelectMode = (mode: TicTacToeMode) => {
    if (!isHost || actionLoading || mode === currentMode) return;
    updateConfig({ ticTacToeMode: mode });
  };

  return (
    <div className="w-full max-w-xl mx-auto mb-4 font-mono">
      <div className="bg-white border-4 border-black p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎮</span>
            <span className="font-black text-black text-sm uppercase tracking-wider">
              {t('gameTicTacToe.modes.title')}
            </span>
          </div>
          {!isHost && (
            <span className="text-xs font-bold text-gray-600 bg-gray-100 border border-black px-2 py-0.5">
              {t('gameTicTacToe.modes.hostSelectingMode')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MODES.map((mode) => {
            const isSelected = currentMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                data-testid={`ttt-mode-${mode.id.toLowerCase()}`}
                disabled={!isHost || actionLoading}
                onClick={() => handleSelectMode(mode.id)}
                className={clsx(
                  'border-4 border-black p-2 sm:p-3 flex flex-col items-center justify-center gap-1 transition-all text-center',
                  isSelected
                    ? `${mode.color} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5`
                    : 'bg-gray-50 hover:bg-gray-100 opacity-70 hover:opacity-100',
                  isHost && !actionLoading
                    ? 'cursor-pointer active:translate-y-0 active:shadow-none'
                    : 'cursor-default',
                )}
              >
                <span className="text-xl sm:text-2xl leading-none">{mode.icon}</span>
                <span className="font-black text-black text-xs sm:text-sm uppercase tracking-tight">
                  {t(`gameTicTacToe.modes.${mode.labelKey}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mode description */}
        <div className="mt-2.5 text-center">
          <p className="text-xs text-black font-bold">
            {currentMode === 'GOBBLER' && t('gameTicTacToe.modes.gobblerDesc')}
            {currentMode === 'ULTIMATE' && t('gameTicTacToe.modes.ultimateDesc')}
            {currentMode === 'CLASSIC' && t('gameTicTacToe.modes.classicDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}
