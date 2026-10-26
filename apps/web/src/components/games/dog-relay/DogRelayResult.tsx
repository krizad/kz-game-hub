'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { useGameFeel } from '@/hooks/useGameFeel';
import { audioManager } from '@/lib/audioManager';
import { DogRelayCard } from './DogRelayCard';

export function DogRelayResult() {
  const { room, playerId, socketId, sendDogRelayAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const { shake, flash, celebrate } = useGameFeel();
  const celebratedRoundRef = useRef<string | null>(null);
  const [best, setBest] = useState('');
  const [worst, setWorst] = useState('');
  const state = room?.dogRelayState;

  useEffect(() => {
    if (!state?.result || !state.roundId) return;
    if (celebratedRoundRef.current === state.roundId) return;
    celebratedRoundRef.current = state.roundId;

    const myRole = state.result.roles[playerId];
    const didMySideWin =
      (state.result.winningTeam === 'GOOD' && (myRole === 'GOOD' || myRole === 'LEADER')) ||
      (state.result.winningTeam === 'EVIL' && myRole === 'EVIL');

    if (didMySideWin) {
      audioManager.playSuccessChime();
      celebrate({ particleCount: 70, spread: 70 });
      flash('gold', 400);
    } else {
      audioManager.playErrorBuzz();
      shake(0.5);
      flash('red', 350);
    }
  }, [state?.result, state?.roundId, playerId, shake, flash, celebrate]);
  if (!room || !state?.result) return null;
  const result = state.result;
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? id;
  const isHost = socketId === room.roomHostId;
  const leaderPresent = room.players.some((p) => p.id === state.leaderId && p.connected !== false);
  const buttonClass =
    'border-2 border-black bg-white p-3 font-black shadow-[3px_3px_0_0_#000] disabled:opacity-40';
  return (
    <section
      data-testid="dog-relay-result"
      data-winning-team={result.winningTeam}
      data-reason={result.reason}
      className="space-y-5"
    >
      <h2 className="text-2xl font-black">{t(`dogRelay.win${result.winningTeam}`)}</h2>
      <p>{t(`dogRelay.${result.reason}`)}</p>
      <h3 className="font-black">{t('dogRelay.truePair')}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p>{t('dogRelay.suspect')}</p>
          <DogRelayCard cardId={result.truePair.suspectId} />
        </div>
        <div>
          <p>{t('dogRelay.victim')}</p>
          <DogRelayCard cardId={result.truePair.victimId} />
        </div>
      </div>
      {state.guess && (
        <>
          <h3 className="font-black">{t('dogRelay.attempt')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <DogRelayCard cardId={state.guess.suspectId} />
            <DogRelayCard cardId={state.guess.victimId} />
          </div>
        </>
      )}
      <h3 className="font-black">{t('dogRelay.rolesVotes')}</h3>
      <ul className="space-y-2">
        {state.seatOrder.map((id) => (
          <li key={id} className="border-b border-black py-2 break-words">
            <strong>{name(id)}</strong> — {t(`dogRelay.role${result.roles[id]}`)}
            {result.ballots[id] && (
              <span> · {t('dogRelay.votedFor', { name: name(result.ballots[id]) })}</span>
            )}
          </li>
        ))}
      </ul>
      {playerId === state.leaderId && (
        <fieldset className="space-y-3">
          <legend className="font-black">{t('dogRelay.awards')}</legend>
          {(
            [
              ['best', best, setBest],
              ['worst', worst, setWorst],
            ] as const
          ).map(([key, value, update]) => (
            <label key={key} className="block">
              {t(`dogRelay.${key}`)}
              <select
                className="block w-full border-2 border-black p-3 bg-white"
                value={value}
                onChange={(event) => update(event.target.value)}
              >
                <option value="">{t('dogRelay.choose')}</option>
                {state.seatOrder.map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className={buttonClass}
            disabled={actionLoading || !best || !worst || best === worst}
            onClick={() =>
              sendDogRelayAction({ type: 'SET_AWARDS', bestActorId: best, worstActorId: worst })
            }
          >
            {t('dogRelay.saveAwards')}
          </button>
          <p className="text-sm">{t('dogRelay.awardsOptional')}</p>
        </fieldset>
      )}
      {state.awards && (
        <p>
          {t('dogRelay.best')}: {state.awards.bestActorId ? name(state.awards.bestActorId) : '—'} ·{' '}
          {t('dogRelay.worst')}: {state.awards.worstActorId ? name(state.awards.worstActorId) : '—'}
        </p>
      )}
      {isHost && (
        <div className="flex flex-wrap gap-3">
          <button
            className={buttonClass}
            disabled={actionLoading}
            data-testid="dog-relay-next-round"
            onClick={() => sendDogRelayAction({ type: 'NEXT_ROUND' })}
          >
            {t('dogRelay.next')}
          </button>
          <button
            className={buttonClass}
            disabled={actionLoading}
            onClick={() => sendDogRelayAction({ type: 'RETURN_TO_LOBBY' })}
          >
            {t('dogRelay.lobby')}
          </button>
          {!leaderPresent && <p className="text-sm">{t('dogRelay.skipAwards')}</p>}
        </div>
      )}
    </section>
  );
}
