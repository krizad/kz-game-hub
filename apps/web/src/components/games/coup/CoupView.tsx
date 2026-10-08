'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { SoundToggle } from '@/components/core/SoundToggle';
import { CoupHelpModal } from './CoupHelpModal';
import { CoupRole, CoupActionType, CoupPhase } from '@repo/types';
import { toast } from 'react-hot-toast';
import { useCoupSounds, type CoupSound } from '@/hooks/useCoupSounds';
import { useSoundSettings } from '@/hooks/useSoundSettings';

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

  const state = room?.coupState;

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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black tracking-wide">
          {t('lobby.gameNames.coup')} — {t(phaseKeys[state.phase])}
        </h2>
        <div className="flex gap-2">
          <CoupHelpModal />
          {renderSoundToggle()}
          {room.roomHostId === socketId && (
            <button
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
                    className="w-6 h-8 border-2 border-black bg-black text-white flex items-center justify-center text-[10px]"
                  >
                    ?
                  </div>
                ))}
                {revealed.map((r, i) => (
                  <div
                    key={`r-${i}`}
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
          {state.pendingAction.actorId !== socketId &&
            (state.influences[socketId]?.count ?? 0) > 0 && (
              <button
                onClick={() => coupChallenge()}
                className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase"
              >
                {t('gameCoup.challenge')}
              </button>
            )}
          {state.pendingAction.actorId === socketId && (
            <div className="text-xs text-center mt-1 opacity-70">
              {t('gameCoup.waitingChallenge')}
            </div>
          )}
          <div className="text-[10px] text-center mt-1 opacity-60">{t('gameCoup.autoResolve')}</div>
        </div>
      )}

      {state.phase === 'AWAITING_CHALLENGE' && state.pendingBlock && state.pendingAction && (
        <div className="border-4 border-black p-3 bg-[#FDE68A]">
          <div className="text-xs font-black uppercase text-center">
            {t('gameCoup.blocksAction', {
              name:
                room.players.find((p) => p.socketId === state.pendingBlock!.blockerId)?.name ?? '',
              action: actionLabel(state.pendingAction.type),
              role: roleLabel(state.pendingBlock.claimedRole),
            })}{' '}
            — {t('gameCoup.challengeBlockQuestion')}
          </div>
          {state.pendingBlock.blockerId !== socketId &&
            (state.influences[socketId]?.count ?? 0) > 0 && (
              <button
                onClick={() => coupChallenge()}
                className="mt-2 w-full bg-black text-white font-black py-2 text-xs uppercase"
              >
                {t('gameCoup.challengeBlock')}
              </button>
            )}
          <div className="text-[10px] text-center mt-1 opacity-60">{t('gameCoup.autoResolve')}</div>
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
            if (canBlockSteal) {
              return (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => coupBlock(CoupRole.CAPTAIN)}
                    className="bg-white border-4 border-black font-black py-2 text-xs uppercase"
                  >
                    {roleLabel(CoupRole.CAPTAIN)}
                  </button>
                  <button
                    onClick={() => coupBlock(CoupRole.AMBASSADOR)}
                    className="bg-white border-4 border-black font-black py-2 text-xs uppercase"
                  >
                    {roleLabel(CoupRole.AMBASSADOR)}
                  </button>
                </div>
              );
            }
            if (canBlockForeignAid || canBlockAssassinate) {
              return (
                <button
                  onClick={() => coupBlock()}
                  className="mt-2 w-full bg-white border-4 border-black font-black py-2 text-xs uppercase"
                >
                  {t('gameCoup.block')}
                </button>
              );
            }
            return (
              <div className="text-xs text-center mt-1 opacity-60">
                {t('gameCoup.waitingBlock')}
              </div>
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
              <div className="grid grid-cols-4 gap-1 mt-2">
                {hand.map((r, i) => {
                  const selected = exchangeKeep.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        setExchangeKeep((prev) =>
                          prev.includes(i)
                            ? prev.filter((x) => x !== i)
                            : prev.length < exchangeKeepCount
                              ? [...prev, i]
                              : prev,
                        )
                      }
                      className={`border-4 p-2 text-xs font-black ${selected ? 'bg-[#A3E635] border-black' : 'bg-white border-black'}`}
                    >
                      {roleEmoji[r]} {roleLabel(r)}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={exchangeKeep.length !== exchangeKeepCount}
                onClick={() => {
                  coupExchangeSelect(exchangeKeep);
                  setExchangeKeep([]);
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
        <div className="border-4 border-black p-3 bg-white">
          <div className="text-xs font-black uppercase mb-2">
            {isMyTurn
              ? t('gameCoup.yourTurn')
              : `${t('gameCoup.waitingFor')} ${room.players.find((p) => p.socketId === state.currentTurn)?.name ?? '...'}`}{' '}
            {forcedCoup && isMyTurn && (
              <span className="bg-red-500 text-white px-1">{t('gameCoup.mustCoup')}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!isMyTurn || forcedCoup}
              onClick={() => coupDeclare(CoupActionType.INCOME)}
              className="border-4 border-black bg-[#E8D9BE] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
            >
              {t('gameCoup.actionIncome')}
            </button>
            <button
              disabled={!isMyTurn || forcedCoup}
              onClick={() => coupDeclare(CoupActionType.FOREIGN_AID)}
              className="border-4 border-black bg-[#C9D7CF] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
            >
              {t('gameCoup.actionForeignAid')}
            </button>
            <button
              disabled={!isMyTurn || forcedCoup}
              onClick={() => coupDeclare(CoupActionType.TAX)}
              className="border-4 border-black bg-[#D9B475] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
            >
              {t('gameCoup.actionTax')}
            </button>
            <div className="flex gap-1">
              <select
                value={assassinateTarget}
                onChange={(e) => setAssassinateTarget(e.target.value)}
                disabled={!isMyTurn}
                className="flex-1 border-4 border-black px-1 text-xs font-black bg-white disabled:bg-gray-100"
              >
                <option value="">{t('gameCoup.target')}</option>
                {aliveTargets.map((p) => (
                  <option key={p.socketId} value={p.socketId}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!isMyTurn || !assassinateTargetValid || myCoins < 3 || forcedCoup}
                onClick={() => {
                  if (!assassinateTargetValid) {
                    toast.error(t('gameCoup.pickTarget'));
                    return;
                  }
                  coupDeclare(CoupActionType.ASSASSINATE, assassinateTarget);
                }}
                className="bg-[#9B6073] border-4 border-black text-white disabled:bg-gray-300 font-black px-2 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
              >
                {t('gameCoup.actionAssassinate')} (3)
              </button>
            </div>
            <div className="flex gap-1">
              <select
                value={stealTarget}
                onChange={(e) => setStealTarget(e.target.value)}
                disabled={!isMyTurn}
                className="flex-1 border-4 border-black px-1 text-xs font-black bg-white disabled:bg-gray-100"
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
                  coupDeclare(CoupActionType.STEAL, stealTarget);
                }}
                className="bg-[#C9A997] border-4 border-black text-black disabled:bg-gray-300 font-black px-2 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
              >
                {t('gameCoup.actionSteal')}
              </button>
            </div>
            <button
              disabled={!isMyTurn || forcedCoup}
              onClick={() => coupDeclare(CoupActionType.EXCHANGE)}
              className="col-span-2 border-4 border-black bg-[#E3C6A6] disabled:bg-gray-300 font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
            >
              {t('gameCoup.actionExchange')}
            </button>
            <div className="flex gap-1 col-span-2">
              <select
                value={coupTarget}
                onChange={(e) => setCoupTarget(e.target.value)}
                disabled={!isMyTurn}
                className="flex-1 border-4 border-black px-1 text-xs font-black bg-white disabled:bg-gray-100"
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
                  coupDeclare(CoupActionType.COUP, coupTarget);
                }}
                className="bg-[#6B213C] border-4 border-black text-white disabled:bg-gray-300 font-black px-3 py-2 text-xs uppercase shadow-[2px_2px_0_0_#000] disabled:shadow-none"
              >
                {t('gameCoup.actionCoup')} (7)
              </button>
            </div>
          </div>
          {forcedCoup && isMyTurn && (
            <div className="text-[10px] font-bold text-red-600 mt-1">
              {t('gameCoup.mustCoupHint')}
            </div>
          )}
        </div>
      )}

      {state.winnerId && (
        <div className="border-4 border-black bg-[#A7F3D0] p-3 text-center font-black">
          {t('gameCoup.winner', {
            name: room.players.find((p) => p.socketId === state.winnerId)?.name ?? state.winnerId,
          })}
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
