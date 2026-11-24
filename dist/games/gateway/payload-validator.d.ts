import { GameType, TttModeFlag } from '@repo/types';
export declare function isValidName(value: unknown): value is string;
export declare function isSettingsKey(value: unknown): value is GameType | TttModeFlag;
export declare function hasSafeValues(value: unknown, depth?: number): boolean;
export declare function isValidPayload(event: string, payload: unknown): boolean;
