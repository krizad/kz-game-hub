'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType, getBananaThiefRequiredPlayerCount } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { GameDialog } from '@/components/core/GameDialog';
import { translateServerError } from '@/i18n/serverErrors';

export function LobbyStartButton() {
  const { room, startGame, submitWordsWhoAmI, isLoading, artistPresets, gameStartError } =
    useGameStore();
  const { t, language } = useTranslate();
  const [showHostWordModal, setShowHostWordModal] = useState(false);
  const [hostWordDraft, setHostWordDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!room) return;
    const activePlayerIds = new Set(room.players.map((p) => p.id));
    setHostWordDraft((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [id, word] of Object.entries(prev)) {
        if (activePlayerIds.has(id)) {
          next[id] = word;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [room?.players]);

  if (!room) return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  if (!isHost) {
    return (
      <div className="w-full max-w-xs flex flex-col items-center gap-2">
        <div className="w-full bg-white text-black border-4 border-black shadow-[4px_4px_0_0_#000] font-black text-sm py-4 text-center uppercase tracking-widest">
          {t('lobby.waitingForHost')}
        </div>
        {gameStartError && (
          <p
            id="game-start-error"
            data-testid="game-start-error"
            className="w-full max-w-sm text-sm text-center font-bold text-red-600 bg-red-100 border-2 border-red-500 px-3 py-2"
          >
            {translateServerError(gameStartError, language)}
          </p>
        )}
      </div>
    );
  }

  const getMinPlayers = () => {
    switch (room.gameType) {
      case GameType.WHO_KNOW:
        return 4;
      case GameType.SOUNDS_FISHY:
      case GameType.DETECTIVE_CLUB:
      case GameType.SABOTEUR:
      case GameType.COUP:
        return 3;
      case GameType.MUSIC_TRIVIA:
      case GameType.POKER:
        return 2;
      case GameType.THE_MIND:
        return 2;
      case GameType.BANANA_THIEF:
        return getBananaThiefRequiredPlayerCount(room.config).min;
      case GameType.WHO_AM_I:
        return room.config.wordMode === 'HOST_INPUT' ? 3 : 2;
      default:
        return 2;
    }
  };

  const minPlayers = getMinPlayers();
  const notEnoughPlayers =
    room.players.filter((p) => !p.isViewer && p.connected !== false).length < minPlayers;
  const presetId = room.config.musicTriviaArtistPresetId;
  const preset = artistPresets.find((p) => p.id === presetId);
  const level = (room.config.musicTriviaLevel ?? 'EASY').toLowerCase() as
    | 'easy'
    | 'medium'
    | 'hard';
  const startReason =
    room.gameType === GameType.MUSIC_TRIVIA
      ? presetId
        ? !preset?.enabled
          ? 'lobby.musicPresetUnavailable'
          : preset.trackCounts[level] === 0
            ? 'lobby.musicPresetEmpty'
            : undefined
        : !room.config.musicTriviaQuery?.trim()
          ? 'lobby.musicQueryMissing'
          : undefined
      : room.gameType === GameType.WHO_AM_I &&
          room.config.wordMode === 'RANDOM' &&
          !room.config.wordCategory
        ? 'lobby.wordCategoryMissing'
        : undefined;

  const isDisabled = notEnoughPlayers || isLoading || !!startReason;

  const getButtonText = () => {
    if (notEnoughPlayers) {
      return t('lobby.waitingMin', { count: minPlayers });
    }
    if (isLoading) {
      return t('lobby.startingGame');
    }
    return t('lobby.startGame');
  };

  const currentSocketId = useGameStore.getState().socketId;
  const targetPlayers =
    room.gameType === GameType.WHO_AM_I && room.config?.wordMode === 'HOST_INPUT'
      ? room.players.filter(
          (p) => p.socketId !== currentSocketId && !p.isViewer && p.connected !== false,
        )
      : [];

  const handleStart = () => {
    if (room.gameType === GameType.WHO_AM_I && room.config?.wordMode === 'HOST_INPUT') {
      setShowHostWordModal(true);
    } else {
      startGame();
    }
  };

  return (
    <>
      <button
        data-testid="lobby-start-game"
        aria-describedby={
          gameStartError ? 'game-start-error' : startReason ? 'lobby-start-reason' : undefined
        }
        onClick={handleStart}
        disabled={isDisabled}
        className={`w-full max-w-xs text-white border-4 border-black font-black text-lg py-4 transition-all uppercase tracking-widest ${
          isDisabled
            ? 'bg-[#9CA3AF] cursor-not-allowed shadow-[4px_4px_0_0_#000]'
            : 'bg-[#22C55E] hover:bg-[#16A34A] shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]'
        }`}
      >
        {getButtonText()}
      </button>
      {gameStartError && (
        <p
          id="game-start-error"
          data-testid="game-start-error"
          className="w-full max-w-sm text-sm text-center font-bold text-red-600 bg-red-100 border-2 border-red-500 px-3 py-2 mt-2"
        >
          {translateServerError(gameStartError, language)}
        </p>
      )}
      {startReason && !gameStartError && (
        <p
          id="lobby-start-reason"
          data-testid="lobby-start-reason"
          className="max-w-sm text-sm text-center font-bold"
        >
          {t(startReason)}
        </p>
      )}

      {/* Host Word Modal for Who Am I */}
      {showHostWordModal && (
        <GameDialog
          open={showHostWordModal}
          onClose={() => setShowHostWordModal(false)}
          title={t('gameWhoAmI.lobby.hostWordModalTitle')}
        >
          <div className="bg-[#E879F9] border-4 border-black w-full max-w-lg shadow-[8px_8px_0_0_#000] relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 md:p-8 flex flex-col gap-6 overflow-hidden flex-1">
              <div className="text-center">
                <h3 className="text-2xl font-black text-black uppercase tracking-widest mb-2 bg-white border-2 border-black py-2 rounded-md shadow-[2px_2px_0_0_#000]">
                  {t('gameWhoAmI.lobby.hostWordModalTitle')}
                </h3>
                <p className="text-black font-bold text-sm bg-white p-2 rounded border border-black/20">
                  {t('gameWhoAmI.lobby.hostWordModalDesc')}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {targetPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000] p-3"
                  >
                    <label
                      htmlFor={`hostWordInput-${p.id}`}
                      className="text-sm font-black text-black mb-1 flex items-center gap-2"
                    >
                      {p.name}
                    </label>
                    <input
                      id={`hostWordInput-${p.id}`}
                      name={`playerWord-${p.id}`}
                      data-testid={`host-word-input-${p.id}`}
                      autoComplete="off"
                      type="text"
                      value={hostWordDraft[p.id] || ''}
                      onChange={(e) =>
                        setHostWordDraft((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      placeholder={t('gameWhoAmI.lobby.hostWordPlaceholder')}
                      className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHostWordModal(false)}
                  className="flex-1 bg-white hover:bg-gray-100 text-black border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  {t('gameWhoAmI.lobby.hostWordCancel')}
                </button>
                <button
                  type="button"
                  disabled={
                    targetPlayers.length < 2 ||
                    targetPlayers.some((p) => !hostWordDraft[p.id]?.trim())
                  }
                  onClick={() => {
                    const cleanInputs: Record<string, string> = {};
                    for (const p of targetPlayers) {
                      const word = hostWordDraft[p.id]?.trim();
                      if (word) {
                        cleanInputs[p.socketId] = word;
                      }
                    }
                    setShowHostWordModal(false);
                    submitWordsWhoAmI(cleanInputs);
                  }}
                  className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-gray-400 text-white border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
                >
                  {t('gameWhoAmI.lobby.hostWordStart')}
                </button>
              </div>
            </div>
          </div>
        </GameDialog>
      )}
    </>
  );
}
