# YouTube Downloader

Desktop app for downloading YouTube videos and playlists as MP3, MP4 or WebM.
Runs on macOS, Windows and Linux. Built with Electron, React and TypeScript.

[![CI](https://github.com/caslanqa/youtube_downloader/actions/workflows/ci.yml/badge.svg)](https://github.com/caslanqa/youtube_downloader/actions/workflows/ci.yml)

> This is a rewrite of the original JavaFX application (v1). The design decisions and the
> reasoning behind them are documented in [`docs/PLAN.md`](docs/PLAN.md) (written in Turkish);
> the Java sources remain in the git history.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [First launch](#first-launch)
- [Usage](#usage)
  - [Download form](#download-form)
  - [Queue](#queue)
  - [Settings](#settings)
- [Where files end up](#where-files-end-up)
- [How it works](#how-it-works)
  - [Process layout](#process-layout)
  - [Managed binaries](#managed-binaries)
  - [Environment variables](#environment-variables)
- [Development](#development)
  - [Requirements](#requirements)
  - [Getting started](#getting-started)
  - [npm scripts](#npm-scripts)
  - [Project layout](#project-layout)
  - [Lockfile note](#lockfile-note)
- [Testing](#testing)
- [Building installers](#building-installers)
- [Releasing](#releasing)
  - [Per-platform versioning](#per-platform-versioning)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Licenses](#licenses)
- [Disclaimer](#disclaimer)

## Features

- **Formats**: MP3 (audio), MP4 and WebM (video), including playlists.
- **Preview before download**: pasting a link shows the title, duration and playlist size.
- **Real progress**: percentage, speed and ETA parsed from yt-dlp's structured output.
- **Queue**: add several links without waiting; two downloads run at a time by default.
- **Cancellable**: a running download stops on request and its partial files are cleaned up.
- **Self-managing tools**: yt-dlp, ffmpeg and deno are downloaded and verified automatically.
- **Bilingual UI**: English and Turkish, following the system language on first launch.
- **Light/dark theme**: follows the system setting or can be pinned.
- **Keyboard and screen-reader friendly**: native controls, visible focus, live status updates.

## Installation

Each platform is released separately, so pick the newest release whose title matches your
platform on the [releases page](https://github.com/caslanqa/youtube_downloader/releases)
(`macos vX.Y.Z`, `windows vX.Y.Z`, `linux vX.Y.Z`) and download its installer:

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `YouTube.Downloader-<version>-arm64.dmg` |
| Windows | `YouTube.Downloader-<version>.Setup.exe` |
| Debian/Ubuntu | `youtube-downloader_<version>_amd64.deb` |
| Fedora/RHEL | `youtube-downloader-<version>-1.x86_64.rpm` |

The installers are **not code-signed**, so the operating system warns on first launch:

- **macOS**: right-click the app → *Open* → confirm. (Gatekeeper blocks a plain double-click.)
- **Windows**: SmartScreen shows *More info* → *Run anyway*.

## First launch

The app downloads the tools it needs into its own user-data directory
(`userData/bin/`), verifying every file against a published SHA-256 before use:

| Tool | Size | Why it is needed |
| --- | --- | --- |
| `yt-dlp` | ~38 MB | The download engine |
| `ffmpeg` | ~43 MB | MP3 extraction and video+audio merging |
| `deno` | ~37 MB (~81 MB on disk) | JavaScript runtime that yt-dlp needs for YouTube extraction |

Nothing is bundled into the installer, which keeps it small and lets the tools be updated
without shipping a new app version. If `deno` cannot be fetched the app still runs, only some
video formats stop being offered; `yt-dlp` and `ffmpeg` are mandatory and a failure to fetch
them is reported on the preparation screen.

## Usage

### Download form

1. **Paste a YouTube link.** The app inspects it and shows the title, duration and, for
   playlists, the number of items.
2. **Pick a format**: MP3 (audio), MP4 or WebM (video).
3. **Album name** — auto-filled from the title, editable. Files are written into a subfolder
   with this name, which keeps a playlist together. Clearing it falls back to `Downloads`.
4. **Destination folder** — defaults to `~/Downloads/YTDownloader`; *Choose* changes it and the
   selection is remembered for the next download.
5. **Add to queue.** The form clears immediately so the next link can be entered.

### Queue

Each job shows its own state: waiting, downloading (with percentage, speed and remaining time),
completed, cancelled or failed.

- **Cancel** stops the running process and removes partially downloaded files.
- **Open folder** reveals the finished download in the system file manager.
- **Details** on a failed job shows the last 50 lines of yt-dlp's own output.

### Settings

The gear button in the top right opens the settings popover:

| Setting | Default | Notes |
| --- | --- | --- |
| Language | System language | English or Turkish |
| Theme | Match system | Light or dark can be pinned |
| Concurrent downloads | 2 | 1–5; extra jobs wait in the queue |
| Number playlist files | On | Prefixes files with the playlist index |

Settings are stored as JSON in the app's user-data directory:

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/YouTube Downloader/config.json` |
| Windows | `%APPDATA%\YouTube Downloader\config.json` |
| Linux | `~/.config/YouTube Downloader/config.json` |

## Where files end up

```text
<destination>/<album name>/<title>.<ext>
```

With *Number playlist files* enabled, playlist items are named
`<playlist index> - <title>.<ext>`.

## How it works

### Process layout

The renderer never touches Node APIs or child processes; everything privileged happens in the
main process behind an explicit IPC allowlist.

```text
┌──────────────────────────────────────────────────────────────┐
│ Main process (Node.js)                                       │
│  ├── binaries/   download + SHA-256 verification, versions   │
│  ├── download/   queue, yt-dlp processes, progress, cancel   │
│  ├── settings    persisted configuration                     │
│  └── ipc         ipcMain.handle registrations                │
└───────────────────────────┬──────────────────────────────────┘
                            │ contextBridge (allowlist only)
┌───────────────────────────┴──────────────────────────────────┐
│ Preload (isolated world)                                     │
│  window.api = { probe, enqueue, cancel, onJobUpdate, … }     │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────┐
│ Renderer (React, contextIsolation, sandbox, no nodeIntegration)│
│  UI and queue rendering; no business logic                   │
└──────────────────────────────────────────────────────────────┘
```

### Managed binaries

| Tool | Source | Integrity check |
| --- | --- | --- |
| yt-dlp | `yt-dlp/yt-dlp` releases | `SHA2-256SUMS` from the same release |
| ffmpeg | `eugeneware/ffmpeg-static` releases | Per-asset `sha256` digest from the GitHub API |
| deno | `denoland/deno` releases | Per-asset `.sha256sum` file |

Downloads are written to a `.part` file first and only renamed after verification, so a
half-written binary is never executed. A binary that exists but cannot run is deleted and
fetched again.

### Environment variables

Useful when a download source is blocked or when driving the app from tests:

| Variable | Effect |
| --- | --- |
| `YTDL_YTDLP_PATH` | Use this yt-dlp binary instead of downloading one |
| `YTDL_FFMPEG_PATH` | Use this ffmpeg binary instead of downloading one |
| `YTDL_DENO_PATH` | Use this deno binary instead of downloading one |

## Development

### Requirements

- Node.js 22+
- npm 10+ (see [Lockfile note](#lockfile-note))
- macOS only, for regenerating icons: `sips` and `iconutil` (part of the OS)

### Getting started

```bash
npm install
npm start
```

`npm start` runs Electron Forge with Vite, so the renderer hot-reloads and the main process
rebuilds on change.

### npm scripts

| Script | What it does |
| --- | --- |
| `npm start` | Run the app in development mode |
| `npm run lint` | ESLint over all TypeScript sources |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit and integration tests (Vitest, no network) |
| `npm run e2e` | Package the app and run the Playwright end-to-end tests |
| `npm run package` | Build the app bundle without installers |
| `npm run make` | Build installers for the current platform |

### Project layout

```text
src/
├── main.ts              app lifecycle, window, CSP and navigation policy
├── preload.ts           contextBridge allowlist
├── renderer.tsx         React entry point
├── main/
│   ├── ipc.ts           every ipcMain.handle registration
│   ├── settings.ts      persisted settings
│   ├── binaries/        yt-dlp, ffmpeg, deno management
│   └── download/        queue, job processes, probing, validation
├── renderer/
│   ├── App.tsx          composition and state
│   ├── components/      form, queue, settings, preparation screen
│   ├── i18n.tsx         all UI strings
│   └── theme.ts         theme resolution
└── shared/types.ts      types shared across the IPC boundary

e2e/                     Playwright specs and fake binaries
resources/               application icons and their source PNG
scripts/make-icons.mjs   icon generation
docs/PLAN.md             design plan and decision log (Turkish)
```

### Lockfile note

`package.json` pins `npm@10.9.2` through the `packageManager` field, because npm 11.16
mangles the lockfile: it records platform-specific optional packages (esbuild, rollup) as
`extraneous` instead of `optional`, or drops them entirely. Either way `npm ci` then fails on
other platforms with `EBADPLATFORM` or `Missing … from lock file`.

If the lockfile has to be regenerated, delete `node_modules` as well and use npm 10 — keeping
an installed tree around makes npm record only the current platform's optional packages:

```bash
rm -rf node_modules package-lock.json
npx npm@10.9.2 install
```

Sanity check afterwards: the lockfile should contain more than one `@rollup/rollup-*` and
`@esbuild/*` entry, all marked `"optional": true`.

## Testing

| Layer | Tool | Coverage |
| --- | --- | --- |
| Unit | Vitest | Progress parsing, URL and path validation, checksum verification, asset naming, spawn environment |
| Integration | Vitest + fake binaries | Job lifecycle (progress, failure, cancellation), queue concurrency, probing |
| End-to-end | Playwright + Electron | App boots and renders under the production CSP, probe → queue → completed file, settings popover position and language switching |

Unit and integration tests need no network: fake yt-dlp binaries stand in for the real one.
The end-to-end tests run against the packaged main process with fake binaries injected through
the environment variables above, and use a temporary user-data directory so they never touch
real settings or downloads.

CI runs lint, typecheck and the unit/integration tests on every push and pull request.
End-to-end tests are run locally because they package the app and need a display server.

## Building installers

```bash
npm run make
```

Artifacts land in `out/make`: `.dmg` and `.zip` on macOS, a Squirrel `Setup.exe` on Windows,
`.deb` and `.rpm` on Linux. Each platform must be built on its own runner.

Icons are generated from a single source image and committed, so a build never needs to
regenerate them. To refresh them (macOS only):

```bash
node scripts/make-icons.mjs [source.png]
```

## Releasing

Releases are triggered manually from the Actions tab, never by pushing a tag.

1. Open **Actions → Release → Run workflow**.
2. Tick the platforms to release: macOS, Windows, Linux (any combination).
3. Choose the version bump applied to each of them: `patch`, `minor` or `major`.
4. Run it.

The workflow then runs lint, typecheck and tests first, so a broken commit never gets released.
For every selected platform it builds the installers on that platform's runner, creates the
`<platform>-vX.Y.Z` tag on the current commit and publishes a GitHub release holding only that
platform's files. A platform whose build fails leaves no tag and no release, and does not
affect the others.

### Per-platform versioning

Each platform has its own version stream, so macOS can sit at 2.4.0 while Windows is still at
2.1.3. The current version of a stream is the newest tag in its namespace:

| Platform | Tag namespace | Release title |
| --- | --- | --- |
| macOS | `macos-vX.Y.Z` | `macos vX.Y.Z` |
| Windows | `windows-vX.Y.Z` | `windows vX.Y.Z` |
| Linux | `linux-vX.Y.Z` | `linux vX.Y.Z` |

A platform without any tag yet starts from the version in `package.json`. That field is only
the starting point: a single field cannot represent three independent streams, so the workflow
stamps the computed version into the build and never commits the change.

## Security

- The renderer runs with `contextIsolation`, `sandbox` and without `nodeIntegration`.
- The preload exposes a fixed allowlist of functions; `ipcRenderer` itself is never exposed.
- A Content-Security-Policy header is applied to the session; only YouTube thumbnail images may
  be loaded from a remote origin.
- In-app navigation is blocked and external links open in the system browser.
- yt-dlp is spawned with an argument array, never through a shell.
- URLs are validated in the main process against an https + YouTube host allowlist, and album
  names cannot escape the destination directory.
- Downloaded binaries are verified against published SHA-256 digests before they are run.
- DevTools are only opened when running against the development server.

## Troubleshooting

**"Checking dependencies…" never finishes, or preparation fails.**
Check the internet connection and restart the app. If GitHub is blocked on your network,
download the tools manually and point the app at them with `YTDL_YTDLP_PATH`,
`YTDL_FFMPEG_PATH` and `YTDL_DENO_PATH`.

**A download fails with "video unavailable".**
The video may be age- or region-restricted. *Details* on the failed job shows yt-dlp's own
output, which usually names the reason.

**Downloads suddenly stop working.**
YouTube changes break yt-dlp regularly. Delete `yt-dlp` from the app's `bin/` directory and
restart; the latest release is fetched again on the next launch.

**Some video formats are missing.**
This usually means deno is not available, so yt-dlp cannot solve YouTube's JavaScript
challenges. Check whether `deno` exists in the app's `bin/` directory.

**macOS refuses to open the app.**
Right-click the app and choose *Open*; the installers are unsigned.

## Licenses

The source code in this repository is MIT licensed ([`LICENSE`](LICENSE)).

None of the three tools is redistributed with the installers; each is downloaded onto the
user's machine at runtime: `yt-dlp` (Unlicense), `ffmpeg` (GPL-3.0-or-later) and `deno` (MIT).
The installers therefore contain no GPL-licensed components.

## Disclaimer

You are responsible for respecting copyright and the YouTube Terms of Service for whatever you
download. The app does not circumvent DRM.
