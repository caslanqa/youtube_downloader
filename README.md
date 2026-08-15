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
  - [Opening an unsigned build](#opening-an-unsigned-build)
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
- [Code signing](#code-signing)
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

### Opening an unsigned build

The installers are **not code-signed** (see [Code signing](#code-signing) for why), so the
operating system blocks them on first launch. This is a one-time step per install.

**macOS.** Gatekeeper refuses a plain double-click.

1. Right-click (or Control-click) the app in Finder → **Open** → **Open** again in the dialog.
2. On macOS 15 and newer that option may not appear. Try to open the app once, then go to
   **System Settings → Privacy & Security**, scroll to the message about the blocked app and
   press **Open Anyway**.
3. If macOS claims the app *"is damaged and can't be opened"*, it is the quarantine attribute
   rather than actual damage. Clear it and open the app again:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/YouTube Downloader.app"
   ```

**Windows.** SmartScreen shows a blue dialog: **More info → Run anyway**. If the installer
does nothing at all, right-click it → **Properties** → tick **Unblock** → **OK**, then run it
again.

**Linux.** `.deb` and `.rpm` files installed directly are not signature-checked, so nothing
special is needed. `rpm -i` may warn about a missing signature; that warning is expected.

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

**yt-dlp is checked for updates on every launch** (the *Keep yt-dlp up to date automatically*
setting, on by default): its installed version is compared against the latest tag on GitHub
and replaced if it is behind. yt-dlp breaks whenever YouTube changes something, so an installed
copy that quietly ages past its release is the most common reason downloads start failing. The
check never blocks startup — a network hiccup here just means the app continues with whatever
copy is already on disk.

## Usage

### Download form

1. **Paste a YouTube link.** The app inspects it and shows the title, duration and, for
   playlists, the number of items.
2. **Pick a format**: MP3 (audio), MP4 or WebM (video). Choosing MP4 or WebM reveals a
   **quality** selector — Best available, or a resolution cap from 2160p down to 360p — passed
   to yt-dlp as a `[height<=N]` filter. MP3 has no such control since it is audio-only.
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

## Code signing

The published installers are **not signed**, because signing costs money on both platforms: an
Apple Developer Program membership (99 USD/year) and a Windows code signing certificate
(roughly 200–400 USD/year, or a subscription such as Azure Trusted Signing). Users can open an
unsigned build with the one-time steps in
[Opening an unsigned build](#opening-an-unsigned-build); this section is about
turning signing on.

Signing is configured in [`forge.config.ts`](forge.config.ts) and the credentials belong in
repository secrets, wired through the `build` job of
[`.github/workflows/release.yml`](.github/workflows/release.yml).

**macOS — Developer ID plus notarization.**

1. Join the Apple Developer Program and create a **Developer ID Application** certificate.
2. Create an [app-specific password](https://support.apple.com/en-us/102654) for notarization.
3. Add to `packagerConfig`:

   ```ts
   osxSign: {},
   osxNotarize: {
     appleId: process.env.APPLE_ID,
     appleIdPassword: process.env.APPLE_PASSWORD, // app-specific password, not your Apple ID password
     teamId: process.env.APPLE_TEAM_ID,
   },
   ```

4. In CI, import the certificate into a temporary keychain before `npm run make` (for example
   with `apple-actions/import-codesign-certs`) and pass `APPLE_ID`, `APPLE_PASSWORD` and
   `APPLE_TEAM_ID` from secrets to the build step. Notarization uploads the app to Apple and
   usually adds a few minutes to the macOS job.

   Only the app bundle is signed and notarized. yt-dlp, ffmpeg and deno are downloaded at
   runtime rather than shipped inside the bundle, so they never need to be stapled — and the
   app already clears their quarantine attribute after downloading them.

**Windows — certificate or cloud signing.**

Since 2023 the certificate's private key must live on a hardware token or in a cloud HSM, so
an unattended CI build effectively needs a cloud signing service.

- *Cloud signing* (Azure Trusted Signing, SSL.com eSigner): write a `windowsSign` helper and
  reference it from both `packagerConfig.windowsSign` and `MakerSquirrel`.
- *Traditional `.pfx` file* (only workable where the key can be exported):

  ```ts
  new MakerSquirrel({
    certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
    certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
  }, ['win32']),
  ```

Note that a brand-new certificate still triggers SmartScreen until it builds up reputation;
an EV certificate skips that waiting period.

**Linux.** Nothing to sign for direct `.deb`/`.rpm` downloads. Signing only becomes relevant if
the packages are published through an apt or dnf repository, which needs a GPG key instead.

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

**A download fails with "403 Forbidden".**
This comes from YouTube, not from the app: yt-dlp reached the video but was refused when it
tried to fetch the actual audio/video data. It is usually one specific video, not every
download — a heavily-viewed video, a TV/film upload from a publisher with extra bot
protection, or a connection that has made a lot of requests recently. Wait a few minutes and
try again, or test with a different video to tell a per-video block apart from a
connection-wide one. If it never clears, make sure `yt-dlp` is up to date (see the next item).

**Downloads suddenly stop working.**
YouTube changes break yt-dlp regularly, which is why the app checks for a newer release on
every launch and updates automatically (see [First launch](#first-launch)). If that setting
has been turned off, or the app has been offline for a while, delete `yt-dlp` from the app's
`bin/` directory and restart; the latest release is fetched again on the next launch.

**Some video formats are missing.**
This usually means deno is not available, so yt-dlp cannot solve YouTube's JavaScript
challenges. Check whether `deno` exists in the app's `bin/` directory.

**macOS refuses to open the app, or says it is damaged.**
The installers are unsigned; "damaged" is the quarantine attribute rather than a broken
download. See [Opening an unsigned build](#opening-an-unsigned-build).

## Licenses

The source code in this repository is MIT licensed ([`LICENSE`](LICENSE)).

None of the three tools is redistributed with the installers; each is downloaded onto the
user's machine at runtime: `yt-dlp` (Unlicense), `ffmpeg` (GPL-3.0-or-later) and `deno` (MIT).
The installers therefore contain no GPL-licensed components.

## Disclaimer

You are responsible for respecting copyright and the YouTube Terms of Service for whatever you
download. The app does not circumvent DRM.
