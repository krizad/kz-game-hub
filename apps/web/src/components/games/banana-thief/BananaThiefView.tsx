'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { SoundToggle } from '@/components/core/SoundToggle';
import { RoleArtwork } from './RoleArtwork';
import {
  BANANA_THIEF_CLOCK_HOURS,
  BANANA_THIEF_REACTIONS,
  BananaThiefPhase,
  BananaThiefRole,
  BananaThiefSpecial,
} from '@repo/types';

/** Ticking seconds remaining until a server deadline (null when none). */
function useCountdown(deadline?: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Stealth sync: a very quiet clock tick from every device masks the sound of
 * neighbours tapping their screens. WebAudio-generated, no assets needed.
 */
function useBananaThiefAmbient(enabled: boolean, active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!enabled || !active) return;
    const tick = () => {
      try {
        if (!ctxRef.current) {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          ctxRef.current = new Ctor();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch {
        // Audio unavailable (autoplay policy etc.) — silence is fine.
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [enabled, active]);
}

const fmtTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Narrator: speaks the public night-hour announcements out loud so the table
 * can truly close their eyes. Uses the browser's speech synthesis (th-TH when
 * available); the first "I'm ready" tap unlocks it under autoplay policies.
 */
function useBananaThiefNarrator(
  enabled: boolean,
  phase: BananaThiefPhase | undefined,
  clock: number,
  phrase: (kind: 'night' | 'hour' | 'morning' | 'vote', n?: number) => string,
) {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!phase) return;
    const key = `${phase}:${clock}`;
    if (prev.current === key) return;
    const wasPrev = prev.current;
    prev.current = key;
    if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (wasPrev === null) return; // skip the initial mount/reconnect

    const speak = (text: string) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch {
        // Narration is a nicety — never break the game on it.
      }
    };

    if (phase === BananaThiefPhase.NIGHT && clock === 0) speak(phrase('night'));
    else if (phase === BananaThiefPhase.NIGHT) speak(phrase('hour', clock));
    else if (phase === BananaThiefPhase.DISCUSSION) speak(phrase('morning'));
    else if (phase === BananaThiefPhase.VOTING) speak(phrase('vote'));
  }, [phase, clock, enabled, phrase]);
}

export function BananaThiefView() {
  const {
    room,
    socketId,
    privateState,
    bananaThiefPeek,
    bananaThiefReady,
    bananaThiefChooseFollower,
    bananaThiefNextHour,
    bananaThiefVote,
    bananaThiefStartVote,
    bananaThiefNextRound,
    bananaThiefReset,
    bananaThiefReaction,
  } = useGameStore();
  const { t } = useTranslate();
  const { enabled: soundsEnabled, toggle: toggleSound } = useSoundSettings();
  const [peekTarget, setPeekTarget] = useState('');
  const [myVote, setMyVote] = useState<string | null>(null);
  const [showPeekResult, setShowPeekResult] = useState(false);
  const [floaters, setFloaters] = useState<
    { seq: number; emoji: string; fromName: string; x: number }[]
  >([]);

  const state = room?.bananaThiefState;
  const ps = privateState as Record<string, unknown> | undefined;
  const role = ps?.ctRole as BananaThiefRole | undefined;
  const myDie = ps?.ctDie as number | undefined;
  const awakePeers = (ps?.ctAwakePeers as string[] | undefined) ?? [];
  const peekOffer = ps?.ctPeekOffer === true;
  const stole = ps?.ctStole === true;
  const witnesses = (ps?.ctWitnesses as string[] | undefined) ?? [];
  const seesThief = ps?.ctSeesThief as string | undefined;
  const mySpecial = ps?.ctSpecial as BananaThiefSpecial | undefined;
  const twinPartner = ps?.ctTwinPartner as string | undefined;
  const chosenFollowers = (ps?.ctChosenFollowers as string[] | undefined) ?? [];
  const peekResult = ps?.ctPeekResult as
    | { targetName: string; die: number; role?: BananaThiefRole }
    | undefined;

  // Narration phrases (i18n-aware); stable callbacks for the narrator hook.
  // HOST-narrator mode silences the synth — the host reads the script aloud.
  const hostPaced = (room?.config.bananaThiefNarrator ?? 'AUTO') === 'HOST';
  const phrase = useRef((kind: 'night' | 'hour' | 'morning' | 'vote', n?: number) =>
    kind === 'night'
      ? t('gameBananaThief.narratorNight')
      : kind === 'hour'
        ? t('gameBananaThief.narratorHour', { n: n ?? 0 })
        : kind === 'morning'
          ? t('gameBananaThief.narratorMorning')
          : t('gameBananaThief.narratorVote'),
  ).current;
  useBananaThiefNarrator(soundsEnabled && !hostPaced, state?.phase, state?.clock ?? 0, phrase);

  // Peek result flashes for ~2s, then disappears (anti-curious-shoulder).
  const peekResultKey = peekResult ? `${peekResult.targetName}:${peekResult.die}` : null;
  const shownPeekKey = useRef<string | null>(null);
  useEffect(() => {
    if (!peekResultKey || shownPeekKey.current === peekResultKey) return;
    shownPeekKey.current = peekResultKey;
    setShowPeekResult(true);
    const timer = setTimeout(() => setShowPeekResult(false), 2000);
    return () => clearTimeout(timer);
  }, [peekResultKey]);

  const reaction = useGameStore((s) => s.lastBananaThiefReaction);
  useEffect(() => {
    if (!reaction) return;
    const f = { ...reaction, x: 8 + Math.random() * 80 };
    setFloaters((prev) => [...prev.slice(-5), f]);
    const timer = setTimeout(
      () => setFloaters((prev) => prev.filter((p) => p.seq !== f.seq)),
      2400,
    );
    return () => clearTimeout(timer);
  }, [reaction]);

  const isHost = socketId === room?.roomHostId;
  const isViewer = room?.players.find((p) => p.socketId === socketId)?.isViewer === true;
  /** "ตี 3" / "3 AM" — the whole UI speaks in Thai night-hours. */
  const hourName = (n: number) => t('gameBananaThief.hourName', { n });
  const nameOf = (id: string) => room?.players.find((p) => p.socketId === id)?.name ?? '?';
  const participants = (room?.players ?? []).filter((p) => p.connected !== false && !p.isViewer);
  const voteTargets = participants.filter((p) => p.socketId !== socketId);

  const tickSeconds = room?.config.bananaThiefTickSeconds ?? 6;
  const nightRemaining = useCountdown(state?.tickEndsAt);
  const phaseRemaining = useCountdown(state?.phaseEndsAt);
  useBananaThiefAmbient(
    soundsEnabled,
    state?.phase === BananaThiefPhase.NIGHT || state?.phase === BananaThiefPhase.CHOOSE_FOLLOWER,
  );

  // A fresh ballot clears the local "already voted" marker.
  useEffect(() => {
    if (state?.phase !== BananaThiefPhase.VOTING) setMyVote(null);
  }, [state?.phase]);

  if (!room || !state) return <div className="p-6 font-black">Loading Banana Thief...</div>;

  const isAwake =
    state.phase === BananaThiefPhase.NIGHT && myDie !== undefined && state.clock >= myDie;

  const roleLabel =
    role === BananaThiefRole.THIEF
      ? t('gameBananaThief.roleThief')
      : role === BananaThiefRole.FOLLOWER
        ? t('gameBananaThief.roleFollower')
        : t('gameBananaThief.roleMouse');

  /** DLC special badge (private card copy) shown under the role card. */
  const specialBadge = () => {
    if (!mySpecial) return null;
    const text =
      mySpecial === BananaThiefSpecial.DETECTIVE
        ? t('gameBananaThief.specialDetective')
        : mySpecial === BananaThiefSpecial.SYCOPHANT
          ? t('gameBananaThief.specialSycophant')
          : mySpecial === BananaThiefSpecial.SCAPEGOAT
            ? seesThief
              ? t('gameBananaThief.specialScapegoatSaw', { name: seesThief })
              : t('gameBananaThief.specialScapegoat')
            : twinPartner
              ? t('gameBananaThief.specialTwins', { name: twinPartner })
              : null;
    if (!text) return null;
    const icon =
      mySpecial === BananaThiefSpecial.DETECTIVE
        ? '🕵️'
        : mySpecial === BananaThiefSpecial.SYCOPHANT
          ? '🎭'
          : mySpecial === BananaThiefSpecial.SCAPEGOAT
            ? '🐐'
            : '👬';
    return (
      <div className="text-[11px] font-bold mt-2 text-cyan-200">
        {icon} {text}
      </div>
    );
  };

  const submitPeek = () => {
    if (!peekTarget) return;
    bananaThiefPeek(peekTarget);
    setPeekTarget('');
  };

  const submitVote = (targetId: string) => {
    if (myVote) return;
    setMyVote(targetId);
    bananaThiefVote(targetId);
  };

  const sendReaction = (emoji: string) => {
    bananaThiefReaction(emoji);
  };

  const renderReactionBar = () => (
    <div className="mt-4 border-t-4 border-black pt-3">
      <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-black">
        {t('gameBananaThief.reactionsTitle')}
      </div>
      <div className="flex flex-wrap gap-2">
        {BANANA_THIEF_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-10 h-10 text-xl bg-white hover:bg-amber-100 border-2 border-black shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  const renderNight = () => (
    <div className="rounded-none bg-slate-950 text-white border-4 border-black p-4 sm:p-6 min-h-[320px] flex flex-col items-center justify-center gap-4">
      {/* Public clock — everyone hears the night hours pass */}
      <div className="text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {t('gameBananaThief.phaseNight')}
        </div>
        <motion.div
          key={state.clock}
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl sm:text-7xl font-black tracking-tighter tabular-nums"
        >
          {state.clock > 0 ? `🌙 ${hourName(state.clock)}` : '🌙 …'}
        </motion.div>
        {state.nightGrace && state.clock >= BANANA_THIEF_CLOCK_HOURS && (
          <div className="text-xs font-black text-amber-300">
            ⏳ {t('gameBananaThief.graceNote')}
          </div>
        )}
        {nightRemaining !== null && state.clock > 0 && state.clock < BANANA_THIEF_CLOCK_HOURS && (
          <div className="text-xs font-black text-slate-500 tabular-nums">
            {fmtTime(nightRemaining)}
          </div>
        )}
      </div>

      {/* Secret role card */}
      <div
        className={`w-full max-w-sm border-4 p-3 text-center ${
          role === BananaThiefRole.THIEF
            ? 'bg-red-900/60 border-red-500 text-red-100'
            : role === BananaThiefRole.FOLLOWER
              ? 'bg-purple-900/60 border-purple-400 text-purple-100'
              : 'bg-slate-900 border-slate-600 text-slate-100'
        }`}
      >
        <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
          {t('gameBananaThief.youAre', { role: roleLabel })}
        </div>
        <div className="flex justify-center my-2">
          <RoleArtwork role={role ?? BananaThiefRole.MOUSE} className="h-28" />
        </div>
        {myDie !== undefined && (
          <div className="text-xs font-black mt-1">
            🎲 {t('gameBananaThief.youWakeAt', { time: hourName(myDie) })}
          </div>
        )}
        {role === BananaThiefRole.FOLLOWER && (
          <div className="text-[11px] font-bold mt-2 text-purple-200">
            {seesThief
              ? t('gameBananaThief.followerSeesThief', { name: seesThief })
              : t('gameBananaThief.followerConverted')}
          </div>
        )}
        {role === BananaThiefRole.THIEF && stole && (
          <div className="text-[11px] font-bold mt-2 text-red-200">
            {t('gameBananaThief.stealDone')}
            {witnesses.length > 0 && (
              <div className="mt-1">
                ⚠️ {t('gameBananaThief.thiefWitness', { names: witnesses.join(', ') })}
              </div>
            )}
          </div>
        )}
        {specialBadge()}
      </div>

      {/* HOST-narrator mode: the host speaks the script and paces the hours */}
      {hostPaced && isHost && (
        <div className="w-full max-w-sm bg-indigo-600 text-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
            {t('gameBananaThief.hostScriptTitle')}
          </div>
          <div className="text-sm font-black mt-1">
            {state.clock === 0
              ? t('gameBananaThief.narratorNight')
              : state.clock < BANANA_THIEF_CLOCK_HOURS
                ? `📢 ${t('gameBananaThief.narratorHour', { n: state.clock })} → ${t('gameBananaThief.narratorHourEnd', { n: state.clock })}`
                : `📢 ${t('gameBananaThief.narratorMorning')}`}
          </div>
          {state.clock < BANANA_THIEF_CLOCK_HOURS ? (
            <button
              onClick={bananaThiefNextHour}
              data-testid="banana-thief-next-hour"
              className="mt-2 w-full bg-white text-black border-2 border-black font-black py-2 uppercase tracking-widest shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] transition-all"
            >
              ⏭ {t('gameBananaThief.nextHour')}
            </button>
          ) : (
            <div className="text-[11px] font-bold mt-1 opacity-90">
              {t('gameBananaThief.graceNote')}
            </div>
          )}
        </div>
      )}
      {hostPaced && !isHost && state.clock < BANANA_THIEF_CLOCK_HOURS && (
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
          {t('gameBananaThief.waitingHostHour')}
        </div>
      )}

      {/* Wake state */}
      {isAwake ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: [1, 0.75, 1], y: 0 }}
          transition={{ opacity: { repeat: Infinity, duration: 2 } }}
          className="w-full max-w-sm bg-amber-400 text-black border-4 border-black p-3 text-center shadow-[4px_4px_0_0_#000]"
        >
          <div className="text-xl font-black">👁️ {t('gameBananaThief.awake')}</div>
          <div className="text-xs font-black mt-1">
            {awakePeers.length > 0
              ? `${t('gameBananaThief.awakePeersTitle')} ${awakePeers.join(', ')}`
              : t('gameBananaThief.awakeAlone')}
          </div>
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="w-full max-w-sm bg-slate-900 border-4 border-slate-700 p-3 text-center"
        >
          <div className="text-xl font-black text-slate-300">
            😴 {t('gameBananaThief.sleeping')}
          </div>
        </motion.div>
      )}

      {/* Solo-wake peek reward (private) */}
      {peekOffer && (
        <div className="w-full max-w-sm bg-yellow-300 text-black border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
          <div className="font-black text-sm">🤫 {t('gameBananaThief.peekTitle')}</div>
          <div className="text-xs font-bold mt-1">{t('gameBananaThief.peekDesc')}</div>
          <div className="flex gap-2 mt-2">
            <select
              value={peekTarget}
              onChange={(e) => setPeekTarget(e.target.value)}
              className="flex-1 bg-white border-2 border-black px-2 py-2 text-sm font-black"
            >
              <option value="">—</option>
              {participants
                .filter((p) => p.socketId !== socketId)
                .map((p) => (
                  <option key={p.socketId} value={p.socketId}>
                    {p.name}
                  </option>
                ))}
            </select>
            <button
              onClick={submitPeek}
              disabled={!peekTarget}
              className="bg-black text-yellow-300 disabled:bg-gray-600 disabled:text-gray-400 border-2 border-black px-3 py-2 text-sm font-black uppercase shadow-[2px_2px_0_0_#000]"
            >
              {t('gameBananaThief.peekGo')}
            </button>
          </div>
        </div>
      )}
      {/* Peeked die flashes for ~2 seconds, then the screen goes dark again */}
      {!peekOffer && showPeekResult && peekResult && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full max-w-sm bg-lime-200 text-black border-4 border-black p-3 text-center font-black"
        >
          <div className="text-[10px] uppercase tracking-widest opacity-70">
            {t('gameBananaThief.peekDoneTitle')}
          </div>
          <div className="text-3xl font-black">
            {peekResult.role !== undefined
              ? `${peekResult.targetName}: ${
                  peekResult.role === BananaThiefRole.THIEF
                    ? t('gameBananaThief.peekRoleThief')
                    : peekResult.role === BananaThiefRole.FOLLOWER
                      ? t('gameBananaThief.peekRoleFollower')
                      : t('gameBananaThief.peekRoleMouse')
                }`
              : `${peekResult.targetName}: 🎲 ${hourName(peekResult.die)}`}
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderSetup = () => {
    const readyIds = state.readyIds ?? [];
    const iAmReady = readyIds.includes(socketId);
    const readyCount = readyIds.length;
    const total = participants.length;
    const unlockNarrator = () => {
      // First user gesture: unlock speech synthesis with a short confirmation.
      try {
        if (soundsEnabled && typeof window !== 'undefined' && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(t('gameBananaThief.readyButton'));
          utterance.lang = 'th-TH';
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        // ignore — narration stays optional
      }
      bananaThiefReady();
    };
    return (
      <div className="bg-slate-900 text-white border-4 border-black p-4 sm:p-6 min-h-[320px] flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {t('gameBananaThief.phaseSetup')}
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">
            {t('gameBananaThief.setupTitle')}
          </div>
          <div className="text-xs font-bold text-slate-400 mt-1">
            {t('gameBananaThief.setupHint')}
          </div>
        </div>

        <div
          className={`w-full max-w-sm border-4 p-3 text-center ${
            role === BananaThiefRole.THIEF
              ? 'bg-red-900/60 border-red-500 text-red-100'
              : 'bg-slate-800 border-slate-600 text-slate-100'
          }`}
        >
          <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
            {t('gameBananaThief.youAre', { role: roleLabel })}
          </div>
          <div className="flex justify-center my-2">
            <RoleArtwork role={role ?? BananaThiefRole.MOUSE} className="h-40" />
          </div>
          {myDie !== undefined && (
            <div className="text-sm font-black mt-1">
              🎲 {t('gameBananaThief.youWakeAt', { time: hourName(myDie) })}
            </div>
          )}
          {specialBadge()}
        </div>

        {!iAmReady ? (
          <button
            onClick={unlockNarrator}
            data-testid="banana-thief-ready"
            className="bg-lime-400 hover:bg-lime-300 text-black border-4 border-black font-black text-lg px-8 py-4 uppercase tracking-widest shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            ✋ {t('gameBananaThief.readyButton')}
          </button>
        ) : (
          <div className="bg-slate-800 border-4 border-slate-600 px-6 py-3 text-sm font-black uppercase tracking-widest">
            ⏳ {t('gameBananaThief.readyWaiting')}
          </div>
        )}
        <div className="text-xs font-black text-slate-400 tabular-nums">
          {t('gameBananaThief.readyCount', { count: readyCount, total })}
        </div>
        {isHost && readyCount < total && (
          <button
            onClick={() => bananaThiefReady(true)}
            data-testid="banana-thief-force-start"
            className="bg-amber-400 hover:bg-amber-300 text-black border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0_0_#000]"
          >
            ⏩ {t('gameBananaThief.forceStartNight')}
          </button>
        )}
      </div>
    );
  };

  const renderChooseFollower = () => {
    const isThief = role === BananaThiefRole.THIEF;
    const candidates = participants.filter((p) => p.socketId !== socketId);
    const quota = room?.config.bananaThiefFollowerCount ?? 1;

    if (isThief) {
      return (
        <div className="bg-slate-900 text-white border-4 border-black p-4 sm:p-6 min-h-[360px] flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-red-400">
              {t('gameBananaThief.phaseChooseFollower')}
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1 text-red-400">
              🦹 {t('gameBananaThief.chooseFollowerTitle')}
            </div>
            <div className="text-xs font-bold text-slate-300 mt-1 max-w-md">
              {t('gameBananaThief.chooseFollowerDesc')}
            </div>
            <div className="mt-2 text-xs font-black text-amber-300 tabular-nums">
              ⏳ {phaseRemaining !== null ? fmtTime(phaseRemaining) : '--:--'} (
              {chosenFollowers.length}/{quota})
            </div>
          </div>

          <div className="w-full max-w-md space-y-2 mt-2">
            <div className="text-xs font-black uppercase text-slate-400">
              {t('gameBananaThief.chooseFollowerPrompt')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {candidates.map((p) => {
                const isSelected = chosenFollowers.includes(p.socketId);
                return (
                  <button
                    key={p.socketId}
                    type="button"
                    disabled={isSelected || chosenFollowers.length >= quota}
                    onClick={() => bananaThiefChooseFollower(p.socketId)}
                    className={`p-3 border-3 border-black text-left flex items-center justify-between font-black transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-300 shadow-[2px_2px_0_0_#000]'
                        : 'bg-white text-black hover:bg-amber-100 shadow-[3px_3px_0_0_#000] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px]'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs shrink-0 ml-2">
                      {isSelected ? '🤝 สมุนแล้ว' : 'แตะเพื่อเลือก'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-950 text-white border-4 border-black p-4 sm:p-6 min-h-[360px] flex flex-col items-center justify-center gap-4 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="text-6xl"
        >
          😴💤
        </motion.div>
        <div>
          <div className="text-xl sm:text-2xl font-black text-amber-300">
            {t('gameBananaThief.waitingThiefFollowerTitle')}
          </div>
          <div className="text-xs font-bold text-slate-400 mt-1 max-w-sm">
            {t('gameBananaThief.waitingThiefFollowerDesc')}
          </div>
          <div className="text-xs font-black text-slate-500 mt-2 tabular-nums">
            ⏳ {phaseRemaining !== null ? fmtTime(phaseRemaining) : '--:--'}
          </div>
        </div>

        {role === BananaThiefRole.FOLLOWER && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm p-3 bg-purple-950/80 border-2 border-purple-400 text-purple-200 text-xs font-black"
          >
            🤫 คุณถูกสะกิดเลือกเป็น &quot;ผู้สมรู้ร่วมคิด&quot; (ลูกสมุน) แล้ว!
            {seesThief && (
              <div className="text-[11px] text-purple-300 font-bold mt-0.5">
                (โจรขโมยกล้วยคือ: {nameOf(seesThief)})
              </div>
            )}
          </motion.div>
        )}

        <div className="w-full max-w-xs border-2 border-slate-700 bg-slate-900 p-2.5 text-center mt-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {t('gameBananaThief.youAre', { role: roleLabel })}
          </div>
          {myDie !== undefined && (
            <div className="text-xs font-black text-slate-300 mt-0.5">
              🎲 {t('gameBananaThief.youWakeAt', { time: hourName(myDie) })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDiscussion = () => (
    <div className="bg-white border-4 border-black p-4 sm:p-6 min-h-[320px] flex flex-col items-center justify-center gap-4">
      <motion.div
        initial={{ scale: 0.7, rotate: -4 }}
        animate={{ scale: 1, rotate: 0 }}
        className="text-center"
      >
        <div className="text-5xl sm:text-6xl">🍌❓</div>
        <div className="text-3xl sm:text-4xl font-black text-black uppercase tracking-tight mt-2">
          {t('gameBananaThief.bananaMissing')}
        </div>
      </motion.div>
      <div className="text-sm font-bold text-gray-600">{t('gameBananaThief.discussionHint')}</div>
      <div className="bg-amber-200 border-4 border-black shadow-[4px_4px_0_0_#000] px-6 py-3 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest">
          {t('gameBananaThief.discussionTime', {
            time: phaseRemaining !== null ? fmtTime(phaseRemaining) : '--:--',
          })}
        </div>
        <div className="text-4xl font-black tabular-nums">
          {phaseRemaining !== null ? fmtTime(phaseRemaining) : '--:--'}
        </div>
      </div>
      {isHost ? (
        <button
          onClick={bananaThiefStartVote}
          className="bg-red-500 hover:bg-red-400 text-white border-4 border-black font-black px-6 py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          🗳️ {t('gameBananaThief.startVote')}
        </button>
      ) : (
        <div className="text-sm font-black text-gray-500 uppercase tracking-widest">
          {t('gameBananaThief.waitingHostStartVote')}
        </div>
      )}
      {renderReactionBar()}
    </div>
  );

  const renderVoting = () => (
    <div className="bg-white border-4 border-black p-4 sm:p-6 min-h-[320px] flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
          🗳️ {t('gameBananaThief.voteTitle')}
        </div>
        <div className="text-xs font-black text-gray-500 mt-1 tabular-nums">
          {t('gameBananaThief.voteTime', {
            time: phaseRemaining !== null ? fmtTime(phaseRemaining) : '--:--',
          })}
          {' · '}
          {state.votesRecorded}/{state.votesTotal}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-md">
        {voteTargets.map((p) => (
          <button
            key={p.socketId}
            onClick={() => submitVote(p.socketId)}
            disabled={!!myVote}
            data-testid={`banana-thief-vote-${p.socketId}`}
            className={`border-4 border-black px-2 py-3 font-black text-sm truncate transition-all shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] ${
              myVote === p.socketId ? 'bg-amber-300' : 'bg-white hover:bg-red-100'
            } disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0`}
          >
            {p.avatar} {p.name}
          </button>
        ))}
      </div>
      {myVote && (
        <div className="bg-lime-200 border-2 border-black px-4 py-2 text-sm font-black">
          ✅ {t('gameBananaThief.voted', { count: state.votesRecorded, total: state.votesTotal })}
        </div>
      )}
      {renderReactionBar()}
    </div>
  );

  const renderResult = () => {
    const goatWin = state.winner === 'SCAPEGOAT';
    const miceWin = state.winner === 'MICE';
    const myDelta = state.scoreDeltas?.[socketId] ?? 0;
    return (
      <div className="bg-white border-4 border-black p-4 sm:p-6 min-h-[320px] flex flex-col items-center gap-3">
        <div
          className={`w-full max-w-md text-center border-4 border-black p-4 shadow-[4px_4px_0_0_#000] ${
            goatWin ? 'bg-emerald-300' : miceWin ? 'bg-lime-300' : 'bg-red-400'
          }`}
        >
          <div className="text-2xl font-black uppercase tracking-tight">
            {state.fledThief
              ? t('gameBananaThief.thiefFled')
              : goatWin
                ? t('gameBananaThief.goatWin', {
                    name: state.caughtId ? nameOf(state.caughtId) : '?',
                  })
                : miceWin
                  ? t('gameBananaThief.miceWin')
                  : t('gameBananaThief.thiefWin')}
          </div>
        </div>

        <div className="w-full max-w-md space-y-2 text-sm font-black">
          <div className="bg-red-100 border-2 border-black p-2">
            🍌 {t('gameBananaThief.thiefIs', { name: state.thiefId ? nameOf(state.thiefId) : '?' })}
          </div>
          <div className="bg-purple-100 border-2 border-black p-2">
            🐒{' '}
            {state.followerIds && state.followerIds.length > 0
              ? t('gameBananaThief.followersAre', {
                  names: state.followerIds.map(nameOf).join(', '),
                })
              : t('gameBananaThief.noFollowers')}
          </div>
          {state.votes && (
            <div className="bg-amber-50 border-2 border-black p-2 space-y-1">
              {Object.entries(state.votes).map(([voter, target]) => (
                <div key={voter} className="flex justify-between gap-2">
                  <span>{nameOf(voter)}</span>
                  <span>
                    → {nameOf(target)}{' '}
                    {target === state.thiefId ? '🎯' : target === state.caughtId ? '❌' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {state.dice && Object.keys(state.dice).length > 0 && (
            <div className="bg-slate-900 text-white border-2 border-black p-2">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">
                🎲 {t('gameBananaThief.resultDiceTitle')}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(state.dice).map(([id, die]) => {
                  const isThief = id === state.thiefId;
                  const isFollower = state.followerIds?.includes(id) ?? false;
                  const special = state.specials?.[id];
                  const specialIcon =
                    special === BananaThiefSpecial.DETECTIVE
                      ? ' 🕵️'
                      : special === BananaThiefSpecial.SYCOPHANT
                        ? ' 🎭'
                        : special === BananaThiefSpecial.TWINS
                          ? ' 👬'
                          : special === BananaThiefSpecial.SCAPEGOAT
                            ? ' 🐐'
                            : '';
                  return (
                    <div key={id} className="flex justify-between gap-2 text-xs font-black">
                      <span className="truncate">
                        {isThief
                          ? '🍌'
                          : special === BananaThiefSpecial.SCAPEGOAT
                            ? '🐐'
                            : isFollower
                              ? '🐒🐒'
                              : '🐒'}{' '}
                        {nameOf(id)}
                        {specialIcon}
                      </span>
                      <span className="tabular-nums">{hourName(die)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bg-lime-100 border-2 border-black p-2 text-center">
            {t('gameBananaThief.yourDelta', { score: myDelta })}
          </div>
        </div>

        {isHost ? (
          <div className="flex gap-2 w-full max-w-md">
            <button
              onClick={bananaThiefNextRound}
              className="flex-1 bg-lime-400 hover:bg-lime-300 text-black border-4 border-black font-black py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              ▶ {t('gameBananaThief.nextRound')}
            </button>
            <button
              onClick={bananaThiefReset}
              className="flex-1 bg-white hover:bg-gray-100 text-black border-4 border-black font-black py-3 uppercase tracking-widest shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              🏠 {t('gameBananaThief.backToLobby')}
            </button>
          </div>
        ) : (
          <div className="text-sm font-black text-gray-500 uppercase tracking-widest">
            {t('gameBananaThief.waitingHost')}
          </div>
        )}
        {renderReactionBar()}
      </div>
    );
  };

  return (
    <div className="relative flex-1 flex flex-col min-w-0">
      {/* Floating emoji reactions */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.seq}
              initial={{ opacity: 0, y: 20, x: `${f.x}%` }}
              animate={{ opacity: 1, y: -80 }}
              exit={{ opacity: 0, y: -140 }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              className="absolute bottom-4 flex items-center gap-1 bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0_0_#000] text-sm font-black"
            >
              <span className="text-xl">{f.emoji}</span>
              <span>{f.fromName}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Phase header */}
      <div className="flex items-center justify-between mb-2">
        <div className="bg-black text-white px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0_0_#000]">
          🍌{' '}
          {state.phase === BananaThiefPhase.SETUP
            ? t('gameBananaThief.phaseSetup')
            : state.phase === BananaThiefPhase.CHOOSE_FOLLOWER
              ? t('gameBananaThief.phaseChooseFollower')
              : state.phase === BananaThiefPhase.NIGHT
                ? t('gameBananaThief.phaseNight')
                : state.phase === BananaThiefPhase.DISCUSSION
                  ? t('gameBananaThief.phaseDiscussion')
                  : state.phase === BananaThiefPhase.VOTING
                    ? t('gameBananaThief.phaseVoting')
                    : t('gameBananaThief.phaseResult')}
        </div>
        <SoundToggle
          enabled={soundsEnabled}
          onToggle={toggleSound}
          titleOn="Ambient on"
          titleOff="Ambient off"
          testId="banana-thief-sound-toggle"
          className="w-9 h-9"
        />
      </div>

      {isViewer ? (
        <div className="bg-white border-4 border-black p-8 text-center font-black text-gray-500">
          👀 {t('gameBananaThief.spectator')}
        </div>
      ) : state.phase === BananaThiefPhase.SETUP ? (
        renderSetup()
      ) : state.phase === BananaThiefPhase.CHOOSE_FOLLOWER ? (
        renderChooseFollower()
      ) : state.phase === BananaThiefPhase.NIGHT ? (
        renderNight()
      ) : state.phase === BananaThiefPhase.DISCUSSION ? (
        renderDiscussion()
      ) : state.phase === BananaThiefPhase.VOTING ? (
        renderVoting()
      ) : (
        renderResult()
      )}

      {/* Keep the per-tick pace visible to the player without leaking roles */}
      {state.phase === BananaThiefPhase.NIGHT && tickSeconds > 0 && (
        <div className="sr-only" data-testid="banana-thief-tick-seconds">
          {tickSeconds}
        </div>
      )}
    </div>
  );
}
