import { useTranslate } from "@/hooks/useTranslate";

export function SoundsFishyRules() {
  const { t } = useTranslate();
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.soundsFishy.title')}</h3>
        <p className="leading-relaxed">
          {t('rules.soundsFishy.desc')}
        </p>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.soundsFishy.rolesTitle')}</h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-purple-400 mt-0.5 flex-shrink-0 text-xl leading-none">🧐</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.soundsFishy.rolePicker')}</strong>
              {t('rules.soundsFishy.rolePickerDesc')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 mt-0.5 flex-shrink-0 text-xl leading-none">🐟</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.soundsFishy.roleBlueFish')}</strong>
              {t('rules.soundsFishy.roleBlueFishDesc')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-rose-400 mt-0.5 flex-shrink-0 text-xl leading-none">🐠</span>
            <div>
              <strong className="text-slate-800 block mb-1">{t('rules.soundsFishy.roleRedHerring')}</strong>
              {t('rules.soundsFishy.roleRedHerringDesc')}
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.soundsFishy.flowTitle')}</h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">1️⃣</span>
            <div>
              {t('rules.soundsFishy.flowSetup')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">2️⃣</span>
            <div>
              {t('rules.soundsFishy.flowPitch')}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">3️⃣</span>
            <div>
              {t('rules.soundsFishy.flowHunt')}
            </div>
          </li>
           <li className="flex gap-3">
            <span className="text-slate-800 mt-0.5 flex-shrink-0 text-xl leading-none">4️⃣</span>
            <div>
              {t('rules.soundsFishy.flowScore')}
            </div>
          </li>
        </ul>
      </div>
      
      <div>
        <h3 className="text-purple-400 font-black uppercase tracking-wider text-sm mb-3">{t('rules.soundsFishy.scoringTitle')}</h3>
        <ul className="space-y-4 border-l-2 border-amber-200 pl-4 py-1">
          <li className="text-slate-700"><span className="text-rose-400 font-bold">🎣</span> {t('rules.soundsFishy.scoreRedHerring')}</li>
          <li className="text-slate-700"><span className="text-amber-400 font-bold">💰</span> {t('rules.soundsFishy.scoreBank')}</li>
          <li className="text-slate-700"><span className="text-blue-400 font-bold">💀</span> {t('rules.soundsFishy.scoreBlueFish')}</li>
        </ul>
      </div>
    </div>
  );
}
