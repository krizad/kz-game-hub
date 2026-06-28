'use client';

import { useTranslate } from '@/hooks/useTranslate';

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslate();

  return (
    <div className="flex gap-1 bg-amber-100/50 p-1 rounded-lg border border-amber-300/50 backdrop-blur-sm z-50">
      <button
        onClick={() => setLanguage('en')}
        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
          language === 'en'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-slate-600 hover:text-slate-800 hover:bg-amber-200/50'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('th')}
        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
          language === 'th'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-slate-600 hover:text-slate-800 hover:bg-amber-200/50'
        }`}
      >
        TH
      </button>
    </div>
  );
}
