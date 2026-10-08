'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, Role, GameType } from '@repo/types';
import { RoleCard } from '@/components/RoleCard';

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
  const { connect, connected, room, myRole, secretWord } = useGameStore();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room');
  const { t } = useTranslate();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      // Read persisted session too: after a reload begins, React state may be
      // empty while the player is still seated and reconnecting to this room.
      const hasRoomSession = !!localStorage.getItem('kz-roomCode');
      if (!useGameStore.getState().room && !hasRoomSession) return;

      event.preventDefault();
      // Browsers show their own localized confirmation text.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, []);

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
    <main className="flex min-h-[100dvh] overflow-x-hidden overflow-y-auto flex-col items-center p-2 sm:p-4 md:p-6 lg:p-8 bg-[#FEF08A] text-black">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-2 sm:gap-4 md:gap-6 flex-1 relative min-h-0">
        {/* Header */}
        <RoomHeader />

        {/* Role Section at Top */}
        {myRole && room.gameType === GameType.WHO_KNOW && (
          <div className="flex-none w-full relative z-0">
            <RoleCard role={myRole} word={secretWord} />
          </div>
        )}

        {/* Main Content Area */}
        <GameViewManager />

      </div>

      {/* Secret Word Setting Modal Handle */}
      {room.status === RoomStatus.WORD_SETTING && myRole === Role.Host && <SecretWordModal />}
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
