'use client';

import { useState } from 'react';
import { CardGamePreset, DealCountMode, GameType, RoomStatus, StarterPolicy, TiePolicy } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';

const PRESET_OPTIONS: CardGamePreset[] = ['POK_DENG', 'SLAVE', 'SAM_SIP', 'OLD_MAID'];

interface DealPreview {
  ok: boolean;
  cards: number;
  stock: number;
}

function computeDealPreview(
  deckSize: number,
  playerCount: number,
  cardsPerPlayer: number,
  countMode: DealCountMode,
): DealPreview {
  if (playerCount < 1) return { ok: false, cards: 0, stock: 0 };
  if (countMode === 'DEAL_ALL') {
    if (deckSize % playerCount !== 0) return { ok: false, cards: 0, stock: 0 };
    return { ok: true, cards: deckSize / playerCount, stock: 0 };
  }
  if (countMode === 'DEAL_ALL_UNEVEN') {
    const cards = Math.floor(deckSize / playerCount);
    if (cards < 1) return { ok: false, cards: 0, stock: 0 };
    return { ok: true, cards, stock: 0 };
  }
  const dealt = cardsPerPlayer * playerCount;
  if (dealt > deckSize) return { ok: false, cards: 0, stock: 0 };
  if (countMode === 'REJECT_IF_NOT_EVEN' && dealt !== deckSize) {
    return { ok: false, cards: 0, stock: 0 };
  }
  return { ok: true, cards: cardsPerPlayer, stock: deckSize - dealt };
}

export function CardGameSettings() {
  const {
    room,
    socketId,
    cardGameShareCode,
    cardGameRulesError,
    cardGameRulesLoading,
    updateConfig,
    cardGamePublishRules,
    cardGameImportRules,
  } = useGameStore();
  const { t } = useTranslate();
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!room || room.gameType !== GameType.CARD_GAME || room.status !== RoomStatus.LOBBY) return null;
  const config = room.cardGameConfig;
  if (!config) return null;

  const isHost = socketId === room.roomHostId;
  const disabled = !isHost || cardGameRulesLoading;
  const playerCount = room.players.filter((player) => !player.isViewer).length;
  const preview = computeDealPreview(
    52 * config.deck.copies,
    playerCount,
    config.deal.cardsPerPlayer,
    config.deal.countMode,
  );

  const allowedOptions = room.cardGameAllowedOptions;
  const starterPolicies: StarterPolicy[] = allowedOptions
    ? allowedOptions.deal
        .map((policy) => policy.starterPolicy)
        .filter((policy, index, list) => list.indexOf(policy) === index)
    : [];
  const tiePolicies: TiePolicy[] = allowedOptions
    ? allowedOptions.scoring
        .map((policy) => policy.tiePolicy)
        .filter((policy, index, list) => list.indexOf(policy) === index)
    : [];
  const actionPolicies = allowedOptions?.actions ?? [];

  const optionClass = (active: boolean) =>
    `px-3 py-1 border-4 border-black font-black uppercase text-xs transition-all ${
      active ? 'bg-lime-300 shadow-[2px_2px_0_0_#000]' : 'bg-white hover:bg-amber-100'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  const copyShareCode = async () => {
    if (!cardGameShareCode || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(cardGameShareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-3" data-testid="card-game-settings">
      <h5 className="text-sm font-black uppercase tracking-widest text-center">
        {t('cardGameSettings.title')}
      </h5>
      {!isHost && (
        <p className="text-xs font-bold text-center opacity-70">{t('cardGameSettings.hostOnly')}</p>
      )}

      <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2">
        <p className="text-xs font-black uppercase">{t('cardGameSettings.preset')}</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_OPTIONS.map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`card-game-preset-${preset.toLowerCase()}`}
              disabled={disabled}
              className={optionClass(config.preset === preset)}
              onClick={() => updateConfig({ cardGamePreset: preset })}
            >
              {t(`cardGameSettings.presets.${preset}`)}
            </button>
          ))}
        </div>
      </div>

      {starterPolicies.length > 1 && (
        <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2">
          <p className="text-xs font-black uppercase">{t('cardGameSettings.starter')}</p>
          <div className="flex gap-2 flex-wrap">
            {starterPolicies.map((policy) => (
              <button
                key={policy}
                type="button"
                data-testid={`card-game-starter-${policy}`}
                disabled={disabled}
                className={optionClass(config.deal.starterPolicy === policy)}
                onClick={() =>
                  updateConfig({}, { deal: { ...config.deal, starterPolicy: policy } })
                }
              >
                {t(`cardGameRules.starterPolicies.${policy}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {tiePolicies.length > 1 && (
        <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2">
          <p className="text-xs font-black uppercase">{t('cardGameSettings.tiePolicy')}</p>
          <div className="flex gap-2 flex-wrap">
            {tiePolicies.map((policy) => (
              <button
                key={policy}
                type="button"
                data-testid={`card-game-tie-${policy}`}
                disabled={disabled}
                className={optionClass(config.scoring.tiePolicy === policy)}
                onClick={() =>
                  updateConfig({}, { scoring: { ...config.scoring, tiePolicy: policy } })
                }
              >
                {t(`cardGameRules.tiePolicies.${policy}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionPolicies.length > 1 && (
        <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2">
          <p className="text-xs font-black uppercase">{t('cardGameSettings.turnTimer')}</p>
          <div className="flex gap-2 flex-wrap">
            {actionPolicies.map((policy) => (
              <button
                key={policy.timeoutSeconds}
                type="button"
                data-testid={`card-game-timer-${policy.timeoutSeconds}`}
                disabled={disabled}
                className={optionClass(config.actions.timeoutSeconds === policy.timeoutSeconds)}
                onClick={() => updateConfig({}, { actions: policy })}
              >
                {policy.timeoutSeconds === 0
                  ? t('cardGameSettings.timerOff')
                  : t('cardGameSettings.timerSeconds', { seconds: policy.timeoutSeconds })}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="border-4 border-black bg-amber-100 p-3 shadow-[4px_4px_0_0_#000]"
        data-testid="card-game-deal-preview"
      >
        <p className="text-xs font-black uppercase">{t('cardGameRules.dealing')}</p>
        <p className="text-sm font-bold mt-1">
          {preview.ok
            ? t('cardGameSettings.preview', { cards: preview.cards, stock: preview.stock })
            : t('cardGameSettings.previewInvalid')}
        </p>
      </div>

      <div className="border-4 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] flex flex-col gap-2">
        <div className="flex gap-2 items-center flex-wrap">
          <button
            type="button"
            data-testid="card-game-publish"
            disabled={disabled}
            className={optionClass(false)}
            onClick={() => cardGamePublishRules(config)}
          >
            {cardGameRulesLoading
              ? t('cardGameSettings.publishing')
              : t('cardGameSettings.publish')}
          </button>
          {cardGameShareCode && (
            <span className="flex items-center gap-2">
              <code
                data-testid="card-game-share-code"
                className="font-black bg-amber-200 border-2 border-black px-2 py-0.5 text-xs"
              >
                {t('cardGameSettings.published', { code: cardGameShareCode })}
              </code>
              <button
                type="button"
                onClick={copyShareCode}
                className="px-2 py-0.5 border-2 border-black bg-white font-black uppercase text-[10px] hover:bg-amber-100"
              >
                {copied ? t('cardGameSettings.copied') : t('cardGameSettings.copy')}
              </button>
            </span>
          )}
        </div>

        <p className="text-xs font-black uppercase">{t('cardGameSettings.import')}</p>
        <div className="flex gap-2">
          <input
            value={shareCodeInput}
            data-testid="card-game-import-input"
            onChange={(event) => setShareCodeInput(event.target.value.toUpperCase())}
            placeholder={t('cardGameSettings.importPlaceholder')}
            maxLength={12}
            className="flex-1 min-w-0 border-4 border-black px-2 py-1 font-black uppercase text-sm"
          />
          <button
            type="button"
            data-testid="card-game-import-button"
            disabled={disabled || shareCodeInput.trim().length === 0}
            className={optionClass(false)}
            onClick={() => cardGameImportRules(shareCodeInput.trim())}
          >
            {cardGameRulesLoading
              ? t('cardGameSettings.importing')
              : t('cardGameSettings.importButton')}
          </button>
        </div>

        {cardGameRulesError && (
          <p data-testid="card-game-rules-error" className="text-xs font-black text-red-600">
            {t(`cardGameSettings.errors.${cardGameRulesError}`)}
          </p>
        )}
        <p className="text-[10px] font-bold opacity-70">{t('cardGameSettings.copyOnEdit')}</p>
      </div>
    </div>
  );
}
