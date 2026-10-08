'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '@repo/types';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate';

interface RoleCardProps {
  role: Role | null;
  word?: string | null;
}

export const RoleCard = ({ role, word }: RoleCardProps) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const { t } = useTranslate();
  const roleLabel =
    role === Role.Host
      ? t('gameWhoKnow.roleCard.host')
      : role === Role.Know
        ? t('gameWhoKnow.insider')
        : role === Role.Unknow
          ? t('gameWhoKnow.roleCard.seeker')
          : t('gameWhoKnow.roleCard.waiting');

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white border border-amber-200 relative w-full max-w-sm mx-auto overflow-hidden">
      <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-2xl font-bold text-slate-800 tracking-wider m-0">
          {t('gameWhoKnow.roleCard.title')}
        </h2>
        <button
          onClick={() => setIsRevealed(!isRevealed)}
          className="p-2 bg-amber-100 hover:bg-amber-200 active:bg-slate-600 rounded-lg text-slate-700 transition-colors flex items-center gap-2"
          title={t(isRevealed ? 'gameWhoKnow.roleCard.hide' : 'gameWhoKnow.roleCard.show')}
        >
          {isRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
          <span className="text-xs font-bold uppercase tracking-wider">
            {t(isRevealed ? 'gameWhoKnow.roleCard.hide' : 'gameWhoKnow.roleCard.show')}
          </span>
        </button>
      </div>

      <div
        className="relative w-full aspect-video cursor-pointer group"
        style={{ perspective: '1000px' }}
        onClick={() => setIsRevealed(!isRevealed)}
      >
        <AnimatePresence mode="wait">
          {!isRevealed ? (
            <motion.div
              key="hidden"
              initial={{ rotateX: -90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: 90, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-amber-100 border border-dashed border-amber-400 flex flex-col items-center justify-center transform-gpu group-hover:bg-amber-200 transition-colors"
            >
              <EyeOff className="w-12 h-12 text-slate-500 mb-3 group-hover:text-slate-600 transition-colors" />
              <p className="text-slate-600 font-medium group-hover:text-slate-700 transition-colors">
                {t('gameWhoKnow.roleCard.tapToReveal')}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="revealed"
              initial={{ rotateX: -90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: 90, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                'absolute inset-0 border flex items-center justify-center transform-gpu',
                role === Role.Host && 'bg-amber-900/50 border-amber-500 text-amber-500',
                role === Role.Know && 'bg-rose-900/50 border-rose-500 text-rose-500',
                role === Role.Unknow && 'bg-emerald-900/50 border-emerald-500 text-emerald-500',
                !role && 'bg-amber-100 border-amber-400 text-slate-600',
              )}
            >
              <div className="flex flex-col items-center justify-center w-full">
                <h3 className="text-2xl sm:text-3xl font-black text-center px-3">{roleLabel}</h3>
                {word && role !== Role.Unknow && (
                  <div className="mt-4 pt-4 border-t border-[currentColor]/30 text-center w-full px-4">
                    <span className="text-xs uppercase tracking-widest opacity-80 block mb-1">
                      {t('gameWhoKnow.roleCard.targetWord')}
                    </span>
                    <span className="text-2xl font-black drop-">{word}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 text-center text-sm text-slate-500">
        {role === Role.Host ? (
          <p>{t('gameWhoKnow.roleCard.hostDesc')}</p>
        ) : role === Role.Know ? (
          <p>{t('gameWhoKnow.roleCard.guideDesc')}</p>
        ) : role === Role.Unknow ? (
          <p>{t('gameWhoKnow.roleCard.seekerDesc')}</p>
        ) : (
          <p>{t('gameWhoKnow.roleCard.secretHint')}</p>
        )}
      </div>
    </div>
  );
};
