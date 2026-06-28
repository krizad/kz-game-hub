'use client';

import { GameType, RoomStatus } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { GobblerView } from '@/components/games/gobbler/GobblerView';
import { TicTacToeView } from '@/components/games/tic-tac-toe/TicTacToeView';
import { RPSView } from '@/components/games/rps/RPSView';
import { SoundsFishyView } from '@/components/games/sounds-fishy/SoundsFishyView';
import { DetectiveClubView } from '@/components/games/detective-club/DetectiveClubView';
import { WhoAmIView } from '@/components/games/who-am-i/WhoAmIView';
import { MusicTriviaView } from '@/components/games/music-trivia/MusicTriviaView';
import { WhoFirstView } from '@/components/games/who-first/WhoFirstView';
import { WhoKnowView } from '@/components/games/who-know/WhoKnowView';
import { PlayerGrid } from '@/components/lobby/PlayerGrid';
import { GameSettingsManager } from '@/components/lobby/GameSettingsManager';
import { LobbyStartButton } from '@/components/lobby/LobbyStartButton';
import { useTranslate } from '@/hooks/useTranslate';

export function GameViewManager() {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (!room) return null;

  const renderGameView = () => {
    if (room.gameType === GameType.GOBBLER_TIC_TAC_TOE) return <GobblerView />;
    if (room.gameType === GameType.TIC_TAC_TOE) return <TicTacToeView />;
    if (room.gameType === GameType.RPS && room.status !== RoomStatus.LOBBY) return <RPSView />;
    if (room.gameType === GameType.SOUNDS_FISHY && room.status !== RoomStatus.LOBBY)
      return <SoundsFishyView />;
    if (room.gameType === GameType.DETECTIVE_CLUB && room.status !== RoomStatus.LOBBY)
      return <DetectiveClubView />;
    if (room.gameType === GameType.WHO_AM_I && room.status !== RoomStatus.LOBBY)
      return <WhoAmIView />;
    if (room.gameType === GameType.MUSIC_TRIVIA && room.status !== RoomStatus.LOBBY)
      return <MusicTriviaView />;
    if (room.gameType === GameType.WHO_FIRST) return <WhoFirstView />;

    return (
      <div className="flex-1 flex flex-col bg-white/80 border border-amber-200 rounded-2xl p-2 sm:p-4 shadow-xl min-h-[300px]">
        {room.status === RoomStatus.LOBBY && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[150px]">
            <h4 className="text-lg font-black uppercase text-indigo-400 tracking-widest bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
              {t('lobby.waitingRoom')}
            </h4>
            <GameSettingsManager />
            <LobbyStartButton />
          </div>
        )}
        {room.status !== RoomStatus.LOBBY && <WhoKnowView />}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 sm:gap-4 relative w-full">
      {/* Left: Players Table (Hidden on mobile/tablet during active game, visible on PC always) */}
      <div
        className={`${room.status === RoomStatus.LOBBY ? 'flex' : 'hidden lg:flex'} lg:flex-none lg:w-72 xl:w-80 flex-col min-h-0`}
      >
        <PlayerGrid />
      </div>

      {/* Right: Game Area */}
      <div className="flex-1 flex flex-col min-w-0">{renderGameView()}</div>
    </div>
  );
}
