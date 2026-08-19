'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function SecretWordModal() {
  const { t } = useTranslate();
  const [secretWordInput, setSecretWordInput] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 w-full h-4 bg-indigo-400 border-b-4 border-black"></div>
        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="text-center">
            <h3 className="text-2xl font-black text-black uppercase tracking-widest mb-2">
              {t('lobby.youAreHost')}
            </h3>
            <p className="text-black font-medium">{t('lobby.enterSecretWordDesc')}</p>
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
              className="w-full bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] - px-4 py-4 text-black focus:outline-none focus:bg-yellow-100 transition-all font-bold text-center text-xl mb-4"
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
              className="w-full bg-indigo-400 hover:bg-indigo-300 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg py-4 uppercase tracking-widest transition-all active:translate-y-1 active:shadow-none"
            >
              {t('lobby.confirmSecretWord')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
