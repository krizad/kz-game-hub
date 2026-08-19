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
      <div className="w-full max-w-xs bg-white text-black border-4 border-black shadow-[4px_4px_0_0_#000] font-black text-sm py-4 text-center uppercase tracking-widest">
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
        className={`w-full max-w-xs text-white border-4 border-black font-black text-lg py-4 transition-all uppercase tracking-widest ${
          isDisabled
            ? 'bg-[#9CA3AF] cursor-not-allowed shadow-[4px_4px_0_0_#000]'
            : 'bg-[#22C55E] hover:bg-[#16A34A] shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]'
        }`}
      >
        {getButtonText()}
      </button>

      {/* Host Word Modal for Who Am I */}
      {showHostWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#E879F9] border-4 border-black w-full max-w-lg shadow-[8px_8px_0_0_#000] relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 md:p-8 flex flex-col gap-6 overflow-hidden flex-1">
              <div className="text-center">
                <h3 className="text-2xl font-black text-black uppercase tracking-widest mb-2 bg-white border-2 border-black py-2 rounded-md shadow-[2px_2px_0_0_#000]">
                  📝 Set Words
                </h3>
                <p className="text-black font-bold text-sm bg-white p-2 rounded border border-black/20">
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
                      className="bg-white border-4 border-black shadow-[4px_4px_0_0_#000] p-3"
                    >
                      <label className="text-sm font-black text-black mb-1 flex items-center gap-2">
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
                        className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] font-bold"
                      />
                    </div>
                  ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowHostWordModal(false)}
                  className="flex-1 bg-white hover:bg-gray-100 text-black border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]"
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
                  className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-gray-400 text-white border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#000]"
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
