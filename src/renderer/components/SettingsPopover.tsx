import type { Language, Settings } from '../../shared/types';
import { useT } from '../i18n';
import { BUTTON_QUIET, FIELD, LABEL } from '../ui';

export const SETTINGS_POPOVER_ID = 'settings-popover';

/**
 * Native Popover API: açma/kapama, dışarı tıklayınca kapanma, Escape ve odağın
 * tetikleyen düğmeye dönmesi tarayıcıdan gelir — React state'i tutulmaz.
 * Konumlandırma CSS anchor positioning ile dişli düğmesine bağlanır (src/index.css).
 */
export function SettingsPopover({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}) {
  const t = useT();

  return (
    <div
      id={SETTINGS_POPOVER_ID}
      popover="auto"
      aria-labelledby="settings-title"
      className="settings-popover w-80 rounded-xl border border-line-soft bg-panel p-5 text-ink shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="settings-title" className="text-sm font-semibold">
          {t('settings')}
        </h2>
        <button type="button" popoverTarget={SETTINGS_POPOVER_ID} popoverTargetAction="hide" className={BUTTON_QUIET}>
          {t('settingsClose')}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="language">
            {t('languageLabel')}
          </label>
          <select
            id="language"
            autoFocus
            value={settings.language}
            onChange={(event) => onChange({ language: event.target.value as Language })}
            className={FIELD}
          >
            <option value="tr">{t('languageTr')}</option>
            <option value="en">{t('languageEn')}</option>
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="theme">
            {t('themeLabel')}
          </label>
          <select
            id="theme"
            value={settings.theme}
            onChange={(event) => onChange({ theme: event.target.value as Settings['theme'] })}
            className={FIELD}
          >
            <option value="system">{t('themeSystem')}</option>
            <option value="light">{t('themeLight')}</option>
            <option value="dark">{t('themeDark')}</option>
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="concurrency">
            {t('concurrencyLabel')}
          </label>
          <input
            id="concurrency"
            type="number"
            min={1}
            max={5}
            value={settings.concurrency}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value >= 1 && value <= 5) onChange({ concurrency: value });
            }}
            className={`${FIELD} w-24`}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="numbering"
            type="checkbox"
            checked={settings.numberPlaylistItems}
            onChange={(event) => onChange({ numberPlaylistItems: event.target.checked })}
            className="size-4 accent-[var(--color-brand)]"
          />
          <label className="text-sm text-ink" htmlFor="numbering">
            {t('numberingLabel')}
          </label>
        </div>
      </div>
    </div>
  );
}
