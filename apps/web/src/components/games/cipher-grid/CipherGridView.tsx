'use client';

import { useState, useMemo, useEffect } from 'react';
import type { CipherTeam, CipherCardType, CipherClueCount } from '@repo/types';
import { CIPHER_GRID_PRIVATE_KEY } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { GameDialog } from '@/components/core/GameDialog';

export function CipherGridView() {
  const { room, socketId, privateState, ...actions } = useGameStore();
  const { t } = useTranslate();

  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState<CipherClueCount>(1);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [isPeekActive, setIsPeekActive] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick for turn timer
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const state = room?.cipherGridState;
  const isHost = room?.hostPlayerId === socketId;

  // Resolve teams and roles
  const myTeam = (state?.teams && socketId ? state.teams[socketId] : null) as CipherTeam | null;
  const isLead = useMemo(() => {
    if (!state || !myTeam || !socketId) return false;
    return state.cipherLeads[myTeam] === socketId;
  }, [state, myTeam, socketId]);
  const isTracker = myTeam !== null && !isLead;

  // Active turn info
  const isMyTeamTurn = state?.currentTeam === myTeam;
  const isMyTurnToGiveClue = state?.phase === 'CLUE_GIVING' && isMyTeamTurn && isLead;
  const isMyTeamDecoding = state?.phase === 'DECODING' && isMyTeamTurn && isTracker;
  const canChallenge = state?.phase === 'DECODING' && !isMyTeamTurn && myTeam !== null;

  // Selected card details
  const selectedCard =
    selectedCardIndex !== null && state?.board ? state.board[selectedCardIndex] : null;

  // Keycard for leads from private state
  const privateKeycard = (privateState as Record<string, unknown> | undefined)?.[
    CIPHER_GRID_PRIVATE_KEY
  ] as CipherCardType[] | undefined;

  // Guesses remaining calculation
  const guessesRemaining = useMemo(() => {
    if (!state?.currentClue) return null;
    if (state.currentClue.count === 'UNLIMITED') return 'UNLIMITED';
    const maxGuesses = state.currentClue.count + 1;
    return Math.max(0, maxGuesses - state.guessesThisTurn);
  }, [state?.currentClue, state?.guessesThisTurn]);

  // End turn capability
  const canEndTurn = useMemo(() => {
    if (!state || state.phase !== 'DECODING' || !isMyTeamTurn || !isTracker) return false;
    if (!state.currentClue) return false;
    if (state.currentClue.count === 0 || state.currentClue.count === 'UNLIMITED') return true;
    return state.guessesThisTurn >= 1;
  }, [state, isMyTeamTurn, isTracker]);

  // Seconds left for turn
  const secondsLeft = useMemo(() => {
    if (!state?.turnEndsAt) return null;
    return Math.max(0, Math.ceil((state.turnEndsAt - now) / 1000));
  }, [state?.turnEndsAt, now]);

  if (!state || !room) {
    return null;
  }

  // 1. TEAM SETUP PHASE
  if (state.phase === 'TEAM_SETUP') {
    const solarLeadSocket = state.cipherLeads['SOLAR'];
    const lunarLeadSocket = state.cipherLeads['LUNAR'];

    const solarLead = solarLeadSocket
      ? room.players.find((p) => p.socketId === solarLeadSocket)
      : null;
    const lunarLead = lunarLeadSocket
      ? room.players.find((p) => p.socketId === lunarLeadSocket)
      : null;

    const solarTrackers = room.players.filter(
      (p) => state.teams[p.socketId] === 'SOLAR' && p.socketId !== solarLeadSocket,
    );
    const lunarTrackers = room.players.filter(
      (p) => state.teams[p.socketId] === 'LUNAR' && p.socketId !== lunarLeadSocket,
    );
    const unassignedPlayers = room.players.filter((p) => !state.teams[p.socketId]);

    const hasEnoughPlayers = room.players.length >= 4;
    const isSolarValid = !!solarLead && solarTrackers.length >= 1;
    const isLunarValid = !!lunarLead && lunarTrackers.length >= 1;
    const canStart = hasEnoughPlayers && isSolarValid && isLunarValid;

    return (
      <div
        data-testid="ciphergrid-team-setup"
        className="flex-1 flex flex-col p-4 bg-amber-50/50 border-4 border-black shadow-[6px_6px_0_0_#000] gap-6 overflow-y-auto"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-4 border-black pb-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <span className="p-1 bg-amber-400 border-2 border-black">🕵️</span>
              {t('cipherGrid.title')} — {t('gamePrompts.cipherGrid.teamSetup')}
            </h2>
            <p className="text-sm font-bold text-stone-600 mt-1">
              {t('cipherGrid.needFourPlayers')} • {t('cipherGrid.needLeadAndTracker')}
            </p>
          </div>
          {isHost && (
            <button
              data-testid="randomize-teams-btn"
              onClick={() => actions.cipherRandomizeTeams()}
              className="px-4 py-2 font-black uppercase text-sm bg-white border-2 border-black shadow-[3px_3px_0_0_#000] hover:bg-stone-100 active:translate-x-0.5 active:translate-y-0.5"
            >
              🎲 {t('cipherGrid.randomizeTeams')}
            </button>
          )}
        </div>

        {/* Two Team Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Solar Team Column */}
          <div className="flex flex-col bg-amber-100 border-4 border-black shadow-[4px_4px_0_0_#000] p-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
              <h3 className="font-black text-lg text-amber-950 uppercase flex items-center gap-1.5">
                ☀️ {t('cipherGrid.solarTeam')}
              </h3>
              <span className="text-xs font-black bg-amber-300 border-2 border-black px-2 py-0.5">
                {(solarLead ? 1 : 0) + solarTrackers.length} {t('lobby.players')}
              </span>
            </div>

            {/* Solar Lead */}
            <div className="mb-4 bg-white/80 border-2 border-black p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                  👑 {t('cipherGrid.leadRole')} (1)
                </span>
                {(!solarLead || solarLead.socketId === socketId) && (
                  <button
                    data-testid="join-solar-lead-btn"
                    onClick={() => actions.cipherAssignTeam({ team: 'SOLAR', role: 'CIPHER_LEAD' })}
                    className="text-xs font-black px-2 py-1 bg-amber-400 border border-black shadow-[1px_1px_0_0_#000] hover:bg-amber-300"
                  >
                    {solarLead?.socketId === socketId ? 'Joined' : '+ Join'}
                  </button>
                )}
              </div>
              <div className="font-bold text-sm">
                {solarLead ? (
                  <span className="flex items-center justify-between">
                    <span>
                      {solarLead.name} {solarLead.socketId === socketId && '(You)'}
                    </span>
                    {solarLead.socketId === socketId && (
                      <span className="text-xs font-mono bg-amber-200 px-1 border border-black">
                        Active
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-stone-400 italic">No Lead assigned</span>
                )}
              </div>
            </div>

            {/* Solar Trackers */}
            <div className="flex-1 bg-white/80 border-2 border-black p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-stone-700">
                  🔍 {t('cipherGrid.trackerRole')} ({solarTrackers.length})
                </span>
                <button
                  data-testid="join-solar-tracker-btn"
                  onClick={() => actions.cipherAssignTeam({ team: 'SOLAR', role: 'TRACKER' })}
                  className="text-xs font-black px-2 py-1 bg-amber-400 border border-black shadow-[1px_1px_0_0_#000] hover:bg-amber-300"
                >
                  + Join
                </button>
              </div>
              <div className="space-y-1.5 flex-1">
                {solarTrackers.length === 0 ? (
                  <div className="text-xs text-stone-400 italic py-2">No Trackers yet</div>
                ) : (
                  solarTrackers.map((tr) => (
                    <div
                      key={tr.socketId}
                      className="text-sm font-bold bg-amber-50 px-2 py-1 border border-black/30 flex justify-between"
                    >
                      <span>
                        {tr.name} {tr.socketId === socketId && '(You)'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Lunar Team Column */}
          <div className="flex flex-col bg-blue-100 border-4 border-black shadow-[4px_4px_0_0_#000] p-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
              <h3 className="font-black text-lg text-blue-950 uppercase flex items-center gap-1.5">
                🌙 {t('cipherGrid.lunarTeam')}
              </h3>
              <span className="text-xs font-black bg-blue-300 border-2 border-black px-2 py-0.5">
                {(lunarLead ? 1 : 0) + lunarTrackers.length} {t('lobby.players')}
              </span>
            </div>

            {/* Lunar Lead */}
            <div className="mb-4 bg-white/80 border-2 border-black p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-blue-800">
                  👑 {t('cipherGrid.leadRole')} (1)
                </span>
                {(!lunarLead || lunarLead.socketId === socketId) && (
                  <button
                    data-testid="join-lunar-lead-btn"
                    onClick={() => actions.cipherAssignTeam({ team: 'LUNAR', role: 'CIPHER_LEAD' })}
                    className="text-xs font-black px-2 py-1 bg-blue-400 text-white border border-black shadow-[1px_1px_0_0_#000] hover:bg-blue-300"
                  >
                    {lunarLead?.socketId === socketId ? 'Joined' : '+ Join'}
                  </button>
                )}
              </div>
              <div className="font-bold text-sm">
                {lunarLead ? (
                  <span className="flex items-center justify-between">
                    <span>
                      {lunarLead.name} {lunarLead.socketId === socketId && '(You)'}
                    </span>
                    {lunarLead.socketId === socketId && (
                      <span className="text-xs font-mono bg-blue-200 px-1 border border-black">
                        Active
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-stone-400 italic">No Lead assigned</span>
                )}
              </div>
            </div>

            {/* Lunar Trackers */}
            <div className="flex-1 bg-white/80 border-2 border-black p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-stone-700">
                  🔍 {t('cipherGrid.trackerRole')} ({lunarTrackers.length})
                </span>
                <button
                  data-testid="join-lunar-tracker-btn"
                  onClick={() => actions.cipherAssignTeam({ team: 'LUNAR', role: 'TRACKER' })}
                  className="text-xs font-black px-2 py-1 bg-blue-400 text-white border border-black shadow-[1px_1px_0_0_#000] hover:bg-blue-300"
                >
                  + Join
                </button>
              </div>
              <div className="space-y-1.5 flex-1">
                {lunarTrackers.length === 0 ? (
                  <div className="text-xs text-stone-400 italic py-2">No Trackers yet</div>
                ) : (
                  lunarTrackers.map((tr) => (
                    <div
                      key={tr.socketId}
                      className="text-sm font-bold bg-blue-50 px-2 py-1 border border-black/30 flex justify-between"
                    >
                      <span>
                        {tr.name} {tr.socketId === socketId && '(You)'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Unassigned Players */}
        {unassignedPlayers.length > 0 && (
          <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
            <span className="text-xs font-black uppercase text-stone-500 mr-2">
              {t('cipherGrid.unassigned')}:
            </span>
            <span className="text-sm font-bold text-stone-800">
              {unassignedPlayers.map((p) => p.name).join(', ')}
            </span>
          </div>
        )}

        {/* Host Start Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-black">
          <div className="text-sm font-bold text-stone-600">
            {!hasEnoughPlayers && (
              <span className="text-red-600">⚠️ {t('cipherGrid.needFourPlayers')}</span>
            )}
            {hasEnoughPlayers && (!isSolarValid || !isLunarValid) && (
              <span className="text-amber-700">⚠️ {t('cipherGrid.needLeadAndTracker')}</span>
            )}
            {canStart && (
              <span className="text-emerald-700 font-black">✓ Ready to deploy operatives</span>
            )}
          </div>

          {isHost ? (
            <button
              data-testid="start-match-btn"
              disabled={!canStart}
              onClick={() => actions.cipherStartMatch()}
              className={`w-full sm:w-auto px-8 py-3 font-black text-lg uppercase tracking-wider border-4 border-black transition-all ${
                canStart
                  ? 'bg-emerald-400 hover:bg-emerald-300 shadow-[4px_4px_0_0_#000] active:translate-x-1 active:translate-y-1'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed border-stone-400'
              }`}
            >
              🚀 {t('cipherGrid.startMatch')}
            </button>
          ) : (
            <div className="text-sm font-bold text-stone-500 italic">
              {t('cipherGrid.waitingHostStart')}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. ACTIVE GAME & ROUND END PHASES
  const isRoundEnd = state.phase === 'ROUND_END';
  const currentTurnTeam = state.currentTeam;
  const isSolarTurn = currentTurnTeam === 'SOLAR';

  return (
    <div
      data-testid="ciphergrid-container"
      className="flex-1 flex flex-col bg-amber-50/30 border-4 border-black shadow-[6px_6px_0_0_#000] p-3 sm:p-4 gap-4 overflow-y-auto"
    >
      {/* Top Bar: Team Scores & Turn Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-4 border-black p-3 shadow-[3px_3px_0_0_#000]">
        {/* Solar Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 border-2 border-black transition-all ${
            isSolarTurn && !isRoundEnd
              ? 'bg-amber-400 shadow-[2px_2px_0_0_#000] font-black'
              : 'bg-amber-100 font-bold opacity-85'
          }`}
        >
          <span className="text-lg">☀️</span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-tight">Solar</span>
            <span className="text-sm font-black">
              {state.remaining.SOLAR} {t('cipherGrid.cardRemaining')}
            </span>
          </div>
        </div>

        {/* Turn Status / Round End Winner Announcement */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          {isRoundEnd ? (
            <div data-testid="round-end-banner" className="flex flex-col items-center">
              <span className="text-xl font-black uppercase text-red-600 animate-pulse">
                {state.winner === 'SOLAR' ? t('cipherGrid.solarWon') : t('cipherGrid.lunarWon')}
              </span>
              <span className="text-xs font-bold text-stone-600">
                {state.winReason === 'VIRUS'
                  ? t('cipherGrid.winReasonVirus')
                  : t('cipherGrid.winReasonAllFound')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black uppercase bg-stone-100 border border-black px-2 py-0.5">
                {t('cipherGrid.round')} {state.round}
              </span>
              <span
                className={`text-sm font-black uppercase px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0_0_#000] ${
                  isSolarTurn ? 'bg-amber-400 text-black' : 'bg-blue-600 text-white'
                }`}
              >
                {isSolarTurn ? '☀️ Solar Team' : '🌙 Lunar Team'}
              </span>
              {typeof secondsLeft === 'number' && (
                <span className="text-xs font-mono font-black bg-stone-900 text-white px-2 py-0.5 border border-black">
                  ⏱️ {secondsLeft}s
                </span>
              )}
            </div>
          )}
        </div>

        {/* Lunar Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 border-2 border-black transition-all ${
            !isSolarTurn && !isRoundEnd
              ? 'bg-blue-600 text-white shadow-[2px_2px_0_0_#000] font-black'
              : 'bg-blue-100 text-blue-950 font-bold opacity-85'
          }`}
        >
          <span className="text-lg">🌙</span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-tight">Lunar</span>
            <span className="text-sm font-black">
              {state.remaining.LUNAR} {t('cipherGrid.cardRemaining')}
            </span>
          </div>
        </div>
      </div>

      {/* Cipher Lead Controls & Peek Keycard Toggle */}
      {isLead && !isRoundEnd && (
        <div className="flex items-center justify-between bg-stone-900 text-white border-3 border-black p-2.5 px-3 shadow-[3px_3px_0_0_#000]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              👑 Cipher Lead Console
            </span>
            <span className="text-[11px] text-stone-300">
              ({myTeam === 'SOLAR' ? 'Solar Team' : 'Lunar Team'})
            </span>
          </div>
          <button
            data-testid="peek-keycard-btn"
            onClick={() => setIsPeekActive(!isPeekActive)}
            className="text-xs font-black uppercase px-3 py-1 bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-amber-300 active:translate-y-0.5"
          >
            {isPeekActive
              ? `🙈 ${t('cipherGrid.hideKeycard')}`
              : `👁️ ${t('cipherGrid.peekKeycard')}`}
          </button>
        </div>
      )}

      {/* Clue Giving Interface (Active Team Cipher Lead) */}
      {isMyTurnToGiveClue && !isRoundEnd && (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000]">
          <div className="text-sm font-black uppercase text-amber-900 flex items-center gap-1.5">
            <span>🗣️</span>
            <span>{t('cipherGrid.giveClueBtn')}:</span>
          </div>
          <div className="flex-1 flex gap-2 w-full sm:w-auto">
            <input
              data-testid="clue-word-input"
              type="text"
              value={clueWord}
              onChange={(e) => setClueWord(e.target.value.trim())}
              placeholder={t('cipherGrid.clueWordPlaceholder')}
              maxLength={20}
              className="flex-1 font-bold text-sm bg-stone-50 border-2 border-black p-2 outline-none focus:bg-amber-50"
            />
            <select
              data-testid="clue-count-select"
              value={clueCount}
              onChange={(e) => {
                const val = e.target.value;
                setClueCount(val === 'UNLIMITED' ? 'UNLIMITED' : parseInt(val, 10));
              }}
              className="font-black text-sm bg-stone-50 border-2 border-black px-2 py-2 outline-none cursor-pointer"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="UNLIMITED">∞</option>
            </select>
          </div>
          <button
            data-testid="give-clue-btn"
            disabled={!clueWord.trim()}
            onClick={() => {
              if (clueWord.trim()) {
                actions.cipherGiveClue(clueWord.trim(), clueCount);
                setClueWord('');
              }
            }}
            className={`w-full sm:w-auto px-6 py-2 text-sm font-black uppercase border-2 border-black transition-all ${
              clueWord.trim()
                ? 'bg-emerald-400 hover:bg-emerald-300 shadow-[3px_3px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5'
                : 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed'
            }`}
          >
            {t('cipherGrid.giveClueBtn')}
          </button>
        </div>
      )}

      {/* Clue Banner (Active during DECODING) */}
      {state.phase === 'DECODING' && state.currentClue && (
        <div
          data-testid="current-clue-banner"
          className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900 text-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000]"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📡</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-amber-400 font-black">
                  Clue:
                </span>
                <span className="text-lg font-black tracking-wide text-white">
                  &ldquo;{state.currentClue.word}&rdquo;
                </span>
                <span className="text-sm font-mono font-black bg-amber-400 text-black px-2 py-0.5 border border-black">
                  {state.currentClue.count === 'UNLIMITED' ? '∞' : state.currentClue.count}
                </span>
              </div>
              <div className="text-xs text-stone-300 font-bold mt-0.5">
                {t('cipherGrid.guessesLeft')}:{' '}
                <span className="text-amber-400 font-mono font-black">
                  {guessesRemaining === 'UNLIMITED' ? '∞' : guessesRemaining}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* End Turn button for active Trackers */}
            {isMyTeamDecoding && (
              <button
                data-testid="end-turn-btn"
                disabled={!canEndTurn}
                onClick={() => actions.cipherEndTurn()}
                className={`text-xs font-black uppercase px-4 py-2 border-2 border-black transition-all ${
                  canEndTurn
                    ? 'bg-amber-400 text-black shadow-[2px_2px_0_0_#000] hover:bg-amber-300 active:translate-y-0.5'
                    : 'bg-stone-700 text-stone-400 border-stone-600 cursor-not-allowed'
                }`}
              >
                🏁 {t('cipherGrid.endTurnBtn')}
              </button>
            )}

            {/* Challenge Clue button for opposing team */}
            {canChallenge && (
              <button
                data-testid="challenge-clue-btn"
                onClick={() => setShowChallengeDialog(true)}
                className="text-xs font-black uppercase px-4 py-2 bg-red-600 text-white border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-red-500 active:translate-y-0.5"
              >
                ⚠️ {t('cipherGrid.challengeClueBtn')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5x5 Card Grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {state.board.map((card, idx) => {
          const isRevealed = card.revealed;
          const isSelected = selectedCardIndex === idx;

          // Determine card role/color styling:
          let cardType: CipherCardType | null = null;
          if (isRevealed) {
            cardType = card.type ?? null;
          } else if (isLead && isPeekActive && privateKeycard) {
            cardType = privateKeycard[idx] ?? null;
          }

          // Visual styles based on card type
          let tileStyle =
            'bg-white text-black border-2 sm:border-4 border-black hover:bg-amber-50 shadow-[2px_2px_0_0_#000]';

          if (isRevealed) {
            if (cardType === 'SOLAR') {
              tileStyle =
                'bg-amber-400 text-black border-2 sm:border-4 border-black shadow-[1px_1px_0_0_#000]';
            } else if (cardType === 'LUNAR') {
              tileStyle =
                'bg-blue-600 text-white border-2 sm:border-4 border-black shadow-[1px_1px_0_0_#000]';
            } else if (cardType === 'DECOY') {
              tileStyle =
                'bg-stone-300 text-stone-600 border-2 sm:border-4 border-black line-through shadow-[1px_1px_0_0_#000]';
            } else if (cardType === 'VIRUS') {
              tileStyle =
                'bg-zinc-950 text-red-500 border-2 sm:border-4 border-red-600 font-black shadow-[1px_1px_0_0_#dc2626]';
            }
          } else if (isLead && isPeekActive && cardType) {
            // Peek view for leads
            if (cardType === 'SOLAR') {
              tileStyle = 'bg-amber-100 text-black border-2 sm:border-4 border-amber-500 font-bold';
            } else if (cardType === 'LUNAR') {
              tileStyle =
                'bg-blue-100 text-blue-950 border-2 sm:border-4 border-blue-500 font-bold';
            } else if (cardType === 'DECOY') {
              tileStyle = 'bg-stone-200 text-stone-700 border-2 sm:border-4 border-stone-400';
            } else if (cardType === 'VIRUS') {
              tileStyle = 'bg-zinc-900 text-red-400 border-2 sm:border-4 border-red-600 font-black';
            }
          }

          // Teammate pings on this card
          const pingingSockets = Object.entries(state.pings || {})
            .filter(([, cardIndex]) => cardIndex === idx)
            .map(([sId]) => sId);

          return (
            <button
              key={idx}
              data-testid={`card-tile-${idx}`}
              data-word={card.word}
              data-revealed={isRevealed}
              disabled={isRevealed || isRoundEnd}
              onClick={() => {
                if (!isRevealed && !isRoundEnd) {
                  setSelectedCardIndex(idx === selectedCardIndex ? null : idx);
                }
              }}
              className={`relative flex flex-col items-center justify-center p-1.5 sm:p-3 min-h-[60px] sm:min-h-[85px] text-center select-none transition-all ${tileStyle} ${
                isSelected ? 'ring-4 ring-black ring-offset-2 scale-[1.03] z-10' : ''
              }`}
            >
              {/* Card Word */}
              <span className="font-black text-xs sm:text-base leading-tight uppercase tracking-tight break-words max-w-full">
                {card.word}
              </span>

              {/* Reveal Badge Indicator */}
              {isRevealed && (
                <span className="text-[10px] font-mono uppercase tracking-widest mt-1 opacity-90">
                  {cardType === 'SOLAR' && '☀️ Solar'}
                  {cardType === 'LUNAR' && '🌙 Lunar'}
                  {cardType === 'DECOY' && 'Neutral'}
                  {cardType === 'VIRUS' && '💀 Virus'}
                </span>
              )}

              {/* Peek badge indicator for Lead */}
              {!isRevealed && isLead && isPeekActive && cardType && (
                <span className="absolute top-1 right-1 text-[9px] font-mono font-black uppercase">
                  {cardType === 'SOLAR' && '☀️'}
                  {cardType === 'LUNAR' && '🌙'}
                  {cardType === 'DECOY' && '⚪'}
                  {cardType === 'VIRUS' && '💀'}
                </span>
              )}

              {/* Player Pings */}
              {pingingSockets.length > 0 && !isRevealed && (
                <div className="absolute bottom-1 left-1 flex gap-1 items-center">
                  {pingingSockets.map((sId, pIdx) => {
                    const pTeam = state.teams[sId];
                    return (
                      <span
                        key={pIdx}
                        className={`text-[9px] font-black px-1 border border-black ${
                          pTeam === 'SOLAR' ? 'bg-amber-400 text-black' : 'bg-blue-600 text-white'
                        }`}
                      >
                        📍
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Card Action Drawer / Controls (For Touch & Mobile Friendly Operation) */}
      {selectedCard && !selectedCard.revealed && !isRoundEnd && (
        <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0_0_#000] flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase bg-stone-100 border border-black px-2 py-1">
              Selected Card:
            </span>
            <span className="text-base font-black uppercase tracking-wide">
              {selectedCard.word}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Ping button (Available to any teammate tracker) */}
            {isTracker && selectedCardIndex !== null && (
              <button
                data-testid="ping-card-btn"
                onClick={() => actions.cipherPingCard(selectedCardIndex)}
                className="flex-1 sm:flex-none text-xs font-black uppercase px-4 py-2 bg-stone-100 hover:bg-stone-200 border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5"
              >
                📍 {t('cipherGrid.pingCardBtn')}
              </button>
            )}

            {/* Reveal button (Active turn trackers only during DECODING) */}
            {isMyTeamDecoding && selectedCardIndex !== null && (
              <button
                data-testid="reveal-card-btn"
                onClick={() => {
                  actions.cipherRevealCard(selectedCardIndex);
                  setSelectedCardIndex(null);
                }}
                className="flex-1 sm:flex-none text-xs font-black uppercase px-5 py-2 bg-amber-400 text-black hover:bg-amber-300 border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5"
              >
                🔍 {t('cipherGrid.revealCardBtn')}
              </button>
            )}

            <button
              onClick={() => setSelectedCardIndex(null)}
              className="text-xs font-bold text-stone-500 hover:text-black px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Round End Controls */}
      {isRoundEnd && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
          {isHost ? (
            <>
              <button
                data-testid="next-round-btn"
                onClick={() => actions.cipherNextRound()}
                className="px-6 py-2.5 bg-emerald-400 hover:bg-emerald-300 font-black text-sm uppercase border-2 border-black shadow-[3px_3px_0_0_#000] active:translate-y-0.5"
              >
                🔄 {t('cipherGrid.nextRoundBtn')}
              </button>
              <button
                data-testid="reset-to-lobby-btn"
                onClick={() => actions.cipherReset()}
                className="px-6 py-2.5 bg-white hover:bg-stone-100 font-black text-sm uppercase border-2 border-black shadow-[3px_3px_0_0_#000] active:translate-y-0.5"
              >
                🏠 {t('cipherGrid.backToLobby')}
              </button>
            </>
          ) : (
            <span className="text-sm font-bold text-stone-500 italic">
              {t('cipherGrid.waitingHostStart')}
            </span>
          )}
        </div>
      )}

      {/* Clue History Toggle & Drawer */}
      {state.history && state.history.length > 0 && (
        <div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0_0_#000]">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs font-black uppercase text-stone-700"
          >
            <span>
              📜 {t('cipherGrid.historyTitle')} ({state.history.length})
            </span>
            <span>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5 border-t border-black/20 pt-2 max-h-40 overflow-y-auto">
              {state.history.map((h, hIdx) => (
                <div
                  key={hIdx}
                  className="flex items-center justify-between text-xs font-bold bg-stone-50 p-1.5 border border-black/20"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1 py-0.5 text-[10px] border border-black ${
                        h.team === 'SOLAR' ? 'bg-amber-400 text-black' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {h.team}
                    </span>
                    <span className="font-mono text-[11px] uppercase">[{h.kind}]</span>
                    {h.word && (
                      <span>
                        &ldquo;{h.word}&rdquo; {h.count !== undefined && `× ${h.count}`}
                      </span>
                    )}
                    {h.cardType && (
                      <span className="text-[11px] font-mono">Card: {h.cardType}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Challenge Clue Confirmation Dialog */}
      <GameDialog
        open={showChallengeDialog}
        onClose={() => setShowChallengeDialog(false)}
        title={t('cipherGrid.challengeConfirmTitle')}
      >
        <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
          <h3 className="text-xl font-black uppercase text-red-600 flex items-center gap-2">
            ⚠️ {t('cipherGrid.challengeConfirmTitle')}
          </h3>
          <p className="text-sm font-bold text-stone-700">{t('cipherGrid.challengeConfirmDesc')}</p>
          {state.currentClue && (
            <div className="bg-stone-100 border-2 border-black p-3 font-mono font-black text-sm">
              Clue: &ldquo;{state.currentClue.word}&rdquo; × {state.currentClue.count}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              data-testid="cancel-challenge-btn"
              onClick={() => setShowChallengeDialog(false)}
              className="px-4 py-2 text-sm font-bold border-2 border-black hover:bg-stone-100"
            >
              {t('cipherGrid.cancel')}
            </button>
            <button
              data-testid="confirm-challenge-btn"
              onClick={() => {
                actions.cipherChallengeClue();
                setShowChallengeDialog(false);
              }}
              className="px-5 py-2 text-sm font-black uppercase bg-red-600 text-white border-2 border-black shadow-[3px_3px_0_0_#000] hover:bg-red-500 active:translate-y-0.5"
            >
              {t('cipherGrid.confirmChallenge')}
            </button>
          </div>
        </div>
      </GameDialog>
    </div>
  );
}
