'use client';

import { CardGamePrivateState, PlayingCard } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';

const suitSymbol: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};

export function PokDengView() {
  const { room, socketId, privateState, cardGameAction, actionLoading } = useGameStore();
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;
  if (!room || !state) return null;

  const myTurn = state.phase === 'PLAYER_TURNS' && state.activePlayerId === socketId;
  const dealer = room.players.find((player) => player.socketId === state.dealerId);

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <div className="flex items-center justify-between gap-3 border-b-4 border-black pb-3">
        <div>
          <h2 className="font-black text-2xl uppercase">🃏 ป๊อกเด้ง</h2>
          <p className="font-bold text-sm">เจ้ามือ: {dealer?.name ?? '—'} · ชิปเริ่มต้น 100</p>
        </div>
        <span className="border-4 border-black bg-white px-3 py-1 font-black uppercase">
          {state.phase}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {room.players
          .filter((player) => !player.isViewer)
          .map((player) => (
            <div
              key={player.socketId}
              className="border-4 border-black bg-white p-2 font-black text-sm"
            >
              <div>
                {player.name}
                {player.socketId === state.dealerId ? ' · เจ้าบ้าน' : ''}
              </div>
              <div>
                🂠 {state.handCounts[player.socketId] ?? 0} ใบ · {state.chips[player.socketId] ?? 0}{' '}
                ชิป
              </div>
            </div>
          ))}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase mb-2">ไพ่ของคุณ</h3>
        <div className="flex gap-2 min-h-24">
          {privateCardState?.hand.map((card) => (
            <div
              key={card.id}
              className={`w-16 h-20 border-4 border-black bg-white p-2 font-black text-xl ${card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-black'}`}
            >
              <div>{card.rank}</div>
              <div className="text-right">{suitSymbol[card.suit]}</div>
            </div>
          ))}
        </div>
      </div>

      {state.phase === 'RESULT' && state.result ? (
        <div className="border-4 border-black bg-[#86EFAC] p-4 font-black">
          เจ้ามือได้ {state.result.dealerScore} แต้ม · ผู้ชนะ:{' '}
          {state.result.winnerIds.length
            ? state.result.winnerIds
                .map((id) => room.players.find((p) => p.socketId === id)?.name)
                .join(', ')
            : 'เจ้ามือ'}
          {socketId === room.roomHostId && (
            <button
              onClick={() => cardGameAction({ type: 'NEXT_ROUND' })}
              className="ml-3 border-4 border-black bg-white px-3 py-1 shadow-[2px_2px_0_0_#000]"
            >
              ตาถัดไป
            </button>
          )}
        </div>
      ) : myTurn ? (
        <div className="flex gap-3">
          <button
            disabled={actionLoading}
            onClick={() => cardGameAction({ type: 'DRAW' })}
            className="border-4 border-black bg-red-400 px-5 py-3 font-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
          >
            จั่วใบที่ 3
          </button>
          <button
            disabled={actionLoading}
            onClick={() => cardGameAction({ type: 'STAND' })}
            className="border-4 border-black bg-white px-5 py-3 font-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
          >
            อยู่
          </button>
        </div>
      ) : (
        <p className="font-black">
          {state.phase === 'PLAYER_TURNS' ? 'รอผู้เล่นเลือกจั่วหรืออยู่…' : 'กำลังเปิดไพ่เจ้ามือ…'}
        </p>
      )}
    </section>
  );
}
