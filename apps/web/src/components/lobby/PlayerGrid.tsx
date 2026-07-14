'use client';

import { useGameStore } from '@/store/useGameStore';
import { Role, RoomStatus } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { getAvatarEmoji } from '@/components/core/utils';

export function PlayerGrid() {
  const { room, myName } = useGameStore();
  const { t } = useTranslate();

  if (!room) return null;

  return (
    <div className="flex-1 md:flex-1 flex flex-col bg-white border border-amber-200 rounded-2xl p-2 sm:p-4 shadow-xl overflow-hidden min-h-[100px]">
      <div className="flex flex-none items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider pl-1">
          {t('lobby.players')}
        </h3>
        <span className="bg-amber-100 px-2 py-0.5 rounded-full text-[10px] text-indigo-400 font-black border border-amber-300">
          {room.players.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto border border-amber-200/50 rounded-xl relative bg-amber-50/20">
        <table className="w-full text-sm text-left relative">
          <thead className="text-[10px] text-slate-500 uppercase bg-white/90 backdrop-blur-md sticky top-0 border-b border-amber-200/80 shadow-sm">
            <tr>
              <th className="px-3 py-2 font-bold tracking-wider">{t('lobby.players')}</th>
              <th className="px-3 py-2 text-right font-bold tracking-wider">{t('lobby.score')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-200/30">
            {room.players.map((p) => (
              <tr key={p.id} className="bg-amber-100/10 hover:bg-amber-100/40 transition-colors">
                <td className="px-3 py-2 font-medium flex items-center gap-2.5">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm shadow-inner flex-shrink-0 border"
                    style={{ 
                      backgroundColor: p.color ? `${p.color}22` : '#fef3c7',
                      borderColor: p.color || '#fcd34d'
                    }}
                    title={p.name}
                  >
                    {p.avatar || getAvatarEmoji(p.id)}
                  </span>
                  <span 
                    className="truncate max-w-[120px] sm:max-w-[200px]"
                    style={{ color: p.color || '#334155', fontWeight: p.color ? 800 : 500 }}
                  >
                    {p.name}
                    {p.connected === false && (
                      <span className="text-[9px] font-bold text-slate-500 ml-1.5 align-middle border border-amber-300 bg-amber-100/50 px-1 py-0.5 rounded leading-none inline-flex">
                        ({t('lobby.offline')})
                      </span>
                    )}
                    {p.name === myName && (
                      <span className="text-[9px] font-bold text-indigo-400 ml-1.5 align-middle">
                        ({t('lobby.you')})
                      </span>
                    )}
                  </span>
                  {p.role === Role.Host && (
                    <span
                      className="text-[9px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded border border-amber-500/20 ml-auto shadow-sm leading-none flex items-center"
                      title="Game Host"
                    >
                      {t('lobby.host').toUpperCase()}
                    </span>
                  )}
                  {room.status === RoomStatus.VOTING && room.votes?.[p.socketId] && (
                    <span
                      className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 ml-auto shadow-sm leading-none flex items-center gap-1"
                      title="Locked In"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {t('lobby.locked')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-slate-600 font-medium">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
