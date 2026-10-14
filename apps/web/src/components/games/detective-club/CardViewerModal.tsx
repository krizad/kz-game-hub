import { X } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';
import { GameDialog } from '@/components/core/GameDialog';

interface CardViewerModalProps {
  cardUrl: string | null;
  onClose: () => void;
}

export function CardViewerModal({ cardUrl, onClose }: CardViewerModalProps) {
  const { t } = useTranslate();
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
        <img
          src={cardUrl}
          alt={t('gameDetectiveClub.enlargedCardAlt')}
          className="max-w-full max-h-[72dvh] object-contain border border-amber-300/50"
        />
      </div>
    </GameDialog>
  );
}
