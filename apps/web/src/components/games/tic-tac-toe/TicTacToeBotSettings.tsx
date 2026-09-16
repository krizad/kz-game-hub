'use client';

import { useGameStore } from '@/store/useGameStore';
import { TicTacToeBotDifficulty } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import clsx from 'clsx';

export function TicTacToeBotSettings() {
  const { room, socketId, updateConfig, actionLoading } = useGameStore();
  const { t } = useTranslate();

  if (!room) return null;

  const isHost = room.roomHostId === socketId;
  const isVsBot = !!room.config?.ticTacToeVsBot;
  const currentDifficulty: TicTacToeBotDifficulty = room.config?.ticTacToeBotDifficulty || 'GOD';

  const handleToggleVsBot = (vsBot: boolean) => {
    if (!isHost || actionLoading || vsBot === isVsBot) return;
    updateConfig({
      ticTacToeVsBot: vsBot,
      ...(vsBot ? { ticTacToeBotDifficulty: currentDifficulty } : {}),
    });
  };

  const handleSelectDifficulty = (difficulty: TicTacToeBotDifficulty) => {
    if (!isHost || actionLoading || difficulty === currentDifficulty) return;
    updateConfig({
      ticTacToeVsBot: true,
      ticTacToeBotDifficulty: difficulty,
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto mb-4 font-mono">
      <div className="bg-white border-4 border-black p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Opponent Selection Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <span className="font-black text-black text-sm uppercase tracking-wider">
              {t('gameTicTacToe.bot.title')}
            </span>
          </div>
          {!isHost && (
            <span className="text-xs font-bold text-gray-600 bg-gray-100 border border-black px-2 py-0.5">
              {t('gameTicTacToe.bot.hostSelectingBot')}
            </span>
          )}
        </div>

        {/* PvP vs Bot Selector */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            data-testid="ttt-opponent-pvp"
            disabled={!isHost || actionLoading}
            onClick={() => handleToggleVsBot(false)}
            className={clsx(
              'border-4 border-black p-2.5 flex flex-col items-center justify-center gap-1 transition-all text-center',
              !isVsBot
                ? 'bg-cyan-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                : 'bg-gray-50 hover:bg-gray-100 opacity-70 hover:opacity-100',
              isHost && !actionLoading
                ? 'cursor-pointer active:translate-y-0 active:shadow-none'
                : 'cursor-default',
            )}
          >
            <span className="text-2xl leading-none">👥</span>
            <span className="font-black text-black text-xs sm:text-sm uppercase">
              {t('gameTicTacToe.bot.pvp')}
            </span>
            <span className="text-[11px] text-gray-700 font-medium hidden sm:inline">
              {t('gameTicTacToe.bot.pvpDesc')}
            </span>
          </button>

          <button
            type="button"
            data-testid="ttt-opponent-bot"
            disabled={!isHost || actionLoading}
            onClick={() => handleToggleVsBot(true)}
            className={clsx(
              'border-4 border-black p-2.5 flex flex-col items-center justify-center gap-1 transition-all text-center',
              isVsBot
                ? 'bg-yellow-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                : 'bg-gray-50 hover:bg-gray-100 opacity-70 hover:opacity-100',
              isHost && !actionLoading
                ? 'cursor-pointer active:translate-y-0 active:shadow-none'
                : 'cursor-default',
            )}
          >
            <span className="text-2xl leading-none">🤖</span>
            <span className="font-black text-black text-xs sm:text-sm uppercase">
              {t('gameTicTacToe.bot.vsBot')}
            </span>
            <span className="text-[11px] text-gray-700 font-medium hidden sm:inline">
              {t('gameTicTacToe.bot.vsBotDesc')}
            </span>
          </button>
        </div>

        {/* Bot Difficulty Settings (visible when vsBot is true) */}
        {isVsBot && (
          <div className="pt-2 border-t-2 border-dashed border-gray-300">
            <div className="text-xs font-black text-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>🎯</span>
              <span>{t('gameTicTacToe.bot.difficulty')}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Easy Mode */}
              <button
                type="button"
                data-testid="ttt-diff-easy"
                disabled={!isHost || actionLoading}
                onClick={() => handleSelectDifficulty('EASY')}
                className={clsx(
                  'border-4 border-black p-2.5 flex flex-col items-center justify-center gap-1 transition-all text-center',
                  currentDifficulty === 'EASY'
                    ? 'bg-emerald-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                    : 'bg-gray-50 hover:bg-gray-100 opacity-70 hover:opacity-100',
                  isHost && !actionLoading
                    ? 'cursor-pointer active:translate-y-0 active:shadow-none'
                    : 'cursor-default',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🎲</span>
                  <span className="font-black text-black text-xs sm:text-sm uppercase">
                    {t('gameTicTacToe.bot.easy')}
                  </span>
                </div>
                <span className="text-[11px] text-gray-700 font-medium leading-tight">
                  {t('gameTicTacToe.bot.easyDesc')}
                </span>
              </button>

              {/* God Mode */}
              <button
                type="button"
                data-testid="ttt-diff-god"
                disabled={!isHost || actionLoading}
                onClick={() => handleSelectDifficulty('GOD')}
                className={clsx(
                  'border-4 border-black p-2.5 flex flex-col items-center justify-center gap-1 transition-all text-center',
                  currentDifficulty === 'GOD'
                    ? 'bg-rose-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                    : 'bg-gray-50 hover:bg-gray-100 opacity-70 hover:opacity-100',
                  isHost && !actionLoading
                    ? 'cursor-pointer active:translate-y-0 active:shadow-none'
                    : 'cursor-default',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">👑</span>
                  <span className="font-black text-black text-xs sm:text-sm uppercase">
                    {t('gameTicTacToe.bot.god')}
                  </span>
                </div>
                <span className="text-[11px] text-black font-semibold leading-tight">
                  {t('gameTicTacToe.bot.godDesc')}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
