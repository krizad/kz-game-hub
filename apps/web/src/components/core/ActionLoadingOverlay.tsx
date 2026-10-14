import { motion, AnimatePresence } from 'framer-motion';

export interface ActionLoadingOverlayProps {
  message?: string;
  status?: 'pending' | 'unknown' | 'rejected';
  onDismiss?: () => void;
}

export function ActionLoadingOverlay({
  message,
  status = 'pending',
  onDismiss,
}: ActionLoadingOverlayProps = {}) {
  const isUnknown = status === 'unknown';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 pointer-events-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/95 p-6 flex flex-col items-center gap-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-xs text-center"
        >
          {!isUnknown ? (
            <>
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-slate-700 font-bold text-sm">{message || 'Processing...'}</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-amber-200 border-2 border-black text-black flex items-center justify-center font-black text-sm">
                ?
              </div>
              <span className="text-black font-black text-sm uppercase tracking-wide">
                {message || 'Action status unknown'}
              </span>
              <p className="text-slate-600 font-medium text-xs">
                No confirmation received from server. Please check room state before acting again.
              </p>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="mt-2 px-4 py-1.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                >
                  Dismiss
                </button>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
