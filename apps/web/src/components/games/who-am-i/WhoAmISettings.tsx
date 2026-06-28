'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function WhoAmISettings() {
  const { room, categories, getCategoriesWhoAmI } = useGameStore();
  const { t, language } = useTranslate();

  if (room?.gameType !== 'WHO_AM_I') return null;

  const getWordModeLabel = (mode: string | undefined) => {
    switch (mode) {
      case 'RANDOM':
        return t('lobby.wordModeRandom');
      case 'PLAYER_INPUT':
        return t('lobby.wordModePlayer');
      case 'AI_GENERATED':
        return t('lobby.wordModeAI');
      case 'HOST_INPUT':
      default:
        return t('lobby.wordModeHost');
    }
  };

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  return (
    <>
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
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
              className="w-8 h-8 bg-white border border-amber-300 rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-amber-100"
            >
              -
            </button>
            <span className="text-lg font-bold text-indigo-600 w-8 text-center">
              {room.config.maxRounds || 3}
            </span>
            <button
              onClick={() =>
                useGameStore.getState().updateConfig({
                  maxRounds: Math.min(20, (room.config.maxRounds || 3) + 1),
                })
              }
              className="w-8 h-8 bg-white border border-amber-300 rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-amber-100"
            >
              +
            </button>
          </div>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {t('gameWhoAmI.lobby.roundsCount', { count: room.config.maxRounds || 3 })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('gameWhoAmI.lobby.wordMode')}
        </label>
        {isHost ? (
          <select
            id="wordModeSelect"
            name="wordMode"
            title="Word Mode"
            aria-label="Word Mode"
            value={room.config.wordMode || 'HOST_INPUT'}
            onChange={(e) => {
              const mode = e.target.value as
                | 'HOST_INPUT'
                | 'RANDOM'
                | 'PLAYER_INPUT'
                | 'AI_GENERATED';
              useGameStore.getState().updateConfig({ wordMode: mode });
              if (mode === 'RANDOM') {
                getCategoriesWhoAmI(language);
              }
            }}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value="HOST_INPUT">{t('gameWhoAmI.lobby.modeHostPick')}</option>
            <option value="RANDOM">{t('gameWhoAmI.lobby.modeRandom')}</option>
            <option value="PLAYER_INPUT">{t('gameWhoAmI.lobby.modePlayer')}</option>
            <option value="AI_GENERATED">{t('gameWhoAmI.lobby.modeAi')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {getWordModeLabel(room.config.wordMode)}
          </div>
        )}
      </div>

      {room.config.wordMode === 'RANDOM' && (
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            {t('gameWhoAmI.lobby.category')}
          </label>
          {!isHost && (
            <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
              {room.config.wordCategory || t('gameWhoAmI.lobby.notSelected')}
            </div>
          )}
          {isHost && categories.length === 0 && (
            <p className="text-slate-500 text-sm italic">{t('gameWhoAmI.lobby.noCategories')}</p>
          )}
          {isHost && categories.length > 0 && (
            <select
              id="wordCatSelect"
              name="wordCategory"
              title="Word Category"
              aria-label="Word Category"
              value={room.config.wordCategory || ''}
              onChange={(e) =>
                useGameStore.getState().updateConfig({ wordCategory: e.target.value })
              }
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
            >
              <option value="" disabled>
                {t('gameWhoAmI.lobby.selectCategory')}
              </option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {room.config.wordMode === 'PLAYER_INPUT' && (
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
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
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          ) : (
            <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
              {room.config.wordCategory || t('gameWhoAmI.lobby.anyTopic')}
            </div>
          )}
        </div>
      )}

      {room.config.wordMode === 'AI_GENERATED' && (
        <div>
          <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
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
              className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
              {room.config.wordCategory || t('gameWhoAmI.lobby.randomTopic')}
            </div>
          )}
        </div>
      )}
    </>
  );
}
