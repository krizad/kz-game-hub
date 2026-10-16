'use client';

import { useState } from 'react';
import { DOG_RELAY_CARDS } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function DogRelayCard({
  cardId,
  selected = false,
  onSelect,
  disabled = false,
}: {
  cardId: string;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const { language } = useTranslate();
  const [failedImage, setFailedImage] = useState(false);
  const card = DOG_RELAY_CARDS.find((item) => item.id === cardId);
  if (!card) return null;
  const content = (
    <>
      <span className="text-xs font-mono font-black">
        #{String(card.number).replace(/^#/, '').padStart(3, '0')}
      </span>
      {card.imageSrc && !failedImage && (
        <img
          src={card.imageSrc}
          alt=""
          onError={() => setFailedImage(true)}
          className="w-full aspect-square object-contain"
        />
      )}
      <strong className="block text-base break-words">{card.name[language]}</strong>
      <span className="block text-sm font-medium">{card.description[language]}</span>
    </>
  );
  const className = `border-2 border-black p-3 text-left min-w-0 shadow-[3px_3px_0_0_#000] ${selected ? 'bg-amber-300 ring-2 ring-black' : 'bg-white'} disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`;
  return onSelect ? (
    <button
      type="button"
      data-testid={`dog-relay-card-${cardId}`}
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
      className={className}
    >
      {content}
    </button>
  ) : (
    <div data-testid={`dog-relay-card-${cardId}`} className={className}>
      {content}
    </div>
  );
}
