'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from './LanguageSwitcher';

export function ConnectionStatus() {
  const { connectionStatus, room, retryConnection, leaveRoom } = useGameStore();
  const { t } = useTranslate();
  return (
    <section
      data-testid="connection-status"
      role="status"
      className="w-full max-w-lg border-4 border-black bg-white p-6 text-center shadow-[4px_4px_0_0_#000]"
    >
      <LanguageSwitcher />
      <h1 className="mt-3 text-xl font-black">{t(`connection.${connectionStatus}`)}</h1>
      {room && <p className="mt-2 font-bold">{t('connection.room', { code: room.code })}</p>}
      <p className="mt-3 text-sm">{t(room ? 'connection.help' : 'connection.initialHelp')}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <button
          onClick={retryConnection}
          className="min-h-11 border-2 border-black bg-lime-300 px-4 py-2 font-bold"
        >
          {t('connection.retry')}
        </button>
        {room && (
          <button
            onClick={() => {
              if (window.confirm(t('lobby.leaveRoomDesc'))) leaveRoom();
            }}
            className="min-h-11 border-2 border-black px-4 py-2 font-bold"
          >
            {t('lobby.leaveRoomBtn')}
          </button>
        )}
      </div>
    </section>
  );
}
