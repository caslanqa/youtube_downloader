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
  it('returns true for a matching checksum', async () => {
    const filePath = path.join(dir, 'yt-dlp_macos');
    writeFileSync(filePath, 'fake binary content');
    const expected = crypto.createHash('sha256').update('fake binary content').digest('hex');
    const sums = `${expected}  yt-dlp_macos\n`;

    expect(await sha256File(filePath)).toBe(expected);
    await expect(verifyChecksum(filePath, 'yt-dlp_macos', sums)).resolves.toBe(true);
  });

  it('returns false when the checksum does not match', async () => {
    const filePath = path.join(dir, 'yt-dlp_macos');
    writeFileSync(filePath, 'corrupted content');
    const sums = `${'0'.repeat(64)}  yt-dlp_macos\n`;

    await expect(verifyChecksum(filePath, 'yt-dlp_macos', sums)).resolves.toBe(false);
  });

  it('throws when the SUMS file has no entry for the file', async () => {
    const filePath = path.join(dir, 'yt-dlp_macos');
    writeFileSync(filePath, 'content');
    await expect(verifyChecksum(filePath, 'yt-dlp_macos', 'line for another file\n')).rejects.toThrow(
      /No checksum entry/,
    );
  });
});
