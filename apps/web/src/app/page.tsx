'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, Role, GameType } from '@repo/types';
import { RoleCard } from '@/components/RoleCard';
import { LeaderboardModal } from '@/components/LeaderboardModal';
import { Toaster } from 'react-hot-toast';

import { HomeView } from '@/components/lobby/HomeView';
import { InviteView } from '@/components/lobby/InviteView';
import { RoomHeader } from '@/components/lobby/RoomHeader';
import { GameViewManager } from '@/components/lobby/GameViewManager';
import { SecretWordModal } from '@/components/lobby/SecretWordModal';
import { LoadingFallback } from '@/components/lobby/LoadingFallback';
import { useTranslate } from '@/hooks/useTranslate';

// Components extracted to separate files

function GameLobby() {
  const { connect, connected, room, myRole } = useGameStore();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room');
  const { t } = useTranslate();

  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  if (!connected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-amber-50">
        <h1 className="text-4xl font-bold animate-pulse text-slate-600">{t('lobby.connecting')}</h1>
      </main>
    );
  }

  if (!room) {
    if (roomQuery) {
      return <InviteView />;
    }
    return <HomeView />;
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center p-2 sm:p-4 md:p-6 lg:p-8 bg-amber-50 text-slate-800">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-2 sm:gap-4 md:gap-6 flex-1 relative">
        {/* Header */}
        <RoomHeader onShowLeaderboard={() => setShowLeaderboard(true)} />

        {/* Role Section at Top */}
        {myRole && room.gameType === GameType.WHO_KNOW && (
          <div className="flex-none w-full relative z-0">
            <RoleCard role={myRole} word={useGameStore.getState().secretWord} />
          </div>
        )}

        {/* Main Content Area */}
        <GameViewManager />

        {/* Phase Footer */}
        {room.status !== RoomStatus.LOBBY && room.gameType === GameType.WHO_KNOW && (
          <footer className="flex-none p-2 sm:p-3 bg-white border border-amber-200 rounded-xl text-center shadow-xl flex items-center justify-center gap-2 sm:gap-3 w-full">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              {t('lobby.phase')}
            </span>
            <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-full text-[10px] sm:text-xs font-black tracking-widest">
              {room.status === 'WORD_SETTING'
                ? t('lobby.secretWordSelection')
                : room.status.replace('_', ' ')}
            </span>
          </footer>
        )}
      </div>

      {/* Secret Word Setting Modal Handle */}
      {room.status === RoomStatus.WORD_SETTING && myRole === Role.Host && <SecretWordModal />}

      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GameLobby />
      <Toaster
        position="bottom-center"
        toastOptions={{
          className:
            '!bg-white !text-slate-800 !border !border-amber-200 !font-bold !tracking-wide rounded-xl',
          success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }}
      />
    </Suspense>
  );
}
