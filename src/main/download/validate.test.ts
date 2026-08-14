import { describe, expect, it } from 'vitest';
import { resolveDestination, sanitizeAlbumName, validateUrl } from './validate';

describe('validateUrl', () => {
  it('kabul eder: https + izinli host', () => {
    expect(() => validateUrl('https://www.youtube.com/watch?v=abc')).not.toThrow();
    expect(() => validateUrl('https://youtu.be/abc')).not.toThrow();
    expect(() => validateUrl('https://music.youtube.com/watch?v=abc')).not.toThrow();
  });

  it('reddeder: http (https değil)', () => {
    expect(() => validateUrl('http://www.youtube.com/watch?v=abc')).toThrow(/https/i);
  });

  it('reddeder: izinsiz host', () => {
    expect(() => validateUrl('https://evil.example.com/watch?v=abc')).toThrow(/host/i);
  });

  it('reddeder: geçersiz URL', () => {
    expect(() => validateUrl('not a url')).toThrow(/geçersiz/i);
  });
});

describe('sanitizeAlbumName', () => {
  it('yol ayırıcıları temizler', () => {
    expect(sanitizeAlbumName('a/b\\c')).toBe('a-b-c');
  });

  it('boş, "." ve ".." için varsayılan ad döner', () => {
    expect(sanitizeAlbumName('')).toBe('Indirilenler');
    expect(sanitizeAlbumName('   ')).toBe('Indirilenler');
    expect(sanitizeAlbumName('.')).toBe('Indirilenler');
    expect(sanitizeAlbumName('..')).toBe('Indirilenler');
  });

  it('zararsız noktalı adları korur', () => {
    expect(sanitizeAlbumName('..hidden')).toBe('..hidden');
  });
});

describe('resolveDestination', () => {
  const base = '/tmp/ytdl-base';

  it('normal albüm adıyla base altında bir yol üretir', () => {
    expect(resolveDestination(base, 'My Album')).toBe('/tmp/ytdl-base/My Album');
  });

  it('path traversal denemesini engeller', () => {
    expect(() => resolveDestination(base, '..')).not.toThrow();
    // ".." tek başına sanitize edilip "Indirilenler" olur, base dışına çıkmaz.
    expect(resolveDestination(base, '..')).toBe('/tmp/ytdl-base/Indirilenler');
  });

  it('slash içeren gizli traversal denemesini engeller', () => {
    expect(resolveDestination(base, '../../etc')).toBe('/tmp/ytdl-base/..-..-etc');
  });
});
