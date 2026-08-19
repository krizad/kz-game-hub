import { motion, AnimatePresence } from 'framer-motion';

export function ActionLoadingOverlay() {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 "
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/90 p-6 flex flex-col items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full border border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-slate-600 font-medium text-sm">Processing...</span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
