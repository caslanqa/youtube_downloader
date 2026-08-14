import { useEffect } from 'react';
import type { Settings } from '../shared/types';

/**
 * Writes the selected theme onto `<html data-theme>`. The 'system' choice is resolved here so
 * the CSS only has to deal with one mechanism (the attribute), and so a system theme change
 * while the app is open takes effect immediately.
 */
export function useAppliedTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
