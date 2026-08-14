import type { Settings } from '../../shared/types';
import { BUTTON_QUIET, FIELD, LABEL, PANEL } from '../ui';

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}) {
  return (
    <details className={PANEL}>
      <summary className="cursor-pointer rounded text-sm font-medium text-ink">Ayarlar</summary>

      <div className="mt-5 space-y-5">
        <div>
          <label className={LABEL} htmlFor="destination">
            Hedef klasör
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
              Seç
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className={LABEL} htmlFor="concurrency">
              Eşzamanlı indirme
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
              className={FIELD}
            />
          </div>
          <div className="flex-1">
            <label className={LABEL} htmlFor="theme">
              Tema
            </label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(event) => onChange({ theme: event.target.value as Settings['theme'] })}
              className={FIELD}
            >
              <option value="system">Sistemle aynı</option>
              <option value="light">Açık</option>
              <option value="dark">Koyu</option>
            </select>
          </div>
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
            Oynatma listesi dosyalarını numaralandır
          </label>
        </div>
      </div>
    </details>
  );
}
