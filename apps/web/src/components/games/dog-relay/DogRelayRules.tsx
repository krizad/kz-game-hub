'use client';

import { DOG_RELAY_MIN_PLAYERS, DOG_RELAY_MAX_PLAYERS, DOG_RELAY_DISCUSSION_MS } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { DogRelayCardCatalog } from './DogRelayCardCatalog';

export function DogRelayRules() {
  const { t } = useTranslate();
  return (
    <article className="space-y-4 text-black">
      <h2 className="text-2xl font-black">{t('lobby.gameNames.dogRelay')}</h2>
      <p>
        {t('dogRelay.rulesIntro', {
          min: DOG_RELAY_MIN_PLAYERS,
          max: DOG_RELAY_MAX_PLAYERS,
          seconds: DOG_RELAY_DISCUSSION_MS / 1000,
        })}
      </p>
      <section className="space-y-3" aria-label={t('dogRelay.rolesAndGoals')}>
        <h3 className="text-xl font-black">{t('dogRelay.rolesAndGoals')}</h3>
        {(['LEADER', 'EVIL', 'GOOD'] as const).map((role) => (
          <div key={role} className="border-2 border-black bg-amber-50 p-3 space-y-2">
            <h4 className="font-black">{t(`dogRelay.role${role}`)}</h4>
            <p>{t(`dogRelay.roleHint${role}`)}</p>
            <p>
              <strong>{t('dogRelay.goal')}: </strong>
              {t(`dogRelay.roleGoal${role}`)}
            </p>
          </div>
        ))}
      </section>
      <p>{t('dogRelay.rulesLeaderSelection')}</p>
      <DogRelayCardCatalog />
      <ol className="list-decimal pl-6 space-y-3">
        {['rulesRoles', 'rulesRelay', 'rulesGuess', 'rulesVote', 'rulesPause'].map((key) => (
          <li key={key}>{t(`dogRelay.${key}`)}</li>
        ))}
      </ol>
    </article>
  );
}
