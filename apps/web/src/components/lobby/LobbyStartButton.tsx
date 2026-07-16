'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function LobbyStartButton() {
  const { room, startGame, submitWordsWhoAmI, isLoading } = useGameStore();
  const { t } = useTranslate();
  const [showHostWordModal, setShowHostWordModal] = useState(false);
  const [hostWordInputs, setHostWordInputs] = useState<Record<string, string>>({});

  if (!room) return null;

  const isHost = useGameStore.getState().socketId === room.roomHostId;

  if (!isHost) {
    return (
      <div className="w-full max-w-xs bg-amber-100/50 text-slate-600 border border-amber-200 font-bold text-sm py-4 rounded-xl text-center uppercase tracking-widest">
        {t('lobby.waitingForHost')}
      </div>
    );
  }

  const getMinPlayers = () => {
    switch (room.gameType) {
      case GameType.WHO_KNOW:
      case GameType.SOUNDS_FISHY:
        return 4;
      case GameType.DETECTIVE_CLUB:
        return 3;
      case GameType.MUSIC_TRIVIA:
        return 2;
      case GameType.THE_MIND:
        return 2;
      case GameType.WHO_AM_I:
      default:
        return 2;
    }
  };

  const minPlayers = getMinPlayers();
  const notEnoughPlayers = room.players.length < minPlayers;

  const isDisabled =
    notEnoughPlayers ||
    (room.gameType === GameType.MUSIC_TRIVIA && !room.config?.musicTriviaQuery?.trim()) ||
    (room.gameType === GameType.WHO_AM_I &&
      room.config?.wordMode === 'RANDOM' &&
      !room.config?.wordCategory);

  const getButtonText = () => {
    if (notEnoughPlayers) {
      return t('lobby.waitingMin', { count: minPlayers });
    }
    if (isLoading) {
      return t('lobby.startingGame');
    }
    return t('lobby.startGame');
  };

  const handleStart = () => {
    if (room.gameType === GameType.WHO_AM_I && room.config?.wordMode === 'HOST_INPUT') {
      const inputs: Record<string, string> = {};
      room.players
        .filter((p) => p.socketId !== useGameStore.getState().socketId)
        .forEach((p) => {
          inputs[p.socketId] = '';
        });
      setHostWordInputs(inputs);
      setShowHostWordModal(true);
    } else {
      startGame();
    }
  };

  return (
    <>
      <button
        onClick={handleStart}
        disabled={isDisabled}
        className={`w-full max-w-xs text-white font-black text-lg py-4 rounded-xl transition-colors uppercase tracking-widest shadow-lg ${
          isDisabled
            ? 'bg-slate-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'
        }`}
      >
        {getButtonText()}
      </button>

      {/* Host Word Modal for Who Am I */}
      {showHostWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-50/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-indigo-500/50 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="p-6 md:p-8 flex flex-col gap-6 overflow-hidden flex-1">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-2">
                  📝 Set Words
                </h3>
                <p className="text-slate-600 font-medium text-sm">
                  Assign a word to each player. You (Host) won't get a word and will act as a
                  spectator/moderator for this match.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {room.players
                  .filter((p) => p.socketId !== useGameStore.getState().socketId)
                  .map((p) => (
                    <div
                      key={p.socketId}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-3"
                    >
                      <label className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                        {p.name}
                      </label>
                      <input
                        id={`hostWordInput-${p.socketId}`}
                        name={`playerWord-${p.socketId}`}
                        autoComplete="off"
                        type="text"
                        value={hostWordInputs[p.socketId] || ''}
                        onChange={(e) =>
                          setHostWordInputs((prev) => ({ ...prev, [p.socketId]: e.target.value }))
                        }
                        placeholder="Enter a character, animal, object..."
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>
                  ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowHostWordModal(false)}
                  className="flex-1 bg-amber-100 hover:bg-amber-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={Object.values(hostWordInputs).some((w) => !w.trim())}
                  onClick={() => {
                    const cleanInputs: Record<string, string> = {};
                    for (const [id, word] of Object.entries(hostWordInputs)) {
                      cleanInputs[id] = word.trim();
                    }
                    setShowHostWordModal(false);
                    submitWordsWhoAmI(cleanInputs);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  Start Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
