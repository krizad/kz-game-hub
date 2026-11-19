'use client';

import { TurnTimerSelect } from '@/components/core/TurnTimerSelect';

/** Lobby settings for Sounds Fishy — currently just the phase timer. */
export function SoundsFishySettings() {
  return <TurnTimerSelect configKey="soundsFishyTurnSeconds" />;
}
