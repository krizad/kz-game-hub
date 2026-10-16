'use client';

import { useState } from 'react';
import { DOG_RELAY_CARDS } from '@repo/types';
import { GameDialog } from '@/components/core/GameDialog';
import { useTranslate } from '@/hooks/useTranslate';
import { DogRelayCard } from './DogRelayCard';

export function DogRelayCardCatalog() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslate();
  return (
    <>
      <button
        type="button"
        data-testid="dog-relay-open-catalog"
        onClick={() => setOpen(true)}
        className="min-h-11 border-2 border-black bg-white px-4 py-2 font-bold shadow-[3px_3px_0_0_#000]"
      >
        {t('dogRelay.viewCards', { count: DOG_RELAY_CARDS.length })}
      </button>
      {open && (
        <GameDialog open onClose={() => setOpen(false)} title={t('dogRelay.cardCatalog')}>
          <section
            data-testid="dog-relay-catalog"
            className="max-h-[85dvh] overflow-y-auto border-4 border-black bg-amber-50 p-3 text-black space-y-4"
          >
            <header className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">{t('dogRelay.cardCatalog')}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 border-2 border-black bg-white px-3 font-bold"
              >
                {t('lobby.close')}
              </button>
            </header>
            <p>{t('dogRelay.catalogHint', { count: DOG_RELAY_CARDS.length })}</p>
            <div className="grid grid-cols-2 gap-3">
              {DOG_RELAY_CARDS.map((card) => (
                <DogRelayCard key={card.id} cardId={card.id} />
              ))}
            </div>
          </section>
        </GameDialog>
      )}
    </>
  );
}
