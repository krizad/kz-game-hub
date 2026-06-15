import { useEffect } from 'react';
import { X } from 'lucide-react';

interface CardViewerModalProps {
  cardUrl: string | null;
  onClose: () => void;
}

export function CardViewerModal({ cardUrl, onClose }: CardViewerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (cardUrl) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [cardUrl, onClose]);

  if (!cardUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 bg-amber-100 hover:bg-amber-200 text-slate-800 rounded-full transition-colors z-10 shadow-lg"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        <img
          src={cardUrl}
          alt="Card enlarged"
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border-4 border-amber-300/50"
        />
      </div>
    </div>
  );
}
