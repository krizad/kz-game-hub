import { CardGameConfig, CardGamePreset, CardGamePresetDefinition } from '@repo/types';
import { POK_DENG_PRESET } from './pok-deng.preset';
import { SLAVE_PRESET } from './slave.preset';
import { SAM_SIP_PRESET } from './sam-sip.preset';
import { OLD_MAID_PRESET } from './old-maid.preset';

/** Registry of every system preset, keyed by its public id. */
export const CARD_GAME_PRESETS: Record<CardGamePreset, CardGamePresetDefinition> = {
  POK_DENG: POK_DENG_PRESET,
  SLAVE: SLAVE_PRESET,
  SAM_SIP: SAM_SIP_PRESET,
  OLD_MAID: OLD_MAID_PRESET,
};

export function presetForConfig(config?: Pick<CardGameConfig, 'preset'>): CardGamePresetDefinition {
  return CARD_GAME_PRESETS[config?.preset ?? 'POK_DENG'];
}
