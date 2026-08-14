import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setDenoDirectory, spawnEnv } from './runtimeEnv';

afterEach(() => setDenoDirectory(null));

describe('spawnEnv', () => {
  it('returns the process environment untouched when deno is missing', () => {
    setDenoDirectory(null);
    expect(spawnEnv()).toBe(process.env);
  });

  it('prepends deno\'s directory to PATH when available', () => {
    setDenoDirectory(path.join('/tmp', 'bin', 'deno'));
    const env = spawnEnv();
    expect(env.PATH?.startsWith(`${path.join('/tmp', 'bin')}${path.delimiter}`)).toBe(true);
    expect(env.PATH).toContain(process.env.PATH ?? '');
  });
});
