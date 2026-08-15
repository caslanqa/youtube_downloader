import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOutdated, sha256File, verifyChecksum } from './manager';

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

// This is the check that was missing: ensureYtDlp used to treat "the file exists and runs"
// as good enough, forever, so an installed copy could sit months behind the latest release
// (yt-dlp breaks whenever YouTube changes something) without the app ever noticing.
describe('isOutdated', () => {
  it('is false when the installed version matches the latest release tag', () => {
    expect(isOutdated('2026.07.04', '2026.07.04')).toBe(false);
  });

  it('is true when a newer release has been published', () => {
    expect(isOutdated('2025.11.12', '2026.07.04')).toBe(true);
  });

  it('ignores surrounding whitespace from either source', () => {
    expect(isOutdated('2026.07.04\n', '2026.07.04')).toBe(false);
  });
});
