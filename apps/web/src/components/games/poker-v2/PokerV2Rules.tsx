'use client';

import { useTranslate } from '@/hooks/useTranslate';

const HAND_ORDER = [
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'ONE_PAIR',
  'HIGH_CARD',
] as const;

/** Rules-modal content for Poker V2. */
export function PokerV2Rules() {
  const { t } = useTranslate();

  const steps = [
    t('pokerV2.rules.step1'),
    t('pokerV2.rules.step2'),
    t('pokerV2.rules.step3'),
    t('pokerV2.rules.step4'),
    t('pokerV2.rules.step5'),
  ];

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-bold">{t('pokerV2.rules.intro')}</p>

      <section>
        <h4 className="mb-1 font-black uppercase">{t('pokerV2.rules.howToTitle')}</h4>
        <ol className="list-decimal space-y-1 pl-5 font-bold">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      <section>
        <h4 className="mb-1 font-black uppercase">{t('pokerV2.rules.winConTitle')}</h4>
        <p className="mb-1.5 font-bold">{t('pokerV2.rules.winConDesc')}</p>
        <ol className="list-decimal space-y-0.5 pl-5 font-bold">
          {HAND_ORDER.slice()
            .reverse()
            .map((hand) => (
              <li key={hand}>
                <strong>{t(`pokerV2.hands.${hand}`)}</strong>
              </li>
            ))}
        </ol>
      </section>

      <section>
        <h4 className="mb-1 font-black uppercase">{t('pokerV2.rules.advisorTitle')}</h4>
        <p className="font-bold">{t('pokerV2.rules.advisorDesc')}</p>
      </section>
    </div>
  );
}
