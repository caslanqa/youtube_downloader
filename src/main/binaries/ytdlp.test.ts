import { describe, expect, it } from 'vitest';
import { getYtDlpAssetName, getYtDlpLocalName } from './ytdlp';

function withPlatform<T>(platform: NodeJS.Platform, arch: NodeJS.Architecture, fn: () => T): T {
  const platformDesc = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const archDesc = Object.getOwnPropertyDescriptor(process, 'arch')!;
  Object.defineProperty(process, 'platform', { value: platform });
  Object.defineProperty(process, 'arch', { value: arch });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'platform', platformDesc);
    Object.defineProperty(process, 'arch', archDesc);
  }
}

describe('getYtDlpAssetName', () => {
  it('returns yt-dlp_macos on darwin', () => {
    expect(withPlatform('darwin', 'arm64', getYtDlpAssetName)).toBe('yt-dlp_macos');
  });

  it('returns yt-dlp.exe on win32', () => {
    expect(withPlatform('win32', 'x64', getYtDlpAssetName)).toBe('yt-dlp.exe');
  });

  it('returns yt-dlp_linux on linux x64', () => {
    expect(withPlatform('linux', 'x64', getYtDlpAssetName)).toBe('yt-dlp_linux');
  });

  it('returns yt-dlp_linux_aarch64 on linux arm64', () => {
    expect(withPlatform('linux', 'arm64', getYtDlpAssetName)).toBe('yt-dlp_linux_aarch64');
  });

  it('throws on an unsupported platform', () => {
    expect(() => withPlatform('aix', 'x64', getYtDlpAssetName)).toThrow(/Unsupported platform/);
  });
});

describe('getYtDlpLocalName', () => {
  it('returns "yt-dlp" everywhere but win32', () => {
    expect(withPlatform('darwin', 'arm64', getYtDlpLocalName)).toBe('yt-dlp');
  });

  it('returns "yt-dlp.exe" on win32', () => {
    expect(withPlatform('win32', 'x64', getYtDlpLocalName)).toBe('yt-dlp.exe');
  });
});
