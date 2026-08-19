'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

export function WhoAmISettings() {
  const { room, categories, getCategoriesWhoAmI } = useGameStore();
  const { t, language } = useTranslate();

  if (room?.gameType !== 'WHO_AM_I') return null;

  const getWordModeLabel = (mode: string | undefined) => {
    switch (mode) {
      case 'RANDOM':
        return t('gameWhoAmI.lobby.modeRandom');
      case 'PLAYER_INPUT':
        return t('gameWhoAmI.lobby.modePlayer');
      case 'AI_GENERATED':
        return t('gameWhoAmI.lobby.modeAi');
      case 'HOST_INPUT':
      default:
        return t('gameWhoAmI.lobby.modeHostPick');
    }
  };

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  return (
    <>
      <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - mb-6">
        <label className="block text-black font-black uppercase tracking-widest mb-2 text-lg">
          {t('gameWhoAmI.lobby.numRounds')}
        </label>
        {isHost ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                useGameStore.getState().updateConfig({
                  maxRounds: Math.max(1, (room.config.maxRounds || 3) - 1),
                })
              }
              className="w-10 h-10 bg-yellow-300 border-4 border-black flex items-center justify-center font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
            >
              -
            </button>
            <span className="text-2xl font-black text-black w-10 text-center">
              {room.config.maxRounds || 3}
            </span>
            <button
              onClick={() =>
                useGameStore.getState().updateConfig({
                  maxRounds: Math.min(20, (room.config.maxRounds || 3) + 1),
                })
              }
              className="w-10 h-10 bg-yellow-300 border-4 border-black flex items-center justify-center font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
            >
              +
            </button>
          </div>
        ) : (
          <div className="text-black font-black text-base px-4 py-2 bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block -">
            {t('gameWhoAmI.lobby.roundsCount', { count: room.config.maxRounds || 3 })}
          </div>
        )}
      </div>

      <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <label className="block text-black font-black uppercase tracking-widest mb-2 text-lg">
          {t('gameWhoAmI.lobby.wordMode')}
        </label>
        {isHost ? (
          <NeobrutalismSelect
            value={room.config.wordMode || 'HOST_INPUT'}
            options={[
              { value: 'HOST_INPUT', label: t('gameWhoAmI.lobby.modeHostPick') },
              { value: 'RANDOM', label: t('gameWhoAmI.lobby.modeRandom') },
              { value: 'PLAYER_INPUT', label: t('gameWhoAmI.lobby.modePlayer') },
              { value: 'AI_GENERATED', label: t('gameWhoAmI.lobby.modeAi') },
            ]}
            onChange={(val) => {
              const mode = val as 'HOST_INPUT' | 'RANDOM' | 'PLAYER_INPUT' | 'AI_GENERATED';
              useGameStore.getState().updateConfig({ wordMode: mode });
              if (mode === 'RANDOM') {
                getCategoriesWhoAmI(language);
              }
            }}
            className="bg-cyan-300 hover:bg-cyan-400"
          />
        ) : (
          <div className="text-black font-black text-base px-4 py-3 bg-cyan-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {getWordModeLabel(room.config.wordMode)}
          </div>
        )}

        {room.config.wordMode === 'RANDOM' && (
          <div className="mt-4 border-t-4 border-black pt-4">
            <label className="block text-black font-black uppercase tracking-widest mb-2">
              {t('gameWhoAmI.lobby.category')}
            </label>
            {!isHost && (
              <div className="text-black font-bold px-4 py-3 bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {room.config.wordCategory || t('gameWhoAmI.lobby.notSelected')}
              </div>
            )}
            {isHost && categories.length === 0 && (
              <p className="text-black font-bold italic">{t('gameWhoAmI.lobby.noCategories')}</p>
            )}
            {isHost && categories.length > 0 && (
              <NeobrutalismSelect
                value={room.config.wordCategory || ''}
                options={[
                  { value: '', label: t('gameWhoAmI.lobby.selectCategory') },
                  ...categories.map((cat) => ({
                    value: cat.name,
                    label: `${cat.name} (${cat.count})`,
                  })),
                ]}
                onChange={(val) => useGameStore.getState().updateConfig({ wordCategory: val })}
                className="bg-pink-300 hover:bg-pink-400"
              />
            )}
          </div>
        )}

        {room.config.wordMode === 'PLAYER_INPUT' && (
          <div className="mt-4 border-t-4 border-black pt-4">
            <label className="block text-black font-black uppercase tracking-widest mb-2">
              {t('gameWhoAmI.lobby.themeOptional')}
            </label>
            {isHost ? (
              <input
                id="themeInput"
                name="wordCategory"
                autoComplete="off"
                type="text"
                value={room.config.wordCategory || ''}
                onChange={(e) =>
                  useGameStore.getState().updateConfig({ wordCategory: e.target.value })
                }
                placeholder={t('gameWhoAmI.lobby.themePlaceholder')}
                className="w-full bg-white border-4 border-black px-4 py-3 text-lg font-black text-black focus:outline-none focus:bg-yellow-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
            ) : (
              <div className="text-black font-bold px-4 py-3 bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {room.config.wordCategory || t('gameWhoAmI.lobby.anyTopic')}
              </div>
            )}
          </div>
        )}

        {room.config.wordMode === 'AI_GENERATED' && (
          <div className="mt-4 border-t-4 border-black pt-4">
            <label className="block text-black font-black uppercase tracking-widest mb-2">
              {t('gameWhoAmI.lobby.aiPrompt')}
            </label>
            {isHost ? (
              <input
                id="aiPromptInput"
                name="aiPrompt"
                autoComplete="off"
                type="text"
                value={room.config.wordCategory || ''}
                onChange={(e) =>
                  useGameStore.getState().updateConfig({ wordCategory: e.target.value })
                }
                placeholder={t('gameWhoAmI.lobby.aiPromptPlaceholder')}
                className="w-full bg-white border-4 border-black px-4 py-3 text-lg font-black text-black focus:outline-none focus:bg-indigo-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
            ) : (
              <div className="text-black font-bold px-4 py-3 bg-indigo-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {room.config.wordCategory || t('gameWhoAmI.lobby.randomTopic')}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
