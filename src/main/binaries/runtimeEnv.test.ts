import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setDenoDirectory, spawnEnv } from './runtimeEnv';

afterEach(() => setDenoDirectory(null));

describe('spawnEnv', () => {
  it('deno yoksa süreç ortamını olduğu gibi verir', () => {
    setDenoDirectory(null);
    expect(spawnEnv()).toBe(process.env);
  });

  it('deno varsa klasörünü PATH başına ekler', () => {
    setDenoDirectory(path.join('/tmp', 'bin', 'deno'));
    const env = spawnEnv();
    expect(env.PATH?.startsWith(`${path.join('/tmp', 'bin')}${path.delimiter}`)).toBe(true);
    expect(env.PATH).toContain(process.env.PATH ?? '');
  });
});
