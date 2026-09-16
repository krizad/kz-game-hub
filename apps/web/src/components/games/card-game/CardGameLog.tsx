'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function CardGameLog() {
  const { room } = useGameStore();
  const { t } = useTranslate();
  const entries = room?.cardGameLog ?? [];
  if (entries.length === 0) return null;

  return (
    <div
      className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]"
      data-testid="card-game-log"
    >
      <h3 className="text-xs font-black uppercase tracking-widest">{t('cardGameLog.title')}</h3>
      <ul className="mt-1 space-y-0.5">
        {entries.slice(-8).map((entry, index) => {
          const actor =
            room?.players.find((player) => player.socketId === entry.actorId)?.name ?? '—';
          return (
            <li key={`${entry.actorId}-${entry.kind}-${index}`} className="text-xs font-bold">
              {t(`cardGameLog.kinds.${entry.kind}`, { actor, count: entry.count ?? 0 })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
