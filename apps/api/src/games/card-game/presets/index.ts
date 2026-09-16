import { CardGameConfig, CardGamePreset, CardGamePresetDefinition } from '@repo/types';
import { POK_DENG_PRESET } from './pok-deng.preset';
import { SLAVE_PRESET } from './slave.preset';

/** Registry of every system preset, keyed by its public id. */
export const CARD_GAME_PRESETS: Record<CardGamePreset, CardGamePresetDefinition> = {
  POK_DENG: POK_DENG_PRESET,
  SLAVE: SLAVE_PRESET,
};

export function presetForConfig(config?: Pick<CardGameConfig, 'preset'>): CardGamePresetDefinition {
  return CARD_GAME_PRESETS[config?.preset ?? 'POK_DENG'];
}
