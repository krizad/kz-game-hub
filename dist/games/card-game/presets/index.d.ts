import { CardGameConfig, CardGamePreset, CardGamePresetDefinition } from '@repo/types';
export declare const CARD_GAME_PRESETS: Record<CardGamePreset, CardGamePresetDefinition>;
export declare function presetForConfig(config?: Pick<CardGameConfig, 'preset'>): CardGamePresetDefinition;
