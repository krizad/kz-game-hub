'use client';

import { useTranslate } from '@/hooks/useTranslate';

/** Rules modal content for Battleship (ยุทธการเรือรบ) — ADR 0016 */
export function BattleshipRules() {
  const { t } = useTranslate();

  const ships = [
    { name: t('battleship.carrier'), length: 5, icon: '🚢' },
    { name: t('battleship.battleship'), length: 4, icon: '🛳️' },
    { name: t('battleship.cruiser'), length: 3, icon: '🛥️' },
    { name: t('battleship.submarine'), length: 3, icon: '🌊' },
    { name: t('battleship.destroyer'), length: 2, icon: '🚤' },
  ];

  return (
    <div className="flex flex-col gap-4 text-sm font-bold">
      <div className="p-3 bg-amber-100 border-2 border-black rounded-lg">
        <p className="font-black text-amber-950">{t('battleship.rulesOverview')}</p>
      </div>

      <section>
        <h4 className="font-black uppercase tracking-widest text-slate-900 mb-1">
          ⚓ {t('battleship.placementTitle')}
        </h4>
        <p className="text-slate-700">{t('battleship.rulesPlacement')}</p>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest text-slate-900 mb-1">
          🎯 {t('battleship.rulesFiring')}
        </h4>
      </section>

      <section className="p-3 bg-red-100 border-2 border-black rounded-lg">
        <h4 className="font-black uppercase tracking-widest text-red-950 mb-1">
          💥 {t('battleship.collision')}
        </h4>
        <p className="text-red-900">{t('battleship.rulesCollision')}</p>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest text-slate-900 mb-2">
          🚢 {t('battleship.gridPreset')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ships.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between p-2 bg-slate-100 border-2 border-black rounded"
            >
              <span className="flex items-center gap-2">
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </span>
              <span className="font-mono text-xs bg-black text-white px-1.5 py-0.5 rounded">
                {s.length} ช่อง
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="font-black uppercase tracking-widest text-slate-900 mb-1">
          🏆 {t('battleship.victory')}
        </h4>
        <p className="text-slate-700">{t('battleship.rulesWin')}</p>
      </section>
    </div>
  );
}
