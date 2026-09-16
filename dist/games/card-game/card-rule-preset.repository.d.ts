import { CardGameConfig, CardGamePresetDefinition } from '@repo/types';
export interface PublishRulesResult {
    ok: boolean;
    shareCode?: string;
    error?: string;
}
export interface ImportRulesResult {
    ok: boolean;
    config?: CardGameConfig;
    error?: string;
}
export declare class CardRulePresetRepository {
    publish(config: CardGameConfig, preset: CardGamePresetDefinition): Promise<PublishRulesResult>;
    importByCode(shareCode: string, preset: CardGamePresetDefinition): Promise<ImportRulesResult>;
    private generateShareCode;
    private isDuplicateShareCode;
}
