'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { NeobrutalismSelect } from '@/components/core/NeobrutalismSelect';

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
      case 'DEEZER':
        return t('gameMusicTrivia.lobby.sourceDeezer');
      case 'SOUNDCLOUD':
        return t('gameMusicTrivia.lobby.sourceSoundcloud');
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
      case '':
      default:
        return t('gameMusicTrivia.lobby.searchAnything');
    }
  };

  return (
    <>
      <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - mb-6">
        <h4 className="font-black text-xl text-black uppercase tracking-widest mb-4 border-b-4 border-black pb-2 inline-block -">
          {t('gameMusicTrivia.lobby.musicSource')}
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.sourceLabel')}
            </label>
            {isHost ? (
              <NeobrutalismSelect
                value={room.config.musicTriviaSource || 'ITUNES'}
                options={[
                  { value: 'ITUNES', label: t('gameMusicTrivia.lobby.sourceItunes') },
                  { value: 'SPOTIFY', label: t('gameMusicTrivia.lobby.sourceSpotify') },
                  { value: 'YOUTUBE', label: t('gameMusicTrivia.lobby.sourceYoutube') },
                  { value: 'DEEZER', label: t('gameMusicTrivia.lobby.sourceDeezer') },
                  { value: 'SOUNDCLOUD', label: t('gameMusicTrivia.lobby.sourceSoundcloud') },
                ]}
                onChange={(val) =>
                  useGameStore.getState().updateConfig({
                    musicTriviaSource: val as
                      | 'ITUNES'
                      | 'SPOTIFY'
                      | 'YOUTUBE'
                      | 'DEEZER'
                      | 'SOUNDCLOUD',
                  })
                }
                className="bg-white hover:bg-gray-100"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {getSourceLabel(room.config.musicTriviaSource)}
              </div>
            )}
          </div>

          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.regionLabel')}
            </label>
            {isHost ? (
              <NeobrutalismSelect
                value={room.config.musicTriviaCountry || 'TH'}
                options={[
                  { value: 'TH', label: t('gameMusicTrivia.lobby.regionTh') },
                  { value: 'US', label: t('gameMusicTrivia.lobby.regionIntl') },
                ]}
                onChange={(val) =>
                  useGameStore.getState().updateConfig({ musicTriviaCountry: val })
                }
                className="bg-white hover:bg-gray-100"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {room.config.musicTriviaCountry === 'US'
                  ? t('gameMusicTrivia.lobby.regionIntl')
                  : t('gameMusicTrivia.lobby.regionTh')}
              </div>
            )}
          </div>

          {room.config.musicTriviaSource === 'ITUNES' && (
            <div>
              <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
                {t('gameMusicTrivia.lobby.searchCriteria')}
              </label>
              {isHost ? (
                <NeobrutalismSelect
                  value={room.config.musicTriviaAttribute || ''}
                  options={[
                    { value: '', label: t('gameMusicTrivia.lobby.searchAnything') },
                    { value: 'artistTerm', label: t('gameMusicTrivia.lobby.searchArtist') },
                    { value: 'songTerm', label: t('gameMusicTrivia.lobby.searchSong') },
                    { value: 'albumTerm', label: t('gameMusicTrivia.lobby.searchAlbum') },
                  ]}
                  onChange={(val) =>
                    useGameStore.getState().updateConfig({ musicTriviaAttribute: val })
                  }
                  className="bg-white hover:bg-gray-100"
                />
              ) : (
                <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] truncate">
                  {getAttributeLabel(room.config.musicTriviaAttribute)}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.searchKeywords')}
            </label>
            {isHost ? (
              <input
                id="musicSearchTermInput"
                name="musicTriviaQuery"
                autoComplete="off"
                type="text"
                value={room.config.musicTriviaQuery || ''}
                onChange={(e) =>
                  useGameStore.getState().updateConfig({ musicTriviaQuery: e.target.value })
                }
                placeholder={t('gameMusicTrivia.lobby.searchPlaceholder')}
                className="w-full bg-white border-4 border-black px-4 py-3 text-lg font-bold text-black focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform focus:-translate-y-1"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] truncate">
                {room.config.musicTriviaQuery || t('gameMusicTrivia.lobby.anyTopic')}
              </div>
            )}
            <p className="text-xs text-black font-bold mt-2 bg-yellow-300 border-2 border-black inline-block px-2 py-1 ">
              {t('gameMusicTrivia.lobby.searchHint')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h4 className="font-black text-xl text-black uppercase tracking-widest mb-4 border-b-4 border-black pb-2 inline-block -">
          {t('gameMusicTrivia.lobby.gameRules')}
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.gameMode')}
            </label>
            {isHost ? (
              <NeobrutalismSelect
                value={room.config?.musicTriviaMode || 'TYPING'}
                options={[
                  { value: 'TYPING', label: t('gameMusicTrivia.lobby.modeTyping') },
                  { value: 'GAME_MASTER', label: t('gameMusicTrivia.lobby.modeVoice') },
                ]}
                onChange={(val) => {
                  useGameStore
                    .getState()
                    .updateConfig({ musicTriviaMode: val as 'TYPING' | 'GAME_MASTER' });
                }}
                className="bg-white hover:bg-gray-100"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {room.config?.musicTriviaMode === 'GAME_MASTER'
                  ? t('gameMusicTrivia.lobby.modeVoice')
                  : t('gameMusicTrivia.lobby.modeTyping')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.numRounds')}
            </label>
            {isHost ? (
              <NeobrutalismSelect
                value={room.config?.musicTriviaRounds || 10}
                options={[
                  { value: '5', label: t('gameMusicTrivia.lobby.roundsCount', { count: 5 }) },
                  { value: '10', label: t('gameMusicTrivia.lobby.roundsCount', { count: 10 }) },
                  { value: '15', label: t('gameMusicTrivia.lobby.roundsCount', { count: 15 }) },
                  { value: '20', label: t('gameMusicTrivia.lobby.roundsCount', { count: 20 }) },
                  { value: '25', label: t('gameMusicTrivia.lobby.roundsCount', { count: 25 }) },
                ]}
                onChange={(val) => {
                  useGameStore
                    .getState()
                    .updateConfig({ musicTriviaRounds: Number.parseInt(val, 10) });
                }}
                className="bg-white hover:bg-gray-100"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {t('gameMusicTrivia.lobby.roundsCount', {
                  count: room.config?.musicTriviaRounds || 10,
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.answerTimeout')}
            </label>
            {isHost ? (
              <NeobrutalismSelect
                value={room.config?.musicTriviaAnswerTimeoutMs || 15000}
                options={[
                  { value: '5000', label: `5 ${t('lobby.seconds') || 'Sec'}` },
                  { value: '10000', label: `10 ${t('lobby.seconds') || 'Sec'}` },
                  { value: '15000', label: `15 ${t('lobby.seconds') || 'Sec'}` },
                  { value: '20000', label: `20 ${t('lobby.seconds') || 'Sec'}` },
                  { value: '30000', label: `30 ${t('lobby.seconds') || 'Sec'}` },
                  { value: '60000', label: `60 ${t('lobby.seconds') || 'Sec'}` },
                ]}
                onChange={(val) => {
                  useGameStore.getState().updateConfig({
                    musicTriviaAnswerTimeoutMs: Number.parseInt(val, 10),
                  });
                }}
                className="bg-white hover:bg-gray-100"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {(room.config?.musicTriviaAnswerTimeoutMs || 15000) / 1000}{' '}
                {t('lobby.seconds') || 'Sec'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
              {t('gameMusicTrivia.lobby.audioPlayback')}
            </label>
            {isHost ? (
              <NeobrutalismSelect
                value={room.config?.musicTriviaAudioPlayback || 'EVERYONE'}
                options={[
                  { value: 'EVERYONE', label: t('gameMusicTrivia.lobby.playbackEveryone') },
                  { value: 'HOST_ONLY', label: t('gameMusicTrivia.lobby.playbackHostOnly') },
                ]}
                onChange={(val) => {
                  useGameStore.getState().updateConfig({
                    musicTriviaAudioPlayback: val as 'EVERYONE' | 'HOST_ONLY',
                  });
                }}
                className="bg-white hover:bg-gray-100"
              />
            ) : (
              <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {room.config?.musicTriviaAudioPlayback === 'HOST_ONLY'
                  ? t('gameMusicTrivia.lobby.playbackHostOnly')
                  : t('gameMusicTrivia.lobby.playbackEveryone')}
              </div>
            )}
            <p className="text-xs text-black font-bold mt-2 bg-yellow-300 border-2 border-black inline-block px-2 py-1 ">
              {room.config?.musicTriviaAudioPlayback === 'HOST_ONLY'
                ? t('gameMusicTrivia.lobby.playbackHostHint')
                : t('gameMusicTrivia.lobby.playbackEveryoneHint')}
            </p>
          </div>

          {room.config?.musicTriviaMode === 'TYPING' && (
            <div>
              <label className="block text-black font-black uppercase tracking-widest mb-2 text-sm">
                {t('gameMusicTrivia.lobby.answerCriteria')}
              </label>
              {isHost ? (
                <NeobrutalismSelect
                  value={room.config?.musicTriviaAnswerCriteria || 'ANY'}
                  options={[
                    { value: 'ANY', label: t('gameMusicTrivia.lobby.answerAny') },
                    { value: 'TITLE', label: t('gameMusicTrivia.lobby.answerTitle') },
                    { value: 'ARTIST', label: t('gameMusicTrivia.lobby.answerArtist') },
                  ]}
                  onChange={(val) => {
                    useGameStore.getState().updateConfig({
                      musicTriviaAnswerCriteria: val as 'ANY' | 'TITLE' | 'ARTIST',
                    });
                  }}
                  className="bg-white hover:bg-gray-100"
                />
              ) : (
                <div className="text-black font-black text-lg px-4 py-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {room.config?.musicTriviaAnswerCriteria === 'TITLE'
                    ? t('gameMusicTrivia.lobby.answerTitle')
                    : room.config?.musicTriviaAnswerCriteria === 'ARTIST'
                      ? t('gameMusicTrivia.lobby.answerArtist')
                      : t('gameMusicTrivia.lobby.answerAny')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
