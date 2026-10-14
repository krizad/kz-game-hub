'use client';

import { useTranslate } from '@/hooks/useTranslate';
import { useGameStore } from '@/store/useGameStore';
import { RoomStatus } from '@repo/types';

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslate();
  const room = useGameStore((state) => state.room);
  const socketId = useGameStore((state) => state.socketId);
  const updateConfig = useGameStore((state) => state.updateConfig);
  const isHost = room?.roomHostId === socketId;

  const handleSetLanguage = (lang: 'en' | 'th') => {
    setLanguage(lang);
    if (isHost && room?.status === RoomStatus.LOBBY) {
      updateConfig({ language: lang });
    }
  };

  return (
    <div className="flex gap-1 bg-amber-100/50 p-1 rounded-lg border border-amber-300/50 z-50">
      <button
        onClick={() => handleSetLanguage('en')}
        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
          language === 'en'
            ? 'bg-indigo-600 text-white '
            : 'text-slate-600 hover:text-slate-800 hover:bg-amber-200/50'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleSetLanguage('th')}
        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
          language === 'th'
            ? 'bg-indigo-600 text-white '
            : 'text-slate-600 hover:text-slate-800 hover:bg-amber-200/50'
        }`}
      >
        TH
      </button>
    </div>
  );
}
