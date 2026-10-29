'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Eye, FastForward, Trophy } from 'lucide-react';
import { GameType, getResultRevealProgress, RoomState, ResultRevealState } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { gameFeel } from '@/lib/gameFeel';
import {
  getRevealCard,
  getRevealEvidence,
  getRevealOutcome,
  revealPlayerName,
} from './result-reveal-content';
import { DogRelayCard } from '@/components/games/dog-relay/DogRelayCard';

function FinalEvidence({ room, elapsed }: { room: RoomState; elapsed: number }) {
  const { t } = useTranslate();
  if (room.gameType === GameType.DOG_RELAY && room.dogRelayState?.result) {
    const state = room.dogRelayState;
    return (
      <div className="space-y-3">
        <h3 className="font-black">{t('dogRelay.truePair')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-bold">{t('dogRelay.suspect')}</p>
            <DogRelayCard cardId={state.result!.truePair.suspectId} />
          </div>
          <div>
            <p className="font-bold">{t('dogRelay.victim')}</p>
            <DogRelayCard cardId={state.result!.truePair.victimId} />
          </div>
        </div>
      </div>
    );
  }
  if (room.gameType === GameType.THE_MIND && room.config.theMindBlindMode) {
    const state = room.theMindState!;
    const count = Math.max(0, Math.floor((elapsed - 2000) / 800));
    return (
      <ol data-testid="result-reveal-mind-replay" className="flex flex-wrap justify-center gap-2">
        {state.playedCards.slice(0, count).map((entry, index) => (
          <li
            key={index}
            className={`border-2 border-black p-3 font-black ${state.result?.invalidPlayIndexes?.includes(index) ? 'bg-rose-200' : 'bg-white'}`}
          >
            <span className="block text-xs">{revealPlayerName(room, entry.playerId)}</span>
            <span className="text-2xl">{entry.card === null ? '?' : Math.abs(entry.card)}</span>
            {entry.pile && <span aria-hidden="true"> {entry.pile === 'UP' ? '↑' : '↓'}</span>}
          </li>
        ))}
      </ol>
    );
  }
  return null;
}

function RevealSequence({ room, reveal }: { room: RoomState; reveal: ResultRevealState }) {
  const { socketId, playerId, serverOffset, secretWord, resultRevealAction, connected } =
    useGameStore();
  const { t } = useTranslate();
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);
  const progress = getResultRevealProgress(reveal, Math.max(now, Date.now()) + serverOffset);
  const outcome = getRevealOutcome(room, t);
  const currentId = reveal.playerIds[progress.activeIndex];
  const current = room.players.find((p) => p.id === currentId);
  const isMyTurn = !!current && (current.id === playerId || current.socketId === socketId);
  const me = room.players.find((p) => p.socketId === socketId && !p.isViewer);
  const isParticipant =
    !!me &&
    (reveal.playerIds.includes(me.id) ||
      (room.gameType === GameType.CIPHER_GRID && !!room.cipherGridState?.teams[me.socketId]));
  const didWin =
    !!me && (outcome.winnerIds.includes(me.socketId) || outcome.winnerIds.includes(me.id));

  const prevShowWinnerRef = useRef(false);
  useEffect(() => {
    if (!prevShowWinnerRef.current && progress.showWinner) {
      if (didWin || outcome.cooperative) {
        void gameFeel.celebrate();
        gameFeel.flash('gold');
        gameFeel.haptic([100, 50, 150]);
      } else {
        gameFeel.shake(0.35);
        gameFeel.flash('white');
        gameFeel.haptic([80]);
      }
    }
    prevShowWinnerRef.current = progress.showWinner;
  }, [progress.showWinner, didWin, outcome.cooperative]);
  const currentOpened = progress.revealedCount > progress.activeIndex;
  const phaseKey = progress.showWinner
    ? 'winner'
    : progress.activeIndex < 0
      ? 'intro'
      : `${currentId}:${currentOpened}`;
  const content = current ? getRevealCard(room, current, t) : null;
  const stepEnd = reveal.introMs + (progress.activeIndex + 0.5) * reveal.stepMs;
  const seconds = Math.max(1, Math.ceil((stepEnd - progress.elapsed) / 1000));
  const duration = reveal.introMs + reveal.playerIds.length * reveal.stepMs;
  const buttonClass =
    'border-4 border-black px-5 py-3 font-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none disabled:opacity-50';

  return (
    <section
      data-testid="result-reveal"
      data-reveal-id={reveal.id}
      className="w-full max-w-3xl mx-auto border-4 border-black bg-amber-50 p-4 sm:p-7 shadow-[6px_6px_0_0_#000] space-y-5 text-black"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-black text-sm uppercase tracking-widest">{t('resultReveal.title')}</p>
        {reveal.playerIds.length > 0 && (
          <span className="text-xs font-bold">
            {t('resultReveal.progress', {
              current: progress.revealedCount,
              total: reveal.playerIds.length,
            })}
          </span>
        )}
      </div>

      {progress.activeIndex >= 0 && !progress.showWinner && (
        <p className="text-center font-bold break-words">
          {getRevealEvidence(room, t, secretWord)}
        </p>
      )}
      <div
        role="progressbar"
        aria-label={t('resultReveal.title')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round((progress.elapsed / duration) * 100))}
        className="h-3 bg-white border-2 border-black overflow-hidden"
      >
        <div
          className="h-full bg-amber-400"
          style={{ width: `${Math.min(100, (progress.elapsed / duration) * 100)}%` }}
        />
      </div>

      <div
        className="min-h-[300px] flex flex-col justify-center"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phaseKey}
            initial={reducedMotion ? false : { opacity: 0, y: 16, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
            className="space-y-5 text-center"
          >
            {progress.showWinner ? (
              <>
                <Trophy aria-hidden="true" className="w-14 h-14 mx-auto stroke-[2.5]" />
                <p className="font-bold text-sm">{t('resultReveal.winnerTitle')}</p>
                <h2
                  data-testid="result-reveal-winner"
                  className="bg-yellow-300 border-4 border-black p-4 font-black text-2xl sm:text-4xl break-words shadow-[4px_4px_0_0_#000]"
                >
                  {outcome.title}
                </h2>
                <p className="font-bold text-base leading-relaxed">{outcome.reason}</p>
                {isParticipant && !outcome.cooperative && (
                  <p
                    className={`inline-block border-2 border-black px-4 py-2 font-black ${didWin ? 'bg-emerald-200' : 'bg-white'}`}
                  >
                    {t(didWin ? 'resultReveal.won' : 'resultReveal.lost')}
                  </p>
                )}
              </>
            ) : progress.activeIndex < 0 || !current ? (
              <>
                <Eye aria-hidden="true" className="w-12 h-12 mx-auto" />
                <h2 className="font-black text-2xl sm:text-3xl">
                  {t(`resultReveal.${reveal.kind}`)}
                </h2>
                <p className="font-bold text-lg break-words">
                  {getRevealEvidence(room, t, secretWord)}
                </p>
                <FinalEvidence room={room} elapsed={progress.elapsed} />
                {reveal.playerIds.length > 0 &&
                  (() => {
                    const first = room.players.find((p) => p.id === reveal.playerIds[0]);
                    if (!first) return null;
                    return (
                      <div className="border-4 border-black bg-yellow-200 p-5 text-center shadow-[5px_5px_0_0_#000]">
                        <div className="text-6xl font-black" aria-hidden="true">
                          ?
                        </div>
                        <p className="mt-3 font-bold">
                          {t(
                            reveal.kind === 'ROLES' ? 'resultReveal.waiting' : 'resultReveal.next',
                            { name: first.name },
                          )}
                        </p>
                      </div>
                    );
                  })()}
              </>
            ) : (
              <>
                <p className="text-xl font-black break-words">
                  {current.avatar} {current.name}
                </p>
                <div
                  className={`border-4 border-black p-5 shadow-[5px_5px_0_0_#000] ${currentOpened ? 'bg-white' : 'bg-yellow-200'}`}
                >
                  {currentOpened && content ? (
                    <>
                      <h2
                        data-testid="result-reveal-current-role"
                        className="text-3xl sm:text-4xl font-black break-words"
                      >
                        {content.label}
                      </h2>
                      {content.cards && (
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                          {content.cards.map((card) => (
                            <span
                              key={card.id}
                              className={`border-2 border-black px-3 py-4 text-2xl font-black ${card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-700' : ''}`}
                            >
                              {card.rank}
                              {{ HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' }[card.suit]}
                            </span>
                          ))}
                        </div>
                      )}
                      {content.details.map((detail, index) => (
                        <p key={index} className="mt-3 font-bold">
                          {detail}
                        </p>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="text-6xl font-black" aria-hidden="true">
                        ?
                      </div>
                      <p className="mt-3 font-bold">
                        {t(reveal.kind === 'ROLES' ? 'resultReveal.waiting' : 'resultReveal.next', {
                          name: current.name,
                        })}
                      </p>
                    </>
                  )}
                </div>
                {!currentOpened && (
                  <p className="font-bold text-sm" aria-live="off">
                    {t('resultReveal.autoReveal', { seconds })}
                  </p>
                )}
                {isMyTurn && !currentOpened && reveal.kind === 'ROLES' && (
                  <button
                    data-testid="result-reveal-mine"
                    onClick={() => resultRevealAction('REVEAL')}
                    disabled={!connected}
                    className={`${buttonClass} bg-emerald-300`}
                  >
                    {t('resultReveal.revealMine')}
                  </button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {progress.revealedCount > 0 && (
        <ol className="grid sm:grid-cols-2 gap-3" data-testid="result-reveal-opened">
          {reveal.playerIds.slice(0, progress.revealedCount).map((id) => {
            const player = room.players.find((p) => p.id === id);
            if (!player) return null;
            const card = getRevealCard(room, player, t);
            return (
              <motion.li
                key={id}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                data-testid={`result-reveal-player-${id}`}
                className="border-2 border-black bg-white p-3 space-y-2 break-words shadow-[2px_2px_0_0_#000]"
              >
                <p className="font-bold text-sm">
                  {player.avatar} {revealPlayerName(room, id)}
                </p>
                <p className="font-black text-xl">{card.label}</p>
                {card.cards && (
                  <div className="flex flex-wrap gap-1">
                    {card.cards.map((playingCard) => (
                      <span
                        key={playingCard.id}
                        className={`border-2 border-black px-2 py-3 text-lg font-black ${playingCard.suit === 'HEARTS' || playingCard.suit === 'DIAMONDS' ? 'text-red-700' : ''}`}
                      >
                        {playingCard.rank}
                        {{ HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' }[playingCard.suit]}
                      </span>
                    ))}
                  </div>
                )}
                {card.details.map((detail, index) => (
                  <p key={index} className="text-sm font-bold">
                    {detail}
                  </p>
                ))}
              </motion.li>
            );
          })}
        </ol>
      )}

      {room.roomHostId === socketId && (
        <button
          data-testid="result-reveal-skip"
          onClick={() => resultRevealAction('SKIP')}
          disabled={!connected}
          className="flex items-center justify-center gap-2 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold disabled:opacity-50"
        >
          <FastForward size={16} aria-hidden="true" />
          {t('resultReveal.skip')}
        </button>
      )}
    </section>
  );
}

export function ResultRevealBoundary({ children }: { children: ReactNode }) {
  const room = useGameStore((state) => state.room);
  const offset = useGameStore((state) => state.serverOffset);
  const reveal = room?.resultReveal;

  const [isComplete, setIsComplete] = useState(() => {
    if (!reveal) return true;
    return getResultRevealProgress(reveal, Date.now() + offset).complete;
  });

  useEffect(() => {
    if (!reveal) {
      setIsComplete(true);
      return;
    }
    const currentProgress = getResultRevealProgress(reveal, Date.now() + offset);
    if (currentProgress.complete) {
      setIsComplete(true);
      return;
    }
    setIsComplete(false);
    const totalMs =
      reveal.introMs +
      reveal.playerIds.length * reveal.stepMs +
      reveal.winnerMs -
      reveal.advancedMs;
    const remainingMs = Math.max(0, reveal.startedAt + totalMs - (Date.now() + offset));
    const timer = setTimeout(() => {
      setIsComplete(true);
    }, remainingMs + 50);
    return () => clearTimeout(timer);
  }, [reveal?.id, reveal?.skipped, reveal?.advancedMs, offset]);

  // Retain Music Trivia's user-unlocked audio across round-result presentations.
  if (room?.gameType === GameType.MUSIC_TRIVIA) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {!isComplete && reveal && <RevealSequence key={reveal.id} room={room} reveal={reveal} />}
        <div hidden={!isComplete} className="flex-1 min-h-0">
          {children}
        </div>
      </div>
    );
  }
  if (!room || !reveal || isComplete) return children;
  return <RevealSequence key={reveal.id} room={room} reveal={reveal} />;
}
