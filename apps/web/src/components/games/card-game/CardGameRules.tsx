'use client';

import { useState } from 'react';
import { CardGamePreset } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

const MODES: CardGamePreset[] = ['POK_DENG', 'SLAVE'];

export function CardGameRules() {
  const { room } = useGameStore();
  const { t } = useTranslate();
  const [mode, setMode] = useState<CardGamePreset>(room?.cardGameConfig?.preset ?? 'POK_DENG');

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-mono">
      <div className="flex gap-2">
        {MODES.map((preset) => (
          <button
            key={preset}
            type="button"
            data-testid={`card-game-rules-tab-${preset.toLowerCase()}`}
            onClick={() => setMode(preset)}
            className={`px-3 py-1 border-4 border-black font-black uppercase text-sm transition-all ${
              mode === preset
                ? 'bg-lime-300 shadow-[2px_2px_0_0_#000]'
                : 'bg-white hover:bg-amber-100'
            }`}
          >
            {t(`cardGameSettings.presets.${preset}`)}
          </button>
        ))}
      </div>
      <div
        data-testid="card-game-rules-content"
        className="border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]"
      >
        <p className="whitespace-pre-line text-sm font-bold text-black">
          {t(mode === 'POK_DENG' ? 'cardGameRules.pokDengText' : 'cardGameRules.slaveText')}
        </p>
      </div>
    </div>
  );
}
