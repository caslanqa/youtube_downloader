import { useEffect } from 'react';
import type { Settings } from '../shared/types';

/**
 * Seçilen temayı `<html data-theme>` üzerine yazar. 'system' seçimi burada
 * çözülür — CSS tarafında tek bir mekanizma (öznitelik) kalsın diye; ayrıca
 * kullanıcı sistem temasını uygulama açıkken değiştirirse anında uygulanır.
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
