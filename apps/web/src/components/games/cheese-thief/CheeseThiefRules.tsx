'use client';

import { CheeseThiefRole, CheeseThiefSpecial } from '@repo/types';
import { useTranslate } from '@/hooks/useTranslate';
import { RoleArtwork } from './RoleArtwork';

/** Team badge colors for the goals grid. */
const TEAM_BADGE: Record<string, string> = {
  thief: 'bg-red-400',
  mice: 'bg-lime-300',
  neutral: 'bg-emerald-300',
};

export function CheeseThiefRules() {
  const { t } = useTranslate();

  const goals = [
    { role: CheeseThiefRole.THIEF, team: 'thief', text: t('rules.cheeseThief.goalThief') },
    { role: CheeseThiefRole.MOUSE, team: 'mice', text: t('rules.cheeseThief.goalMouse') },
    { role: CheeseThiefRole.FOLLOWER, team: 'thief', text: t('rules.cheeseThief.goalFollower') },
    {
      role: CheeseThiefSpecial.DETECTIVE,
      team: 'mice',
      text: t('rules.cheeseThief.goalDetective'),
    },
    {
      role: CheeseThiefSpecial.SYCOPHANT,
      team: 'thief',
      text: t('rules.cheeseThief.goalSycophant'),
    },
    { role: CheeseThiefSpecial.TWINS, team: 'mice', text: t('rules.cheeseThief.goalTwins') },
    {
      role: CheeseThiefSpecial.SCAPEGOAT,
      team: 'neutral',
      text: t('rules.cheeseThief.goalScapegoat'),
    },
  ];
  const teamLabel = (team: string) =>
    team === 'thief'
      ? t('rules.cheeseThief.teamThief')
      : team === 'neutral'
        ? t('rules.cheeseThief.teamNeutral')
        : t('rules.cheeseThief.teamMice');

  return (
    <div className="space-y-4 text-sm font-bold">
      <div>
        <h4 className="font-black uppercase">{t('rules.cheeseThief.setupTitle')}</h4>
        <p className="opacity-80">{t('rules.cheeseThief.setupDesc')}</p>
      </div>

      {/* Roles & goals: card art + team badge + win condition */}
      <div>
        <h4 className="font-black uppercase">{t('rules.cheeseThief.goalsTitle')}</h4>
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
        <h4 className="font-black uppercase">{t('rules.cheeseThief.nightTitle')}</h4>
        <p className="opacity-80">{t('rules.cheeseThief.nightDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.cheeseThief.peekTitle')}</h4>
        <p className="opacity-80">{t('rules.cheeseThief.peekDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.cheeseThief.dayTitle')}</h4>
        <p className="opacity-80">{t('rules.cheeseThief.dayDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.cheeseThief.winTitle')}</h4>
        <p className="opacity-80">{t('rules.cheeseThief.winDesc')}</p>
      </div>
      <div>
        <h4 className="font-black uppercase">{t('rules.cheeseThief.dlcTitle')}</h4>
        <ul className="list-disc list-inside opacity-80 space-y-1">
          <li>{t('rules.cheeseThief.dlcDetective')}</li>
          <li>{t('rules.cheeseThief.dlcSycophant')}</li>
          <li>{t('rules.cheeseThief.dlcTwins')}</li>
          <li>{t('rules.cheeseThief.dlcScapegoat')}</li>
        </ul>
        <p className="opacity-60 mt-1">{t('rules.cheeseThief.dlcNote')}</p>
      </div>
    </div>
  );
}
