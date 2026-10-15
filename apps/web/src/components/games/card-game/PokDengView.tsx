'use client';

import { CardGamePrivateState } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from './CardHand';
import { CardGameLog } from './CardGameLog';
import { CardGameActionPanel } from './CardGameActionPanel';

export function PokDengView() {
  const { room, privateState } = useGameStore();
  const { t } = useTranslate();
  const state = room?.cardGameState;
  const privateCardState = privateState.cardGame as CardGamePrivateState | undefined;
  if (!room || !state) return null;

  const dealer = room.players.find((player) => player.socketId === state.dealerId);
  const phaseLabel = t(`gameStatus.phaseNames.${state.phase}` as any) || state.phase;

  return (
    <section className="flex-1 min-h-[300px] bg-[#FDE68A] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-4">
      <div className="flex items-center justify-between gap-3 border-b-4 border-black pb-3">
        <div>
          <h2 className="font-black text-2xl uppercase">{t('gamePokDeng.title')}</h2>
          <p className="font-bold text-sm">
            {t('gamePokDeng.dealerLine', { name: dealer?.name ?? '—' })}
          </p>
        </div>
        <span className="border-4 border-black bg-white px-3 py-1 font-black uppercase">
          {phaseLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {room.players
          .filter((player) => !player.isViewer)
          .map((player) => {
            const chipBalance = state.chips[player.socketId] ?? 0;
            return (
              <div
                key={player.socketId}
                className="border-4 border-black bg-white p-2 font-black text-sm"
              >
                <div>
                  {player.name}
                  {player.socketId === state.dealerId ? ` · ${t('gamePokDeng.dealerBadge')}` : ''}
                </div>
                <div className={chipBalance < 0 ? 'text-red-600' : undefined}>
                  🂠 {state.handCounts[player.socketId] ?? 0} {t('gamePokDeng.cards')} ·{' '}
                  {chipBalance} {t('gamePokDeng.chips')}
                </div>
              </div>
            );
          })}
      </div>

      <div className="border-4 border-black bg-white p-4">
        <h3 className="font-black uppercase mb-2">{t('gamePokDeng.yourHand')}</h3>
        <CardHand cards={privateCardState?.hand ?? []} allowSort={false} preset="POK_DENG" />
      </div>

      {state.phase === 'RESULT' && state.result && (
        <div
          data-testid="pok-deng-settlement"
          className="border-4 border-black bg-white p-4 font-black space-y-3 shadow-[4px_4px_0_0_#000]"
        >
          <h3 className="font-black uppercase text-base border-b-2 border-black pb-1">
            {t('gamePokDeng.settlement')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {room.players
              .filter((player) => !player.isViewer)
              .map((player) => {
                const isDealer = player.socketId === state.dealerId;
                const score = isDealer
                  ? (state.result?.dealerScore ?? 0)
                  : (state.result?.playerScores[player.socketId] ?? 0);
                const tag = state.result?.outcomeTags?.[player.socketId];
                const delta = state.result?.deltas?.[player.socketId] ?? 0;
                const chipsAfter = state.chips[player.socketId] ?? 0;
                const chipsBefore = chipsAfter - delta;
                const isWinner = state.result?.winnerIds.includes(player.socketId);
                const revealedCards = state.result?.revealedHands[player.socketId] ?? [];

                return (
                  <div
                    key={player.socketId}
                    className="border-2 border-black p-3 bg-amber-50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">
                        {player.name}
                        {isDealer ? ` (${t('gamePokDeng.dealerBadge')})` : ''}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 border border-black font-black uppercase ${
                          isWinner
                            ? 'bg-green-300'
                            : isDealer
                              ? 'bg-amber-200'
                              : delta < 0
                                ? 'bg-red-200'
                                : 'bg-zinc-200'
                        }`}
                      >
                        {isWinner
                          ? t('gamePokDeng.win')
                          : delta < 0
                            ? t('gamePokDeng.lose')
                            : t('gamePokDeng.tie')}
                      </span>
                    </div>

                    <div className="text-xs font-bold space-y-0.5">
                      <div>
                        {t('gamePokDeng.score', { score })}{' '}
                        {tag && tag !== 'NORMAL'
                          ? `· ${t(`cardGameRules.outcomes.${tag}` as any) || tag}`
                          : ''}
                      </div>
                      <div className="text-zinc-700">
                        {t('gamePokDeng.chipsBefore', { chips: chipsBefore })} →{' '}
                        {t('gamePokDeng.chipsAfter', { chips: chipsAfter })} (
                        <span
                          className={delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : ''}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>{' '}
                        {t('gamePokDeng.chips')})
                      </div>
                    </div>

                    {revealedCards.length > 0 && (
                      <div className="pt-1">
                        <CardHand cards={revealedCards} allowSort={false} preset="POK_DENG" />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <CardGameLog />
      <CardGameActionPanel />
    </section>
  );
}
