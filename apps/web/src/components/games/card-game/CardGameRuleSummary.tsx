'use client';

import { CardGameConfig } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';

export function CardGameRuleSummary({ config }: { config?: CardGameConfig }) {
  const { t } = useTranslate();

  if (!config) {
    return (
      <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('cardGameRules.title')}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('cardGameRules.noConfig')}</p>
      </div>
    );
  }

  const actionNames = config.actions.allowed
    .map((kind) => t(`cardGameRules.actionNames.${kind}`))
    .join(' · ');
  const multiplierList = Object.entries(config.scoring.multipliers)
    .map(([tag, value]) => `${t(`cardGameRules.outcomes.${tag}`)} ×${value}`)
    .join(' · ');
  const presetLabel = config.preset === 'POK_DENG' ? t('lobby.gameNames.pokDeng') : config.preset;

  const sections: { title: string; rows: string[] }[] = [
    {
      title: t('cardGameRules.deck'),
      rows: [t('cardGameRules.deckValue', { copies: config.deck.copies })],
    },
    {
      title: t('cardGameRules.dealing'),
      rows: [
        t('cardGameRules.dealValue', {
          cards: config.deal.cardsPerPlayer,
          mode: t(`cardGameRules.dealModes.${config.deal.countMode}`),
        }),
        `${t('cardGameRules.starter')}: ${t(`cardGameRules.starterPolicies.${config.deal.starterPolicy}`)}`,
      ],
    },
    {
      title: t('cardGameRules.actions'),
      rows: [
        actionNames,
        ...(config.actions.timeoutSeconds > 0
          ? [
              t('cardGameRules.turnTimer', {
                seconds: config.actions.timeoutSeconds,
                auto: t(`cardGameRules.actionNames.${config.actions.autoAction}`),
              }),
            ]
          : []),
      ],
    },
    {
      title: t('cardGameRules.piles'),
      rows: [
        t(`cardGameRules.exhaustionPolicies.${config.piles.stockExhaustion}`),
        ...(config.piles.reserveSize > 0
          ? [t('cardGameRules.reserveValue', { size: config.piles.reserveSize })]
          : []),
      ],
    },
    {
      title: t('cardGameRules.visibility'),
      rows: [
        config.visibility.revealHandsAtEnd
          ? t('cardGameRules.showHandsAtEnd')
          : t('cardGameRules.hideHandsAtEnd'),
        config.visibility.othersHandCountsVisible
          ? t('cardGameRules.showHandCounts')
          : t('cardGameRules.hideHandCounts'),
      ],
    },
    {
      title: t('cardGameRules.scoring'),
      rows: [
        t('cardGameRules.chipsValue', {
          chips: config.scoring.startingChips,
          stake: config.scoring.baseStake,
        }),
        t('cardGameRules.tieLine', {
          policy: t(`cardGameRules.tiePolicies.${config.scoring.tiePolicy}`),
        }),
        `${t('cardGameRules.multipliers')}: ${multiplierList}`,
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-amber-100 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
          {t('cardGameRules.title')} · {presetLabel}
        </h3>
        <p className="leading-relaxed font-bold text-black">{t('cardGameRules.mod10Note')}</p>
      </div>
      {sections.map((section) => (
        <div
          key={section.title}
          className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <h3 className="text-black font-black uppercase tracking-wider text-sm mb-2 border-b-4 border-black border-dashed pb-1">
            {section.title}
          </h3>
          <ul className="space-y-1 font-bold text-black">
            {section.rows.map((row) => (
              <li key={row}>• {row}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
