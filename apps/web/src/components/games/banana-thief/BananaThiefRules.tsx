'use client';

import { BananaThiefRole, BananaThiefSpecial } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { RoleArtwork } from './RoleArtwork';

/** Team badge colors for the goals grid. */
const TEAM_BADGE: Record<string, string> = {
  thief: 'bg-red-400',
  mice: 'bg-lime-300',
  neutral: 'bg-emerald-300',
};

export function BananaThiefRules() {
  const { t } = useTranslate();

  const goals = [
    { role: BananaThiefRole.THIEF, team: 'thief', text: t('rules.bananaThief.goalThief') },
    { role: BananaThiefRole.MOUSE, team: 'mice', text: t('rules.bananaThief.goalMouse') },
    { role: BananaThiefRole.FOLLOWER, team: 'thief', text: t('rules.bananaThief.goalFollower') },
    {
      role: BananaThiefSpecial.DETECTIVE,
      team: 'mice',
      text: t('rules.bananaThief.goalDetective'),
    },
    {
      role: BananaThiefSpecial.SYCOPHANT,
      team: 'thief',
      text: t('rules.bananaThief.goalSycophant'),
    },
    { role: BananaThiefSpecial.TWINS, team: 'mice', text: t('rules.bananaThief.goalTwins') },
    {
      role: BananaThiefSpecial.SCAPEGOAT,
      team: 'neutral',
      text: t('rules.bananaThief.goalScapegoat'),
    },
  ];
  const teamLabel = (team: string) =>
    team === 'thief'
      ? t('rules.bananaThief.teamThief')
      : team === 'neutral'
        ? t('rules.bananaThief.teamNeutral')
        : t('rules.bananaThief.teamMice');

  return (
    <div className="space-y-4 text-sm font-bold">
      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.setupTitle')}</h4>
        <p className="opacity-80">{t('rules.bananaThief.setupDesc')}</p>
      </div>

      {/* Roles & goals: card art + team badge + win condition */}
      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.goalsTitle')}</h4>
        <div className="mt-2 space-y-2">
          {goals.map(({ role, team, text }) => (
            <div
              key={role}
              className="flex items-stretch gap-2 border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000]"
            >
              <div className="shrink-0 self-center">
                <RoleArtwork role={role} className="h-20" compact />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={`inline-block border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black ${TEAM_BADGE[team]}`}
                >
                  {teamLabel(team)}
                </span>
                <p className="mt-1 text-xs font-bold opacity-80">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.nightTitle')}</h4>
        <p className="opacity-80">{t('rules.bananaThief.nightDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.peekTitle')}</h4>
        <p className="opacity-80">{t('rules.bananaThief.peekDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.dayTitle')}</h4>
        <p className="opacity-80">{t('rules.bananaThief.dayDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.winTitle')}</h4>
        <p className="opacity-80">{t('rules.bananaThief.winDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.bananaThief.dlcTitle')}</h4>
        <ul className="list-disc list-inside opacity-80 space-y-1">
          <li>{t('rules.bananaThief.dlcDetective')}</li>
          <li>{t('rules.bananaThief.dlcSycophant')}</li>
          <li>{t('rules.bananaThief.dlcTwins')}</li>
          <li>{t('rules.bananaThief.dlcScapegoat')}</li>
        </ul>
        <p className="opacity-60 mt-1">{t('rules.bananaThief.dlcNote')}</p>
      </div>
    </div>
  );
}
