'use client';

import { useState } from 'react';
import { PokerPublicState } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { Sparkles, ChevronDown, ChevronUp, Layers, Flame, Info, CheckCircle2 } from 'lucide-react';

interface PokerDealerGuideProps {
  state: PokerPublicState;
  playerName: Record<string, string>;
  socketId: string;
}

export function PokerDealerGuide({ state, playerName, socketId }: PokerDealerGuideProps) {
  const { t } = useTranslate();
  const [showChecklist, setShowChecklist] = useState(false);

  const phase = state.phase;
  const isDealer = state.dealerId === socketId;
  const dealerName = state.dealerId ? (playerName[state.dealerId] ?? '???') : '-';

  // Physical board configuration per phase
  const burnCount = phase === 'PREFLOP' ? 0 : phase === 'FLOP' ? 1 : phase === 'TURN' ? 2 : 3; // RIVER, SHOWDOWN, HAND_RESULT

  const activeBoardSlots =
    phase === 'PREFLOP' ? 0 : phase === 'FLOP' ? 3 : phase === 'TURN' ? 4 : 5; // RIVER, SHOWDOWN, HAND_RESULT

  const checklistItems = [
    {
      icon: '🃏',
      name: t('poker.dealerGuide.checklist.deck'),
      desc: t('poker.dealerGuide.checklist.deckDesc'),
    },
    {
      icon: '🔘',
      name: t('poker.dealerGuide.checklist.dealerButton'),
      desc: t('poker.dealerGuide.checklist.dealerButtonDesc'),
    },
    {
      icon: '🎴',
      name: t('poker.dealerGuide.checklist.cutCard'),
      desc: t('poker.dealerGuide.checklist.cutCardDesc'),
    },
    {
      icon: '🗑️',
      name: t('poker.dealerGuide.checklist.burnPile'),
      desc: t('poker.dealerGuide.checklist.burnPileDesc'),
    },
    {
      icon: '🗂️',
      name: t('poker.dealerGuide.checklist.communityArea'),
      desc: t('poker.dealerGuide.checklist.communityAreaDesc'),
    },
    {
      icon: '📱',
      name: t('poker.dealerGuide.checklist.appChips'),
      desc: t('poker.dealerGuide.checklist.appChipsDesc'),
    },
  ];

  const stepsForPhase: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const stepKey = `poker.dealerGuide.steps.${phase}.step${i}`;
    const stepText = t(stepKey);
    // If translation key is returned unchanged, there are no more steps
    if (stepText && stepText !== stepKey) {
      stepsForPhase.push(stepText);
    }
  }

  const actionHeadline = t(`poker.dealerGuide.steps.${phase}.action`);

  return (
    <div
      className="flex flex-col gap-2 p-2.5 sm:p-3 bg-emerald-800/10 border-4 border-black rounded shadow-[2px_2px_0_0_#000]"
      data-testid="poker-dealer-guide-wrapper"
    >
      {/* Top Header: Mode & Dealer identity */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 font-black text-xs uppercase px-2 py-0.5 bg-black text-white rounded">
            <Layers size={13} />
            {t('poker.dealerGuide.title')}
          </span>
          <span className="font-bold text-xs text-slate-800">
            {t('poker.dealerGuide.currentDealer', { name: dealerName })}
          </span>
          {isDealer && (
            <span className="px-2 py-0.5 bg-amber-300 border-2 border-black font-black text-[10px] uppercase shadow-[1px_1px_0_0_#000] animate-bounce">
              {t('poker.dealerGuide.youAreDealer')}
            </span>
          )}
        </div>

        {/* Toggle Real Table Checklist */}
        <button
          type="button"
          data-testid="poker-toggle-checklist"
          onClick={() => setShowChecklist((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-black px-2 py-1 bg-white hover:bg-amber-100 border-2 border-black rounded shadow-[1px_1px_0_0_#000] transition-colors"
        >
          <span>
            📋{' '}
            {showChecklist
              ? t('poker.dealerGuide.hideChecklist')
              : t('poker.dealerGuide.tableChecklistToggle')}
          </span>
          {showChecklist ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Real Table Setup Checklist (Expandable) */}
      {showChecklist && (
        <div
          className="border-2 border-black bg-amber-50 p-2.5 rounded shadow-[2px_2px_0_0_#000] flex flex-col gap-2"
          data-testid="poker-table-checklist"
        >
          <div className="flex items-center justify-between border-b-2 border-black/20 pb-1">
            <span className="font-black text-xs uppercase flex items-center gap-1">
              <span>📋</span> {t('poker.dealerGuide.tableChecklistTitle')}
            </span>
            <span className="text-[10px] text-slate-500 font-bold">
              Texas Hold&apos;em Physical Setup
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {checklistItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border-2 border-black p-2 rounded flex flex-col gap-0.5 shadow-[1px_1px_0_0_#000]"
              >
                <span className="font-black text-xs flex items-center gap-1">
                  <span>{item.icon}</span> {item.name}
                </span>
                <span className="text-[11px] text-slate-600 font-semibold leading-tight">
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Physical Board & Burn Card Layout Visualization */}
      <div className="flex flex-col gap-1 bg-white/80 border-2 border-black p-2 rounded">
        <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-600 px-0.5">
          <span className="flex items-center gap-1">
            <Info size={11} /> {t('poker.dealerGuide.physicalBoardState')}
          </span>
          <span className="text-amber-800 font-bold">
            {t('poker.dealerGuide.burnCount', { count: burnCount })}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-1">
          {/* Burn Card indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-1.5 border-2 border-black rounded text-[10px] sm:text-xs font-black transition-all ${
              burnCount > 0
                ? 'bg-amber-200 text-amber-950 shadow-[1px_1px_0_0_#000]'
                : 'bg-slate-100 text-slate-400 border-dashed'
            }`}
          >
            <Flame size={13} className={burnCount > 0 ? 'text-amber-600 fill-amber-500' : ''} />
            <span>
              {t('poker.dealerGuide.burnCard')}: {burnCount}/3
            </span>
          </div>

          <div className="h-6 w-[2px] bg-black/20" />

          {/* 5 Physical Board Slots */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, index) => {
              const isSlotActive = index < activeBoardSlots;
              const slotStage = index <= 2 ? 'FLOP' : index === 3 ? 'TURN' : 'RIVER';
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center justify-center w-12 h-14 sm:w-14 sm:h-16 rounded border-2 transition-all ${
                    isSlotActive
                      ? 'bg-white border-black font-black shadow-[2px_2px_0_0_#000]'
                      : 'bg-slate-50/60 border-dashed border-slate-300 font-bold text-slate-400'
                  }`}
                >
                  <span
                    className={`text-[10px] sm:text-xs font-black ${isSlotActive ? 'text-black' : 'text-slate-400'}`}
                  >
                    {isSlotActive ? '🎴' : '⏳'}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-tight">
                    {slotStage}
                  </span>
                  {index <= 2 && (
                    <span className="text-[8px] font-bold opacity-60">#{index + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Dealer Guidance Box for Current Phase */}
      <div
        className="flex flex-col gap-1.5 p-2.5 sm:p-3 bg-white border-2 border-black rounded shadow-[2px_2px_0_0_#000]"
        data-testid="poker-dealer-guide"
      >
        <div className="flex items-center justify-between flex-wrap gap-1 border-b-2 border-black/10 pb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 bg-lime-300 border-2 border-black font-black text-xs uppercase shadow-[1px_1px_0_0_#000]">
              {t(`poker.table.phase.${phase}`)}
            </span>
            <span className="font-black text-xs sm:text-sm text-black">{actionHeadline}</span>
          </div>
          {isDealer && (
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-black rounded flex items-center gap-1">
              <Sparkles size={11} /> {t('poker.dealerGuide.youAreDealer')}
            </span>
          )}
        </div>

        {/* Step-by-step duties */}
        <div className="flex flex-col gap-1.5 pt-1">
          {stepsForPhase.map((step, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-800 font-bold">
              <CheckCircle2 size={13} className="text-emerald-700 shrink-0 mt-0.5" />
              <span>{step}</span>
            </div>
          ))}
        </div>

        {/* Informative footer note */}
        <div className="text-[10px] text-slate-500 font-bold pt-1 border-t border-black/10">
          {t('poker.dealerGuide.boardPhysicalNote')}
        </div>
      </div>
    </div>
  );
}
