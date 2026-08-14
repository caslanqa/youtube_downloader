import { describe, expect, it } from 'vitest';
import { parseProgressLine } from './job';

// Satır biçimi gerçek yt-dlp 2026.07.04 çıktısından alındı: `--progress-template
// "download:%(progress)j"` içindeki `download:` tip seçicidir, satıra yazılmaz.
describe('parseProgressLine', () => {
  it('bilinen alanlardan yüzde/hız/eta hesaplar', () => {
    const line = JSON.stringify({
      status: 'downloading',
      downloaded_bytes: 512000,
      total_bytes: 1024000,
      speed: 2 * 1024 * 1024,
      eta: 12.4,
    });
    expect(parseProgressLine(line)).toEqual({ percent: 50, speed: '2.00 MB/s', eta: '12s' });
  });

  it('total_bytes yoksa total_bytes_estimate kullanır', () => {
    const line = JSON.stringify({ downloaded_bytes: 250000, total_bytes_estimate: 1000000 });
    expect(parseProgressLine(line)?.percent).toBe(25);
  });

  it('toplam boyut bilinmiyorsa percent undefined kalır', () => {
    const line = JSON.stringify({ downloaded_bytes: 1000 });
    expect(parseProgressLine(line)?.percent).toBeUndefined();
  });

  it('yt-dlp durum satırlarını yoksayar', () => {
    expect(parseProgressLine('[youtube] Extracting URL')).toBeNull();
    expect(parseProgressLine('[download] Destination: /tmp/x.webm')).toBeNull();
  });

  it('ilerleme olmayan JSON satırını yoksayar', () => {
    expect(parseProgressLine(JSON.stringify({ status: 'finished' }))).toBeNull();
  });

  it('bozuk JSON için null döner', () => {
    expect(parseProgressLine('{not json')).toBeNull();
  });
});
