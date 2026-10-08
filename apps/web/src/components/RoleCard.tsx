'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  const prefersReducedMotion = useReducedMotion();
  const flipTransition = { duration: prefersReducedMotion ? 0 : 0.28 };
  const roleLabel =
    role === Role.Host
      ? t('gameWhoKnow.roleCard.host')
      : role === Role.Know
        ? t('gameWhoKnow.insider')
        : role === Role.Unknow
          ? t('gameWhoKnow.roleCard.seeker')
          : t('gameWhoKnow.roleCard.waiting');

  return (
    <section className="relative mx-auto flex w-full max-w-lg flex-col items-center justify-center overflow-hidden border-4 border-black bg-white p-4 shadow-[5px_5px_0_0_#000] sm:p-5">
      <div className="mb-3 flex w-full items-center justify-between gap-3 sm:mb-4">
        <h2 className="m-0 text-xl font-black tracking-wide text-slate-900 sm:text-2xl">
          {t('gameWhoKnow.roleCard.title')}
        </h2>
        <button
          onClick={() => setIsRevealed(!isRevealed)}
          type="button"
          aria-pressed={isRevealed}
          className="flex min-h-10 shrink-0 items-center gap-2 border-2 border-black bg-amber-100 px-3 py-2 text-slate-900 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        >
          {isRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
          <span className="text-xs font-black uppercase tracking-wider">
            {t(isRevealed ? 'gameWhoKnow.roleCard.hide' : 'gameWhoKnow.roleCard.show')}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setIsRevealed(!isRevealed)}
        aria-pressed={isRevealed}
        aria-label={t(isRevealed ? 'gameWhoKnow.roleCard.hide' : 'gameWhoKnow.roleCard.show')}
        className="group relative aspect-[16/8] w-full cursor-pointer focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 sm:aspect-[16/7]"
        style={{ perspective: prefersReducedMotion ? undefined : '1000px' }}
      >
        <AnimatePresence mode="wait">
          {!isRevealed ? (
            <motion.div
              key="hidden"
              initial={prefersReducedMotion ? { opacity: 0 } : { rotateX: -80, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { rotateX: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { rotateX: 80, opacity: 0 }}
              transition={flipTransition}
              className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-amber-700 bg-amber-100 transition-colors group-hover:bg-amber-200"
            >
              <EyeOff className="mb-1 h-8 w-8 text-slate-700 transition-colors group-hover:text-slate-900 sm:mb-2 sm:h-10 sm:w-10" />
              <p className="px-2 text-center text-sm font-bold text-slate-800 transition-colors group-hover:text-slate-900 sm:text-base">
                {t('gameWhoKnow.roleCard.tapToReveal')}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="revealed"
              initial={prefersReducedMotion ? { opacity: 0 } : { rotateX: -80, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { rotateX: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { rotateX: 80, opacity: 0 }}
              transition={flipTransition}
              className={cn(
                'absolute inset-0 flex items-center justify-center border-2 px-3 text-black',
                role === Role.Host && 'border-amber-900 bg-amber-200',
                role === Role.Know && 'border-rose-900 bg-rose-200',
                role === Role.Unknow && 'border-emerald-900 bg-emerald-200',
                !role && 'border-amber-700 bg-amber-100 text-slate-700',
              )}
            >
              <div className="flex flex-col items-center justify-center w-full">
                <h3 className="px-2 text-center text-xl font-black sm:text-3xl">{roleLabel}</h3>
                {word && role !== Role.Unknow && (
                  <div className="mt-2 w-full border-t border-black/30 px-2 pt-2 text-center sm:mt-3 sm:px-4 sm:pt-3">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-700 sm:text-xs">
                      {t('gameWhoKnow.roleCard.targetWord')}
                    </span>
                    <span className="break-words text-xl font-black text-black sm:text-2xl">{word}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <div className="mt-3 text-center text-xs font-medium leading-relaxed text-slate-700 sm:mt-4 sm:text-sm">
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
    </section>
  );
};
