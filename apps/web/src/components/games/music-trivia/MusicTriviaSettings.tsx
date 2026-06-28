'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function MusicTriviaSettings() {
  const { room } = useGameStore();
  const { t } = useTranslate();

  if (room?.gameType !== 'MUSIC_TRIVIA') return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  const getSourceLabel = (source: string | undefined) => {
    switch (source) {
      case 'SPOTIFY':
        return t('gameMusicTrivia.lobby.sourceSpotify');
      case 'YOUTUBE':
        return t('gameMusicTrivia.lobby.sourceYoutube');
      case 'ITUNES':
      default:
        return t('gameMusicTrivia.lobby.sourceItunes');
    }
  };

  const getAttributeLabel = (attr: string | undefined) => {
    switch (attr) {
      case 'artistTerm':
        return t('gameMusicTrivia.lobby.searchArtist');
      case 'songTerm':
        return t('gameMusicTrivia.lobby.searchSong');
      case 'albumTerm':
        return t('gameMusicTrivia.lobby.searchAlbum');
      default:
        return t('gameMusicTrivia.lobby.searchAnything');
    }
  };

  return (
    <>
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('gameMusicTrivia.lobby.musicCategory')}
        </label>
        {isHost ? (
          <input
            autoComplete="off"
            type="text"
            value={room.config.musicTriviaQuery || ''}
            onChange={(e) =>
              useGameStore.getState().updateConfig({ musicTriviaQuery: e.target.value })
            }
            placeholder={t('gameMusicTrivia.lobby.queryPlaceholder')}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
            {room.config.musicTriviaQuery || t('gameMusicTrivia.lobby.waitingForHost')}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('gameMusicTrivia.lobby.musicSource')}
        </label>
        {isHost ? (
          <select
            title="Select music source"
            aria-label="Music source"
            value={room.config.musicTriviaSource || 'ITUNES'}
            onChange={(e) =>
              useGameStore
                .getState()
                .updateConfig({
                  musicTriviaSource: e.target.value as 'ITUNES' | 'SPOTIFY' | 'YOUTUBE',
                })
            }
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ITUNES">{t('gameMusicTrivia.lobby.sourceItunes')}</option>
            <option value="YOUTUBE">{t('gameMusicTrivia.lobby.sourceYoutube')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
            {getSourceLabel(room.config.musicTriviaSource)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            {t('gameMusicTrivia.lobby.region')}
          </label>
          {isHost ? (
            <select
              title="Select music region"
              aria-label="Music region"
              value={room.config.musicTriviaCountry || 'TH'}
              onChange={(e) =>
                useGameStore.getState().updateConfig({ musicTriviaCountry: e.target.value })
              }
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TH">{t('gameMusicTrivia.lobby.regionTh')}</option>
              <option value="US">{t('gameMusicTrivia.lobby.regionIntl')}</option>
            </select>
          ) : (
            <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              {room.config.musicTriviaCountry === 'US'
                ? t('gameMusicTrivia.lobby.regionIntl')
                : t('gameMusicTrivia.lobby.regionTh')}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            {t('gameMusicTrivia.lobby.searchBy')}
          </label>
          {isHost ? (
            <select
              title="Select search attribute"
              aria-label="Search attribute"
              value={room.config.musicTriviaAttribute || ''}
              onChange={(e) =>
                useGameStore.getState().updateConfig({ musicTriviaAttribute: e.target.value })
              }
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('gameMusicTrivia.lobby.searchAnything')}</option>
              <option value="artistTerm">{t('gameMusicTrivia.lobby.searchArtist')}</option>
              <option value="songTerm">{t('gameMusicTrivia.lobby.searchSong')}</option>
              <option value="albumTerm">{t('gameMusicTrivia.lobby.searchAlbum')}</option>
            </select>
          ) : (
            <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 truncate">
              {getAttributeLabel(room.config.musicTriviaAttribute)}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('gameMusicTrivia.lobby.gameMode')}
        </label>
        {isHost ? (
          <select
            id="musicModeSelect"
            name="musicTriviaMode"
            title="Game Mode"
            aria-label="Game Mode"
            value={room.config?.musicTriviaMode || 'TYPING'}
            onChange={(e) => {
              useGameStore
                .getState()
                .updateConfig({ musicTriviaMode: e.target.value as 'TYPING' | 'GAME_MASTER' });
            }}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value="TYPING">{t('gameMusicTrivia.lobby.modeTyping')}</option>
            <option value="GAME_MASTER">{t('gameMusicTrivia.lobby.modeVoice')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {room.config?.musicTriviaMode === 'GAME_MASTER'
              ? t('gameMusicTrivia.lobby.modeVoice')
              : t('gameMusicTrivia.lobby.modeTyping')}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('gameMusicTrivia.lobby.numRounds')}
        </label>
        {isHost ? (
          <select
            id="musicRoundsSelect"
            name="musicTriviaRounds"
            title="Number of Rounds"
            aria-label="Number of Rounds"
            value={room.config?.musicTriviaRounds || 10}
            onChange={(e) => {
              useGameStore
                .getState()
                .updateConfig({ musicTriviaRounds: Number.parseInt(e.target.value, 10) });
            }}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value={5}>{t('gameMusicTrivia.lobby.roundsCount', { count: 5 })}</option>
            <option value={10}>{t('gameMusicTrivia.lobby.roundsCount', { count: 10 })}</option>
            <option value={15}>{t('gameMusicTrivia.lobby.roundsCount', { count: 15 })}</option>
            <option value={20}>{t('gameMusicTrivia.lobby.roundsCount', { count: 20 })}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {t('gameMusicTrivia.lobby.roundsCount', {
              count: room.config?.musicTriviaRounds || 10,
            })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {t('gameMusicTrivia.lobby.audioPlayback')}
        </label>
        {isHost ? (
          <select
            id="musicPlaybackSelect"
            name="musicTriviaAudioPlayback"
            title="Audio Playback"
            aria-label="Audio Playback"
            value={room.config?.musicTriviaAudioPlayback || 'EVERYONE'}
            onChange={(e) => {
              useGameStore
                .getState()
                .updateConfig({
                  musicTriviaAudioPlayback: e.target.value as 'EVERYONE' | 'HOST_ONLY',
                });
            }}
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 appearance-none"
          >
            <option value="EVERYONE">{t('gameMusicTrivia.lobby.playbackEveryone')}</option>
            <option value="HOST_ONLY">{t('gameMusicTrivia.lobby.playbackHostOnly')}</option>
          </select>
        ) : (
          <div className="text-slate-700 font-medium text-sm px-3 py-2 bg-white/50 rounded-lg border border-amber-200/50">
            {room.config?.musicTriviaAudioPlayback === 'HOST_ONLY'
              ? t('gameMusicTrivia.lobby.playbackHostOnly')
              : t('gameMusicTrivia.lobby.playbackEveryone')}
          </div>
        )}
      </div>
    </>
  );
}
