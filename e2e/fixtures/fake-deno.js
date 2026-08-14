#!/usr/bin/env node
// Uçtan uca testler için sahte deno: yalnızca varlığı gerekiyor (yt-dlp'nin JS
// runtime'ı). Gerçek indirmenin testte tetiklenmemesi için YTDL_DENO_PATH ile verilir.
process.stdout.write('deno 2.9.5 (stable, release, sahte)\n');
process.exit(0);
