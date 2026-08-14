import type { ForgeConfig } from '@electron-forge/shared-types';
import path from 'node:path';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const MAINTAINER_NAME = 'caslanqa';
const MAINTAINER = 'caslanqa <cihan.aslan.qa@gmail.com>';
const HOMEPAGE = 'https://github.com/caslanqa/youtube_downloader';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // No extension: packager picks .icns / .ico per platform (see scripts/make-icons.mjs).
    icon: path.join('resources', 'icon'),
    appBundleId: 'com.caslanqa.ytdownloader',
    appCategoryType: 'public.app-category.utilities',
    win32metadata: { CompanyName: MAINTAINER_NAME },
    // The deb/rpm makers look for the executable under the package name, while packager
    // defaults to productName ("YouTube Downloader"), which fails the Linux build with
    // "could not find the Electron app binary".
    ...(process.platform === 'linux' ? { executableName: 'youtube-downloader' } : {}),
    // ffmpeg, yt-dlp and deno are not bundled; they are downloaded at runtime (docs/PLAN.md §6).
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ setupIcon: path.join('resources', 'icon.ico') }, ['win32']),
    new MakerDMG({ icon: path.join('resources', 'icon.icns') }, ['darwin']),
    // ZIP is macOS only: a future auto-update setup (electron-updater) expects this format.
    new MakerZIP({}, ['darwin']),
    new MakerRpm(
      { options: { icon: path.join('resources', 'icon.png'), homepage: HOMEPAGE, license: 'MIT' } },
      ['linux'],
    ),
    new MakerDeb(
      { options: { icon: path.join('resources', 'icon.png'), maintainer: MAINTAINER, homepage: HOMEPAGE } },
      ['linux'],
    ),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
