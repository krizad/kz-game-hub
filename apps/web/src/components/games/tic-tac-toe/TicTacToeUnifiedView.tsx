'use client';

import { useGameStore } from '@/store/useGameStore';
import { RoomStatus } from '@repo/types';
import { TicTacToeView } from './TicTacToeView';
import { GobblerView } from '../gobbler/GobblerView';
import { UltimateTicTacToeView } from '../ultimate-tic-tac-toe/UltimateTicTacToeView';
import { TicTacToeModeSelector } from './TicTacToeModeSelector';
import { TicTacToeBotSettings } from './TicTacToeBotSettings';

export function TicTacToeUnifiedView() {
  const { room } = useGameStore();

  if (!room) return null;

  let mode = room.config?.ticTacToeMode;
  if (!mode) {
    if (room.gobblerState) {
      mode = 'GOBBLER';
    } else if (room.ultimateTicTacToeState) {
      mode = 'ULTIMATE';
    } else {
      mode = 'CLASSIC';
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center w-full h-full overflow-y-auto overflow-x-hidden">
      {room.status === RoomStatus.LOBBY && <TicTacToeModeSelector />}
      {room.status === RoomStatus.LOBBY && mode === 'CLASSIC' && <TicTacToeBotSettings />}
      {mode === 'GOBBLER' && <GobblerView />}
      {mode === 'ULTIMATE' && <UltimateTicTacToeView />}
      {mode === 'CLASSIC' && <TicTacToeView />}
    </div>
  );
}
