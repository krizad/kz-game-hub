'use client';

import { TurnTimerSelect } from '@/components/core/TurnTimerSelect';

/** Lobby settings for Detective Club — currently just the phase timer. */
export function DetectiveClubSettings() {
  return <TurnTimerSelect configKey="detectiveClubTurnSeconds" />;
}
