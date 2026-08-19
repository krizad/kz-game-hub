import React from 'react';
import { useTranslate } from '../../../hooks/useTranslate';

export function MusicTriviaRules() {
  const { t } = useTranslate();

  return (
    <div className="space-y-6 text-base text-black font-bold">
      <div className="bg-yellow-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h4 className="font-black text-black mb-4 flex items-center gap-3 text-2xl uppercase tracking-widest bg-white px-3 py-1 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          <span className="text-2xl">🌟</span> {t('rules.musicTrivia.rules.sharedFeaturesTitle')}
        </h4>
        <ul className="list-disc pl-6 space-y-3 font-medium text-lg">
          {t('rules.musicTrivia.rules.sharedFeatures')
            .split('||')
            .map((rule, idx) => (
              <li
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: rule.replace(
                    /^([^:]+):/,
                    '<strong class="font-black bg-white px-1 border-2 border-black mr-1">$1:</strong>',
                  ),
                }}
              />
            ))}
        </ul>
      </div>

      <div className="bg-cyan-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h4 className="font-black text-black mb-4 flex items-center gap-3 text-2xl uppercase tracking-widest bg-white px-3 py-1 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          <span className="text-2xl">⌨️</span> {t('rules.musicTrivia.rules.modeTypingTitle')}
        </h4>
        <p className="mb-4 font-bold text-black bg-white border-2 border-black px-2 py-1 inline-block -">
          {t('rules.musicTrivia.rules.modeTypingDesc')}
        </p>
        <ul className="list-disc pl-6 space-y-3 font-medium text-lg">
          {t('rules.musicTrivia.rules.modeTypingRules')
            .split('||')
            .map((rule, idx) => (
              <li
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: rule.replace(
                    /^([^:]+):/,
                    '<strong class="font-black bg-white px-1 border-2 border-black mr-1">$1:</strong>',
                  ),
                }}
              />
            ))}
        </ul>
      </div>

      <div className="bg-pink-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
        <h4 className="font-black text-black mb-4 flex items-center gap-3 text-2xl uppercase tracking-widest bg-white px-3 py-1 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          <span className="text-2xl">👑</span> {t('rules.musicTrivia.rules.modeGmTitle')}
        </h4>
        <p className="mb-4 font-bold text-black bg-white border-2 border-black px-2 py-1 inline-block ">
          {t('rules.musicTrivia.rules.modeGmDesc')}
        </p>
        <ul className="list-disc pl-6 space-y-3 font-medium text-lg">
          {t('rules.musicTrivia.rules.modeGmRules')
            .split('||')
            .map((rule, idx) => (
              <li
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: rule.replace(
                    /^([^:]+):/,
                    '<strong class="font-black bg-white px-1 border-2 border-black mr-1">$1:</strong>',
                  ),
                }}
              />
            ))}
        </ul>
      </div>

      <div className="bg-emerald-300 p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
        <h4 className="font-black text-black mb-4 flex items-center gap-3 text-2xl uppercase tracking-widest bg-white px-3 py-1 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
          <span className="text-2xl">💡</span> {t('rules.musicTrivia.rules.tipsTitle')}
        </h4>
        <ul className="list-disc pl-6 space-y-2 font-bold text-lg">
          {t('rules.musicTrivia.rules.tips')
            .split('||')
            .map((tip, idx) => (
              <li key={idx} className="bg-white px-2 py-1 border-2 border-black inline-block mb-2">
                {tip}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
