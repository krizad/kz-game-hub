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
    <div className="w-full flex flex-col bg-white border-4 border-black p-2 sm:p-4 shadow-[4px_4px_0_0_#000] overflow-hidden min-h-[100px] h-fit max-h-full">
      <div className="flex flex-none items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-xs font-black text-black uppercase tracking-wider pl-1">
          {t('lobby.players')}
        </h3>
        <span className="bg-[#FEF08A] px-2 py-0.5 rounded-full text-[10px] text-black font-black border-2 border-black">
          {room.players.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto border-2 border-black relative bg-white">
        <table className="w-full text-sm text-left relative">
          <thead className="text-[10px] text-black font-black uppercase bg-[#F3F4F6] sticky top-0 border-b-2 border-black">
            <tr>
              <th className="px-3 py-2 font-black tracking-wider">{t('lobby.players')}</th>
              <th className="px-3 py-2 text-right font-black tracking-wider">{t('lobby.score')}</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {room.players.map((p) => (
              <tr key={p.id} className="bg-white hover:bg-[#FEF08A] transition-colors">
                <td className="px-3 py-2 font-medium flex items-center gap-2.5">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0 border-2 border-black shadow-[1px_1px_0_0_#000]"
                    style={{
                      backgroundColor: p.color ? p.color : '#FEF08A',
                    }}
                    title={p.name}
                  >
                    {p.avatar || getAvatarEmoji(p.id)}
                  </span>
                  <span className="truncate max-w-[120px] sm:max-w-[200px] text-black font-black">
                    {p.name}
                    {p.connected === false && (
                      <span className="text-[9px] font-black text-black ml-1.5 align-middle border border-black bg-[#9CA3AF] px-1 py-0.5 rounded leading-none inline-flex">
                        ({t('lobby.offline')})
                      </span>
                    )}
                    {p.name === myName && (
                      <span className="text-[9px] font-black text-indigo-600 ml-1.5 align-middle">
                        ({t('lobby.you')})
                      </span>
                    )}
                  </span>
                  {p.role === Role.Host && (
                    <span
                      className="text-[9px] bg-[#FDE047] text-black font-black px-1 py-0.5 rounded border border-black ml-auto leading-none flex items-center"
                      title="Game Host"
                    >
                      {t('lobby.host').toUpperCase()}
                    </span>
                  )}
                  {room.status === RoomStatus.VOTING && room.votes?.[p.socketId] && (
                    <span
                      className="text-[9px] bg-[#6EE7B7] text-black font-black px-1.5 py-0.5 rounded border border-black ml-auto leading-none flex items-center gap-1"
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
                <td className="px-3 py-2 text-right text-black font-black">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
