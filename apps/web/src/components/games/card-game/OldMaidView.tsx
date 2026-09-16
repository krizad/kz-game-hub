'use client';

import { CardGamePrivateState } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameLog } from './CardGameLog';

export function OldMaidView() {
  const { room, socketId, privateState, cardGameAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;

  if (!room || !state) return null;

  const myTurn = state.phase === 'PLAYER_TURNS' && state.activePlayerId === socketId;
  const cards = privateCardState?.hand ?? [];
  const targetId = (() => {
    if (!socketId) return undefined;
    const order = state.playerOrder;
    const start = order.indexOf(socketId);
    if (start === -1) return undefined;
    for (let offset = 1; offset < order.length; offset += 1) {
      const candidate = order[(start + offset) % order.length];
      if ((state.handCounts[candidate] ?? 0) > 0) return candidate;
    }
    return undefined;
  })();
  const target = room.players.find((player) => player.socketId === targetId);
  const targetCount = targetId ? (state.handCounts[targetId] ?? 0) : 0;
  const placements = state.result?.placements ?? [];
  const loserId = placements[placements.length - 1];
  const loserName = room.players.find((player) => player.socketId === loserId)?.name;
  const winnerNames = (state.result?.winnerIds ?? [])
    .map((id) => room.players.find((player) => player.socketId === id)?.name ?? id)
    .join(', ');

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <CardGameLog />
      <div className="border-b-4 border-black pb-3">
        <h2 className="text-xl font-black">{t('gameOldMaid.title')}</h2>
        <span className="inline-block mt-1 px-2 py-0.5 border-2 border-black bg-white text-xs font-black uppercase">
          {state.phase}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {room.players
          .filter((player) => !player.isViewer)
          .map((player) => {
            const chipBalance = state.chips[player.socketId] ?? 0;
            return (
              <div
                key={player.socketId}
                className="border-4 border-black bg-white p-2 font-black text-sm"
              >
                <div className="flex items-center gap-1">
                  <span>{player.name}</span>
                  {player.socketId === state.activePlayerId && <span>⏳</span>}
                </div>
                <div className="text-xs">
                  🂠 {state.handCounts[player.socketId] ?? 0} {t('gamePokDeng.cards')}
                </div>
                <div className={`text-xs ${chipBalance < 0 ? 'text-red-600' : ''}`}>
                  {chipBalance} {t('gamePokDeng.chips')}
                </div>
              </div>
            );
          })}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase text-sm mb-2">{t('gameOldMaid.yourHand')}</h3>
        <CardHand cards={cards} />
      </div>

      {state.phase === 'RESULT' ? (
        <div
          data-testid="card-game-result"
          className="border-4 border-black bg-[#86EFAC] p-4 font-black"
        >
          {loserName && <p>{t('gameOldMaid.loserLine', { name: loserName })}</p>}
          <p className="text-sm">🏆 {winnerNames}</p>
          {socketId === room.roomHostId && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => cardGameAction({ type: 'NEXT_ROUND' })}
              className="mt-2 px-3 py-1 border-4 border-black bg-white font-black uppercase text-sm disabled:opacity-50"
            >
              {t('gamePokDeng.nextRound')}
            </button>
          )}
        </div>
      ) : myTurn && target ? (
        <div className="border-4 border-black bg-white p-4 space-y-2" data-testid="card-game-actions">
          <p className="font-black text-sm">{t('gameOldMaid.takeHint', { name: target.name })}</p>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: targetCount }, (_, index) => (
              <button
                key={index}
                type="button"
                data-testid={`old-maid-take-${index}`}
                disabled={actionLoading}
                onClick={() => cardGameAction({ type: 'TAKE_CARD', index })}
                className="w-16 h-20 border-4 border-black bg-indigo-500 text-white font-black text-2xl disabled:opacity-50"
              >
                🂠
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="font-black">{t('gameOldMaid.waiting')}</p>
      )}
    </section>
  );
}
