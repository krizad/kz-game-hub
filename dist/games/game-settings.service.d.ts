import { GameSettingsMap, GameType, TttModeFlag } from '@repo/types';
export type SettingsKey = GameType | TttModeFlag;
export declare class GameSettingsService {
    private readonly logger;
    private readonly enabled;
    load(): Promise<void>;
    isEnabled(key: SettingsKey): boolean;
    snapshot(): GameSettingsMap;
    setEnabled(key: SettingsKey, enabled: boolean): Promise<void>;
}
