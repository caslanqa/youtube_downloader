import path from 'node:path';

// yt-dlp, JS runtime'ını PATH üzerinden arar (varsayılan olarak yalnızca deno
// etkindir). Yolu her spawn çağrısına parametre olarak taşımak yerine, indirilen
// deno'nun klasörü bir kez burada saklanıp spawn ortamına ekleniyor.
// Bu modül bilerek electron'a bağımlı değil: job.ts ve probe.ts'in birim
// testleri electron olmadan çalışıyor.

let denoDir: string | null = null;

export function setDenoDirectory(denoPath: string | null): void {
  denoDir = denoPath ? path.dirname(denoPath) : null;
}

/** Alt süreçlere verilecek ortam: deno bulunduysa PATH'in başına eklenir. */
export function spawnEnv(): NodeJS.ProcessEnv {
  if (!denoDir) return process.env;
  const currentPath = process.env.PATH ?? '';
  return { ...process.env, PATH: currentPath ? `${denoDir}${path.delimiter}${currentPath}` : denoDir };
}
