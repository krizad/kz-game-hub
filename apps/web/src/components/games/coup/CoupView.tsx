'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { SoundToggle } from '@/components/core/SoundToggle';
import { CoupHelpModal } from './CoupHelpModal';
import { CoupRole, CoupActionType, CoupPhase, type CoupState } from '@repo/types';
import { toast } from 'react-hot-toast';
import { useCoupSounds, type CoupSound } from '@/hooks/useCoupSounds';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { useServerClock } from '@/hooks/useServerClock';

const roleEmoji: Record<CoupRole, string> = {
  [CoupRole.DUKE]: '👒',
  [CoupRole.ASSASSIN]: '💢',
  [CoupRole.CAPTAIN]: '💍',
  [CoupRole.AMBASSADOR]: '📜',
  [CoupRole.CONTESSA]: '🧺',
};

const roleKeys: Record<CoupRole, string> = {
  [CoupRole.DUKE]: 'gameCoup.roleDuke',
  [CoupRole.ASSASSIN]: 'gameCoup.roleAssassin',
  [CoupRole.CAPTAIN]: 'gameCoup.roleCaptain',
  [CoupRole.AMBASSADOR]: 'gameCoup.roleAmbassador',
  [CoupRole.CONTESSA]: 'gameCoup.roleContessa',
};

const roleDescriptionKeys: Record<CoupRole, string> = {
  [CoupRole.DUKE]: 'gameCoup.roleDukeDesc',
  [CoupRole.ASSASSIN]: 'gameCoup.roleAssassinDesc',
  [CoupRole.CAPTAIN]: 'gameCoup.roleCaptainDesc',
  [CoupRole.AMBASSADOR]: 'gameCoup.roleAmbassadorDesc',
  [CoupRole.CONTESSA]: 'gameCoup.roleContessaDesc',
};

const actionKeys: Record<CoupActionType, string> = {
  [CoupActionType.INCOME]: 'gameCoup.actionIncome',
  [CoupActionType.FOREIGN_AID]: 'gameCoup.actionForeignAid',
  [CoupActionType.COUP]: 'gameCoup.actionCoup',
  [CoupActionType.TAX]: 'gameCoup.actionTax',
  [CoupActionType.ASSASSINATE]: 'gameCoup.actionAssassinate',
  [CoupActionType.STEAL]: 'gameCoup.actionSteal',
  [CoupActionType.EXCHANGE]: 'gameCoup.actionExchange',
};

const phaseKeys: Record<CoupPhase, string> = {
  [CoupPhase.LOBBY]: 'gameCoup.phaseLobby',
  [CoupPhase.PLAYING]: 'gameCoup.phasePlaying',
  [CoupPhase.AWAITING_CHALLENGE]: 'gameCoup.phaseAwaitingChallenge',
  [CoupPhase.AWAITING_BLOCK]: 'gameCoup.phaseAwaitingBlock',
  [CoupPhase.AWAITING_EXCHANGE]: 'gameCoup.phaseAwaitingExchange',
  [CoupPhase.AWAITING_REVEAL]: 'gameCoup.phaseAwaitingReveal',
  [CoupPhase.RESULT]: 'gameCoup.phaseResult',
};

export function CoupView() {
  const {
    room,
    socketId,
    privateState,
    resetRoom,
    coupDeclare,
    coupChallenge,
    coupBlock,
    coupExchangeSelect,
  } = useGameStore();
  const { t } = useTranslate();
  const roleLabel = (role: CoupRole) => t(roleKeys[role]);
  const actionLabel = (action: CoupActionType) => t(actionKeys[action]);
  const { enabled: soundsEnabled, toggle: toggleSound } = useSoundSettings();
  const playSound = useCoupSounds(soundsEnabled);
  const [coupTarget, setCoupTarget] = useState<string>('');
  const [assassinateTarget, setAssassinateTarget] = useState<string>('');
  const [stealTarget, setStealTarget] = useState<string>('');
  const [exchangeKeep, setExchangeKeep] = useState<number[]>([]);
  const [isExchangeSubmitting, setIsExchangeSubmitting] = useState<boolean>(false);
  const [actionHistory, setActionHistory] = useState<string[]>([]);
  const { getRemainingMs } = useServerClock();
  const [, setTick] = useState<number>(0);

  const state = room?.coupState;

  const activeDeadline =
    state?.phase === CoupPhase.AWAITING_CHALLENGE
      ? state.challengeWindowDeadline
      : state?.phase === CoupPhase.AWAITING_BLOCK
        ? state.blockWindowDeadline
        : null;

  useEffect(() => {
    if (!activeDeadline) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 250);
    return () => clearInterval(timer);
  }, [activeDeadline]);

  const getSecondsLeft = (deadline: number | null | undefined): number => {
    if (!deadline) return 0;
    return Math.max(0, Math.ceil(getRemainingMs(deadline) / 1000));
  };

  useEffect(() => {
    if (state?.phase !== CoupPhase.AWAITING_EXCHANGE) {
      setExchangeKeep([]);
      setIsExchangeSubmitting(false);
    }
  }, [state?.phase]);

  // ── Action History Logging ─────────────────────────────────────────
  const prevGameRef = useRef<{
    phase: string | null;
    pendingAction: NonNullable<CoupState['pendingAction']> | null;
    pendingBlock: NonNullable<CoupState['pendingBlock']> | null;
    influences: Record<string, { count: number; revealed: CoupRole[] }>;
    coins: Record<string, number>;
    currentTurn: string | null;
    winnerId: string | null;
  }>({
    phase: null,
    pendingAction: null,
    pendingBlock: null,
    influences: {},
    coins: {},
    currentTurn: null,
    winnerId: null,
  });

  useEffect(() => {
    if (!state) return;
    const prev = prevGameRef.current;
    if (!prev.phase) {
      prevGameRef.current = {
        phase: state.phase,
        pendingAction: state.pendingAction ? { ...state.pendingAction } : null,
        pendingBlock: state.pendingBlock ? { ...state.pendingBlock } : null,
        influences: JSON.parse(JSON.stringify(state.influences)),
        coins: { ...state.coins },
        currentTurn: state.currentTurn,
        winnerId: state.winnerId,
      };
      return;
    }

    const addHistory = (entry: string) => {
      setActionHistory((h) => (h[0] === entry ? h : [entry, ...h.slice(0, 19)]));
    };

    // 1. Pending Action declared
    if (
      state.pendingAction &&
      (!prev.pendingAction ||
        prev.pendingAction.type !== state.pendingAction.type ||
        prev.pendingAction.actorId !== state.pendingAction.actorId)
    ) {
      const actor =
        room?.players.find((p) => p.socketId === state.pendingAction!.actorId)?.name ?? 'Someone';
      const actionName = actionLabel(state.pendingAction.type);
      const target = state.pendingAction.targetId
        ? room?.players.find((p) => p.socketId === state.pendingAction!.targetId)?.name
        : undefined;
      const role = state.pendingAction.claimedRole
        ? roleLabel(state.pendingAction.claimedRole)
        : undefined;
      let entry = `${actor}: ${actionName}`;
      if (role) entry += ` (${role})`;
      if (target) entry += ` ➔ ${target}`;
      addHistory(entry);
    }

    // 2. Pending Block declared
    if (
      state.pendingBlock &&
      (!prev.pendingBlock ||
        prev.pendingBlock.blockerId !== state.pendingBlock.blockerId ||
        prev.pendingBlock.claimedRole !== state.pendingBlock.claimedRole)
    ) {
      const blocker =
        room?.players.find((p) => p.socketId === state.pendingBlock!.blockerId)?.name ?? 'Someone';
      const role = roleLabel(state.pendingBlock.claimedRole);
      const entry = `🛡️ ${blocker} blocks as ${role}`;
      addHistory(entry);
    }

    // 3. Influence lost anywhere (challenge loss, assassination, coup)
    for (const [pid, inf] of Object.entries(state.influences)) {
      const prevInf = prev.influences[pid];
      if (prevInf && inf.count < prevInf.count) {
        const playerName = room?.players.find((p) => p.socketId === pid)?.name ?? pid;
        const newRevealed = inf.revealed[inf.revealed.length - 1];
        const roleText = newRevealed
          ? `${roleEmoji[newRevealed]} ${roleLabel(newRevealed)}`
          : 'status card';

        // Check context of influence loss:
        if (prev.pendingBlock) {
          const blockerId = prev.pendingBlock.blockerId;
          if (pid === blockerId) {
            // Blocker lost -> block challenge succeeded (blocker caught bluffing)
            addHistory(
              t('gameCoup.blockChallengeSuccessLog', { blocker: playerName, role: roleText }),
            );
          } else {
            // Challenger lost -> block challenge failed (blocker had the role)
            const blockerName =
              room?.players.find((p) => p.socketId === blockerId)?.name ?? 'Blocker';
            addHistory(
              t('gameCoup.blockChallengeFailLog', {
                blocker: blockerName,
                challenger: playerName,
              }),
            );
          }
        } else if (
          prev.pendingAction &&
          prev.pendingAction.claimedRole &&
          prev.phase === 'AWAITING_CHALLENGE'
        ) {
          const actorId = prev.pendingAction.actorId;
          // Action challenge context
          if (pid === actorId) {
            // Actor lost -> action challenge succeeded (actor caught bluffing)
            addHistory(
              t('gameCoup.actionChallengeSuccessLog', { actor: playerName, role: roleText }),
            );
          } else {
            // Challenger lost -> action challenge failed (actor had the role)
            const actorName =
              room?.players.find((p) => p.socketId === actorId)?.name ?? 'Actor';
            addHistory(
              t('gameCoup.actionChallengeFailLog', {
                actor: actorName,
                challenger: playerName,
              }),
            );
          }
        } else {
          // General influence loss (e.g. Coup or Assassinate)
          addHistory(t('gameCoup.lostInfluenceLog', { player: playerName, role: roleText }));
        }
      }
    }

    // 4. Block stood via timeout (pendingBlock was present, now null, and no influence lost)
    if (prev.pendingBlock && !state.pendingBlock && prev.phase === 'AWAITING_CHALLENGE') {
      const blockerId = prev.pendingBlock.blockerId;
      const influenceDropped = Object.entries(state.influences).some(
        ([id, inf]) => (prev.influences[id]?.count ?? 0) > inf.count,
      );
      if (!influenceDropped && state.phase === 'PLAYING') {
        const blocker =
          room?.players.find((p) => p.socketId === blockerId)?.name ?? 'Someone';
        const actionName = prev.pendingAction ? actionLabel(prev.pendingAction.type) : '';
        addHistory(t('gameCoup.blockStoodLog', { blocker, action: actionName }));
      }
    }

    // 5. Action resolved via timeout (Income, Tax, Foreign Aid, etc.)
    if (prev.currentTurn && prev.currentTurn !== state.currentTurn) {
      const prevActor =
        room?.players.find((p) => p.socketId === prev.currentTurn)?.name ?? 'Someone';
      const prevCoins = prev.coins[prev.currentTurn] ?? 0;
      const currentCoins = state.coins[prev.currentTurn] ?? 0;

      // Income (+1 coin)
      if (currentCoins === prevCoins + 1 && !prev.pendingAction) {
        addHistory(`${prevActor}: ${actionLabel(CoupActionType.INCOME)}`);
      }
      // Coup (-7 coins)
      else if (currentCoins === prevCoins - 7 && !prev.pendingAction) {
        addHistory(`${prevActor}: ${actionLabel(CoupActionType.COUP)}`);
      }
    }

    // 6. Winner
    if (state.winnerId && state.winnerId !== prev.winnerId) {
      const winner =
        room?.players.find((p) => p.socketId === state.winnerId)?.name ?? state.winnerId;
      addHistory(`🏆 ${t('gameCoup.winner', { name: winner })}`);
    }

    prevGameRef.current = {
      phase: state.phase,
      pendingAction: state.pendingAction ? { ...state.pendingAction } : null,
      pendingBlock: state.pendingBlock ? { ...state.pendingBlock } : null,
      influences: JSON.parse(JSON.stringify(state.influences)),
      coins: { ...state.coins },
      currentTurn: state.currentTurn,
      winnerId: state.winnerId,
    };
  }, [state, room?.players, t]);

  // ── Sound effects: derive cues from server-state deltas ─────────────
  // 1) a declared action (pendingAction appears) → sound per action type
  // 2) any influence count drops → coup boom
  // 3) winnerId set → victory fanfare
  const lastSeq = useRef<{
    pending: string | null;
    influences: string | null;
    winner: string | null;
  }>({ pending: null, influences: null, winner: null });
  useEffect(() => {
    if (!state) return;
    const pendingKey = state.pendingAction
      ? `${state.pendingAction.actorId}:${state.pendingAction.type}:${state.pendingAction.targetId ?? ''}`
      : null;
    const influencesKey = Object.entries(state.influences)
      .map(([id, inf]) => `${id}:${inf.count}`)
      .sort()
      .join(',');
    const winnerKey = state.winnerId ?? null;

    const prev = lastSeq.current;
    const first = prev.pending === null && prev.influences === null && prev.winner === null;

    if (!first) {
      // Declared action (only on appear, not on resolution)
      if (pendingKey && pendingKey !== prev.pending && state.pendingAction) {
        const type = state.pendingAction.type;
        const map: Record<string, CoupSound> = {
          INCOME: 'income',
          FOREIGN_AID: 'foreign-aid',
          TAX: 'tax',
          ASSASSINATE: 'assassinate',
          STEAL: 'steal',
          EXCHANGE: 'exchange',
          COUP: 'coup',
        };
        playSound(map[type] ?? 'income');
      }
      // Influence lost anywhere at the table
      if (influencesKey !== prev.influences && prev.influences !== null) {
        const before: Record<string, number> = {};
        prev.influences.split(',').forEach((pair) => {
          const [id, c] = pair.split(':');
          before[id] = Number(c);
        });
        const dropped = Object.entries(state.influences).some(
          ([id, inf]) => (before[id] ?? inf.count) > inf.count,
        );
        if (dropped) playSound('coup');
      }
      // Winner decided
      if (winnerKey && winnerKey !== prev.winner) {
        playSound('win');
      }
    }

    lastSeq.current = { pending: pendingKey, influences: influencesKey, winner: winnerKey };
  }, [state, playSound]);
  if (!room || !state) return <div className="p-6 font-black">{t('gameCoup.loading')}</div>;
  const hand = (privateState as any)?.coupHand as CoupRole[] | undefined;
  const exchangeKeepCount = hand ? Math.max(1, hand.length - 2) : 2;
  const isMyTurn = state.currentTurn === socketId;
  const myCoins = state.coins[socketId] ?? 0;
  const forcedCoup = myCoins >= 10;
  const aliveTargets = room.players.filter(
    (p) => p.socketId !== socketId && (state.influences[p.socketId]?.count ?? 0) > 0,
  );
  // A remembered target can die (or leave) between its selection and the
  // declare — never let a stale id arm the action buttons.
  const assassinateTargetValid = aliveTargets.some((p) => p.socketId === assassinateTarget);
  const stealTargetValid = aliveTargets.some((p) => p.socketId === stealTarget);
  const coupTargetValid = aliveTargets.some((p) => p.socketId === coupTarget);
  const getTargetName = (targetId: string) =>
    room.players.find((p) => p.socketId === targetId)?.name ?? t('gameCoup.none');

  const getClaimedRole = (type: CoupActionType): CoupRole | null => {
    switch (type) {
      case CoupActionType.TAX:
        return CoupRole.DUKE;
      case CoupActionType.ASSASSINATE:
        return CoupRole.ASSASSIN;
      case CoupActionType.STEAL:
        return CoupRole.CAPTAIN;
      case CoupActionType.EXCHANGE:
        return CoupRole.AMBASSADOR;
      default:
        return null;
    }
  };

  const handleDeclare = (type: CoupActionType, targetId?: string) => {
    const actor = room?.players.find((p) => p.socketId === socketId)?.name ?? 'You';
    const actionName = actionLabel(type);
    const target = targetId ? getTargetName(targetId) : undefined;
    const role = getClaimedRole(type);
    let entry = `${actor}: ${actionName}`;
    if (role) entry += ` (${roleLabel(role)})`;
    if (target && target !== t('gameCoup.none')) entry += ` ➔ ${target}`;

    setActionHistory((prev) => (prev[0] === entry ? prev : [entry, ...prev.slice(0, 19)]));
    coupDeclare(type, targetId);
  };

  const isSpectator =
    room.players.find((p) => p.socketId === socketId)?.isViewer ||
    state.influences[socketId]?.count === 0;
  const renderSoundToggle = () => (
    <SoundToggle
      enabled={soundsEnabled}
      onToggle={toggleSound}
      titleOn={t('gameCoup.soundOn')}
      titleOff={t('gameCoup.soundOff')}
      testId="coup-sound-toggle"
      className="w-8 h-8 shadow-[2px_2px_0_0_#000]"
    />
  );

  return (
    <div className="flex flex-col gap-4 bg-[#FFF7E8] border-4 border-[#5B2637] p-4 shadow-[4px_4px_0_0_#5B2637]">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="min-w-0 text-xl font-black tracking-wide">
          {t('lobby.gameNames.coup')} — {t(phaseKeys[state.phase])}
        </h2>
        <div className="flex flex-wrap shrink-0 gap-2">
          <CoupHelpModal />
          {renderSoundToggle()}
          {room.roomHostId === socketId && (
            <button
              data-testid="coup-return-lobby"
              onClick={() => resetRoom()}
              className="bg-black text-white px-3 py-1 text-xs font-black uppercase"
            >
              {t('gameCoup.reset')}
            </button>
          )}
        </div>
      </div>
      {isSpectator && (
        <div className="bg-black text-white text-xs font-black uppercase text-center py-1">
          {t('gameCoup.spectating')} — {t('gameCoup.helpButton')} {t('lobby.viewer')}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {room.players.map((p) => {
          const coins = state.coins[p.socketId] ?? 0;
          const inf = state.influences[p.socketId];
          const isTurn = state.currentTurn === p.socketId;
          const revealed = inf?.revealed ?? [];
          const count = inf?.count ?? 0;
          const isMe = p.socketId === socketId;
          return (
            <div
              key={p.socketId}
              className={`border-4 p-2 ${isTurn ? 'border-[#7B3149] bg-[#F4DEAA]' : 'border-[#5B2637] bg-white'}`}
            >
              <div className="text-xs font-black truncate">
                {p.name} {isMe && `(${t('gameCoup.you')})`} {isTurn && '◀'}
              </div>
              <div className="text-xs font-bold">
                {t('gameCoup.coins')}: {coins} 💰
              </div>
              <div className="text-xs font-bold">
                {t('gameCoup.influences')}: {count} {count === 0 && '💀'}
              </div>
              {revealed.length > 0 && (
                <div className="text-[10px] font-bold">
                  {t('gameCoup.revealed')}:{' '}
                  {revealed.map((r) => `${roleEmoji[r]} ${roleLabel(r)}`).join(', ')}
                </div>
              )}
              <div className="flex gap-1 mt-1">
                {Array.from({ length: count }).map((_, i) => (
                  <div
                    key={i}
                    data-testid="coup-card-hidden"
                    aria-label="Hidden influence"
                    className="w-6 h-8 border-2 border-black bg-black text-white flex items-center justify-center text-[10px]"
                  >
                    ?
                  </div>
                ))}
                {revealed.map((r, i) => (
                  <div
                    key={`r-${i}`}
                    data-testid="coup-card-revealed"
                    aria-label={`Revealed: ${roleLabel(r)}`}
                    className="w-6 h-8 border-2 border-black bg-white flex items-center justify-center text-[10px]"
                  >
                    {roleEmoji[r]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-4 border-[#5B2637] p-3 bg-[#F7EBD6]">
        <div className="text-xs font-black uppercase mb-1">
          {t('gameCoup.deadPile')}: {state.deadPile.length} {t('gameCoup.cards')}
        </div>
        <div className="flex gap-1 flex-wrap">
          {state.deadPile.map((r, i) => (
            <span
              key={i}
              className="border-2 border-black px-1 py-0.5 bg-white text-[10px] font-black"
            >
              {roleEmoji[r]} {roleLabel(r)}
            </span>
          ))}
          {state.deadPile.length === 0 && (
            <span className="text-xs opacity-50">— {t('gameCoup.emptyPile')} —</span>
          )}
        </div>
        <div className="text-xs font-bold mt-1">
          {t('gameCoup.deck')}: {state.deck.length} {t('gameCoup.cards')}
        </div>
      </div>

      <div className="border-4 border-[#5B2637] p-3 bg-[#EFE0BC]">
        <div className="text-xs font-black uppercase">
          {t('gameCoup.yourInfluence')} {hand ? `(${hand.length})` : ''}
        </div>
        {hand ? (
          <div className="flex gap-2 mt-2">
            {hand.map((r, i) => (
              <div
                key={i}
                className="flex-1 border-4 border-[#5B2637] bg-white p-3 text-center font-black shadow-[2px_2px_0_0_#5B2637]"
              >
                <span className="text-2xl">{roleEmoji[r]}</span>
                <div className="text-xs mt-1">{roleLabel(r)}</div>
                <div className="text-[10px] font-bold opacity-70 mt-1">
                  {t(roleDescriptionKeys[r])}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs opacity-60">{t('gameCoup.noHand')}</div>
        )}
        <div className="text-xs font-bold mt-2">
          {t('gameCoup.yourCoins')}: {myCoins} 💰{' '}
          {isMyTurn && (
            <span className="bg-[#EF4444] text-white px-1 ml-1">{t('gameCoup.yourTurn')}</span>
          )}
        </div>
      </div>

      {state.phase === 'AWAITING_CHALLENGE' && state.pendingAction && !state.pendingBlock && (
        <div className="border-4 border-black p-3 bg-[#FECACA]">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span
              data-testid="coup-challenge-kind"
              className="bg-red-800 text-white text-[10px] font-black uppercase px-2 py-0.5"
            >
              {t('gameCoup.challengeActionLabel')}
            </span>
          </div>
          <div className="text-xs font-black uppercase text-center">
            {t('gameCoup.declaredAction', {
              name:
                room.players.find((p) => p.socketId === state.pendingAction!.actorId)?.name ?? '',
              action: actionLabel(state.pendingAction.type),
              role: state.pendingAction.claimedRole
                ? roleLabel(state.pendingAction.claimedRole)
                : '',
            })}{' '}
            — {t('gameCoup.challengeQuestion')}
          </div>
          {(() => {
            const actorId = state.pendingAction.actorId;
            const eligible = room.players.filter(
              (p) => p.socketId !== actorId && (state.influences[p.socketId]?.count ?? 0) > 0,
            );
            const canChallenge =
              actorId !== socketId && (state.influences[socketId]?.count ?? 0) > 0;
            const secondsLeft = getSecondsLeft(state.challengeWindowDeadline);

            return (
              <>
                <div
                  data-testid="coup-countdown"
                  className="text-xs font-black text-center mt-1 text-red-800"
                >
                  ⏱️ {t('gameCoup.countdown', { seconds: secondsLeft })}
                </div>
                <div
                  data-testid="coup-eligible-responders"
                  className="text-[11px] font-bold text-center mt-0.5 text-gray-800"
                >
                  {t('gameCoup.eligibleChallengers', {
                    names: eligible.map((p) => p.name).join(', '),
                  })}
                </div>
                {canChallenge && (
                  <button
                    data-testid="coup-challenge-button"
                    onClick={() => coupChallenge()}
                    className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase"
                  >
                    {t('gameCoup.challenge')}
                  </button>
                )}
                {!canChallenge && (
                  <div className="text-xs text-center mt-1 opacity-70">
                    {t('gameCoup.waitingChallenge')}
                  </div>
                )}
                <div className="text-[10px] text-center mt-1 opacity-60">
                  {t('gameCoup.autoResolve')}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {state.phase === 'AWAITING_CHALLENGE' && state.pendingBlock && state.pendingAction && (
        <div className="border-4 border-black p-3 bg-[#FDE68A]">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span
              data-testid="coup-challenge-kind"
              className="bg-amber-800 text-white text-[10px] font-black uppercase px-2 py-0.5"
            >
              {t('gameCoup.challengeBlockLabel')}
            </span>
          </div>
          <div className="text-xs font-black uppercase text-center">
            {t('gameCoup.blocksAction', {
              name:
                room.players.find((p) => p.socketId === state.pendingBlock!.blockerId)?.name ?? '',
              action: actionLabel(state.pendingAction.type),
              role: roleLabel(state.pendingBlock.claimedRole),
            })}{' '}
            — {t('gameCoup.challengeBlockQuestion')}
          </div>
          {(() => {
            const blockerId = state.pendingBlock.blockerId;
            const eligible = room.players.filter(
              (p) => p.socketId !== blockerId && (state.influences[p.socketId]?.count ?? 0) > 0,
            );
            const canChallengeBlock =
              blockerId !== socketId && (state.influences[socketId]?.count ?? 0) > 0;
            const secondsLeft = getSecondsLeft(state.challengeWindowDeadline);

            return (
              <>
                <div
                  data-testid="coup-countdown"
                  className="text-xs font-black text-center mt-1 text-amber-900"
                >
                  ⏱️ {t('gameCoup.countdown', { seconds: secondsLeft })}
                </div>
                <div
                  data-testid="coup-eligible-responders"
                  className="text-[11px] font-bold text-center mt-0.5 text-gray-800"
                >
                  {t('gameCoup.eligibleBlockChallengers', {
                    names: eligible.map((p) => p.name).join(', '),
                  })}
                </div>
                {canChallengeBlock && (
                  <button
                    data-testid="coup-challenge-block-button"
                    onClick={() => coupChallenge()}
                    className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase"
                  >
                    {t('gameCoup.challengeBlock')}
                  </button>
                )}
                {!canChallengeBlock && (
                  <div className="text-xs text-center mt-1 opacity-70">
                    {t('gameCoup.waitingChallenge')}
                  </div>
                )}
                <div className="text-[10px] text-center mt-1 opacity-60">
                  {t('gameCoup.autoResolve')}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {state.phase === 'AWAITING_BLOCK' && state.pendingAction && (
        <div className="border-4 border-black p-3 bg-[#BFDBFE]">
          <div className="text-xs font-black uppercase text-center">
            {room.players.find((p) => p.socketId === state.pendingAction!.actorId)?.name}{' '}
            {actionLabel(state.pendingAction.type)} — {t('gameCoup.blockQuestion')}
          </div>
          {(() => {
            const isForeignAid = state.pendingAction!.type === 'FOREIGN_AID';
            const isAssassinate = state.pendingAction!.type === 'ASSASSINATE';
            const isSteal = state.pendingAction!.type === 'STEAL';
            const secondsLeft = getSecondsLeft(state.blockWindowDeadline);

            const canBlockForeignAid =
              isForeignAid &&
              state.pendingAction!.actorId !== socketId &&
              (state.influences[socketId]?.count ?? 0) > 0;
            const canBlockAssassinate =
              isAssassinate &&
              state.pendingAction!.targetId === socketId &&
              (state.influences[socketId]?.count ?? 0) > 0;
            const canBlockSteal =
              isSteal &&
              state.pendingAction!.targetId === socketId &&
              (state.influences[socketId]?.count ?? 0) > 0;

            const targetName =
              room.players.find((p) => p.socketId === state.pendingAction!.targetId)?.name ??
              t('gameCoup.none');

            return (
              <>
                <div
                  data-testid="coup-countdown"
                  className="text-xs font-black text-center mt-1 text-blue-900"
                >
                  ⏱️ {t('gameCoup.countdown', { seconds: secondsLeft })}
                </div>
                <div
                  data-testid="coup-eligible-responders"
                  className="text-[11px] font-bold text-center mt-0.5 text-gray-800"
                >
                  {isForeignAid
                    ? t('gameCoup.anyoneCanBlock')
                    : t('gameCoup.onlyTargetCanBlock', { target: targetName })}
                </div>

                {canBlockSteal && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      data-testid="coup-block-captain"
                      onClick={() => coupBlock(CoupRole.CAPTAIN)}
                      className="bg-white border-4 border-black font-black py-2 text-xs uppercase"
                    >
                      {roleLabel(CoupRole.CAPTAIN)}
                    </button>
                    <button
                      data-testid="coup-block-ambassador"
                      onClick={() => coupBlock(CoupRole.AMBASSADOR)}
                      className="bg-white border-4 border-black font-black py-2 text-xs uppercase"
                    >
                      {roleLabel(CoupRole.AMBASSADOR)}
                    </button>
                  </div>
                )}

                {(canBlockForeignAid || canBlockAssassinate) && (
                  <button
                    data-testid="coup-block-button"
                    onClick={() => coupBlock()}
                    className="mt-2 w-full bg-white border-4 border-black font-black py-2 text-xs uppercase"
                  >
                    {t('gameCoup.block')}
                  </button>
                )}

                {!canBlockForeignAid && !canBlockAssassinate && !canBlockSteal && (
                  <div className="text-xs text-center mt-1 opacity-60">
                    {t('gameCoup.waitingBlock')}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {state.phase === 'AWAITING_EXCHANGE' && state.pendingAction && (
        <div className="border-4 border-black p-3 bg-[#FDE68A]">
          <div className="text-xs font-black uppercase text-center">
            {t('gameCoup.exchangeChoose', { count: exchangeKeepCount })}
          </div>
          {state.pendingAction.actorId === socketId && hand && hand.length >= 3 ? (
            <>
              <div
                data-testid="coup-exchange-selected-count"
                className="text-xs font-bold text-center mt-1 text-gray-800"
              >
                {t('gameCoup.exchangeSelectedCount', {
                  selected: exchangeKeep.length,
                  total: exchangeKeepCount,
                })}
              </div>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {hand.map((r, i) => {
                  const selected = exchangeKeep.includes(i);
                  const toggleSelect = () => {
                    setExchangeKeep((prev) =>
                      prev.includes(i)
                        ? prev.filter((x) => x !== i)
                        : prev.length < exchangeKeepCount
                          ? [...prev, i]
                          : prev,
                    );
                  };

                  return (
                    <button
                      key={i}
                      data-testid={`coup-exchange-card-${i}`}
                      aria-pressed={selected}
                      aria-label={`${roleLabel(r)} ${selected ? '(Selected)' : ''}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleSelect();
                        }
                      }}
                      onClick={toggleSelect}
                      className={`border-4 p-2 text-xs font-black focus:outline-none focus:ring-2 focus:ring-black ${
                        selected ? 'bg-[#A3E635] border-black' : 'bg-white border-black'
                      }`}
                    >
                      {roleEmoji[r]} {roleLabel(r)}
                    </button>
                  );
                })}
              </div>
              <button
                data-testid="coup-exchange-submit"
                disabled={isExchangeSubmitting || exchangeKeep.length !== exchangeKeepCount}
                onClick={() => {
                  if (isExchangeSubmitting || exchangeKeep.length !== exchangeKeepCount) return;
                  setIsExchangeSubmitting(true);
                  coupExchangeSelect(exchangeKeep);
                }}
                className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase disabled:bg-gray-300"
              >
                {t('gameCoup.keepSelected', { count: exchangeKeepCount })}
              </button>
            </>
          ) : (
            <div className="text-xs text-center mt-1 opacity-60">
              {state.pendingAction.actorId === socketId
                ? t('gameCoup.loading')
                : t('gameCoup.waitingExchange', {
                    name:
                      room.players.find((p) => p.socketId === state.pendingAction!.actorId)?.name ??
                      '',
                  })}
            </div>
          )}
        </div>
      )}

      {!state.winnerId && state.phase === 'PLAYING' && (
        <div data-testid="coup-action-area" className="border-4 border-black p-3 bg-white">
          <div className="text-xs font-black uppercase mb-3 flex flex-wrap items-center justify-between gap-1">
            <div>
              {isMyTurn
                ? t('gameCoup.yourTurn')
                : `${t('gameCoup.waitingFor')} ${room.players.find((p) => p.socketId === state.currentTurn)?.name ?? '...'}`}{' '}
            </div>
            {forcedCoup && isMyTurn && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 text-[11px] font-bold">
                {t('gameCoup.mustCoup')}
              </span>
            )}
          </div>

          {forcedCoup && isMyTurn && (
            <div
              data-testid="coup-mandatory-banner"
              className="border-2 border-red-600 bg-red-100 text-red-900 p-2 text-xs font-bold mb-3 flex items-center gap-2"
            >
              <span>⚠️</span>
              <span>{t('gameCoup.mustCoupHint')}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Untargeted actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Income */}
              <div className="border-2 border-black p-2 bg-[#F9F5EC] flex flex-col justify-between gap-1.5">
                <button
                  disabled={!isMyTurn || forcedCoup}
                  onClick={() => handleDeclare(CoupActionType.INCOME)}
                  className="w-full border-4 border-black bg-[#E8D9BE] disabled:bg-gray-300 font-black py-2 px-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11"
                >
                  {t('gameCoup.actionIncome')}
                </button>
                <div
                  data-testid="coup-action-summary-income"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 0 })}</span>
                  <span>{t('gameCoup.claimedRoleLabel', { role: t('gameCoup.none') })}</span>
                </div>
              </div>

              {/* Foreign Aid */}
              <div className="border-2 border-black p-2 bg-[#F9F5EC] flex flex-col justify-between gap-1.5">
                <button
                  disabled={!isMyTurn || forcedCoup}
                  onClick={() => handleDeclare(CoupActionType.FOREIGN_AID)}
                  className="w-full border-4 border-black bg-[#C9D7CF] disabled:bg-gray-300 font-black py-2 px-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11"
                >
                  {t('gameCoup.actionForeignAid')}
                </button>
                <div
                  data-testid="coup-action-summary-foreign_aid"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 0 })}</span>
                  <span>{t('gameCoup.claimedRoleLabel', { role: t('gameCoup.none') })}</span>
                </div>
              </div>

              {/* Tax */}
              <div className="border-2 border-black p-2 bg-[#F9F5EC] flex flex-col justify-between gap-1.5">
                <button
                  disabled={!isMyTurn || forcedCoup}
                  onClick={() => handleDeclare(CoupActionType.TAX)}
                  className="w-full border-4 border-black bg-[#D9B475] disabled:bg-gray-300 font-black py-2 px-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11"
                >
                  {t('gameCoup.actionTax')}
                </button>
                <div
                  data-testid="coup-action-summary-tax"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 0 })}</span>
                  <span>{t('gameCoup.claimedRoleLabel', { role: roleLabel(CoupRole.DUKE) })}</span>
                </div>
              </div>

              {/* Exchange */}
              <div className="border-2 border-black p-2 bg-[#F9F5EC] flex flex-col justify-between gap-1.5">
                <button
                  disabled={!isMyTurn || forcedCoup}
                  onClick={() => handleDeclare(CoupActionType.EXCHANGE)}
                  className="w-full border-4 border-black bg-[#E3C6A6] disabled:bg-gray-300 font-black py-2 px-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11"
                >
                  {t('gameCoup.actionExchange')}
                </button>
                <div
                  data-testid="coup-action-summary-exchange"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 0 })}</span>
                  <span>
                    {t('gameCoup.claimedRoleLabel', { role: roleLabel(CoupRole.AMBASSADOR) })}
                  </span>
                </div>
              </div>
            </div>

            {/* Targeted actions */}
            <div className="flex flex-col gap-2.5">
              {/* Assassinate */}
              <div className="border-2 border-black p-2.5 bg-[#FFF7E8] flex flex-col gap-1.5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <select
                    value={assassinateTarget}
                    onChange={(e) => setAssassinateTarget(e.target.value)}
                    disabled={!isMyTurn}
                    className="min-w-0 flex-1 min-h-11 border-4 border-black px-2 text-xs font-black bg-white disabled:bg-gray-100"
                  >
                    <option value="">{t('gameCoup.target')}</option>
                    {aliveTargets.map((p) => (
                      <option key={p.socketId} value={p.socketId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    data-testid="coup-action-assassinate"
                    disabled={!isMyTurn || !assassinateTargetValid || myCoins < 3 || forcedCoup}
                    onClick={() => {
                      if (!assassinateTargetValid) {
                        toast.error(t('gameCoup.pickTarget'));
                        return;
                      }
                      handleDeclare(CoupActionType.ASSASSINATE, assassinateTarget);
                    }}
                    className="bg-[#9B6073] border-4 border-black text-white disabled:bg-gray-300 font-black px-3 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11 shrink-0"
                  >
                    {t('gameCoup.actionAssassinate')} (3)
                  </button>
                </div>
                <div
                  data-testid="coup-action-summary-assassinate"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 3 })}</span>
                  <span>
                    {t('gameCoup.claimedRoleLabel', { role: roleLabel(CoupRole.ASSASSIN) })}
                  </span>
                  <span>
                    {t('gameCoup.targetLabel', {
                      name: assassinateTarget
                        ? getTargetName(assassinateTarget)
                        : t('gameCoup.none'),
                    })}
                  </span>
                </div>
              </div>

              {/* Steal */}
              <div className="border-2 border-black p-2.5 bg-[#FFF7E8] flex flex-col gap-1.5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <select
                    value={stealTarget}
                    onChange={(e) => setStealTarget(e.target.value)}
                    disabled={!isMyTurn}
                    className="min-w-0 flex-1 min-h-11 border-4 border-black px-2 text-xs font-black bg-white disabled:bg-gray-100"
                  >
                    <option value="">{t('gameCoup.target')}</option>
                    {aliveTargets.map((p) => (
                      <option key={p.socketId} value={p.socketId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!isMyTurn || !stealTargetValid || forcedCoup}
                    onClick={() => {
                      if (!stealTargetValid) {
                        toast.error(t('gameCoup.pickTarget'));
                        return;
                      }
                      handleDeclare(CoupActionType.STEAL, stealTarget);
                    }}
                    className="bg-[#C9A997] border-4 border-black text-black disabled:bg-gray-300 font-black px-3 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11 shrink-0"
                  >
                    {t('gameCoup.actionSteal')}
                  </button>
                </div>
                <div
                  data-testid="coup-action-summary-steal"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 0 })}</span>
                  <span>
                    {t('gameCoup.claimedRoleLabel', { role: roleLabel(CoupRole.CAPTAIN) })}
                  </span>
                  <span>
                    {t('gameCoup.targetLabel', {
                      name: stealTarget ? getTargetName(stealTarget) : t('gameCoup.none'),
                    })}
                  </span>
                </div>
              </div>

              {/* Coup */}
              <div className="border-2 border-black p-2.5 bg-[#FFF7E8] flex flex-col gap-1.5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <select
                    value={coupTarget}
                    onChange={(e) => setCoupTarget(e.target.value)}
                    disabled={!isMyTurn}
                    className="min-w-0 flex-1 min-h-11 border-4 border-black px-2 text-xs font-black bg-white disabled:bg-gray-100"
                  >
                    <option value="">{t('gameCoup.target')}</option>
                    {aliveTargets.map((p) => (
                      <option key={p.socketId} value={p.socketId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!isMyTurn || !coupTargetValid || myCoins < 7}
                    onClick={() => {
                      if (!coupTargetValid) {
                        toast.error(t('gameCoup.pickTarget'));
                        return;
                      }
                      handleDeclare(CoupActionType.COUP, coupTarget);
                    }}
                    className="bg-[#6B213C] border-4 border-black text-white disabled:bg-gray-300 font-black px-3 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none min-h-11 shrink-0"
                  >
                    {t('gameCoup.actionCoup')} (7)
                  </button>
                </div>
                <div
                  data-testid="coup-action-summary-coup"
                  className="text-[10px] font-bold text-[#5B2637] flex flex-wrap gap-x-2 gap-y-0.5"
                >
                  <span>{t('gameCoup.cost', { amount: 7 })}</span>
                  <span>{t('gameCoup.claimedRoleLabel', { role: t('gameCoup.none') })}</span>
                  <span>
                    {t('gameCoup.targetLabel', {
                      name: coupTarget ? getTargetName(coupTarget) : t('gameCoup.none'),
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {forcedCoup && isMyTurn && (
            <div className="text-[10px] font-bold text-red-600 mt-2">
              {t('gameCoup.mustCoupHint')}
            </div>
          )}
        </div>
      )}

      {/* Folded Role Explanations */}
      <details
        data-testid="coup-role-explanations"
        className="border-4 border-[#5B2637] bg-[#F7EBD6] p-3 shadow-[2px_2px_0_0_#5B2637]"
      >
        <summary className="cursor-pointer font-black text-xs uppercase select-none flex items-center justify-between">
          <span>👑 {t('gameCoup.roleReference')}</span>
          <span className="text-[10px] opacity-70">▼</span>
        </summary>
        <div className="grid gap-2 text-xs mt-3">
          <div className="border-2 border-black p-2 bg-[#E0E7FF]">
            <div className="font-black">
              {roleEmoji[CoupRole.DUKE]} {roleLabel(CoupRole.DUKE)}
            </div>
            <div className="opacity-80 text-[11px]">{t('gameCoup.roleDukeDesc')}</div>
          </div>
          <div className="border-2 border-black p-2 bg-[#FECACA]">
            <div className="font-black">
              {roleEmoji[CoupRole.ASSASSIN]} {roleLabel(CoupRole.ASSASSIN)}
            </div>
            <div className="opacity-80 text-[11px]">{t('gameCoup.roleAssassinDesc')}</div>
          </div>
          <div className="border-2 border-black p-2 bg-[#A7F3D0]">
            <div className="font-black">
              {roleEmoji[CoupRole.CAPTAIN]} {roleLabel(CoupRole.CAPTAIN)}
            </div>
            <div className="opacity-80 text-[11px]">{t('gameCoup.roleCaptainDesc')}</div>
          </div>
          <div className="border-2 border-black p-2 bg-[#FDE68A]">
            <div className="font-black">
              {roleEmoji[CoupRole.AMBASSADOR]} {roleLabel(CoupRole.AMBASSADOR)}
            </div>
            <div className="opacity-80 text-[11px]">{t('gameCoup.roleAmbassadorDesc')}</div>
          </div>
          <div className="border-2 border-black p-2 bg-[#DDD6FE]">
            <div className="font-black">
              {roleEmoji[CoupRole.CONTESSA]} {roleLabel(CoupRole.CONTESSA)}
            </div>
            <div className="opacity-80 text-[11px]">{t('gameCoup.roleContessaDesc')}</div>
          </div>
        </div>
      </details>

      {/* Folded Action History */}
      <details
        data-testid="coup-action-history"
        className="border-4 border-[#5B2637] bg-[#F7EBD6] p-3 shadow-[2px_2px_0_0_#5B2637]"
      >
        <summary className="cursor-pointer font-black text-xs uppercase select-none flex items-center justify-between">
          <span>
            📜 {t('gameCoup.history')} {actionHistory.length > 0 ? `(${actionHistory.length})` : ''}
          </span>
          <span className="text-[10px] opacity-70">▼</span>
        </summary>
        <div className="mt-3 space-y-1 text-xs max-h-48 overflow-y-auto">
          {actionHistory.length === 0 ? (
            <div className="text-xs opacity-60 text-center py-2">{t('gameCoup.noHistory')}</div>
          ) : (
            actionHistory.map((entry, idx) => (
              <div
                key={idx}
                className="border-2 border-[#5B2637] bg-white p-1.5 font-bold text-[11px] flex items-center gap-1.5"
              >
                <span className="opacity-50 text-[10px]">#{actionHistory.length - idx}</span>
                <span>{entry}</span>
              </div>
            ))
          )}
        </div>
      </details>

      {state.winnerId && (
        <div
          data-testid="coup-winner-banner"
          className="border-4 border-black bg-[#A7F3D0] p-4 text-center font-black shadow-[4px_4px_0_0_#000]"
        >
          <div className="text-base sm:text-lg">
            {t('gameCoup.winner', {
              name:
                room.players.find((p) => p.socketId === state.winnerId)?.name ?? state.winnerId,
            })}
          </div>
          {room.roomHostId === socketId ? (
            <button
              data-testid="coup-rematch-button"
              onClick={() => resetRoom()}
              className="mt-3 w-full bg-black text-white hover:bg-gray-800 font-black py-2.5 px-4 text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000]"
            >
              🔄 {t('gameCoup.playAgain')}
            </button>
          ) : (
            <div data-testid="coup-waiting-host" className="text-xs font-bold text-gray-700 mt-2">
              ⏳ {t('gameCoup.waitingHostRestart')}
            </div>
          )}
        </div>
      )}

      {!state.winnerId && !isMyTurn && state.phase !== 'PLAYING' && (
        <div className="text-xs font-bold text-center opacity-60">
          {t('gameCoup.waitingFor')}{' '}
          {room.players.find((p) => p.socketId === state.currentTurn)?.name ?? '...'}
        </div>
      )}
    </div>
  );
}
