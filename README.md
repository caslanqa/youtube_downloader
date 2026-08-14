# YouTube Downloader

Electron + React + TypeScript masaüstü uygulaması. YouTube video/playlist indirme aracının
Electron ile yeniden yazımı; plan için bkz. [`docs/PLAN.md`](docs/PLAN.md).

## Geliştirme

```bash
npm install
npm start
```

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
npm run make
```

## Eski sürüm (v1, JavaFX)

Önceki JavaFX masaüstü uygulaması [`legacy/`](legacy/) altında referans olarak duruyor
(Maven ile derlenir: `cd legacy && ./mvnw javafx:run`). Yeni sürüm üç platformda
doğrulandıktan sonra kaldırılacak (bkz. plan §4, §13 Faz 7).
