'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CoupHelpModal } from './CoupHelpModal';
import { CoupRole } from '@repo/types';

const roleEmoji: Record<string, string> = {
  DUKE: '👑',
  ASSASSIN: '🗡️',
  CAPTAIN: '🏴‍☠️',
  AMBASSADOR: '🤝',
  CONTESSA: '💃',
};

export function CoupView() {
  const { room, socketId, privateState, resetRoom } = useGameStore();
  const { t } = useTranslate();

  if (!room || !room.coupState) return <div className="p-6 font-black">Loading Coup...</div>;
  const state = room.coupState;
  const hand = (privateState as any)?.coupHand as CoupRole[] | undefined;
  const isMyTurn = state.currentTurn === socketId;
  const myCoins = state.coins[socketId] ?? 0;

  return (
    <div className="flex flex-col gap-4 bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-widest">Coup — {state.phase}</h2>
        <div className="flex gap-2">
          <CoupHelpModal />
          <button onClick={() => resetRoom()} className="bg-black text-white px-3 py-1 text-xs font-black uppercase">Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {room.players.map((p) => {
          const coins = state.coins[p.socketId] ?? 0;
          const inf = state.influences[p.socketId];
          const isTurn = state.currentTurn === p.socketId;
          const revealed = inf?.revealed ?? [];
          const count = inf?.count ?? 0;
          const isMe = p.socketId === socketId;
          return (
            <div key={p.socketId} className={`border-4 p-2 ${isTurn ? 'border-[#EF4444] bg-[#FEF08A]' : 'border-black bg-white'}`}>
              <div className="text-xs font-black truncate">{p.name} {isMe && '(YOU)'} {isTurn && '◀'}</div>
              <div className="text-xs font-bold">{t('gameCoup.coins')}: {coins} 💰</div>
              <div className="text-xs font-bold">{t('gameCoup.influences')}: {count} {count===0 && '💀'}</div>
              {revealed.length>0 && <div className="text-[10px] font-bold">Revealed: {revealed.map(r=> `${roleEmoji[r] ?? ''} ${r}`).join(', ')}</div>}
              <div className="flex gap-1 mt-1">
                {Array.from({length: count}).map((_,i)=> <div key={i} className="w-6 h-8 border-2 border-black bg-black text-white flex items-center justify-center text-[10px]">?</div>)}
                {revealed.map((r,i)=> <div key={`r-${i}`} className="w-6 h-8 border-2 border-black bg-white flex items-center justify-center text-[10px]">{roleEmoji[r] ?? r[0]}</div>)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-4 border-black p-3 bg-[#F3F4F6]">
        <div className="text-xs font-black uppercase mb-1">{t('gameCoup.deadPile')}: {state.deadPile.length} {t('gameCoup.cards')}</div>
        <div className="flex gap-1 flex-wrap">
          {state.deadPile.map((r,i)=> <span key={i} className="border-2 border-black px-1 py-0.5 bg-white text-[10px] font-black">{roleEmoji[r] ?? ''} {r}</span>)}
          {state.deadPile.length===0 && <span className="text-xs opacity-50">— empty —</span>}
        </div>
        <div className="text-xs font-bold mt-1">{t('gameCoup.deck')}: {state.deck.length} {t('gameCoup.cards')}</div>
      </div>

      <div className="border-4 border-black p-3 bg-[#E0E7FF]">
        <div className="text-xs font-black uppercase">{t('gameCoup.yourInfluence')} {hand ? `(${hand.length})` : ''}</div>
        {hand ? (
          <div className="flex gap-2 mt-2">
            {hand.map((r,i)=> <div key={i} className="flex-1 border-4 border-black bg-white p-3 text-center font-black">{roleEmoji[r] ?? ''} <div className="text-xs">{r}</div></div>)}
          </div>
        ) : <div className="text-xs opacity-60">No private hand (spectator or not dealt)</div>}
        <div className="text-xs font-bold mt-2">{t('gameCoup.yourCoins')}: {myCoins} 💰 {isMyTurn && <span className="bg-[#EF4444] text-white px-1 ml-1">{t('gameCoup.yourTurn')}</span>}</div>
      </div>

      {state.winnerId && (
        <div className="border-4 border-black bg-[#A7F3D0] p-3 text-center font-black">
          Winner: {room.players.find(p=> p.socketId===state.winnerId)?.name ?? state.winnerId}
        </div>
      )}

      {!state.winnerId && !isMyTurn && (
        <div className="text-xs font-bold text-center opacity-60">{t('gameCoup.waitingFor')} {room.players.find(p=> p.socketId===state.currentTurn)?.name ?? '...'}</div>
      )}
    </div>
  );
}
