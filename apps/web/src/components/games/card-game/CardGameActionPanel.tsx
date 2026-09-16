'use client';

import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

export function CardGameActionPanel() {
  const { room, socketId, actionLoading, cardGameAction } = useGameStore();
  const { t } = useTranslate();
  const state = room?.cardGameState;
  if (!room || !state) return null;

  const myTurn = state.phase === 'PLAYER_TURNS' && state.activePlayerId === socketId;
  const isHost = socketId === room.roomHostId;
  const allowedActions = (room.cardGameConfig?.actions.allowed ?? ['DRAW', 'STAND']).filter(
    (kind): kind is 'DRAW' | 'STAND' => kind === 'DRAW' || kind === 'STAND',
  );
  const winnerLabel = state.result?.winnerIds.length
    ? state.result.winnerIds
        .map((id) => room.players.find((p) => p.socketId === id)?.name)
        .join(', ')
    : t('gamePokDeng.dealerWins');

  if (state.phase === 'RESULT' && state.result) {
    return (
      <div
        className="border-4 border-black bg-[#86EFAC] p-4 font-black"
        data-testid="card-game-result"
      >
        {t('gamePokDeng.resultLine', {
          score: state.result.dealerScore ?? 0,
          winners: winnerLabel,
        })}
        {isHost && (
          <button
            onClick={() => cardGameAction({ type: 'NEXT_ROUND' })}
            disabled={actionLoading}
            className="ml-3 border-4 border-black bg-white px-3 py-1 shadow-[2px_2px_0_0_#000] disabled:opacity-50"
          >
            {t('gamePokDeng.nextRound')}
          </button>
        )}
      </div>
    );
  }

  if (myTurn) {
    return (
      <div className="flex gap-3" data-testid="card-game-actions">
        {allowedActions.map((kind) => (
          <button
            key={kind}
            disabled={actionLoading}
            onClick={() => cardGameAction({ type: kind })}
            className={`border-4 border-black px-5 py-3 font-black shadow-[4px_4px_0_0_#000] disabled:opacity-50 ${kind === 'DRAW' ? 'bg-red-400' : 'bg-white'}`}
          >
            {t(`cardGameRules.actionNames.${kind}`)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <p className="font-black">
      {state.phase === 'PLAYER_TURNS' ? t('gamePokDeng.waiting') : t('gamePokDeng.revealing')}
    </p>
  );
}
