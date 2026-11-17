'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Hourglass,
  ListOrdered,
  Play,
  RotateCw,
  ScrollText,
  Timer,
  Trophy,
} from 'lucide-react';
import {
  GameType,
  PokerV2Action,
  PokerV2PrivateState,
  PokerV2PublicState,
  PokerV2Seat,
  RoomStatus,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { audioManager } from '@/lib/audioManager';
import { gameFeel } from '@/lib/gameFeel';
import { CountdownBadge } from '@/components/core/CountdownBadge';
import { GameDialog } from '@/components/core/GameDialog';
import { PokerV2Card, PokerV2CardRow, PokerV2Chips } from './PokerV2Card';
import { PokerV2AdvisorPanel } from './PokerV2Advisor';

const STREET_PHASES = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'] as const;

/** Landscape seat slots, clockwise from bottom-centre (slot 0 = the viewer). */
const SEAT_SLOTS = [
  { x: 50, y: 76 },
  { x: 17, y: 84 },
  { x: 7, y: 58 },
  { x: 7, y: 32 },
  { x: 17, y: 14 },
  { x: 50, y: 6 },
  { x: 83, y: 14 },
  { x: 93, y: 32 },
  { x: 93, y: 58 },
  { x: 83, y: 84 },
] as const;

/** Which slots are used per table size, always including slot 0 (me). */
const SLOT_SETS: Record<number, number[]> = {
  2: [0, 5],
  3: [0, 4, 6],
  4: [0, 3, 5, 7],
  5: [0, 2, 4, 6, 8],
  6: [0, 1, 3, 5, 7, 9],
  7: [0, 1, 2, 4, 5, 6, 9],
  8: [0, 1, 2, 3, 4, 5, 6, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

const HAND_ORDER = [
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'ONE_PAIR',
  'HIGH_CARD',
] as const;

const SEAT_TONES = [
  'bg-sky-300',
  'bg-rose-300',
  'bg-amber-300',
  'bg-emerald-300',
  'bg-violet-300',
  'bg-orange-300',
  'bg-teal-300',
  'bg-fuchsia-300',
  'bg-lime-300',
] as const;

export function PokerV2View() {
  const { room, socketId, privateState, pokerV2Action, actionLoading, serverOffset } =
    useGameStore();
  const { t } = useTranslate();
  const [raiseTo, setRaiseTo] = useState<number | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showAdvisorMobile, setShowAdvisorMobile] = useState(false);
  const prevMyTurn = useRef(false);
  const prevResultHand = useRef(0);
  const prevBoardLen = useRef(0);

  const state = room?.pokerV2State as PokerV2PublicState | undefined;
  const mine = privateState.pokerV2 as PokerV2PrivateState | undefined;

  const playerName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of room?.players ?? []) map[player.socketId] = player.name;
    return map;
  }, [room]);

  /* --- Game feel: my turn / results / dealt cards ------------------ */
  useEffect(() => {
    const isMyTurn =
      !!state &&
      STREET_PHASES.includes(state.phase as (typeof STREET_PHASES)[number]) &&
      state.activePlayerId === socketId;
    if (isMyTurn && !prevMyTurn.current) {
      audioManager.playCardSnap();
      gameFeel.haptic(40);
    }
    prevMyTurn.current = isMyTurn;
  }, [state?.activePlayerId, state?.phase, socketId, state]);

  useEffect(() => {
    if (!state?.handResult || state.handNumber === prevResultHand.current) return;
    prevResultHand.current = state.handNumber;
    const iWon = state.handResult.pots.some((pot) => pot.winnerIds.includes(socketId));
    if (iWon) {
      audioManager.playSuccessChime();
      void gameFeel.celebrate();
      gameFeel.flash('gold');
      gameFeel.haptic([100, 50, 150]);
    } else {
      gameFeel.flash('white', 250);
    }
  }, [state?.handResult, state?.handNumber, socketId]);

  useEffect(() => {
    const boardLen = state?.board.length ?? 0;
    if (boardLen > prevBoardLen.current) {
      audioManager.playCardSnap();
    }
    prevBoardLen.current = boardLen;
  }, [state?.board.length]);

  /* ---------------------------------------------------------------- */
  if (!room || !state || room.gameType !== GameType.POKER_V2) return null;

  const isHost = socketId === room.roomHostId;
  const mySeat = state.seats[socketId];
  const isMyTurn =
    !!mySeat &&
    STREET_PHASES.includes(state.phase as (typeof STREET_PHASES)[number]) &&
    state.activePlayerId === socketId;
  const isStreet = STREET_PHASES.includes(state.phase as (typeof STREET_PHASES)[number]);

  const toCall = mySeat ? Math.max(0, state.currentBet - mySeat.bet) : 0;
  const callAmount = Math.min(toCall, mySeat?.chips ?? 0);
  const minRaise = Math.max(state.minRaiseTo, state.currentBet + 1);
  const maxRaise = mySeat ? mySeat.chips + mySeat.bet : 0;
  const othersActive = state.playerOrder.some(
    (id) => id !== socketId && state.seats[id].status === 'ACTIVE',
  );
  const canRaise =
    !!mySeat &&
    !mySeat.raiseLocked &&
    othersActive &&
    maxRaise >= minRaise &&
    STREET_PHASES.includes(state.phase as (typeof STREET_PHASES)[number]);
  const effectiveRaise = raiseTo ?? minRaise;

  const act = (action: PokerV2Action) => {
    if (action.type === 'BET') setRaiseTo(null);
    pokerV2Action(action);
  };

  /* Seat arrangement: I am always slot 0; the rest run clockwise. */
  const seatedIds = state.playerOrder.filter((id) => state.seats[id]);
  const myIndex = seatedIds.indexOf(socketId);
  const slots = SLOT_SETS[Math.max(2, Math.min(9, seatedIds.length))] ?? SLOT_SETS[9];
  const seatLayout = seatedIds.map((id, i) => ({
    id,
    slot: SEAT_SLOTS[slots[(i - myIndex + seatedIds.length) % seatedIds.length]],
  }));

  const winnerIds = new Set((state.handResult?.pots ?? []).flatMap((pot) => pot.winnerIds));
  const showdownCards = state.showdown?.revealedCards ?? {};
  const liveOpponents = state.playerOrder.filter((id) => {
    const s = state.seats[id];
    return id !== socketId && (s.status === 'ACTIVE' || s.status === 'ALL_IN');
  }).length;

  const standings = [...seatedIds].sort((a, b) => state.seats[b].chips - state.seats[a].chips);
  const matchEnded = room.status === RoomStatus.RESULT;

  return (
    <div
      data-testid="poker-v2-table"
      className="flex h-full w-full flex-col gap-2 p-2 lg:flex-row lg:gap-3 lg:p-3"
    >
      {/* ---------------- Table area ---------------- */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-hidden rounded-[40px] border-4 border-black bg-gradient-to-br from-emerald-800 to-emerald-950 shadow-[8px_8px_0_0_#000]">
          {/* felt inner rail */}
          <div className="absolute inset-3 rounded-[32px] border-[6px] border-amber-900/70" />
          <div className="absolute inset-6 rounded-[26px] border-2 border-emerald-600/40" />
        </div>

        {/* rotate hint (portrait phones only) */}
        <div className="absolute left-1/2 top-2 hidden -translate-x-1/2 items-center gap-1 rounded-full border-2 border-black bg-amber-300 px-3 py-1 text-[11px] font-black shadow-[2px_2px_0_0_#000] [@media(orientation:portrait)and(max-width:900px)]:flex">
          <RotateCw className="h-3.5 w-3.5" />
          {t('pokerV2.table.rotateHint')}
        </div>

        {/* Phase + hand banner */}
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2">
          <span className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
            {t('pokerV2.table.hand')} {state.handNumber}
          </span>
          <span className="rounded-full border-2 border-black bg-emerald-300 px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0_0_#000]">
            {t(`pokerV2.table.phase.${state.phase}`)}
          </span>
          <span className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
            {t('pokerV2.table.blinds')} {state.smallBlind}/{state.bigBlind}
          </span>
        </div>

        {/* Pot */}
        <div
          data-testid="poker-v2-pot"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[110px] flex-col items-center gap-1 lg:-translate-y-[130px]"
        >
          <motion.div
            key={state.pot}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 rounded-2xl border-4 border-black bg-amber-300 px-4 py-1.5 shadow-[4px_4px_0_0_#000]"
          >
            <span className="text-[11px] font-black uppercase tracking-wide">
              {t('pokerV2.table.pot')}
            </span>
            <span className="text-lg font-black">{state.pot.toLocaleString()}</span>
          </motion.div>
        </div>

        {/* Community board */}
        <div
          data-testid="poker-v2-board"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-2xl border-4 border-black/30 bg-black/20 p-2 lg:gap-2.5"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-center">
              {state.board[i] ? (
                <PokerV2Card
                  card={state.board[i]}
                  size="lg"
                  highlight={winnerIds.size > 0 && isWinningCard(state.board[i], state.handResult)}
                />
              ) : (
                <div className="h-[96px] w-[68px] rounded-xl border-2 border-dashed border-white/30" />
              )}
            </div>
          ))}
        </div>

        {/* Seats */}
        {seatLayout.map(({ id, slot }) => (
          <Seat
            key={id}
            id={id}
            seat={state.seats[id]}
            slot={slot}
            name={playerName[id] ?? id}
            isMe={id === socketId}
            isDealer={state.dealerId === id}
            isActive={state.activePlayerId === id && isStreet}
            isWinner={winnerIds.has(id)}
            turnDeadline={state.turnDeadline}
            serverOffset={serverOffset}
            revealedCards={showdownCards[id]}
            phase={state.phase}
          />
        ))}

        {/* Waiting / turn banner */}
        {!matchEnded && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            {isMyTurn ? (
              <span className="animate-pulse rounded-full border-2 border-black bg-yellow-300 px-4 py-1 text-sm font-black uppercase shadow-[2px_2px_0_0_#000]">
                ⚡ {t('pokerV2.table.yourTurn')}
              </span>
            ) : state.activePlayerId ? (
              <span className="flex items-center gap-1.5 rounded-full border-2 border-black bg-white/90 px-4 py-1 text-xs font-black shadow-[2px_2px_0_0_#000]">
                <Hourglass className="h-3.5 w-3.5" />
                {t('pokerV2.table.waiting')}
                {state.turnDeadline && (
                  <CountdownBadge
                    deadline={state.turnDeadline}
                    serverOffset={serverOffset}
                    className="text-rose-600"
                    suffix={t('pokerV2.table.seconds')}
                  />
                )}
              </span>
            ) : null}
          </div>
        )}

        {/* Hand-result overlay */}
        {state.handResult && !matchEnded && (
          <HandResultOverlay
            state={state}
            isHost={isHost}
            serverOffset={serverOffset}
            onDealNow={() => act({ type: 'START_HAND' })}
            onEndMatch={() => setShowEndConfirm(true)}
          />
        )}
      </div>

      {/* ---------------- Sidebar ---------------- */}
      <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-72 lg:gap-3">
        {/* My hand + actions (mobile: above advisor) */}
        <ActionBar
          visible={isMyTurn}
          mySeat={mySeat}
          holeCards={mine?.holeCards ?? []}
          toCall={toCall}
          callAmount={callAmount}
          canRaise={canRaise}
          minRaise={minRaise}
          maxRaise={maxRaise}
          raiseValue={effectiveRaise}
          onRaiseChange={setRaiseTo}
          onAct={act}
          loading={actionLoading}
        />

        {/* Folded / out notice */}
        {!isMyTurn && mySeat && (mySeat.status === 'FOLDED' || mySeat.status === 'OUT') && (
          <div className="rounded-xl border-4 border-black bg-white p-2 text-center text-xs font-black shadow-[4px_4px_0_0_#000]">
            {t('pokerV2.advisor.folded')}
          </div>
        )}

        {/* Advisor (desktop) */}
        <div className="hidden lg:block">
          <PokerV2AdvisorPanel advisor={mine?.advisor} opponentCount={liveOpponents} />
        </div>

        {/* Advisor toggle (mobile only — desktop shows the panel below) */}
        <button
          onClick={() => setShowAdvisorMobile((v) => !v)}
          className="rounded-xl border-4 border-black bg-violet-300 px-2 py-1.5 text-[11px] font-black shadow-[4px_4px_0_0_#000] active:translate-y-0.5 lg:hidden"
        >
          {showAdvisorMobile ? '▾' : '▸'} {t('pokerV2.advisor.title')}
        </button>
        {showAdvisorMobile && (
          <div className="lg:hidden">
            <PokerV2AdvisorPanel advisor={mine?.advisor} opponentCount={liveOpponents} compact />
          </div>
        )}

        {/* Rankings + standings + host controls */}
        <div className="flex flex-row items-center gap-2 lg:flex-col lg:items-stretch">
          <button
            data-testid="poker-v2-rankings"
            onClick={() => setShowRankings(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-black bg-white px-2 py-1.5 text-[11px] font-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5"
          >
            <ScrollText className="h-4 w-4" />
            {t('pokerV2.table.rankings')}
          </button>
          <div className="flex min-w-0 flex-1 flex-col rounded-xl border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000]">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
              <ListOrdered className="h-3.5 w-3.5" />
              {t('pokerV2.table.standings')}
            </span>
            <ul className="flex flex-col gap-0.5">
              {standings.map((id, idx) => (
                <li key={id} className="flex items-center justify-between text-[11px] font-bold">
                  <span
                    className={`flex items-center gap-1 truncate ${id === socketId ? 'font-black underline' : ''}`}
                  >
                    <span className="opacity-60">{idx + 1}.</span>
                    <span className="truncate">{playerName[id]}</span>
                    {state.seats[id].status === 'OUT' && (
                      <span className="rounded border border-black bg-black/10 px-1 text-[9px] font-black uppercase">
                        {t('pokerV2.table.out')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-black">
                    {state.seats[id].chips.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {isHost && !matchEnded && (
            <button
              data-testid="poker-v2-end-match"
              onClick={() => setShowEndConfirm(true)}
              className="rounded-xl border-2 border-black bg-rose-300 px-2 py-1.5 text-[11px] font-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 lg:mt-0"
            >
              {t('pokerV2.table.endMatch')}
            </button>
          )}
        </div>
      </aside>

      {/* ---------------- Dialogs ---------------- */}
      <GameDialog
        open={showRankings}
        onClose={() => setShowRankings(false)}
        title={t('pokerV2.table.rankings')}
      >
        <ol className="flex flex-col gap-1.5">
          {HAND_ORDER.map((hand, idx) => (
            <li
              key={hand}
              className="flex items-center justify-between rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-black"
            >
              <span>
                {HAND_ORDER.length - idx}. {t(`pokerV2.hands.${hand}`)}
              </span>
            </li>
          ))}
        </ol>
      </GameDialog>

      <GameDialog
        open={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        title={t('pokerV2.table.confirmEnd')}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold">{t('pokerV2.table.confirmEndDesc')}</p>
          <div className="flex gap-2">
            <button
              data-testid="poker-v2-confirm-end"
              onClick={() => {
                setShowEndConfirm(false);
                act({ type: 'END_MATCH' });
              }}
              className="flex-1 rounded-xl border-4 border-black bg-rose-400 px-3 py-2 text-sm font-black uppercase shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
            >
              {t('pokerV2.table.endMatch')}
            </button>
            <button
              onClick={() => setShowEndConfirm(false)}
              className="flex-1 rounded-xl border-4 border-black bg-white px-3 py-2 text-sm font-black uppercase shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
            >
              {t('pokerV2.table.cancel')}
            </button>
          </div>
        </div>
      </GameDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seat                                                                */
/* ------------------------------------------------------------------ */

function Seat({
  id,
  seat,
  slot,
  name,
  isMe,
  isDealer,
  isActive,
  isWinner,
  turnDeadline,
  serverOffset,
  revealedCards,
  phase,
}: {
  id: string;
  seat: PokerV2Seat;
  slot: { x: number; y: number };
  name: string;
  isMe: boolean;
  isDealer: boolean;
  isActive: boolean;
  isWinner: boolean;
  turnDeadline?: number | null;
  serverOffset: number;
  revealedCards?: import('@repo/types').PlayingCard[];
  phase: PokerV2PublicState['phase'];
}) {
  const { t } = useTranslate();
  const busted = seat.status === 'OUT';
  const folded = seat.status === 'FOLDED';
  const showCards = !!revealedCards && revealedCards.length > 0;

  const lastActionLabel = (() => {
    switch (seat.lastAction) {
      case 'FOLD':
        return t('pokerV2.action.fold');
      case 'CHECK':
        return t('pokerV2.action.check');
      case 'CALL':
        return `${t('pokerV2.action.call')} ${seat.lastActionAmount ?? ''}`;
      case 'BET':
      case 'RAISE':
      case 'ALL_IN':
        return seat.lastActionAmount != null ? seat.lastActionAmount.toLocaleString() : null;
      case 'SMALL_BLIND':
        return 'SB';
      case 'BIG_BLIND':
        return 'BB';
      case 'ANTE':
        return 'A';
      default:
        return null;
    }
  })();

  return (
    <div
      data-testid={`poker-v2-seat-${id}`}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      {/* hole cards (showdown reveal only — my cards live in the action bar) */}
      {showCards && !isMe && (
        <PokerV2CardRow cards={revealedCards!} size="xs" dimmed={folded || busted} />
      )}

      {/* street bet */}
      {seat.bet > 0 && <PokerV2Chips amount={seat.bet} tone="sky" className="scale-90" />}

      {/* avatar plate */}
      <motion.div
        animate={isActive ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={isActive ? { repeat: Infinity, duration: 1.2 } : {}}
        className={`relative flex items-center gap-1.5 rounded-2xl border-[3px] border-black px-2 py-1 shadow-[3px_3px_0_0_#000] ${
          isWinner
            ? 'bg-yellow-300 ring-4 ring-yellow-400'
            : isActive
              ? 'bg-yellow-200'
              : 'bg-white'
        } ${folded || busted ? 'opacity-45 grayscale' : ''}`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-black text-xs font-black ${
            SEAT_TONES[(id.charCodeAt(id.length - 1) + id.length) % SEAT_TONES.length]
          }`}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="max-w-[90px] truncate text-[11px] font-black">
            {isMe ? `★ ${name}` : name}
          </span>
          <PokerV2Chips
            amount={seat.chips}
            tone={busted ? 'rose' : 'emerald'}
            className="scale-90 origin-left"
          />
        </span>

        {isDealer && (
          <span
            title={t('pokerV2.table.dealer')}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-white text-[9px] font-black shadow-[1px_1px_0_0_#000]"
          >
            D
          </span>
        )}
        {isActive && turnDeadline && (
          <span className="absolute -bottom-3 -left-2 flex items-center gap-0.5 rounded-full border-2 border-black bg-rose-300 px-1.5 text-[10px] font-black shadow-[1px_1px_0_0_#000]">
            <Timer className="h-2.5 w-2.5" />
            <CountdownBadge deadline={turnDeadline} serverOffset={serverOffset} />
          </span>
        )}
        {seat.status === 'ALL_IN' && (
          <span className="absolute -left-2 -top-2 rounded-full border-2 border-black bg-fuchsia-400 px-1.5 text-[9px] font-black uppercase shadow-[1px_1px_0_0_#000]">
            {t('pokerV2.table.allIn')}
          </span>
        )}
        {folded && (
          <span className="absolute -left-2 -top-2 rounded-full border-2 border-black bg-black/80 px-1.5 text-[9px] font-black uppercase text-white shadow-[1px_1px_0_0_#000]">
            {t('pokerV2.table.folded')}
          </span>
        )}
        {busted && (
          <span className="absolute -left-2 -top-2 rounded-full border-2 border-black bg-black px-1.5 text-[9px] font-black uppercase text-white shadow-[1px_1px_0_0_#000]">
            {t('pokerV2.table.out')}
          </span>
        )}
        {isWinner && (
          <Crown className="absolute -top-6 left-1/2 h-5 w-5 -translate-x-1/2 text-yellow-500" />
        )}
      </motion.div>

      {/* last action bubble */}
      {lastActionLabel && seat.status !== 'OUT' && (
        <span className="rounded-full border-2 border-black bg-white/95 px-2 py-0.5 text-[10px] font-black shadow-[1px_1px_0_0_#000]">
          {lastActionLabel}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action bar                                                          */
/* ------------------------------------------------------------------ */

function ActionBar({
  visible,
  mySeat,
  holeCards,
  toCall,
  callAmount,
  canRaise,
  minRaise,
  maxRaise,
  raiseValue,
  onRaiseChange,
  onAct,
  loading,
}: {
  visible: boolean;
  mySeat?: PokerV2Seat;
  holeCards: import('@repo/types').PlayingCard[];
  toCall: number;
  callAmount: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  raiseValue: number;
  onRaiseChange: (v: number) => void;
  onAct: (action: PokerV2Action) => void;
  loading: boolean;
}) {
  const { t } = useTranslate();
  if (!visible || !mySeat) {
    // Waiting state: keep my cards visible on every screen size.
    return (
      <div className="flex items-center gap-2 rounded-xl border-4 border-black bg-white p-2 shadow-[4px_4px_0_0_#000]">
        <PokerV2CardRow cards={holeCards} size="md" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] font-black uppercase opacity-60">
            {t('pokerV2.table.yourCards')}
          </span>
          <PokerV2Chips
            amount={mySeat?.chips ?? 0}
            tone="emerald"
            className="scale-90 origin-left"
          />
        </div>
      </div>
    );
  }

  const btn =
    'flex-1 rounded-xl border-4 border-black px-3 py-2.5 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_0_#000] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-50';

  return (
    <div
      data-testid="poker-v2-action-panel"
      className="flex flex-col gap-2 rounded-2xl border-4 border-black bg-white p-2 shadow-[4px_4px_0_0_#000]"
    >
      <div className="flex items-center gap-2">
        <PokerV2CardRow cards={holeCards} size="md" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] font-black uppercase opacity-60">
            {t('pokerV2.table.yourCards')} ·{' '}
            <PokerV2Chips amount={mySeat.chips} tone="emerald" className="scale-90" />
          </span>
          {toCall > 0 && (
            <span className="text-[11px] font-black">
              {t('pokerV2.table.toCall')}: {callAmount.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          data-testid="poker-v2-fold"
          onClick={() => onAct({ type: 'FOLD' })}
          disabled={loading}
          className={`${btn} bg-rose-400`}
        >
          {t('pokerV2.action.fold')}
        </button>
        {toCall === 0 ? (
          <button
            data-testid="poker-v2-check"
            onClick={() => onAct({ type: 'CHECK' })}
            disabled={loading}
            className={`${btn} bg-amber-300`}
          >
            {t('pokerV2.action.check')}
          </button>
        ) : (
          <button
            data-testid="poker-v2-call"
            onClick={() => onAct({ type: 'CALL' })}
            disabled={loading}
            className={`${btn} bg-amber-300`}
          >
            {t('pokerV2.action.call')} {callAmount.toLocaleString()}
          </button>
        )}
        {canRaise && (
          <button
            data-testid="poker-v2-raise"
            onClick={() => onAct({ type: 'BET', amount: raiseValue })}
            disabled={loading}
            className={`${btn} bg-emerald-400`}
          >
            {t('pokerV2.action.raiseTo')} {raiseValue.toLocaleString()}
          </button>
        )}
      </div>

      {canRaise && (
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            data-testid="poker-v2-raise-slider"
            min={minRaise}
            max={maxRaise}
            step={1}
            value={Math.min(raiseValue, maxRaise)}
            onChange={(e) => onRaiseChange(Number(e.target.value))}
            className="w-full accent-emerald-600"
            aria-label={t('pokerV2.action.betAmount')}
          />
          <div className="flex gap-1.5">
            {(
              [
                ['min', t('pokerV2.action.min')],
                ['half', t('pokerV2.action.half')],
                ['pot', t('pokerV2.action.pot')],
                ['allin', t('pokerV2.action.allIn')],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                data-testid={`poker-v2-size-${kind}`}
                onClick={() => onRaiseChange(presetFor(kind, minRaise, maxRaise, toCall, mySeat))}
                className="flex-1 rounded-lg border-2 border-black bg-slate-200 px-1.5 py-1 text-[11px] font-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function presetFor(
  kind: 'min' | 'half' | 'pot' | 'allin',
  minRaise: number,
  maxRaise: number,
  _toCall: number,
  _mySeat: PokerV2Seat,
): number {
  void _toCall;
  void _mySeat;
  if (kind === 'min') return Math.min(minRaise, maxRaise);
  if (kind === 'allin') return maxRaise;
  const target = Math.round(maxRaise * (kind === 'half' ? 0.55 : 1));
  return Math.max(minRaise, Math.min(maxRaise, Math.max(target, minRaise)));
}

/* ------------------------------------------------------------------ */
/* Hand-result overlay                                                 */
/* ------------------------------------------------------------------ */

function HandResultOverlay({
  state,
  isHost,
  serverOffset,
  onDealNow,
  onEndMatch,
}: {
  state: PokerV2PublicState;
  isHost: boolean;
  serverOffset: number;
  onDealNow: () => void;
  onEndMatch: () => void;
}) {
  const { t } = useTranslate();
  const result = state.handResult!;
  const matchEnded = !!result.matchEnded;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="poker-v2-hand-result"
      className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border-4 border-black bg-white/95 p-3 shadow-[6px_6px_0_0_#000]"
    >
      <div className="flex flex-col gap-2">
        {result.pots.map((pot, idx) => (
          <div key={idx} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-black">
              <Trophy className="h-4 w-4 text-amber-500" />
              {pot.winnerIds.length > 1 ? t('pokerV2.result.splitPot') : t('pokerV2.result.winner')}
              {pot.handCategory ? ` · ${t(`pokerV2.hands.${pot.handCategory}`)}` : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <PokerV2Chips amount={pot.amount} tone="amber" />
            </span>
          </div>
        ))}
        {result.uncalledRefund && (
          <p className="text-[11px] font-bold opacity-70">
            {t('pokerV2.table.uncalled')}: {result.uncalledRefund.amount.toLocaleString()}
          </p>
        )}

        {/* revealed hands strip */}
        {state.showdown && Object.keys(state.showdown.revealedCards).length > 0 && (
          <div className="flex flex-wrap gap-2 border-t-2 border-black/10 pt-2">
            {Object.entries(state.showdown.revealedCards).map(([id, cards]) => (
              <div key={id} className="flex flex-col items-start gap-0.5">
                <span className="text-[10px] font-black opacity-70">
                  {state.seats[id]?.handCategory
                    ? t(`pokerV2.hands.${state.seats[id]!.handCategory!}`)
                    : ''}
                </span>
                <PokerV2CardRow
                  cards={cards}
                  size="xs"
                  highlightIds={
                    new Set(
                      result.pots
                        .find((p) => p.winnerIds.includes(id))
                        ?.bestCards?.map((c) => c.id) ?? [],
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {matchEnded ? (
            <span className="flex items-center gap-1.5 text-sm font-black">
              <Crown className="h-4 w-4 text-yellow-500" />
              {t('pokerV2.table.champion')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-black">
              <Hourglass className="h-4 w-4" />
              {t('pokerV2.table.nextHandIn')}
              <CountdownBadge
                deadline={state.nextHandDeadline}
                serverOffset={serverOffset}
                className="text-emerald-700"
                suffix={t('pokerV2.table.seconds')}
              />
            </span>
          )}
          <div className="flex gap-2">
            {isHost && !matchEnded && (
              <button
                data-testid="poker-v2-deal-now"
                onClick={onDealNow}
                className="flex items-center gap-1 rounded-xl border-2 border-black bg-emerald-400 px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0_0_#000] active:translate-y-0.5"
              >
                <Play className="h-3.5 w-3.5" />
                {t('pokerV2.table.dealNow')}
              </button>
            )}
            {isHost && (
              <button
                onClick={onEndMatch}
                className="rounded-xl border-2 border-black bg-rose-300 px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0_0_#000] active:translate-y-0.5"
              >
                {matchEnded ? t('pokerV2.table.backToLobby') : t('pokerV2.table.endMatch')}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** True when the card belongs to the winning hand of the first pot. */
function isWinningCard(
  card: import('@repo/types').PlayingCard | undefined,
  result?: PokerV2PublicState['handResult'],
): boolean {
  if (!card || !result) return false;
  const best = result.pots.find((p) => p.bestCards)?.bestCards;
  return !!best && best.some((c) => c.id === card.id);
}
