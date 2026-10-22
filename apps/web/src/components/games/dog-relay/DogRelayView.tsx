'use client';

import { useEffect, useState } from 'react';
import { DOG_RELAY_CARDS, type DogRelayPrivateState } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { CountdownBadge } from '@/components/core/CountdownBadge';
import { DogRelayCard } from './DogRelayCard';
import { DogRelayResult } from './DogRelayResult';
import { DogRelayCardCatalog } from './DogRelayCardCatalog';
import { audioManager } from '@/lib/audioManager';

export function getDogRelayPrivateState(
  value: unknown,
  roundId: string | null,
): DogRelayPrivateState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<DogRelayPrivateState>;
  return state.roundId === roundId && ['LEADER', 'EVIL', 'GOOD'].includes(state.role ?? '')
    ? (state as DogRelayPrivateState)
    : null;
}

export function DogRelayView() {
  const {
    room,
    privateState,
    playerId,
    socketId,
    sendDogRelayAction,
    actionLoading,
    connected,
    serverOffset,
  } = useGameStore();
  const { t, language } = useTranslate();
  const [revealed, setRevealed] = useState(false);
  const [suspect, setSuspect] = useState('');
  const [victim, setVictim] = useState('');
  const [target, setTarget] = useState('');
  const state = room?.dogRelayState;
  useEffect(() => {
    setRevealed(false);
    setSuspect('');
    setVictim('');
    setTarget('');
  }, [state?.roundId, state?.phase]);
  useEffect(() => {
    const hide = () => setRevealed(false);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  if (!room || !state) return null;
  const own = getDogRelayPrivateState(privateState.dogRelay, state.roundId);
  const active = state.seatOrder.includes(playerId);
  const isHost = socketId === room.roomHostId;
  const name = (id: string | null | undefined) =>
    room.players.find((p) => p.id === id)?.name ?? '—';
  const disabled = actionLoading || !!state.pause || !connected;
  const buttonClass =
    'w-full min-h-12 border-2 border-black bg-amber-300 p-3 font-black shadow-[3px_3px_0_0_#000] disabled:opacity-40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-indigo-600';
  const actor = state.relayOrder[state.relayIndex];
  const viewer = state.relayOrder[state.relayIndex + 1];
  const finalPlayer = state.relayOrder[state.relayOrder.length - 1];
  return (
    <div
      data-round-id={state.roundId ?? undefined}
      className="relative border-4 border-black bg-amber-50 p-3 sm:p-6 shadow-[4px_4px_0_0_#000] space-y-5 text-black"
    >
      <h2 className="text-xl font-black">
        {t('lobby.gameNames.dogRelay')} · {t('dogRelay.round', { number: state.roundNumber })}
      </h2>
      {!active && <p className="border-2 border-black bg-white p-3">{t('dogRelay.spectator')}</p>}
      <DogRelayCardCatalog />
      {!connected && <p role="status">{t('connection.reconnecting')}</p>}
      <fieldset disabled={disabled} className="min-w-0 space-y-5">
        {state.phase === 'ROLE_REVEAL' && (
          <section className="space-y-4">
            <p>{t('dogRelay.secretHint')}</p>
            {active && own && !state.readyIds.includes(playerId) && (
              <>
                {!revealed ? (
                  <button
                    data-testid="dog-relay-role-reveal"
                    className={buttonClass}
                    onClick={() => setRevealed(true)}
                  >
                    {t('dogRelay.reveal')}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <h3
                      data-testid="dog-relay-own-role"
                      data-role={own.role}
                      className="text-2xl font-black"
                    >
                      {t(`dogRelay.role${own.role}`)}
                    </h3>
                    <p>{t(`dogRelay.roleHint${own.role}`)}</p>
                    <button
                      data-testid="dog-relay-role-ack"
                      className={buttonClass}
                      onClick={() => {
                        setRevealed(false);
                        sendDogRelayAction({ type: 'ACK_ROLE' });
                      }}
                    >
                      {t('dogRelay.ack')}
                    </button>
                    <button className={buttonClass} onClick={() => setRevealed(false)}>
                      {t('dogRelay.hide')}
                    </button>
                  </div>
                )}
              </>
            )}
            <p role="status">
              {t('dogRelay.readyCount', {
                current: state.readyIds.length,
                total: state.seatOrder.length,
              })}
            </p>
          </section>
        )}
        {state.phase === 'LEADER_PREP' && (
          <section className="space-y-4">
            {active && own?.role === 'LEADER' && own.truePair ? (
              <>
                <p>{t('dogRelay.prep')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <h3>{t('dogRelay.suspect')}</h3>
                    <DogRelayCard cardId={own.truePair.suspectId} />
                  </div>
                  <div>
                    <h3>{t('dogRelay.victim')}</h3>
                    <DogRelayCard cardId={own.truePair.victimId} />
                  </div>
                </div>
                <button
                  data-testid="dog-relay-begin"
                  className={buttonClass}
                  onClick={() => sendDogRelayAction({ type: 'BEGIN_RELAY' })}
                >
                  {t('dogRelay.begin')}
                </button>
              </>
            ) : (
              <p>{t('dogRelay.waitLeader', { name: name(state.leaderId) })}</p>
            )}
          </section>
        )}
        {state.phase === 'RELAY' && (
          <section className="space-y-4">
            <h3 className="text-xl font-black">
              {name(actor)} → {name(viewer)}
            </h3>
            <p>
              {t('dogRelay.handoffCount', {
                current: state.relayIndex + 1,
                total: state.relayOrder.length - 1,
              })}
            </p>
            <p>
              {playerId === actor
                ? t('dogRelay.act')
                : playerId === viewer
                  ? t('dogRelay.watch')
                  : active && state.relayOrder.indexOf(playerId) > state.relayIndex + 1
                    ? t('dogRelay.closeEyes')
                    : t('dogRelay.wait')}
            </p>
            {active && playerId === viewer && (
              <button
                data-testid="dog-relay-handoff"
                className={buttonClass}
                onClick={() =>
                  sendDogRelayAction({ type: 'CONFIRM_HANDOFF', relayIndex: state.relayIndex })
                }
              >
                {t('dogRelay.handoff')}
              </button>
            )}
          </section>
        )}
        {state.phase === 'RESTORE' && (
          <section className="space-y-4">
            <p>
              {active && playerId === finalPlayer
                ? t('dogRelay.tellStory')
                : t('dogRelay.waitGuess', { name: name(finalPlayer) })}
            </p>
            {active && playerId === finalPlayer && (
              <>
                <p>
                  {!suspect
                    ? t('dogRelay.selectSuspect')
                    : !victim
                      ? t('dogRelay.selectVictim')
                      : t('dogRelay.confirmPair')}
                </p>
              </>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {state.candidateIds.map((id) => (
                <DogRelayCard
                  key={id}
                  cardId={id}
                  selected={suspect === id || victim === id}
                  disabled={disabled}
                  onSelect={
                    active && playerId === finalPlayer
                      ? () => {
                          audioManager.playCardSnap();
                          if (!suspect) setSuspect(id);
                          else if (suspect === id) {
                            setSuspect('');
                            setVictim('');
                          } else setVictim(id);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
            {suspect && victim && (
              <div className="space-y-3">
                <p>
                  {t('dogRelay.suspect')}:{' '}
                  <span data-testid="dog-relay-selected-suspect">
                    {DOG_RELAY_CARDS.find((card) => card.id === suspect)?.name[language]}
                  </span>{' '}
                  · {t('dogRelay.victim')}:{' '}
                  <span data-testid="dog-relay-selected-victim">
                    {DOG_RELAY_CARDS.find((card) => card.id === victim)?.name[language]}
                  </span>
                </p>
                <button
                  data-testid="dog-relay-confirm-guess"
                  className={buttonClass}
                  disabled={disabled || suspect === victim}
                  onClick={() =>
                    sendDogRelayAction({
                      type: 'SUBMIT_GUESS',
                      pair: { suspectId: suspect, victimId: victim },
                    })
                  }
                >
                  {t('dogRelay.confirmPair')}
                </button>
                <button
                  className={buttonClass}
                  onClick={() => {
                    setSuspect('');
                    setVictim('');
                  }}
                >
                  {t('dogRelay.chooseAgain')}
                </button>
              </div>
            )}
          </section>
        )}
        {(state.phase === 'DISCUSS' || state.phase === 'VOTE_COUNTDOWN') && (
          <section className="space-y-4">
            <h3 className="text-xl font-black">
              {t(state.phase === 'DISCUSS' ? 'dogRelay.discuss' : 'dogRelay.countdown')}
            </h3>
            <p>{t('dogRelay.discussHint')}</p>
            {(state.phaseEndsAt !== null || state.pause?.remainingPhaseMs != null) && (
              <p role="timer" className="text-4xl font-black">
                {state.pause?.remainingPhaseMs != null ? (
                  `${Math.ceil(state.pause.remainingPhaseMs / 1000)}s`
                ) : (
                  <CountdownBadge
                    deadline={state.phaseEndsAt}
                    serverOffset={serverOffset}
                    suffix="s"
                  />
                )}
              </p>
            )}
            {isHost && state.phase === 'DISCUSS' && (
              <button
                data-testid="dog-relay-end-discussion"
                className={buttonClass}
                onClick={() => sendDogRelayAction({ type: 'END_DISCUSSION' })}
              >
                {t('dogRelay.endDiscussion')}
              </button>
            )}
          </section>
        )}
        {state.phase === 'VOTE' && (
          <section className="space-y-4">
            <h3 className="text-xl font-black">{t('dogRelay.vote')}</h3>
            <p>{t('dogRelay.voteHint')}</p>
            <p role="status">
              {t('dogRelay.voteCount', {
                current: state.voteSubmittedIds.length,
                total: state.seatOrder.length,
              })}
            </p>
            {active &&
              (state.voteSubmittedIds.includes(playerId) ? (
                <p>
                  {own?.ownVoteTargetId
                    ? t('dogRelay.votedFor', { name: name(own.ownVoteTargetId) })
                    : t('dogRelay.voteSaved')}
                </p>
              ) : (
                <>
                  <div className="grid gap-3">
                    {state.seatOrder
                      .filter((id) => id !== playerId && id !== state.leaderId)
                      .map((id) => (
                        <button
                          key={id}
                          data-testid={`dog-relay-vote-${id}`}
                          aria-pressed={target === id}
                          className={`${buttonClass} ${target === id ? 'ring-4 ring-indigo-500' : ''}`}
                          onClick={() => {
                            setTarget(id);
                            audioManager.playCardSnap();
                          }}
                        >
                          {name(id)}
                        </button>
                      ))}
                  </div>
                  {target && <p>{t('dogRelay.confirmVoteHint', { name: name(target) })}</p>}
                  <button
                    data-testid="dog-relay-confirm-vote"
                    disabled={disabled || !target}
                    className={buttonClass}
                    onClick={() =>
                      sendDogRelayAction({ type: 'SUBMIT_VOTE', targetPlayerId: target })
                    }
                  >
                    {t('dogRelay.confirmVote')}
                  </button>
                </>
              ))}
          </section>
        )}
        {state.phase === 'RESULT' && <DogRelayResult />}
      </fieldset>
      {state.pause && (
        <section role="alert" className="border-4 border-black bg-orange-200 p-4 space-y-2">
          <h3 className="font-black text-xl">{t('dogRelay.paused')}</h3>
          <p>{t('dogRelay.pauseHint')}</p>
          <ul>
            {state.pause.disconnectedIds.map((id) => (
              <li key={id}>
                {name(id)} ·{' '}
                <CountdownBadge
                  deadline={state.pause!.graceEndsAtById[id]}
                  serverOffset={serverOffset}
                  suffix="s"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
