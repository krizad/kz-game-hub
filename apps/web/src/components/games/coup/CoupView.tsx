'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CoupHelpModal } from './CoupHelpModal';
import { CoupRole, CoupActionType } from '@repo/types';
import { toast } from 'react-hot-toast';

const roleEmoji: Record<string, string> = {
  DUKE: '👑',
  ASSASSIN: '🗡️',
  CAPTAIN: '🏴‍☠️',
  AMBASSADOR: '🤝',
  CONTESSA: '💃',
};

export function CoupView() {
  const { room, socketId, privateState, resetRoom, coupDeclare, coupChallenge, coupBlock } = useGameStore();
  const { t } = useTranslate();
  const [coupTarget, setCoupTarget] = useState<string>('');
  const [assassinateTarget, setAssassinateTarget] = useState<string>('');

  if (!room || !room.coupState) return <div className="p-6 font-black">Loading Coup...</div>;
  const state = room.coupState;
  const hand = (privateState as any)?.coupHand as CoupRole[] | undefined;
  const isMyTurn = state.currentTurn === socketId;
  const myCoins = state.coins[socketId] ?? 0;
  const forcedCoup = myCoins >= 10;
  const aliveTargets = room.players.filter((p) => p.socketId !== socketId && (state.influences[p.socketId]?.count ?? 0) > 0);

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

      {state.phase === 'AWAITING_CHALLENGE' && state.pendingAction && !state.pendingBlock && (
        <div className="border-4 border-black p-3 bg-[#FECACA]">
          <div className="text-xs font-black uppercase text-center">
            {room.players.find(p=> p.socketId===state.pendingAction!.actorId)?.name} declares {state.pendingAction.type} ({state.pendingAction.claimedRole}) — Challenge?
          </div>
          {state.pendingAction.actorId !== socketId && (state.influences[socketId]?.count ?? 0) > 0 && (
            <button onClick={() => coupChallenge()} className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase">Challenge!</button>
          )}
          {state.pendingAction.actorId === socketId && <div className="text-xs text-center mt-1 opacity-70">Waiting for others to challenge (7s)...</div>}
          <div className="text-[10px] text-center mt-1 opacity-60">Auto-resolves in 7s if no challenge</div>
        </div>
      )}

      {state.phase === 'AWAITING_CHALLENGE' && state.pendingBlock && state.pendingAction && (
        <div className="border-4 border-black p-3 bg-[#FDE68A]">
          <div className="text-xs font-black uppercase text-center">
            {room.players.find(p=> p.socketId===state.pendingBlock!.blockerId)?.name} blocks {state.pendingAction.type} with {state.pendingBlock.claimedRole} — Challenge block?
          </div>
          {state.pendingBlock.blockerId !== socketId && (state.influences[socketId]?.count ?? 0) > 0 && (
            <button onClick={() => coupChallenge()} className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase">Challenge Block!</button>
          )}
          <div className="text-[10px] text-center mt-1 opacity-60">Block challenge auto-resolves in 7s</div>
        </div>
      )}

      {state.phase === 'AWAITING_BLOCK' && state.pendingAction && (
        <div className="border-4 border-black p-3 bg-[#BFDBFE]">
          <div className="text-xs font-black uppercase text-center">
            {room.players.find(p=> p.socketId===state.pendingAction!.actorId)?.name} did {state.pendingAction!.type} — Block?
          </div>
          {(() => {
            const isForeignAid = state.pendingAction!.type === 'FOREIGN_AID';
            const isAssassinate = state.pendingAction!.type === 'ASSASSINATE';
            const canBlockForeignAid = isForeignAid && state.pendingAction!.actorId !== socketId && (state.influences[socketId]?.count ?? 0) > 0;
            const canBlockAssassinate = isAssassinate && state.pendingAction!.targetId === socketId && (state.influences[socketId]?.count ?? 0) > 0;
            if (canBlockForeignAid || canBlockAssassinate) {
              return <button onClick={() => coupBlock()} className="mt-2 w-full bg-white border-4 border-black font-black py-2 text-xs uppercase">Block!</button>;
            }
            return <div className="text-xs text-center mt-1 opacity-60">Waiting for block (7s)...</div>;
          })()}
        </div>
      )}

      {!state.winnerId && state.phase === 'PLAYING' && (
        <div className="border-4 border-black p-3 bg-white">
          <div className="text-xs font-black uppercase mb-2">{isMyTurn ? t('gameCoup.yourTurn') : `${t('gameCoup.waitingFor')} ${room.players.find(p=> p.socketId===state.currentTurn)?.name ?? '...'}`} {forcedCoup && isMyTurn && <span className="bg-red-500 text-white px-1">Must Coup (10+)</span>}</div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!isMyTurn || forcedCoup} onClick={() => coupDeclare(CoupActionType.INCOME)} className="border-4 border-black bg-[#A3E635] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none">{t('gameCoup.actionIncome')}</button>
            <button disabled={!isMyTurn || forcedCoup} onClick={() => coupDeclare(CoupActionType.FOREIGN_AID)} className="border-4 border-black bg-[#60A5FA] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none">{t('gameCoup.actionForeignAid')}</button>
            <button disabled={!isMyTurn || forcedCoup} onClick={() => coupDeclare(CoupActionType.TAX)} className="border-4 border-black bg-[#FBBF24] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none">{t('gameCoup.actionTax')}</button>
            <div className="flex gap-1">
              <select value={assassinateTarget} onChange={(e)=> setAssassinateTarget(e.target.value)} disabled={!isMyTurn} className="flex-1 border-4 border-black px-1 text-xs font-black bg-white disabled:bg-gray-100">
                <option value="">target</option>
                {aliveTargets.map(p=> <option key={p.socketId} value={p.socketId}>{p.name}</option>)}
              </select>
              <button
                disabled={!isMyTurn || !assassinateTarget || myCoins < 3 || forcedCoup}
                onClick={() => {
                  if (!assassinateTarget) { toast.error('Pick target'); return; }
                  coupDeclare(CoupActionType.ASSASSINATE, assassinateTarget);
                }}
                className="bg-[#A855F7] border-4 border-black text-white disabled:bg-gray-300 font-black px-2 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
              >
                {t('gameCoup.actionAssassinate')} (3)
              </button>
            </div>
            <div className="flex gap-1 col-span-2">
              <select value={coupTarget} onChange={(e)=> setCoupTarget(e.target.value)} disabled={!isMyTurn} className="flex-1 border-4 border-black px-1 text-xs font-black bg-white disabled:bg-gray-100">
                <option value="">coup target</option>
                {aliveTargets.map(p=> <option key={p.socketId} value={p.socketId}>{p.name}</option>)}
              </select>
              <button
                disabled={!isMyTurn || !coupTarget || myCoins < 7}
                onClick={() => {
                  if (!coupTarget) { toast.error('Pick target'); return; }
                  coupDeclare(CoupActionType.COUP, coupTarget);
                }}
                className="bg-[#EF4444] border-4 border-black text-white disabled:bg-gray-300 font-black px-3 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
              >
                {t('gameCoup.actionCoup')} (7)
              </button>
            </div>
          </div>
          {forcedCoup && isMyTurn && <div className="text-[10px] font-bold text-red-600 mt-1">You have 10+ coins — you must Coup!</div>}
        </div>
      )}

      {state.winnerId && (
        <div className="border-4 border-black bg-[#A7F3D0] p-3 text-center font-black">
          Winner: {room.players.find(p=> p.socketId===state.winnerId)?.name ?? state.winnerId}
        </div>
      )}

      {!state.winnerId && !isMyTurn && state.phase !== 'PLAYING' && (
        <div className="text-xs font-bold text-center opacity-60">{t('gameCoup.waitingFor')} {room.players.find(p=> p.socketId===state.currentTurn)?.name ?? '...'}</div>
      )}
    </div>
  );
}
