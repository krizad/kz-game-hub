'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, Crown, Heart, Layers, RotateCcw, Skull, Sparkles, Timer } from 'lucide-react';
import {
  GameType,
  PlayingCard,
  ThirtyOnePrivateState,
  ThirtyOnePublicState,
  THIRTY_ONE_STARTING_LIVES,
} from '@repo/types';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';
import { CountdownBadge } from '@/components/core/CountdownBadge';
import { PokerV2Card, PokerV2CardRow, SUIT_SYMBOLS } from '../poker-v2/PokerV2Card';

const SEAT_TONES = [
  'bg-sky-200',
  'bg-rose-200',
  'bg-amber-200',
  'bg-emerald-200',
  'bg-violet-200',
  'bg-orange-200',
  'bg-teal-200',
  'bg-fuchsia-200',
  'bg-lime-200',
] as const;

export function ThirtyOneView() {
  const { room, socketId, privateState, thirtyOneAction, resetRoom, actionLoading, serverOffset } =
    useGameStore(
      useShallow((s) => ({
        room: s.room,
        socketId: s.socketId,
        privateState: s.privateState,
        thirtyOneAction: s.thirtyOneAction,
        resetRoom: s.resetRoom,
        actionLoading: s.actionLoading,
        serverOffset: s.serverOffset,
      })),
    );
  const { t } = useTranslate();

  const state = room?.thirtyOneState as ThirtyOnePublicState | undefined;
  const mine = privateState.thirtyOne as ThirtyOnePrivateState | undefined;

  const prevTurnRef = useRef(false);
  const prevShowdownRoundRef = useRef(0);

  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of room?.players ?? []) {
      map[p.socketId] = p.name;
    }
    return map;
  }, [room?.players]);

  useEffect(() => {
    const isMyTurn = !!state && state.phase === 'PLAYING' && state.activePlayerId === socketId;
    if (isMyTurn && !prevTurnRef.current) {
      audioManager.playCardSnap();
      gameFeel.haptic(40);
    }
    prevTurnRef.current = isMyTurn;
  }, [state?.activePlayerId, state?.phase, socketId, state]);

  useEffect(() => {
    const sd = state?.showdown;
    if (!sd || sd.roundNumber === prevShowdownRoundRef.current) return;
    prevShowdownRoundRef.current = sd.roundNumber;
    const iWon = sd.winnerIds.includes(socketId);
    if (iWon && sd.reason === 'BLITZ') {
      audioManager.playSuccessChime();
      void gameFeel.celebrate();
      gameFeel.flash('gold');
      gameFeel.haptic([100, 50, 150]);
    } else if (state?.phase === 'MATCH_OVER' && state.winnerId === socketId) {
      audioManager.playSuccessChime();
      void gameFeel.celebrate();
      gameFeel.flash('gold');
    } else if (sd.loserIds.includes(socketId)) {
      gameFeel.flash('white', 200);
      gameFeel.haptic([60, 40, 60]);
    }
  }, [state?.showdown, state?.phase, state?.winnerId, socketId]);

  if (!room || !state || room.gameType !== GameType.THIRTY_ONE) return null;

  const isHost = socketId === room.roomHostId;
  const mySeat = state.seats[socketId];
  const isPlaying = state.phase === 'PLAYING';
  const isMyTurn = isPlaying && state.activePlayerId === socketId && mySeat?.status === 'ACTIVE';
  const canChooseAction = isMyTurn && state.turnSubPhase === 'CHOOSE_ACTION';
  const canDiscard = isMyTurn && state.turnSubPhase === 'DISCARD';
  const canKnock = canChooseAction && state.knockerId === null;

  const myHand: PlayingCard[] = mine?.hand ?? [];
  const myEval = mine?.evaluation;
  const forbiddenCardId = mine?.forbiddenDiscardCardId ?? null;

  const isHighlightedCard = (card: PlayingCard): boolean => {
    if (!myEval || myHand.length !== 3) return false;
    if (myEval.isThreeOfAKind) return true;
    return myEval.bestSuit === card.suit;
  };

  const formatScoreLabel = (
    score?: number,
    isTrips?: boolean,
    isBlitz?: boolean,
    suit?: PlayingCard['suit'] | null,
  ) => {
    if (score === undefined) return '';
    if (isBlitz) return t('thirtyOne.blitz31');
    if (isTrips) return t('thirtyOne.threeOfAKind');
    const suitText = suit ? ` · ${t(`thirtyOne.suitName.${suit}`)}` : '';
    return `${t('thirtyOne.scoreLabel', { score })}${suitText}`;
  };

  const renderLivesPips = (lives: number, onWelfare: boolean, status: string) => {
    if (status === 'ELIMINATED') {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-black bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-white">
          <Skull className="h-3 w-3 text-rose-400" />
          {t('thirtyOne.eliminated')}
        </span>
      );
    }
    if (onWelfare) {
      return (
        <span className="inline-flex items-center gap-1 rounded border-2 border-black bg-amber-300 px-1.5 py-0.5 text-[10px] font-black text-black animate-pulse">
          🚌 {t('thirtyOne.onWelfare')}
        </span>
      );
    }
    return (
      <div
        className="flex items-center gap-0.5"
        aria-label={t('thirtyOne.lives', { count: lives })}
      >
        {Array.from({ length: THIRTY_ONE_STARTING_LIVES }, (_, idx) => {
          const filled = idx < lives;
          return (
            <Heart
              key={idx}
              className={`h-3.5 w-3.5 ${
                filled ? 'fill-rose-500 text-black' : 'fill-slate-200 text-slate-400'
              }`}
              strokeWidth={2.5}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      data-testid="thirty-one-view"
      className="flex flex-1 flex-col gap-3 rounded-none border-4 border-black bg-[#FEF3C7] p-3 sm:p-4 shadow-[4px_4px_0_0_#000]"
    >
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-black pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="thirty-one-round-badge"
            className="border-2 border-black bg-white px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0_0_#000]"
          >
            🃏 {t('thirtyOne.round', { n: state.roundNumber })}
          </span>

          {state.knockerId && isPlaying && (
            <span
              data-testid="thirty-one-knocked-banner"
              className="inline-flex items-center gap-1 border-2 border-black bg-rose-400 px-2.5 py-1 text-xs font-black text-black shadow-[2px_2px_0_0_#000]"
            >
              <Bell className="h-3.5 w-3.5" />
              {playerNames[state.knockerId] ?? ''} {t('thirtyOne.knockedBadge')} (
              {t('thirtyOne.finalTurnsLeft', { count: state.finalTurnQueue.length })})
            </span>
          )}

          {isPlaying && state.turnDeadline && (
            <span className="inline-flex items-center gap-1 border-2 border-black bg-amber-300 px-2.5 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
              <Timer className="h-3.5 w-3.5" />
              <CountdownBadge
                deadline={state.turnDeadline}
                serverOffset={serverOffset}
                suffix="s"
              />
            </span>
          )}
        </div>

        {isHost && state.phase !== 'MATCH_OVER' && (
          <button
            type="button"
            data-testid="thirty-one-end-match"
            disabled={actionLoading}
            onClick={() => thirtyOneAction({ type: 'END_MATCH' })}
            className="border-2 border-black bg-white px-2.5 py-1 text-xs font-black text-rose-600 shadow-[2px_2px_0_0_#000] hover:bg-rose-50 active:translate-y-0.5 active:shadow-none"
          >
            {t('thirtyOne.showdown.endMatch')}
          </button>
        )}
      </div>

      {/* Reshuffle Notice & Last Action */}
      {(state.reshuffledThisTurn || state.lastAction) && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {state.reshuffledThisTurn && (
            <span className="inline-flex items-center gap-1 border-2 border-black bg-cyan-200 px-2 py-0.5 font-black shadow-[2px_2px_0_0_#000]">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('thirtyOne.reshuffledNotice')}
            </span>
          )}
          {state.lastAction && (
            <span
              data-testid="thirty-one-last-action"
              className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-2.5 py-0.5 font-bold shadow-[2px_2px_0_0_#000]"
            >
              <span>
                {t(`thirtyOne.lastAction.${state.lastAction.type}`, {
                  name: playerNames[state.lastAction.playerId] ?? '',
                })}
              </span>
              {state.lastAction.card && (
                <span
                  className={`font-black ${
                    state.lastAction.card.suit === 'HEARTS' ||
                    state.lastAction.card.suit === 'DIAMONDS'
                      ? 'text-red-600'
                      : 'text-black'
                  }`}
                >
                  {state.lastAction.card.rank}
                  {SUIT_SYMBOLS[state.lastAction.card.suit]}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Players Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {state.playerOrder.map((pid, idx) => {
          const seat = state.seats[pid];
          if (!seat) return null;
          const isMe = pid === socketId;
          const isTurn = isPlaying && state.activePlayerId === pid;
          const isDealer = state.dealerId === pid;
          const isKnocker = state.knockerId === pid;
          const tone = SEAT_TONES[idx % SEAT_TONES.length];
          const cardCount = isTurn && state.turnSubPhase === 'DISCARD' ? 4 : 3;

          return (
            <div
              key={pid}
              data-testid={`thirty-one-seat-${pid}`}
              className={`flex flex-col gap-1.5 border-2 border-black p-2 transition-all shadow-[3px_3px_0_0_#000] ${
                seat.status === 'ELIMINATED'
                  ? 'bg-slate-200 opacity-65'
                  : isTurn
                    ? 'bg-yellow-300 ring-4 ring-black'
                    : tone
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-black text-black">
                  {playerNames[pid] ?? pid}
                  {isMe ? ' ★' : ''}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {isDealer && (
                    <span className="border border-black bg-white px-1 text-[10px] font-black">
                      {t('thirtyOne.dealer')}
                    </span>
                  )}
                  {isKnocker && (
                    <span className="border border-black bg-rose-400 px-1 text-[10px] font-black">
                      🔔
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-1">
                {renderLivesPips(seat.lives, seat.onWelfare, seat.status)}
                {seat.status === 'ACTIVE' && (
                  <div className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: cardCount }, (_, c) => (
                      <span
                        key={c}
                        className="inline-block h-4 w-2.5 rounded-[2px] border border-black bg-indigo-600"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Table: Draw Pile + Discard Pile + Knock (when PLAYING) */}
      {isPlaying && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-4 border-black bg-[#15803D] p-4 sm:p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {/* Draw Pile */}
            <div className="flex flex-col items-center gap-2">
              <span className="rounded border-2 border-black bg-white px-2 py-0.5 text-[11px] font-black uppercase shadow-[2px_2px_0_0_#000]">
                {t('thirtyOne.drawPile')} (
                {t('thirtyOne.cardsLeft', { count: state.drawPileCount })})
              </span>
              <button
                type="button"
                data-testid="thirty-one-draw-stock"
                disabled={!canChooseAction || actionLoading}
                onClick={() => thirtyOneAction({ type: 'DRAW_STOCK' })}
                className={`group relative flex flex-col items-center justify-center rounded-xl transition-transform ${
                  canChooseAction
                    ? 'cursor-pointer hover:-translate-y-1 active:translate-y-0.5 ring-4 ring-yellow-300'
                    : 'cursor-not-allowed opacity-85'
                }`}
              >
                <div className="relative h-[106px] w-[74px] rounded-xl border-4 border-black bg-gradient-to-br from-indigo-600 to-violet-800 shadow-[4px_4px_0_0_#000] flex flex-col items-center justify-center gap-1">
                  <Layers className="h-7 w-7 text-white" />
                  <span className="text-xs font-black text-white">{state.drawPileCount}</span>
                </div>
                {canChooseAction && (
                  <span className="mt-2 border-2 border-black bg-yellow-300 px-2.5 py-1 text-xs font-black text-black shadow-[2px_2px_0_0_#000]">
                    {t('thirtyOne.drawFromStock')}
                  </span>
                )}
              </button>
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center gap-2">
              <span className="rounded border-2 border-black bg-white px-2 py-0.5 text-[11px] font-black uppercase shadow-[2px_2px_0_0_#000]">
                {t('thirtyOne.discardPile')} ({state.discardPileCount})
              </span>
              <button
                type="button"
                data-testid="thirty-one-draw-discard"
                disabled={!canChooseAction || !state.topDiscard || actionLoading}
                onClick={() => thirtyOneAction({ type: 'DRAW_DISCARD' })}
                className={`flex flex-col items-center justify-center rounded-xl transition-transform ${
                  canChooseAction && state.topDiscard
                    ? 'cursor-pointer hover:-translate-y-1 active:translate-y-0.5 ring-4 ring-yellow-300'
                    : 'cursor-not-allowed opacity-90'
                }`}
              >
                <PokerV2Card card={state.topDiscard ?? undefined} size="lg" />
                {canChooseAction && state.topDiscard && (
                  <span className="mt-2 border-2 border-black bg-cyan-300 px-2.5 py-1 text-xs font-black text-black shadow-[2px_2px_0_0_#000]">
                    {t('thirtyOne.drawFromDiscard')}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Knock Action */}
          {canKnock && (
            <button
              type="button"
              data-testid="thirty-one-knock"
              disabled={actionLoading}
              onClick={() => thirtyOneAction({ type: 'KNOCK' })}
              className="mt-1 inline-flex items-center gap-2 border-4 border-black bg-[#FB7185] hover:bg-[#F43F5E] px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Bell className="h-4 w-4" />
              {t('thirtyOne.knock')}
            </button>
          )}
        </div>
      )}

      {/* Showdown / Round Result / Match Over */}
      {(state.phase === 'ROUND_RESULT' || state.phase === 'MATCH_OVER') && state.showdown && (
        <div
          data-testid="thirty-one-showdown"
          className="flex flex-col gap-3 border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]"
        >
          {state.phase === 'MATCH_OVER' && state.winnerId && (
            <div
              data-testid="thirty-one-champion-banner"
              className="flex flex-col items-center gap-1 border-4 border-black bg-yellow-300 p-4 text-center shadow-[4px_4px_0_0_#000]"
            >
              <Crown className="h-8 w-8 text-black" />
              <div className="text-xs font-black uppercase tracking-widest">
                {t('thirtyOne.showdown.championTitle')}
              </div>
              <div className="text-2xl font-black text-black">
                {playerNames[state.winnerId] ?? state.winnerId}
              </div>
            </div>
          )}

          <div
            className={`border-2 border-black p-3 ${
              state.showdown.reason === 'BLITZ'
                ? 'bg-emerald-200'
                : state.showdown.knockPenalty
                  ? 'bg-rose-200'
                  : 'bg-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 text-base font-black text-black">
              {state.showdown.reason === 'BLITZ' ? (
                <>
                  <Sparkles className="h-5 w-5 text-emerald-700" />
                  <span>{t('thirtyOne.showdown.blitzTitle')}</span>
                </>
              ) : (
                <>
                  <Bell className="h-5 w-5 text-rose-700" />
                  <span>{t('thirtyOne.showdown.knockTitle')}</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs font-bold text-slate-800">
              {state.showdown.reason === 'BLITZ'
                ? t('thirtyOne.showdown.blitzDesc')
                : state.showdown.knockPenalty && state.showdown.knockerId
                  ? t('thirtyOne.showdown.knockPenaltyDesc', {
                      name: playerNames[state.showdown.knockerId] ?? '',
                    })
                  : t('thirtyOne.showdown.normalKnockDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(state.showdown.revealedHands)
              .sort((a, b) => {
                const sa = state.showdown!.handScores[a[0]]?.score ?? 0;
                const sb = state.showdown!.handScores[b[0]]?.score ?? 0;
                return sb - sa;
              })
              .map(([pid, cards]) => {
                const evalInfo = state.showdown!.handScores[pid];
                const delta = state.showdown!.lifeChanges[pid] ?? 0;
                const isWinner = state.showdown!.winnerIds.includes(pid);
                const enteredWelfare = state.showdown!.welfareEnteredIds.includes(pid);
                const eliminatedNow = state.showdown!.eliminatedIds.includes(pid);
                const seat = state.seats[pid];

                return (
                  <div
                    key={pid}
                    data-testid={`thirty-one-showdown-player-${pid}`}
                    className={`flex flex-col gap-2 border-2 border-black p-3 shadow-[2px_2px_0_0_#000] ${
                      isWinner ? 'bg-emerald-50' : delta < 0 ? 'bg-rose-50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-black">
                        {playerNames[pid] ?? pid}
                        {state.showdown!.knockerId === pid ? ' 🔔' : ''}
                      </span>
                      <span className="border border-black bg-white px-2 py-0.5 text-xs font-black">
                        {formatScoreLabel(
                          evalInfo?.score,
                          evalInfo?.isThreeOfAKind,
                          evalInfo?.isBlitz,
                          evalInfo?.bestSuit,
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <PokerV2CardRow cards={cards} size="xs" />
                      <div className="flex flex-col items-end gap-1">
                        {delta < 0 ? (
                          <span className="border border-black bg-rose-400 px-2 py-0.5 text-[11px] font-black text-black">
                            {t('thirtyOne.showdown.lostLives', { count: Math.abs(delta) })}
                          </span>
                        ) : (
                          <span className="border border-black bg-lime-300 px-2 py-0.5 text-[11px] font-black text-black">
                            {t('thirtyOne.showdown.safe')}
                          </span>
                        )}
                        {enteredWelfare && (
                          <span className="text-[10px] font-black text-amber-700">
                            🚌 {t('thirtyOne.showdown.enteredWelfare')}
                          </span>
                        )}
                        {eliminatedNow && (
                          <span className="text-[10px] font-black text-rose-700">
                            💀 {t('thirtyOne.showdown.eliminatedNow')}
                          </span>
                        )}
                        {seat && renderLivesPips(seat.lives, seat.onWelfare, seat.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {state.phase === 'ROUND_RESULT' &&
              (isHost ? (
                <button
                  type="button"
                  data-testid="thirty-one-next-round"
                  disabled={actionLoading}
                  onClick={() => thirtyOneAction({ type: 'NEXT_ROUND' })}
                  className="border-4 border-black bg-[#A3E635] hover:bg-[#84CC16] px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
                >
                  {t('thirtyOne.showdown.nextRound')}
                </button>
              ) : (
                <span className="text-xs font-black text-slate-600">
                  {t('thirtyOne.showdown.waitingHostNextRound')}
                </span>
              ))}

            {state.phase === 'MATCH_OVER' && isHost && (
              <button
                type="button"
                data-testid="thirty-one-reset-match"
                disabled={actionLoading}
                onClick={() => resetRoom()}
                className="border-4 border-black bg-[#A3E635] hover:bg-[#84CC16] px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                {t('thirtyOne.showdown.backToLobby')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Your Private Hand */}
      {myHand.length > 0 && (
        <div
          data-testid="thirty-one-my-hand"
          className="mt-auto flex flex-col gap-2.5 border-4 border-black bg-white p-3 sm:p-4 shadow-[4px_4px_0_0_#000]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-black">
              ✋ {t('thirtyOne.yourHand')}
            </span>
            {myEval && (
              <span
                data-testid="thirty-one-my-score"
                className={`border-2 border-black px-2.5 py-0.5 text-xs font-black shadow-[2px_2px_0_0_#000] ${
                  myEval.isBlitz
                    ? 'bg-emerald-300'
                    : myEval.isThreeOfAKind
                      ? 'bg-violet-300'
                      : 'bg-amber-200'
                }`}
              >
                {formatScoreLabel(
                  myEval.score,
                  myEval.isThreeOfAKind,
                  myEval.isBlitz,
                  myEval.bestSuit,
                )}
              </span>
            )}
          </div>

          {canDiscard && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-black text-indigo-700">{t('thirtyOne.discardHint')}</p>
              {forbiddenCardId && (
                <p
                  data-testid="thirty-one-anti-stall-note"
                  className="text-[11px] font-bold text-rose-600"
                >
                  {t('thirtyOne.antiStallNote')}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {myHand.map((card) => {
              const isForbidden = canDiscard && forbiddenCardId === card.id;
              const isClickable = canDiscard && !isForbidden && !actionLoading;

              return (
                <motion.button
                  key={card.id}
                  type="button"
                  data-testid={`thirty-one-card-${card.id}`}
                  disabled={!isClickable}
                  whileHover={isClickable ? { y: -8 } : undefined}
                  whileTap={isClickable ? { scale: 0.96 } : undefined}
                  onClick={() => {
                    if (isClickable) {
                      thirtyOneAction({ type: 'DISCARD', cardId: card.id });
                    }
                  }}
                  className={`relative flex flex-col items-center gap-1 focus:outline-none ${
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <PokerV2Card
                    card={card}
                    size="lg"
                    highlight={isHighlightedCard(card)}
                    dimmed={isForbidden}
                  />
                  {isForbidden && (
                    <span
                      data-testid="thirty-one-forbidden-badge"
                      className="rounded border border-black bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[1px_1px_0_0_#000]"
                    >
                      {t('thirtyOne.antiStallLocked')}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
