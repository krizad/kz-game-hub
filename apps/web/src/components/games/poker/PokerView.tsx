'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Hourglass, ScrollText, Settings2, Spade } from 'lucide-react';
import {
  GameType,
  PokerAction,
  PokerHandCategory,
  PokerPhase,
  PokerPublicState,
  PokerSeat,
  RoomStatus,
} from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CardHand } from '@/components/games/card-game/CardHand';
import { PokerHandRankings } from './PokerHandRankings';

const POKER_STREETS: PokerPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
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
  const { room, socketId, pokerAction, resetRoom } = useGameStore();
  const { t } = useTranslate();
  const [now, setNow] = useState(() => Date.now());
  const [betAmount, setBetAmount] = useState<number | null>(null);
  const [awardSelection, setAwardSelection] = useState<string[]>([]);
  const [adjustDrafts, setAdjustDrafts] = useState<Record<string, string>>({});
  const [showRankings, setShowRankings] = useState(false);

  const state = room?.pokerState;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

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
  const awaitingMyReveal =
    state.phase === 'SHOWDOWN' && !!state.showdown?.awaitingRevealIds.includes(socketId);
  const pendingPot = state.showdown?.pendingPots[0];
  const matchOver = room.status === RoomStatus.RESULT;

  const act = (action: PokerAction) => {
    pokerAction(action);
    setAwardSelection([]);
  };

  // Effective bet amount (clamped into the legal window; server re-checks).
  const amount = Math.min(Math.max(betAmount ?? raiseMin, raiseMin), myMax);
  const quickAmounts = [
    { key: 'min', value: raiseMin },
    {
      key: 'half',
      value: toCall + Math.ceil((state.pot + state.currentBet) / 2),
    },
    { key: 'pot', value: toCall + state.pot + state.currentBet },
    { key: 'allin', value: myMax },
  ].map((quick) => ({ ...quick, value: Math.min(Math.max(quick.value, raiseMin), myMax) }));

  const standings = [...room.players].filter((p) => !p.isViewer).sort((a, b) => b.score - a.score);

  const secondsLeft =
    state.turnDeadline && state.activePlayerId
      ? Math.max(0, Math.ceil((state.turnDeadline - now) / 1000))
      : null;

  return (
    <div
      className="flex-1 flex flex-col bg-white border-4 border-black p-2 sm:p-4 shadow-[4px_4px_0_0_#000] min-h-[300px] overflow-y-auto gap-3"
      data-testid="poker-table"
    >
      {/* Header: hand, phase, blinds, pot */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-1 bg-amber-300 border-2 border-black font-black text-xs uppercase">
            {t('poker.table.hand')} {state.handNumber}
          </span>
          <span
            className="px-2 py-1 bg-white border-2 border-black font-black text-xs uppercase"
            data-testid="poker-phase"
          >
            {t(`poker.table.phase.${state.phase as PokerPhase}`)}
          </span>
          <span className="text-xs font-bold opacity-70">
            SB {state.smallBlind} / BB {state.bigBlind}
          </span>
          {mode === 'CHIPS_LEDGER' && (
            <span className="px-2 py-1 bg-slate-200 border-2 border-black font-black text-[10px] uppercase">
              {t('poker.modeLedger')}
            </span>
          )}
          <button
            type="button"
            data-testid="poker-rankings-toggle"
            onClick={() => setShowRankings((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 border-2 border-black font-black text-[10px] uppercase transition-colors ${
              showRankings ? 'bg-lime-300' : 'bg-white hover:bg-amber-100'
            }`}
          >
            <ScrollText size={12} />
            {t('poker.table.rankings')}
          </button>
        </div>
        <div
          className="px-4 py-1 bg-lime-300 border-4 border-black font-black text-lg shadow-[2px_2px_0_0_#000]"
          data-testid="poker-pot"
        >
          {t('poker.table.pot')}:{' '}
          {state.pot + Object.values(state.seats).reduce((sum, seat) => sum + seat.bet, 0)}
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
        <div className="flex items-center gap-2" data-testid="poker-board">
          {Array.from({ length: 5 }).map((_, index) => {
            const card = state.board[index];
            if (card) {
              return (
                <div key={card.id}>
                  <CardHand cards={[card]} />
                </div>
              );
            }
            return (
              <div
                key={`slot-${index}`}
                className="w-16 h-20 border-4 border-dashed border-slate-300 rounded"
              />
            );
          })}
        </div>
      )}

      {/* Seats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {state.playerOrder.map((id) => {
          const seat = state.seats[id];
          const badge = seatBadgeLabel(seat);
          const isDealer = state.dealerId === id;
          const isActive = state.activePlayerId === id;
          const revealed = state.showdown?.revealedCards[id];
          return (
            <div
              key={id}
              data-testid={`poker-seat-${id}`}
              className={`border-4 border-black p-2 flex flex-col gap-1 ${
                isActive ? 'bg-yellow-200 shadow-[4px_4px_0_0_#000]' : 'bg-white'
              } ${seat.status === 'FOLDED' || seat.status === 'OUT' ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-black text-sm truncate max-w-[110px]">
                  {playerName[id] ?? '???'}
                </span>
                {isDealer && (
                  <span className="w-5 h-5 flex items-center justify-center bg-black text-white font-black text-xs rounded-full">
                    {t('poker.table.dealer')}
                  </span>
                )}
                {badge && (
                  <span className="px-1 border-2 border-black bg-slate-200 font-black text-[10px] uppercase">
                    {t(`poker.table.${badge}`)}
                  </span>
                )}
                {seat.lastAction && seat.status !== 'OUT' && (
                  <span className="px-1 bg-amber-100 border border-black font-bold text-[10px] uppercase">
                    {t(`poker.action.${seat.lastAction.toLowerCase()}`) !==
                    `poker.action.${seat.lastAction.toLowerCase()}`
                      ? t(`poker.action.${seat.lastAction.toLowerCase()}`)
                      : seat.lastAction}
                    {seat.lastActionAmount && seat.lastActionAmount > 0
                      ? ` ${seat.lastActionAmount}`
                      : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>🪙 {seat.chips}</span>
                {seat.bet > 0 && (
                  <span className="px-1 bg-lime-200 border border-black">
                    {t('poker.table.pot')} +{seat.bet}
                  </span>
                )}
              </div>
              {isActive && secondsLeft !== null && (
                <span className="flex items-center gap-1 text-[11px] font-black text-red-600">
                  <Hourglass size={12} /> {secondsLeft}
                  {t('poker.table.seconds')}
                </span>
              )}
              {revealed && (
                <div className="scale-75 origin-left">
                  <CardHand cards={revealed} />
                  {seat.handCategory && (
                    <span className="font-black text-[11px] uppercase">
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

      {/* My cards (ONLINE) */}
      {mode === 'ONLINE' && mySeat && state.handNumber > 0 && (
        <div className="flex flex-col gap-1" data-testid="poker-my-cards">
          <span className="text-xs font-black uppercase opacity-70">
            {t('poker.table.yourCards')} — 🪙 {mySeat.chips}
            {toCall > 0 && ` · ${t('poker.table.toCall')} ${toCall}`}
          </span>
          <MyHoleCards />
        </div>
      )}

      {/* Show / muck choice */}
      {awaitingMyReveal && (
        <div className="flex gap-2" data-testid="poker-reveal-panel">
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
        </div>
      )}
      {state.phase === 'SHOWDOWN' &&
        !!state.showdown?.awaitingRevealIds.length &&
        !awaitingMyReveal && (
          <p className="text-xs font-bold opacity-70 text-center">{t('poker.showdown.awaiting')}</p>
        )}

      {/* Betting action bar */}
      {isMyTurn && mySeat && (
        <div
          className="border-4 border-black bg-yellow-200 p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2"
          data-testid="poker-action-panel"
        >
          <span className="font-black uppercase text-sm flex items-center gap-1">
            <Spade size={14} /> {t('poker.table.yourTurn')}
          </span>
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
                {t('poker.action.call')} {toCall}
              </button>
            )}
          </div>
          {myMax > state.currentBet && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((quick) => (
                  <button
                    key={quick.key}
                    type="button"
                    data-testid={`poker-quick-${quick.key}`}
                    onClick={() => setBetAmount(quick.value)}
                    className={`px-2 py-1 border-2 border-black font-black text-xs uppercase ${
                      amount === quick.value ? 'bg-lime-300' : 'bg-white hover:bg-amber-100'
                    }`}
                  >
                    {t(`poker.action.${quick.key}`)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <span className="font-black text-xs uppercase">{t('poker.action.raiseTo')}</span>
                <input
                  type="number"
                  data-testid="poker-bet-input"
                  className="w-28 border-4 border-black px-2 py-1 font-black bg-white"
                  value={amount}
                  min={raiseMin}
                  max={myMax}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                />
                <button
                  type="button"
                  data-testid="poker-bet-confirm"
                  onClick={() => act({ type: 'BET', amount })}
                  className="ml-auto bg-lime-300 hover:bg-lime-200 border-4 border-black font-black uppercase px-4 py-2 shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
                >
                  {state.currentBet === 0 ? t('poker.action.bet') : t('poker.action.raiseTo')}{' '}
                  {amount}
                </button>
              </div>
            </div>
          )}
        </div>
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
          {state.handResult?.pots.map((pot, index) => (
            <p key={index} className="font-black text-sm">
              {pot.winnerIds.map((id) => playerName[id] ?? '???').join(' + ')}{' '}
              {pot.winnerIds.length > 1 ? t('poker.showdown.splitPot') : t('poker.showdown.winner')}{' '}
              🪙 {pot.amount}
              {pot.handCategory ? ` — ${t(`poker.handNames.${pot.handCategory}`)}` : ''}
            </p>
          ))}
          {state.handResult?.uncalledRefund && (
            <p className="text-xs font-bold opacity-70">
              {t('poker.showdown.uncalled')} —{' '}
              {playerName[state.handResult.uncalledRefund.playerId]} 🪙{' '}
              {state.handResult.uncalledRefund.amount}
            </p>
          )}

          {/* LEDGER: host awards pending pots one by one */}
          {isHost && pendingPot && (
            <div className="flex flex-col gap-2 border-2 border-black p-2 bg-amber-50">
              <p className="font-black text-xs uppercase">
                {t('poker.showdown.award')} 🪙 {pendingPot.amount}
              </p>
              <p className="text-xs font-bold opacity-70">{t('poker.showdown.awardPrompt')}</p>
              <div className="flex gap-2 flex-wrap">
                {pendingPot.eligiblePlayerIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`poker-award-${id}`}
                    onClick={() =>
                      setAwardSelection((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                    }
                    className={`px-2 py-1 border-2 border-black font-black text-xs uppercase ${
                      awardSelection.includes(id) ? 'bg-lime-300' : 'bg-white hover:bg-amber-100'
                    }`}
                  >
                    {playerName[id] ?? '???'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="poker-award-confirm"
                disabled={awardSelection.length === 0}
                className="bg-lime-300 hover:bg-lime-200 disabled:opacity-40 border-4 border-black font-black uppercase py-2 shadow-[3px_3px_0_0_#000]"
                onClick={() => act({ type: 'POT_AWARD', targetIds: awardSelection })}
              >
                {t('poker.showdown.award')}
              </button>
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
