'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Hourglass, Minus, Plus, ScrollText, Settings2, Spade } from 'lucide-react';
import {
  GameType,
  PlayingCard,
  PokerAction,
  PokerLastAction,
  PokerHandCategory,
  PokerPhase,
  PokerPublicState,
  PokerSeat,
  RoomStatus,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from '@/components/games/card-game/CardHand';
import { GameDialog } from '@/components/core/GameDialog';
import { CountdownBadge } from '@/components/core/CountdownBadge';
import { PokerHandRankings } from './PokerHandRankings';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';

const POKER_STREETS: PokerPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
const LAST_ACTION_KEYS: Record<PokerLastAction, string> = {
  ANTE: 'ante',
  SMALL_BLIND: 'smallBlind',
  BIG_BLIND: 'bigBlind',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raiseTo',
  ALL_IN: 'allIn',
  FOLD: 'fold',
};
const SUIT_SYMBOLS: Record<PlayingCard['suit'], string> = {
  CLUBS: '♣',
  DIAMONDS: '♦',
  HEARTS: '♥',
  SPADES: '♠',
};
const isRedSuit = (suit: PlayingCard['suit']) => suit === 'HEARTS' || suit === 'DIAMONDS';
const isPokerStreet = (phase: PokerPhase): boolean => POKER_STREETS.includes(phase);

/** Client mirror of the engine's min raise-to (the server re-validates). */
function minRaiseTo(state: PokerPublicState): number {
  return Math.max(state.minRaiseTo, state.currentBet + 1);
}

function seatBadgeLabel(seat: PokerSeat): string | null {
  if (seat.status === 'FOLDED') return 'folded';
  if (seat.status === 'ALL_IN') return 'allIn';
  if (seat.status === 'OUT') return 'out';
  return null;
}

export function PokerView() {
  const { room, socketId, pokerAction, resetRoom, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const [betInputText, setBetInputText] = useState<string>('');
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [awardSelection, setAwardSelection] = useState<string[]>([]);
  const [showAwardConfirm, setShowAwardConfirm] = useState(false);
  const [adjustDrafts, setAdjustDrafts] = useState<Record<string, string>>({});
  const [showRankings, setShowRankings] = useState(false);

  const state = room?.pokerState;

  // Progressive reveal for community cards
  useEffect(() => {
    setRevealedCount(0);
  }, [state?.handNumber]);

  useEffect(() => {
    if (!state?.board) return;
    if (state.phase === 'HAND_RESULT') {
      setRevealedCount(state.board.length);
      return;
    }
    if (state.board.length > revealedCount) {
      const delay = revealedCount === 0 ? 150 : 450;
      const timer = setTimeout(() => {
        setRevealedCount((prev) => Math.min(prev + 1, state.board.length));
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [state?.board, state?.board?.length, state?.phase, revealedCount]);

  useEffect(() => {
    setAwardSelection([]);
    setShowAwardConfirm(false);
  }, [
    state?.handNumber,
    state?.phase,
    state?.showdown?.pendingPots?.[0]?.amount,
    state?.showdown?.pendingPots?.[0]?.eligiblePlayerIds?.join(','),
  ]);

  const playerName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of room?.players ?? []) map[player.socketId] = player.name;
    return map;
  }, [room]);

  if (!room || !state || room.gameType !== GameType.POKER) return null;

  const isHost = socketId === room.roomHostId;
  const mode = state.mode;
  const mySeat = state.seats[socketId];
  const isMyTurn = !!mySeat && state.activePlayerId === socketId && isPokerStreet(state.phase);
  const toCall = mySeat ? Math.max(0, state.currentBet - mySeat.bet) : 0;
  const raiseMin = minRaiseTo(state);
  const myMax = mySeat ? mySeat.chips + mySeat.bet : 0;
  const callAmount = Math.min(toCall, mySeat?.chips ?? 0);
  const othersActive = state.playerOrder.some(
    (id) => id !== socketId && state.seats[id].status === 'ACTIVE',
  );
  const canRaise = !!mySeat && !mySeat.raiseLocked && othersActive && myMax >= raiseMin;
  const canShortRaise =
    !!mySeat && !mySeat.raiseLocked && othersActive && myMax > state.currentBet && myMax < raiseMin;
  const awaitingMyReveal =
    state.phase === 'SHOWDOWN' && !!state.showdown?.awaitingRevealIds.includes(socketId);
  const pendingPot = state.showdown?.pendingPots[0];
  const matchOver = room.status === RoomStatus.RESULT;

  const act = (action: PokerAction) => {
    if (action.type === 'FOLD') {
      audioManager.playCardSnap();
    } else {
      audioManager.playChipClink();
    }
    pokerAction(action);
  };

  // Keep bet input initialized to minimum legal raise when it becomes our turn
  useEffect(() => {
    if (isMyTurn) {
      setBetInputText(String(raiseMin));
    }
  }, [isMyTurn, state?.handNumber, state?.phase, state?.activePlayerId, raiseMin]);

  const prevPhaseRef = useRef(state?.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'SHOWDOWN' && state?.phase === 'SHOWDOWN') {
      const wonAnyPot = state.handResult?.pots.some((p) => p.winnerIds.includes(socketId));
      if (wonAnyPot) {
        audioManager.playSuccessChime();
        void gameFeel.celebrate();
        gameFeel.flash('gold');
        gameFeel.haptic([100, 50, 150]);
      } else {
        gameFeel.flash('white', 250);
      }
    }
    prevPhaseRef.current = state?.phase;
  }, [state?.phase, state?.handResult, socketId]);

  // Effective bet amount (clamped into the legal window; server re-checks).
  const parsedBet = parseInt(betInputText, 10);
  const amount = Number.isFinite(parsedBet)
    ? Math.min(Math.max(parsedBet, raiseMin), myMax)
    : raiseMin;
  const additionalChips = mySeat ? Math.max(0, amount - mySeat.bet) : 0;
  const stackAfter = mySeat ? Math.max(0, mySeat.chips - additionalChips) : 0;
  const quickAmounts = [
    { key: 'min', value: raiseMin },
    {
      key: 'half',
      value: toCall + Math.ceil((state.pot + state.currentBet) / 2),
    },
    { key: 'pot', value: toCall + state.pot + state.currentBet },
    { key: 'allIn', value: myMax },
  ].map((quick) => ({ ...quick, value: Math.min(Math.max(quick.value, raiseMin), myMax) }));

  const standings = [...room.players].filter((p) => !p.isViewer).sort((a, b) => b.score - a.score);

  const totalPot = state.pot + Object.values(state.seats).reduce((sum, seat) => sum + seat.bet, 0);

  return (
    <div
      className="flex-1 flex flex-col bg-white border-4 border-black p-2 sm:p-4 shadow-[4px_4px_0_0_#000] min-h-[300px] overflow-y-auto gap-3"
      data-testid="poker-table"
    >
      {/* Header: hand, phase, blinds, pot & current bet */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-1 bg-amber-300 border-2 border-black font-black text-xs uppercase shadow-[1px_1px_0_0_#000]">
            {t('poker.table.hand')} {state.handNumber}
          </span>
          <span
            className="px-2 py-1 bg-white border-2 border-black font-black text-xs uppercase shadow-[1px_1px_0_0_#000]"
            data-testid="poker-phase"
          >
            {t(`poker.table.phase.${state.phase as PokerPhase}`)}
          </span>
          <span className="text-xs font-bold opacity-75">
            SB {state.smallBlind} / BB {state.bigBlind}
          </span>
          {mode === 'CHIPS_LEDGER' && (
            <span className="px-2 py-1 bg-slate-200 border-2 border-black font-black text-[10px] uppercase shadow-[1px_1px_0_0_#000]">
              {t('poker.modeLedger')}
            </span>
          )}
          <button
            type="button"
            data-testid="poker-rankings-toggle"
            onClick={() => setShowRankings((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 border-2 border-black font-black text-[10px] uppercase transition-colors shadow-[1px_1px_0_0_#000] ${
              showRankings ? 'bg-lime-300' : 'bg-white hover:bg-amber-100'
            }`}
          >
            <ScrollText size={12} />
            {t('poker.table.rankings')}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Current Bet to match this street */}
          {state.currentBet > 0 ? (
            <div className="px-3 py-1 bg-amber-200 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0_0_#000] flex items-center gap-1">
              <span>{t('poker.table.currentBet')}:</span>
              <strong className="text-sm">🪙 {state.currentBet}</strong>
            </div>
          ) : (
            <div className="px-3 py-1 bg-slate-100 border-2 border-black font-black text-xs text-slate-600 uppercase shadow-[2px_2px_0_0_#000]">
              {t('poker.table.noBetYet')}
            </div>
          )}
          {/* Total Pot */}
          <div
            className="px-4 py-1 bg-lime-300 border-4 border-black font-black text-lg shadow-[2px_2px_0_0_#000]"
            data-testid="poker-pot"
          >
            {t('poker.table.pot')}: {totalPot}
          </div>
        </div>
      </div>

      {/* Always-available winning-hand reference */}
      {showRankings && (
        <div
          className="border-4 border-black bg-amber-50 p-3 shadow-[4px_4px_0_0_#000]"
          data-testid="poker-rankings-panel"
        >
          <PokerHandRankings />
        </div>
      )}

      {/* Community board (ONLINE) */}
      {mode === 'ONLINE' && (
        <div className="flex flex-col gap-1.5 p-2 bg-emerald-800/10 border-4 border-black rounded shadow-[2px_2px_0_0_#000]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>🃏 Community Cards</span>
              {state.board.length > 0 && state.board.length > revealedCount && (
                <span className="text-[10px] text-amber-700 animate-pulse font-black bg-amber-200 px-1.5 py-0.5 border border-black rounded">
                  กำลังเปิดไพ่...
                </span>
              )}
            </span>
            {state.board.length > revealedCount && (
              <button
                type="button"
                onClick={() => setRevealedCount(state.board.length)}
                className="text-[10px] font-black underline hover:text-black text-slate-600"
              >
                เปิดทั้งหมด (Skip)
              </button>
            )}
          </div>

          <div
            className="flex min-w-0 overflow-x-auto items-center gap-2 sm:gap-3 py-1 px-1 cursor-pointer"
            data-testid="poker-board"
            onClick={() => {
              if (state.board.length > revealedCount) {
                setRevealedCount(state.board.length);
              }
            }}
            title={state.board.length > revealedCount ? 'คลิกเพื่อเปิดไพ่ทั้งหมดทันที' : undefined}
          >
            {Array.from({ length: 5 }).map((_, index) => {
              const card = state.board[index];
              const isRevealed = Boolean(card && index < revealedCount);
              const isPending = Boolean(card && index >= revealedCount);
              const stageName = index <= 2 ? 'FLOP' : index === 3 ? 'TURN' : 'RIVER';

              return (
                <div key={card?.id ?? `slot-${index}`} className="flex flex-col items-center gap-1">
                  <div className="relative w-14 h-20 sm:w-16 sm:h-24 perspective-1000 select-none">
                    {card ? (
                      <div
                        className={`w-full h-full relative preserve-3d transition-transform duration-500 ease-out ${
                          isRevealed ? 'rotate-y-180' : ''
                        }`}
                      >
                        {/* Back face (Face Down) */}
                        <div className="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-indigo-900 to-slate-900 border-4 border-black rounded shadow-[2px_2px_0_0_#000] flex flex-col items-center justify-center p-1">
                          <div className="w-full h-full border-2 border-dashed border-amber-400/40 rounded flex flex-col items-center justify-center">
                            <span className="text-amber-400 font-black text-[11px] sm:text-xs tracking-widest">
                              KZ
                            </span>
                            <span className="text-sm sm:text-base text-amber-300">♠</span>
                            {isPending && (
                              <span className="text-[9px] font-black text-amber-300 animate-pulse">
                                ...
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Front face (Face Up) */}
                        <div
                          className={`absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-white border-4 border-black rounded shadow-[2px_2px_0_0_#000] p-1 sm:p-1.5 flex flex-col justify-between font-black ${
                            isRedSuit(card.suit) ? 'text-red-600' : 'text-black'
                          }`}
                        >
                          <div className="text-sm sm:text-base leading-none">{card.rank}</div>
                          <div className="text-center text-lg sm:text-2xl leading-none">
                            {SUIT_SYMBOLS[card.suit]}
                          </div>
                          <div className="text-right text-xs sm:text-sm leading-none">
                            {card.rank}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty slot */
                      <div className="w-full h-full border-4 border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-slate-50/50">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400">
                          {stageName}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                    {stageName} {index <= 2 ? `#${index + 1}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {state.playerOrder.map((id) => {
          const seat = state.seats[id];
          const badge = seatBadgeLabel(seat);
          const isDealer = state.dealerId === id;
          const isActive = state.activePlayerId === id;
          const isMe = id === socketId;
          const revealed = state.showdown?.revealedCards[id];
          const isHighestBet = seat.bet > 0 && seat.bet === state.currentBet;

          return (
            <div
              key={id}
              data-testid={`poker-seat-${id}`}
              className={`border-4 border-black p-2 flex flex-col gap-1.5 transition-all ${
                isActive ? 'bg-yellow-200 shadow-[4px_4px_0_0_#000] ring-2 ring-black' : 'bg-white'
              } ${seat.status === 'FOLDED' || seat.status === 'OUT' ? 'opacity-40 grayscale' : ''}`}
            >
              {/* Header: Name + Dealer + Status Badges */}
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-black text-xs sm:text-sm truncate max-w-[90px] sm:max-w-[120px]">
                    {playerName[id] ?? '???'}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-black px-1 bg-black text-white rounded">
                      YOU
                    </span>
                  )}
                  {isDealer && (
                    <span
                      className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center bg-black text-white font-black text-[10px] sm:text-xs rounded-full shadow-[1px_1px_0_0_#000]"
                      title="Dealer Button"
                    >
                      D
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {badge && (
                    <span
                      className={`px-1.5 py-0.5 border-2 border-black font-black text-[9px] sm:text-[10px] uppercase ${
                        seat.status === 'FOLDED'
                          ? 'bg-red-200 text-red-950'
                          : seat.status === 'ALL_IN'
                            ? 'bg-purple-200 text-purple-950'
                            : 'bg-slate-200'
                      }`}
                    >
                      {t(`poker.table.${badge}`)}
                    </span>
                  )}
                  {seat.lastAction && seat.status !== 'OUT' && (
                    <span className="px-1.5 py-0.5 bg-amber-100 border border-black font-black text-[9px] sm:text-[10px] uppercase shadow-[1px_1px_0_0_#000]">
                      {t(`poker.action.${LAST_ACTION_KEYS[seat.lastAction]}`)}
                      {seat.lastActionAmount && seat.lastActionAmount > 0
                        ? ` ${seat.lastActionAmount}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Chips stack & Current Round Bet */}
              <div className="flex items-center justify-between text-xs font-bold pt-1 border-t-2 border-black/10 gap-1 flex-wrap">
                <span className="text-slate-800">
                  🪙 <strong className="font-black text-black">{seat.chips}</strong>
                </span>
                {seat.bet > 0 ? (
                  <span
                    className={`px-1.5 py-0.5 border-2 border-black font-black text-[11px] flex items-center gap-1 ${
                      isHighestBet
                        ? 'bg-lime-300 text-black shadow-[1px_1px_0_0_#000]'
                        : 'bg-amber-100 text-black'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase">
                      {t('poker.table.betAmount')}:
                    </span>
                    <strong>🪙 {seat.bet}</strong>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold">
                    {t('poker.table.betAmount')}: 0
                  </span>
                )}
              </div>

              {isActive && state.turnDeadline && (
                <span className="flex items-center gap-1 text-[11px] font-black text-red-600">
                  <Hourglass size={12} />
                  <CountdownBadge
                    deadline={state.turnDeadline}
                    suffix={` ${t('poker.table.seconds')}`}
                  />
                </span>
              )}

              {revealed && (
                <div className="scale-75 origin-left mt-1">
                  <CardHand cards={revealed} />
                  {seat.handCategory && (
                    <span className="font-black text-[11px] uppercase bg-amber-100 px-1 border border-black inline-block mt-1">
                      {t(`poker.handNames.${seat.handCategory as PokerHandCategory}`)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Standings after END_MATCH */}
      {matchOver && (
        <div
          className="border-4 border-black bg-amber-100 p-3 shadow-[4px_4px_0_0_#000]"
          data-testid="poker-result"
        >
          <h4 className="font-black uppercase flex items-center gap-1">
            <Crown size={16} /> {t('poker.result.standings')}
          </h4>
          <ol className="list-decimal list-inside font-bold text-sm mt-1">
            {standings.map((player) => (
              <li key={player.socketId}>
                {player.name} — 🪙 {player.score}
              </li>
            ))}
          </ol>
          {isHost && (
            <button
              type="button"
              data-testid="poker-back-to-lobby"
              onClick={() => resetRoom()}
              className="mt-3 w-full bg-lime-300 hover:bg-lime-200 border-4 border-black font-black uppercase py-2 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
            >
              {t('poker.result.backToLobby')}
            </button>
          )}
        </div>
      )}

      {/* Player Status Banner: Chips, Bet this round, and Amount to Call */}
      {mySeat && isPokerStreet(state.phase) && state.handNumber > 0 && (
        <div
          className="border-4 border-black bg-gradient-to-r from-amber-50 to-yellow-100 p-2.5 sm:p-3 shadow-[3px_3px_0_0_#000] flex flex-col gap-2"
          data-testid="poker-my-status-panel"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold flex-wrap">
              <span>
                {t('poker.table.yourChips')}:{' '}
                <strong className="font-black text-black text-sm sm:text-base">
                  🪙 {mySeat.chips}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                {t('poker.table.yourBet')}:{' '}
                <strong className="font-black text-black">🪙 {mySeat.bet}</strong>
              </span>
            </div>
            <div
              className={`px-3 py-1 border-2 border-black font-black text-xs sm:text-sm uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] ${
                toCall > 0 ? 'bg-red-400 text-white' : 'bg-lime-300 text-black'
              }`}
            >
              {toCall > 0 ? (
                <>
                  <span>{t('poker.table.toCall')}:</span>
                  <strong className="text-sm sm:text-base underline">🪙 {toCall}</strong>
                  {callAmount < toCall && (
                    <span className="text-[10px] bg-black text-white px-1 py-0.5 rounded ml-1">
                      All-in
                    </span>
                  )}
                </>
              ) : (
                <span>{t('poker.table.checkAvailable')}</span>
              )}
            </div>
          </div>

          {/* Hole cards (ONLINE mode) */}
          {mode === 'ONLINE' && (
            <div className="flex flex-col gap-1 pt-1" data-testid="poker-my-cards">
              <span className="text-[11px] font-black uppercase text-slate-700">
                {t('poker.table.yourCards')}
              </span>
              <MyHoleCards />
            </div>
          )}
        </div>
      )}

      {/* Show / muck choice */}
      {awaitingMyReveal && (
        <fieldset disabled={actionLoading} className="flex gap-2" data-testid="poker-reveal-panel">
          <button
            type="button"
            data-testid="poker-show"
            onClick={() => act({ type: 'SHOW' })}
            className="flex-1 bg-lime-300 hover:bg-lime-200 border-4 border-black font-black uppercase py-3 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          >
            {t('poker.showdown.show')}
          </button>
          <button
            type="button"
            data-testid="poker-muck"
            onClick={() => act({ type: 'MUCK' })}
            className="flex-1 bg-white hover:bg-slate-100 border-4 border-black font-black uppercase py-3 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          >
            {t('poker.showdown.muck')}
          </button>
        </fieldset>
      )}
      {state.phase === 'SHOWDOWN' &&
        !!state.showdown?.awaitingRevealIds.length &&
        !awaitingMyReveal && (
          <p className="text-xs font-bold opacity-70 text-center">{t('poker.showdown.awaiting')}</p>
        )}

      {/* Betting action bar */}
      {isMyTurn && mySeat && (
        <fieldset
          disabled={actionLoading}
          className="border-4 border-black bg-yellow-200 p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-3"
          data-testid="poker-action-panel"
        >
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="font-black uppercase text-sm flex items-center gap-1">
              <Spade size={14} /> {t('poker.table.yourTurn')}
            </span>
            <span className="text-xs font-black uppercase px-2 py-0.5 border border-black bg-white">
              {toCall > 0 ? (
                <span>
                  {t('poker.table.toCall')} 🪙 {toCall}
                </span>
              ) : (
                <span>{t('poker.table.checkAvailable')}</span>
              )}
            </span>
          </div>

          {/* Primary Action Buttons: Fold / Check or Call */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              data-testid="poker-fold"
              onClick={() => act({ type: 'FOLD' })}
              className="flex-1 min-w-[80px] bg-red-400 hover:bg-red-300 border-4 border-black font-black uppercase py-3 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
            >
              {t('poker.action.fold')}
            </button>
            {toCall === 0 ? (
              <button
                type="button"
                data-testid="poker-check"
                onClick={() => act({ type: 'CHECK' })}
                className="flex-1 min-w-[80px] bg-white hover:bg-slate-100 border-4 border-black font-black uppercase py-3 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                {t('poker.action.check')}
              </button>
            ) : (
              <button
                type="button"
                data-testid="poker-call"
                onClick={() => act({ type: 'CALL' })}
                className="flex-1 min-w-[80px] bg-sky-300 hover:bg-sky-200 border-4 border-black font-black uppercase py-3 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                {t('poker.action.call')} {callAmount}
                {callAmount < toCall ? ` · ${t('poker.action.allIn')}` : ''}
              </button>
            )}
          </div>

          {/* Raise / Bet Controls */}
          {canRaise && (
            <div className="flex flex-col gap-2 pt-2 border-t-2 border-black/20">
              {/* Quick Amount Buttons */}
              <div className="flex gap-2 flex-wrap items-center">
                {quickAmounts.map((quick) => (
                  <button
                    key={quick.key}
                    type="button"
                    data-testid={`poker-quick-${quick.key === 'allIn' ? 'allin' : quick.key}`}
                    onClick={() => setBetInputText(String(quick.value))}
                    className={`px-2.5 py-1 border-2 border-black font-black text-xs uppercase transition-colors shadow-[1px_1px_0_0_#000] ${
                      amount === quick.value ? 'bg-lime-300' : 'bg-white hover:bg-amber-100'
                    }`}
                  >
                    {t(`poker.action.${quick.key}`)}
                  </button>
                ))}
              </div>

              {/* Slider for smooth raise adjustment */}
              {myMax > raiseMin && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-black">{raiseMin}</span>
                  <input
                    type="range"
                    min={raiseMin}
                    max={myMax}
                    step={1}
                    value={amount}
                    onChange={(e) => setBetInputText(e.target.value)}
                    className="flex-1 accent-black cursor-pointer"
                  />
                  <span className="text-[10px] font-black">{myMax}</span>
                </div>
              )}

              {/* Number Input + Stepper + Confirm Button */}
              <div className="flex min-w-0 flex-wrap gap-2 items-center">
                <label
                  htmlFor="poker-bet-input"
                  className="font-black text-xs uppercase cursor-pointer"
                >
                  {state.currentBet === 0 ? t('poker.action.bet') : t('poker.action.raiseTo')}
                </label>

                {/* Decrement Stepper */}
                <button
                  type="button"
                  onClick={() => {
                    const step = Math.max(1, state.bigBlind);
                    const current = parseInt(betInputText, 10);
                    const base = isNaN(current) ? raiseMin : current;
                    setBetInputText(String(Math.max(raiseMin, base - step)));
                  }}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border-2 border-black font-black text-xs shadow-[1px_1px_0_0_#000]"
                  title={`-${state.bigBlind}`}
                >
                  <Minus size={12} />
                </button>

                {/* Editable Number Input */}
                <input
                  id="poker-bet-input"
                  type="number"
                  data-testid="poker-bet-input"
                  className="w-24 sm:w-28 border-4 border-black px-2 py-1 font-black bg-white text-center text-sm"
                  value={betInputText}
                  min={raiseMin}
                  max={myMax}
                  onChange={(e) => setBetInputText(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(betInputText, 10);
                    if (isNaN(parsed) || parsed < raiseMin) {
                      setBetInputText(String(raiseMin));
                    } else if (parsed > myMax) {
                      setBetInputText(String(myMax));
                    } else {
                      setBetInputText(String(parsed));
                    }
                  }}
                />

                {/* Increment Stepper */}
                <button
                  type="button"
                  onClick={() => {
                    const step = Math.max(1, state.bigBlind);
                    const current = parseInt(betInputText, 10);
                    const base = isNaN(current) ? raiseMin : current;
                    setBetInputText(String(Math.min(myMax, base + step)));
                  }}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border-2 border-black font-black text-xs shadow-[1px_1px_0_0_#000]"
                  title={`+${state.bigBlind}`}
                >
                  <Plus size={12} />
                </button>

                {/* Confirm Action Button */}
                <button
                  type="button"
                  data-testid="poker-bet-confirm"
                  onClick={() =>
                    act(amount === myMax ? { type: 'ALL_IN' } : { type: 'BET', amount })
                  }
                  className="ml-auto bg-lime-300 hover:bg-lime-200 border-4 border-black font-black uppercase px-4 py-2 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
                >
                  {state.currentBet === 0 ? t('poker.action.bet') : t('poker.action.raiseTo')}{' '}
                  {amount}
                </button>
              </div>

              {/* Chip preview */}
              <div
                className="flex gap-4 text-xs font-bold text-slate-700 mt-1 flex-wrap"
                data-testid="poker-bet-preview"
              >
                <span data-testid="poker-bet-additional">
                  {t('poker.table.additionalChips')}:{' '}
                  <strong className="text-black font-black">🪙 {additionalChips}</strong>
                </span>
                <span data-testid="poker-bet-stack-after">
                  {t('poker.table.stackAfter')}:{' '}
                  <strong className="text-black font-black">🪙 {stackAfter}</strong>
                </span>
              </div>
            </div>
          )}
          {canShortRaise && (
            <button
              type="button"
              data-testid="poker-short-allin"
              onClick={() => act({ type: 'ALL_IN' })}
              className="min-h-11 bg-lime-300 border-4 border-black px-4 py-2 font-black shadow-[2px_2px_0_0_#000]"
            >
              {t('poker.action.allIn')} {myMax}
            </button>
          )}
        </fieldset>
      )}

      {/* Status line */}
      {!isMyTurn &&
        !awaitingMyReveal &&
        !matchOver &&
        isPokerStreet(state.phase) &&
        state.activePlayerId && (
          <p className="text-sm font-bold text-center opacity-70">
            {playerName[state.activePlayerId]} — {t('poker.table.waiting')}
          </p>
        )}

      {/* Hand result + host controls */}
      {(state.phase === 'HAND_RESULT' || state.phase === 'SHOWDOWN') && !matchOver && (
        <div
          className="border-4 border-black bg-white p-3 flex flex-col gap-2"
          data-testid="poker-hand-result"
        >
          {/* Pot breakdown */}
          <div data-testid="poker-pot-breakdown" className="flex flex-col gap-2">
            <span className="font-black text-xs uppercase opacity-80">
              {t('poker.table.potBreakdown')}
            </span>
            {state.handResult?.pots.map((pot, index) => {
              const isMainPot = index === 0;
              const potLabel = isMainPot
                ? t('poker.table.mainPot')
                : t('poker.table.sidePot', { index });
              const perWinner =
                pot.winnerIds.length > 0 ? Math.floor(pot.amount / pot.winnerIds.length) : 0;
              return (
                <div
                  key={index}
                  className="border-2 border-black p-2 bg-slate-50 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-center font-black text-sm">
                    <span>
                      {potLabel}: 🪙 {pot.amount}
                    </span>
                    {pot.winnerIds.length > 1 && (
                      <span className="text-xs bg-amber-200 px-1 border border-black font-black">
                        {t('poker.showdown.splitPot')}
                      </span>
                    )}
                  </div>
                  {pot.eligiblePlayerIds && pot.eligiblePlayerIds.length > 0 && (
                    <p className="text-xs text-slate-600 font-bold">
                      {t('poker.table.eligiblePlayers')}:{' '}
                      {pot.eligiblePlayerIds.map((id) => playerName[id] ?? '???').join(', ')}
                    </p>
                  )}
                  <p className="font-bold text-xs">
                    {pot.winnerIds.length > 1
                      ? t('poker.showdown.splitPot')
                      : t('poker.showdown.winner')}
                    :{' '}
                    {pot.winnerIds
                      .map((id) => `${playerName[id] ?? '???'} (+🪙${perWinner})`)
                      .join(' + ')}
                    {pot.handCategory ? ` — ${t(`poker.handNames.${pot.handCategory}`)}` : ''}
                  </p>
                </div>
              );
            })}
            {state.mode === 'CHIPS_LEDGER' &&
              state.showdown?.pendingPots.map((pot, index) => {
                const isMainPot = (state.handResult?.pots.length ?? 0) + index === 0;
                const potLabel = isMainPot
                  ? t('poker.table.mainPot')
                  : t('poker.table.sidePot', {
                      index: (state.handResult?.pots.length ?? 0) + index,
                    });
                return (
                  <div
                    key={`pending-${index}`}
                    className="border-2 border-black p-2 bg-amber-50 flex flex-col gap-1"
                  >
                    <div className="flex justify-between items-center font-black text-sm">
                      <span>
                        {potLabel}: 🪙 {pot.amount} ({t('poker.showdown.awardPrompt')})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-bold">
                      {t('poker.table.eligiblePlayers')}:{' '}
                      {pot.eligiblePlayerIds.map((id) => playerName[id] ?? '???').join(', ')}
                    </p>
                  </div>
                );
              })}
            {state.handResult?.uncalledRefund && (
              <p className="text-xs font-bold text-slate-700 bg-amber-100 p-1 border border-black">
                {t('poker.showdown.uncalled')} —{' '}
                {playerName[state.handResult.uncalledRefund.playerId]} 🪙{' '}
                {state.handResult.uncalledRefund.amount}
              </p>
            )}
          </div>

          {/* LEDGER: host awards pending pots one by one */}
          {isHost && pendingPot && (
            <div className="flex flex-col gap-2 border-2 border-black p-2 bg-amber-50">
              <div className="flex justify-between items-center flex-wrap gap-1">
                <p className="font-black text-xs uppercase">
                  {t('poker.showdown.award')} 🪙 {pendingPot.amount}
                </p>
                <span
                  className="text-xs font-bold text-slate-700"
                  data-testid="poker-selected-count"
                >
                  {t('poker.showdown.selectedWinnersCount', { count: awardSelection.length })}
                </span>
              </div>
              <p className="text-xs font-bold opacity-70">{t('poker.showdown.awardPrompt')}</p>
              <div className="flex gap-2 flex-wrap">
                {pendingPot.eligiblePlayerIds.map((id) => {
                  const selected = awardSelection.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected}
                      data-testid={`poker-award-${id}`}
                      onClick={() =>
                        setAwardSelection((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                        )
                      }
                      className={`px-2 py-1 border-2 border-black font-black text-xs uppercase transition-colors ${
                        selected ? 'bg-lime-300' : 'bg-white hover:bg-amber-100'
                      }`}
                    >
                      {playerName[id] ?? '???'}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                data-testid="poker-award-confirm"
                disabled={awardSelection.length === 0 || actionLoading}
                className="bg-lime-300 hover:bg-lime-200 disabled:opacity-40 border-4 border-black font-black uppercase py-2 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
                onClick={() => setShowAwardConfirm(true)}
              >
                {t('poker.showdown.award')}
              </button>

              <GameDialog
                open={showAwardConfirm}
                onClose={() => setShowAwardConfirm(false)}
                title={t('poker.showdown.confirmAwardTitle')}
              >
                <div className="flex flex-col gap-3 p-2 text-black">
                  <p className="text-sm font-bold">
                    {t('poker.showdown.confirmAwardDesc', {
                      amount: pendingPot.amount,
                      count: awardSelection.length,
                    })}
                  </p>
                  <div className="bg-slate-100 p-2 border-2 border-black text-xs font-bold">
                    {awardSelection.map((id) => playerName[id] ?? '???').join(', ')}
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      data-testid="poker-award-dialog-cancel"
                      onClick={() => setShowAwardConfirm(false)}
                      className="border-2 border-black px-3 py-1.5 text-xs font-black uppercase bg-white hover:bg-gray-100"
                    >
                      {t('poker.showdown.cancel')}
                    </button>
                    <button
                      type="button"
                      data-testid="poker-award-dialog-confirm"
                      disabled={actionLoading || awardSelection.length === 0}
                      onClick={() => {
                        setShowAwardConfirm(false);
                        act({ type: 'POT_AWARD', targetIds: awardSelection });
                      }}
                      className="border-2 border-black px-3 py-1.5 text-xs font-black uppercase bg-lime-300 hover:bg-lime-200 text-black shadow-[2px_2px_0_0_#000] disabled:opacity-40"
                    >
                      {t('poker.showdown.award')}
                    </button>
                  </div>
                </div>
              </GameDialog>
            </div>
          )}

          {isHost && (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                data-testid="poker-next-hand"
                onClick={() => act({ type: 'START_HAND' })}
                className="flex-1 min-w-[140px] bg-lime-300 hover:bg-lime-200 border-4 border-black font-black uppercase py-2 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                {t('poker.result.nextHand')}
              </button>
              <button
                type="button"
                data-testid="poker-end-match"
                onClick={() => {
                  if (window.confirm(t('poker.result.confirmEnd'))) act({ type: 'END_MATCH' });
                }}
                className="flex-1 min-w-[140px] bg-red-400 hover:bg-red-300 border-4 border-black font-black uppercase py-2 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                {t('poker.result.endMatch')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Host tools: rebuy + ledger adjustments */}
      {isHost && !matchOver && state.handNumber > 0 && (
        <details className="border-4 border-black bg-white p-2">
          <summary className="font-black uppercase text-xs flex items-center gap-1 cursor-pointer">
            <Settings2 size={14} /> {t('poker.host.tools')}
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {state.playerOrder.map((id) => {
              const seat = state.seats[id];
              const bust = seat.chips === 0;
              return (
                <div key={id} className="flex items-center gap-2 text-xs font-bold flex-wrap">
                  <span className="w-24 truncate font-black">{playerName[id] ?? '???'}</span>
                  <span>🪙 {seat.chips}</span>
                  {bust && (
                    <button
                      type="button"
                      data-testid={`poker-rebuy-${id}`}
                      onClick={() => act({ type: 'REBUY', targetId: id })}
                      className="px-2 py-0.5 border-2 border-black bg-lime-300 font-black uppercase"
                    >
                      {t('poker.host.rebuy')}
                    </button>
                  )}
                  {mode === 'CHIPS_LEDGER' && (
                    <>
                      <input
                        type="number"
                        data-testid={`poker-adjust-${id}`}
                        className="w-20 border-2 border-black px-1 font-black"
                        placeholder="+/-"
                        value={adjustDrafts[id] ?? ''}
                        onChange={(e) =>
                          setAdjustDrafts((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        data-testid={`poker-adjust-apply-${id}`}
                        onClick={() => {
                          const value = Number(adjustDrafts[id]);
                          if (Number.isInteger(value) && value !== 0) {
                            act({ type: 'ADJUST_CHIPS', targetId: id, amount: value });
                            setAdjustDrafts((prev) => ({ ...prev, [id]: '' }));
                          }
                        }}
                        className="px-2 py-0.5 border-2 border-black bg-white font-black uppercase"
                      >
                        {t('poker.host.apply')}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/** Reads the private hole cards mirrored into the store's private state. */
function MyHoleCards() {
  const privateState = useGameStore((s) => s.privateState);
  const cards = (
    privateState['poker'] as { holeCards?: import('@repo/types').PlayingCard[] } | undefined
  )?.holeCards;
  if (!cards || cards.length === 0) return null;
  return <CardHand cards={cards} />;
}
