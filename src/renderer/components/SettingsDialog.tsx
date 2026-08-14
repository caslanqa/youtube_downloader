import { useEffect, useRef } from 'react';
import type { Language, Settings } from '../../shared/types';
import { useT } from '../i18n';
import { BUTTON_QUIET, FIELD, LABEL } from '../ui';

/**
 * Native `<dialog>` bilinçli tercih: Escape ile kapanma, odak tuzağı ve kapanınca
 * odağın tetikleyen düğmeye dönmesi tarayıcıdan geliyor (WCAG 2.1.2 / 2.4.3).
 */
export function SettingsDialog({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="settings-title"
      className="w-[min(32rem,90vw)] rounded-xl border border-line-soft bg-panel p-6 text-ink backdrop:bg-black/50"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="settings-title" className="text-lg font-semibold">
          {t('settings')}
        </h2>
        <button type="button" onClick={onClose} className={BUTTON_QUIET}>
          {t('settingsClose')}
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className={LABEL} htmlFor="destination">
            {t('destinationLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="destination"
              type="text"
              readOnly
              value={settings.destination}
              className={`${FIELD} text-muted`}
            />
            <button
              type="button"
              onClick={async () => {
                const picked = await window.api.pickFolder();
                if (picked) onChange({ destination: picked });
              }}
              className={`${BUTTON_QUIET} shrink-0`}
            >
              {t('destinationPick')}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className={LABEL} htmlFor="language">
              {t('languageLabel')}
            </label>
            <select
              id="language"
              value={settings.language}
              onChange={(event) => onChange({ language: event.target.value as Language })}
              className={FIELD}
            >
              <option value="tr">{t('languageTr')}</option>
              <option value="en">{t('languageEn')}</option>
            </select>
          </div>
          <div className="flex-1">
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
    </dialog>
  );
}
