import { GameSettingsMap, GameType } from '@repo/types';
export declare class GameSettingsService {
    private readonly logger;
    private readonly enabled;
    load(): Promise<void>;
    isEnabled(gameType: GameType): boolean;
    snapshot(): GameSettingsMap;
    setEnabled(gameType: GameType, enabled: boolean): Promise<void>;
}
