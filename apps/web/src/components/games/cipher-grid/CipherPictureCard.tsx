'use client';

import { useState } from 'react';
import { getCipherGridPicture, type CipherCardType, type CipherGridPicturePack } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function CipherPictureImage({
  pictureId,
  full = false,
  pack = 'MINIMAL',
}: {
  pictureId: string;
  full?: boolean;
  pack?: CipherGridPicturePack;
}) {
  const { t, language } = useTranslate();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const picture = getCipherGridPicture(pictureId, pack);
  if (!picture || failed)
    return (
      <div role="status" className="p-2 text-xs font-bold text-center">
        <p>{t('cipherGrid.imageFailed')}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setRetry(retry + 1);
            setFailed(false);
          }}
          className="min-h-11 border border-black bg-white p-2"
        >
          {t('cipherGrid.retry')}
        </button>
      </div>
    );
  return (
    <img
      key={`${pack}-${retry}`}
      src={`${full ? picture.src : picture.thumbnail}?retry=${retry}`}
      alt={picture.alt[language]}
      onError={() => setFailed(true)}
      className={
        full ? 'w-full max-h-[60dvh] object-contain' : 'w-full aspect-square object-contain'
      }
    />
  );
}

export function CipherPictureCard({
  pictureId,
  index,
  revealed,
  cardType,
  selected,
  pingCount,
  pack = 'MINIMAL',
  onSelect,
  onZoom,
}: {
  pictureId: string;
  index: number;
  revealed: boolean;
  cardType: CipherCardType | null;
  selected: boolean;
  pingCount: number;
  pack?: CipherGridPicturePack;
  onSelect?: () => void;
  onZoom: () => void;
}) {
  const { t } = useTranslate();
  const symbol =
    cardType === 'SOLAR'
      ? '☀️'
      : cardType === 'LUNAR'
        ? '🌙'
        : cardType === 'VIRUS'
          ? '💀'
          : cardType === 'DECOY'
            ? '⚪'
            : '';
  const border =
    cardType === 'SOLAR'
      ? 'border-amber-500'
      : cardType === 'LUNAR'
        ? 'border-blue-600'
        : cardType === 'VIRUS'
          ? 'border-red-700'
          : cardType === 'DECOY'
            ? 'border-stone-500'
            : 'border-black';
  return (
    <div
      data-testid={`card-tile-${index}`}
      onClick={onSelect}
      data-revealed={revealed}
      data-selected={selected}
      data-card-type={cardType ?? undefined}
      className={`relative min-w-0 bg-white border-2 sm:border-4 ${border} ${selected ? 'ring-2 ring-black ring-offset-2' : ''}`}
    >
      <CipherPictureImage pictureId={pictureId} pack={pack} />
      <div className="flex items-center justify-between gap-0.5 px-0.5 bg-amber-50 text-[10px] font-black">
        <button
          type="button"
          disabled={!onSelect}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          aria-label={t('cipherGrid.selectPicture', { number: index + 1 })}
          className="min-h-11 w-full disabled:text-stone-700"
        >
          {String(index + 1).padStart(2, '0')} {symbol} {pingCount > 0 ? '📍' : ''}
        </button>
        <button
          type="button"
          data-testid={`picture-zoom-${index}`}
          aria-label={t('cipherGrid.zoomPicture', { number: index + 1 })}
          onClick={(event) => {
            event.stopPropagation();
            onZoom();
          }}
          className="absolute top-0 right-0 min-h-11 min-w-11 bg-white/90 border border-black/30 text-base"
        >
          ⌕
        </button>
      </div>
    </div>
  );
}
