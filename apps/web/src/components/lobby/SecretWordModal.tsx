'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function SecretWordModal() {
  const { t } = useTranslate();
  const [secretWordInput, setSecretWordInput] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-50/80 backdrop-blur-sm p-4">
      <div className="bg-white border border-indigo-500/50 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="text-center">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-2">
              {t('lobby.youAreHost')}
            </h3>
            <p className="text-slate-600 font-medium">{t('lobby.enterSecretWordDesc')}</p>
          </div>

          <div>
            <input
              id="secretWordModalInput"
              name="secretWord"
              title="Secret Word"
              aria-label="Secret Word"
              autoComplete="off"
              type="text"
              value={secretWordInput}
              onChange={(e) => setSecretWordInput(e.target.value)}
              placeholder={t('lobby.typeSecretWord')}
              className="w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center text-xl shadow-inner mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    useGameStore.getState().setWord(val);
                    setSecretWordInput('');
                  }
                }
              }}
            />
            <button
              onClick={() => {
                if (secretWordInput.trim()) {
                  useGameStore.getState().setWord(secretWordInput.trim());
                  setSecretWordInput('');
                }
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              {t('lobby.confirmSecretWord')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
