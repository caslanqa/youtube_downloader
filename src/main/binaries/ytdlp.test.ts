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
  it('darwin için yt-dlp_macos döner', () => {
    expect(withPlatform('darwin', 'arm64', getYtDlpAssetName)).toBe('yt-dlp_macos');
  });

  it('win32 için yt-dlp.exe döner', () => {
    expect(withPlatform('win32', 'x64', getYtDlpAssetName)).toBe('yt-dlp.exe');
  });

  it('linux x64 için yt-dlp_linux döner', () => {
    expect(withPlatform('linux', 'x64', getYtDlpAssetName)).toBe('yt-dlp_linux');
  });

  it('linux arm64 için yt-dlp_linux_aarch64 döner', () => {
    expect(withPlatform('linux', 'arm64', getYtDlpAssetName)).toBe('yt-dlp_linux_aarch64');
  });

  it('desteklenmeyen platformda hata fırlatır', () => {
    expect(() => withPlatform('aix', 'x64', getYtDlpAssetName)).toThrow(/Desteklenmeyen platform/);
  });
});

describe('getYtDlpLocalName', () => {
  it('win32 dışında "yt-dlp" döner', () => {
    expect(withPlatform('darwin', 'arm64', getYtDlpLocalName)).toBe('yt-dlp');
  });

  it('win32 için "yt-dlp.exe" döner', () => {
    expect(withPlatform('win32', 'x64', getYtDlpLocalName)).toBe('yt-dlp.exe');
  });
});
