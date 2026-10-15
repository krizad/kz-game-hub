import { useState, useEffect } from 'react';
import { X, ImageOff } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';
import { GameDialog } from '@/components/core/GameDialog';

interface CardViewerModalProps {
  cardUrl: string | null;
  onClose: () => void;
}

export function CardViewerModal({ cardUrl, onClose }: CardViewerModalProps) {
  const { t } = useTranslate();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [cardUrl]);

  if (!cardUrl) return null;

  return (
    <GameDialog open={!!cardUrl} onClose={onClose} title={t('gameDetectiveClub.enlargedCardAlt')}>
      <div className="relative mx-auto flex max-h-[88dvh] max-w-full flex-col items-center justify-center p-12 bg-black/90 border-4 border-black">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-2 bg-amber-100 hover:bg-amber-200 text-slate-800 rounded-full transition-colors z-10"
          aria-label={t('gameDetectiveClub.close')}
        >
          <X className="w-6 h-6" />
        </button>
        {hasError ? (
          <div
            data-testid="missing-card-fallback"
            className="flex flex-col items-center justify-center p-8 bg-zinc-900 border-4 border-amber-400 text-amber-200 min-w-[240px] min-h-[300px] text-center"
          >
            <ImageOff className="w-16 h-16 mb-4 text-amber-400" />
            <p className="font-mono font-bold text-lg">{t('gameDetectiveClub.imageUnavailable')}</p>
          </div>
        ) : (
          <img
            src={cardUrl}
            alt={t('gameDetectiveClub.enlargedCardAlt')}
            onError={() => setHasError(true)}
            className="max-w-full max-h-[72dvh] object-contain border border-amber-300/50"
          />
        )}
      </div>
    </GameDialog>
  );
}
