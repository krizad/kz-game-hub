import { useGameStore } from '@/store/useGameStore';
import { useState } from 'react';

export function SetupPhase() {
  const { room, socketId, detectiveClubSubmitWord } = useGameStore();
  const [wordInput, setWordInput] = useState('');

  if (!room?.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const myPlayer = state.players[socketId];
  const isInformer = myPlayer?.role === 'INFORMER';

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="bg-white border border-amber-200 rounded-xl p-6 text-center w-full shadow-lg">
        <h2 className="text-2xl sm:text-3xl font-black text-indigo-400 mb-2">Setup Phase</h2>
        <p className="text-slate-600">
          {isInformer
            ? 'คุณเป็น Informer! ดูการ์ดในมือแล้วตั้งคำศัพท์ที่สื่อถึงการ์ดของคุณ'
            : 'รอ Informer เลือกคำศัพท์...'}
        </p>
      </div>

      {/* Your Hand - shown for ALL players */}
      {myPlayer && myPlayer.hand.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 sm:p-6 shadow-2xl">
          <h3 className="text-slate-600 font-bold uppercase tracking-widest text-xs mb-4 text-center">
            การ์ดในมือของคุณ
          </h3>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 justify-start sm:justify-center items-center px-4">
            {myPlayer.hand.map((cardUrl, idx) => (
              <div
                key={`hand-${idx}`}
                className="relative flex-shrink-0 w-24 h-36 sm:w-32 sm:h-48 rounded-xl overflow-hidden border-2 border-amber-300 shadow-md transform hover:scale-105 transition-transform"
              >
                <img
                  src={cardUrl}
                  alt={`Card ${idx + 1}`}
                  className="w-full h-full object-cover border-4 border-white rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informer word input */}
      {isInformer ? (
        <div className="w-full max-w-md mx-auto space-y-4 bg-amber-50 p-6 rounded-xl border border-indigo-500/30">
          <p className="text-slate-700 font-medium text-center">
            พิมพ์คำศัพท์ที่เชื่อมโยงกับการ์ดในมือคุณ
          </p>
          <input
            id="wordInput"
            name="word"
            autoComplete="off"
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            placeholder="เช่น อวกาศ, ทะเล, เวทมนตร์..."
            className="w-full bg-white border-2 border-amber-200 focus:border-indigo-500 text-slate-800 px-4 py-3 rounded-xl outline-none transition-all font-medium text-center"
            onKeyDown={(e) =>
              e.key === 'Enter' && wordInput.trim() && detectiveClubSubmitWord(wordInput)
            }
          />
          <button
            onClick={() => detectiveClubSubmitWord(wordInput)}
            disabled={!wordInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-4 py-3 rounded-xl transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider"
          >
            ยืนยันคำศัพท์
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="text-slate-700 font-medium animate-pulse">รอ Informer เลือกคำศัพท์...</p>
        </div>
      )}
    </div>
  );
}
