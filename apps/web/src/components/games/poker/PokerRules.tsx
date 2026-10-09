'use client';

import { useTranslate } from '@/hooks/useTranslate';
import { PokerHandRankings } from './PokerHandRankings';

/** Rules modal tab content for POKER. */
export function PokerRules() {
  const { t } = useTranslate();

  return (
    <div className="flex flex-col gap-4" data-testid="poker-rules">
      <section>
        <h3 className="font-black text-lg uppercase">{t('poker.rules.onlineTitle')}</h3>
        <p className="text-sm mt-1">{t('poker.rules.onlineBody')}</p>
      </section>
      <section>
        <h3 className="font-black text-lg uppercase">{t('poker.rules.ledgerTitle')}</h3>
        <p className="text-sm mt-1">{t('poker.rules.ledgerBody')}</p>
      </section>
      <section>
        <h3 className="font-black text-lg uppercase">{t('poker.rules.bettingTitle')}</h3>
        <p className="text-sm mt-1">{t('poker.rules.bettingBody')}</p>
      </section>
      <section>
        <h3 className="font-black text-lg uppercase">{t('poker.rules.hostTitle')}</h3>
        <p className="text-sm mt-1">{t('poker.rules.hostBody')}</p>
      </section>
      <section>
        <h3 className="font-black text-lg uppercase">{t('poker.rules.handsTitle')}</h3>
        <div className="mt-2">
          <PokerHandRankings />
        </div>
      </section>
    </div>
  );
}
