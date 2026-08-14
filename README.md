# YouTube Downloader

Electron + React + TypeScript masaüstü uygulaması. YouTube video/playlist indirme aracının
Electron ile yeniden yazımı; plan için bkz. [`docs/PLAN.md`](docs/PLAN.md).

## Geliştirme

```bash
npm install
npm start
```

## İlk açılış

Uygulama, ihtiyaç duyduğu araçları kendisi indirir (checksum doğrulamalı, `userData/bin/` altına):
`yt-dlp` (~38 MB) ve `deno` (~37 MB indirme, açıldığında ~81 MB — yt-dlp'nin YouTube
çıkarımı için gereken JavaScript runtime'ı). `ffmpeg` uygulamayla birlikte gelir.
deno inemezse uygulama çalışmaya devam eder, yalnızca bazı video formatları listelenmez.

## Testler

```bash
npm run lint
npm run typecheck
npm test          # birim + entegrasyon (vitest, ağ gerektirmez)
npm run e2e       # uygulamayı paketler ve Playwright ile açar (sahte yt-dlp/ffmpeg)
```

CI yalnızca ilk üçünü çalıştırır; uçtan uca testler yerelde çalıştırılır (bkz. `.github/workflows/ci.yml`).

## Paketleme

```bash
npm run make          # çalışılan platformun yükleyicisini out/make altına üretir
```

Üretilenler: macOS `.dmg` + `.zip`, Windows `Setup.exe` (Squirrel), Linux `.deb` + `.rpm`.
Her platform kendi runner'ında derlenmeli — ffmpeg binary'si kurulum anında platforma göre iniyor.
CI, sürüm etiketi (`v*`) gönderildiğinde veya elle tetiklendiğinde üç platformu birden derler.

Yükleyiciler **imzalanmıyor**: macOS'ta ilk açılışta Gatekeeper uyarısı çıkar (sağ tık → Aç),
Windows'ta SmartScreen "yine de çalıştır" ister.

İkonlar tek kaynak PNG'den üretilip depoya işlenmiştir; yeniden üretmek için (macOS gerekir):

```bash
node scripts/make-icons.mjs [kaynak.png]
```

## Eski sürüm (v1, JavaFX)

Önceki JavaFX masaüstü uygulaması [`legacy/`](legacy/) altında referans olarak duruyor
(Maven ile derlenir: `cd legacy && ./mvnw javafx:run`). Yeni sürüm üç platformda
doğrulandıktan sonra kaldırılacak (bkz. plan §4, §13 Faz 7).
