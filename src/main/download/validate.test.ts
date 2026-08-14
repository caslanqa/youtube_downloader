import { describe, expect, it } from 'vitest';
import { resolveDestination, sanitizeAlbumName, validateUrl } from './validate';

describe('validateUrl', () => {
  it('accepts https URLs on allowlisted hosts', () => {
    expect(() => validateUrl('https://www.youtube.com/watch?v=abc')).not.toThrow();
    expect(() => validateUrl('https://youtu.be/abc')).not.toThrow();
    expect(() => validateUrl('https://music.youtube.com/watch?v=abc')).not.toThrow();
  });

  it('rejects plain http', () => {
    expect(() => validateUrl('http://www.youtube.com/watch?v=abc')).toThrow(/https/i);
  });

  it('rejects hosts outside the allowlist', () => {
    expect(() => validateUrl('https://evil.example.com/watch?v=abc')).toThrow(/host/i);
  });

  it('rejects malformed URLs', () => {
    expect(() => validateUrl('not a url')).toThrow(/invalid/i);
  });
});

describe('sanitizeAlbumName', () => {
  it('replaces path separators', () => {
    expect(sanitizeAlbumName('a/b\\c')).toBe('a-b-c');
  });

  it('falls back to a default name for empty, "." and ".."', () => {
    expect(sanitizeAlbumName('')).toBe('Downloads');
    expect(sanitizeAlbumName('   ')).toBe('Downloads');
    expect(sanitizeAlbumName('.')).toBe('Downloads');
    expect(sanitizeAlbumName('..')).toBe('Downloads');
  });

  it('keeps harmless names that start with dots', () => {
    expect(sanitizeAlbumName('..hidden')).toBe('..hidden');
  });
});

describe('resolveDestination', () => {
  const base = '/tmp/ytdl-base';

  it('resolves a normal album name under the base directory', () => {
    expect(resolveDestination(base, 'My Album')).toBe('/tmp/ytdl-base/My Album');
  });

  it('blocks a path traversal attempt', () => {
    expect(() => resolveDestination(base, '..')).not.toThrow();
    // A bare ".." is sanitised to "Downloads" and never escapes the base directory.
    expect(resolveDestination(base, '..')).toBe('/tmp/ytdl-base/Downloads');
  });

  it('blocks traversal attempts hidden behind slashes', () => {
    expect(resolveDestination(base, '../../etc')).toBe('/tmp/ytdl-base/..-..-etc');
  });
});
