'use client';

import { useTranslate } from '@/hooks/useTranslate';

export function ThirtyOneRules() {
  const { t } = useTranslate();

  return (
    <div className="flex flex-col gap-4 text-sm text-slate-800">
      <p className="font-bold leading-relaxed">{t('thirtyOne.rules.intro')}</p>

      <section className="bg-amber-50 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
        <h4 className="mb-1 font-black uppercase text-black">
          🃏 {t('thirtyOne.rules.setupTitle')}
        </h4>
        <p className="font-bold leading-relaxed">{t('thirtyOne.rules.setupBody')}</p>
      </section>

      <section className="bg-emerald-50 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
        <h4 className="mb-1.5 font-black uppercase text-black">
          🧮 {t('thirtyOne.rules.scoringTitle')}
        </h4>
        <ul className="list-disc space-y-1 pl-5 font-bold">
          <li>{t('thirtyOne.rules.scoringA')}</li>
          <li>{t('thirtyOne.rules.scoringFace')}</li>
          <li>{t('thirtyOne.rules.scoringNum')}</li>
          <li className="text-emerald-800">{t('thirtyOne.rules.scoringBlitz')}</li>
          <li className="text-indigo-800">{t('thirtyOne.rules.scoringTrips')}</li>
        </ul>
        <p className="mt-2 rounded border border-black/20 bg-white px-2.5 py-1.5 text-xs font-bold">
          {t('thirtyOne.rules.scoringExample')}
        </p>
      </section>

      <section className="bg-sky-50 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
        <h4 className="mb-1.5 font-black uppercase text-black">
          🔄 {t('thirtyOne.rules.turnsTitle')}
        </h4>
        <ul className="list-disc space-y-1 pl-5 font-bold">
          <li>{t('thirtyOne.rules.turnDraw')}</li>
          <li className="text-rose-700">{t('thirtyOne.rules.turnAntiStall')}</li>
          <li>{t('thirtyOne.rules.turnKnock')}</li>
        </ul>
      </section>

      <section className="bg-rose-50 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
        <h4 className="mb-1.5 font-black uppercase text-black">
          ⚡ {t('thirtyOne.rules.showdownTitle')}
        </h4>
        <ul className="list-disc space-y-1 pl-5 font-bold">
          <li>{t('thirtyOne.rules.showdownBlitz')}</li>
          <li>{t('thirtyOne.rules.showdownKnock')}</li>
          <li className="text-rose-800">{t('thirtyOne.rules.showdownPenalty')}</li>
        </ul>
      </section>

      <section className="bg-violet-50 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
        <h4 className="mb-1.5 font-black uppercase text-black">
          🚌 {t('thirtyOne.rules.edgeTitle')}
        </h4>
        <ul className="list-disc space-y-1 pl-5 font-bold">
          <li>{t('thirtyOne.rules.edgeReshuffle')}</li>
          <li>{t('thirtyOne.rules.edgeWelfare')}</li>
          <li className="text-emerald-800">{t('thirtyOne.rules.edgeWin')}</li>
        </ul>
      </section>
    </div>
  );
}
