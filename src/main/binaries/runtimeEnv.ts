import path from 'node:path';

// yt-dlp looks up its JS runtime through PATH (only deno is enabled by default). Instead of
// threading the path through every spawn call, the downloaded deno's directory is stored here
// once and prepended to the spawn environment.
// This module deliberately does not import electron, so the unit tests for job.ts and probe.ts
// keep running without it.

let denoDir: string | null = null;

export function setDenoDirectory(denoPath: string | null): void {
  denoDir = denoPath ? path.dirname(denoPath) : null;
}

/** Environment for child processes: deno's directory is prepended to PATH when available. */
export function spawnEnv(): NodeJS.ProcessEnv {
  if (!denoDir) return process.env;
  const currentPath = process.env.PATH ?? '';
  return { ...process.env, PATH: currentPath ? `${denoDir}${path.delimiter}${currentPath}` : denoDir };
}
