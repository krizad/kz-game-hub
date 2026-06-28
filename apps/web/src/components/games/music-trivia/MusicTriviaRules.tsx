import React from 'react';
import { useTranslate } from '../../../hooks/useTranslate';

export function MusicTriviaRules() {
  const { t } = useTranslate();

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-lg">🌟</span> {t('rules.musicTrivia.rules.sharedFeaturesTitle')}
        </h4>
        <ul className="list-disc pl-5 space-y-2">
          {t('rules.musicTrivia.rules.sharedFeatures')
            .split('||')
            .map((rule, idx) => (
              <li
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: rule.replace(/^([^:]+):/, '<strong>$1:</strong>'),
                }}
              />
            ))}
        </ul>
      </div>

      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-lg">⌨️</span> {t('rules.musicTrivia.rules.modeTypingTitle')}
        </h4>
        <p className="mb-2 italic text-slate-500">{t('rules.musicTrivia.rules.modeTypingDesc')}</p>
        <ul className="list-disc pl-5 space-y-2">
          {t('rules.musicTrivia.rules.modeTypingRules')
            .split('||')
            .map((rule, idx) => (
              <li
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: rule.replace(/^([^:]+):/, '<strong>$1:</strong>'),
                }}
              />
            ))}
        </ul>
      </div>

      <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-lg">👑</span> {t('rules.musicTrivia.rules.modeGmTitle')}
        </h4>
        <p className="mb-2 italic text-slate-500">{t('rules.musicTrivia.rules.modeGmDesc')}</p>
        <ul className="list-disc pl-5 space-y-2">
          {t('rules.musicTrivia.rules.modeGmRules')
            .split('||')
            .map((rule, idx) => (
              <li
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: rule.replace(/^([^:]+):/, '<strong>$1:</strong>'),
                }}
              />
            ))}
        </ul>
      </div>

      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-lg">💡</span> {t('rules.musicTrivia.rules.tipsTitle')}
        </h4>
        <ul className="list-disc pl-5 space-y-1">
          {t('rules.musicTrivia.rules.tips')
            .split('||')
            .map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
        </ul>
      </div>
    </div>
  );
}
