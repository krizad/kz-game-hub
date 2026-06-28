'use client';

import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';

import { WhoKnowSettings } from '@/components/games/who-know/WhoKnowSettings';
import { RpsSettings } from '@/components/games/rps/RpsSettings';
import { WhoAmISettings } from '@/components/games/who-am-i/WhoAmISettings';
import { MusicTriviaSettings } from '@/components/games/music-trivia/MusicTriviaSettings';

export function GameSettingsManager() {
  const { room } = useGameStore();

  if (!room) return null;

  const hasSettings =
    room.gameType === GameType.WHO_KNOW ||
    room.gameType === GameType.RPS ||
    room.gameType === GameType.WHO_AM_I ||
    room.gameType === GameType.MUSIC_TRIVIA;

  if (!hasSettings) return null;

  return (
    <div className="w-full max-w-sm bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-4">
      {room.gameType === GameType.WHO_KNOW && <WhoKnowSettings />}
      {room.gameType === GameType.RPS && <RpsSettings />}
      {room.gameType === GameType.WHO_AM_I && <WhoAmISettings />}
      {room.gameType === GameType.MUSIC_TRIVIA && <MusicTriviaSettings />}
    </div>
  );
}
