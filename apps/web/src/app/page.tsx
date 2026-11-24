'use client';

import { useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus, Role, GameType } from '@repo/types';

import { Toaster } from 'react-hot-toast';

import { HomeView } from '@/components/lobby/HomeView';
import { InviteView } from '@/components/lobby/InviteView';
import { LoadingFallback } from '@/components/lobby/LoadingFallback';
import { GameChunkFallback } from '@/components/lobby/GameChunkFallback';
import { ConnectionStatus } from '@/components/core/ConnectionStatus';
import { GameErrorBoundary } from '@/components/core/GameErrorBoundary';

const RoleCard = dynamic(() => import('@/components/RoleCard').then((m) => m.RoleCard), {
  ssr: false,
});
const RoomHeader = dynamic(
  () => import('@/components/lobby/RoomHeader').then((m) => m.RoomHeader),
  { ssr: false },
);
const GameViewManager = dynamic(
  () => import('@/components/lobby/GameViewManager').then((m) => m.GameViewManager),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
const SecretWordModal = dynamic(
  () => import('@/components/lobby/SecretWordModal').then((m) => m.SecretWordModal),
  { ssr: false },
);
const GameFeelLayer = dynamic(
  () => import('@/components/core/GameFeelLayer').then((m) => m.GameFeelLayer),
  { ssr: false },
);

// Components extracted to separate files

function GameLobby() {
  const { connect, connected, connectionStatus, room, myRole, secretWord, leaveRoom } =
    useGameStore(
      useShallow((s) => ({
        connect: s.connect,
        connected: s.connected,
        connectionStatus: s.connectionStatus,
        room: s.room,
        myRole: s.myRole,
        secretWord: s.secretWord,
        leaveRoom: s.leaveRoom,
      })),
    );
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room');

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

  if (!connected || connectionStatus !== 'connected') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-amber-50">
        <ConnectionStatus />
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
    <GameFeelLayer>
      <main className="flex min-h-[100dvh] overflow-x-hidden overflow-y-auto flex-col items-center p-2 sm:p-4 md:p-6 lg:p-8 pt-safe pb-safe pl-safe pr-safe bg-[#FEF08A] text-black">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-2 sm:gap-4 md:gap-6 flex-1 relative min-h-0">
          {/* Header */}
          <RoomHeader />

          {/* Role Section at Top */}
          {myRole && room.gameType === GameType.WHO_KNOW && room.status !== RoomStatus.RESULT && (
            <div className="flex-none w-full relative z-0">
              <RoleCard role={myRole} word={secretWord} roomCode={room.code} />
            </div>
          )}

          {/* Main Content Area */}
          <GameErrorBoundary resetKey={`${room.code}:${room.gameType}`} onLeaveRoom={leaveRoom}>
            <GameViewManager />
          </GameErrorBoundary>
        </div>

        {/* Secret Word Setting Modal Handle */}
        {room.status === RoomStatus.WORD_SETTING && myRole === Role.Host && <SecretWordModal />}
      </main>
    </GameFeelLayer>
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
