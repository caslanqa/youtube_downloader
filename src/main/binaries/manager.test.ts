import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256File, verifyChecksum } from './manager';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ytdlp-checksum-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('sha256File / verifyChecksum', () => {
  it('doğru checksum için true döner', async () => {
    const filePath = path.join(dir, 'yt-dlp_macos');
    writeFileSync(filePath, 'sahte binary içeriği');
    const expected = crypto.createHash('sha256').update('sahte binary içeriği').digest('hex');
    const sums = `${expected}  yt-dlp_macos\n`;

    expect(await sha256File(filePath)).toBe(expected);
    await expect(verifyChecksum(filePath, 'yt-dlp_macos', sums)).resolves.toBe(true);
  });

  it('bozuk dosya için false döner (checksum eşleşmez)', async () => {
    const filePath = path.join(dir, 'yt-dlp_macos');
    writeFileSync(filePath, 'bozuk içerik');
    const sums = `${'0'.repeat(64)}  yt-dlp_macos\n`;

    await expect(verifyChecksum(filePath, 'yt-dlp_macos', sums)).resolves.toBe(false);
  });

  it('SUMS içinde dosya adı yoksa hata fırlatır', async () => {
    const filePath = path.join(dir, 'yt-dlp_macos');
    writeFileSync(filePath, 'içerik');
    await expect(verifyChecksum(filePath, 'yt-dlp_macos', 'başka-dosya için satır\n')).rejects.toThrow(
      /checksum bulunamadı/,
    );
  });
});
