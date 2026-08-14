// Generates the application icons from a single source PNG: resources/icon.{png,icns,ico}
// Usage: node scripts/make-icons.mjs [source.png]
//
// icns generation relies on macOS tools (sips, iconutil). The generated icons are committed,
// so builds on other platforms never need to run this script.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import pngToIco from 'png-to-ico';

const source = process.argv[2] ?? 'resources/icon-source.png';
const outDir = 'resources';
const tmpIconset = path.join(outDir, 'icon.iconset');

fs.mkdirSync(tmpIconset, { recursive: true });

function resize(size, destination) {
  execFileSync('sips', ['-z', String(size), String(size), source, '--out', destination], { stdio: 'ignore' });
}

// macOS .icns: iconutil expects fixed file names, including the retina variants.
for (const size of [16, 32, 64, 128, 256, 512]) {
  resize(size, path.join(tmpIconset, `icon_${size}x${size}.png`));
  resize(size * 2, path.join(tmpIconset, `icon_${size}x${size}@2x.png`));
}
execFileSync('iconutil', ['-c', 'icns', tmpIconset, '-o', path.join(outDir, 'icon.icns')]);
fs.rmSync(tmpIconset, { recursive: true, force: true });

// Single PNG for Linux and the window icon.
resize(512, path.join(outDir, 'icon.png'));

// Windows .ico: several resolutions in one file.
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoSources = icoSizes.map((size) => {
  const file = path.join(outDir, `.ico-${size}.png`);
  resize(size, file);
  return file;
});
fs.writeFileSync(path.join(outDir, 'icon.ico'), await pngToIco(icoSources));
for (const file of icoSources) fs.rmSync(file, { force: true });

console.log('Icons generated:', fs.readdirSync(outDir).join(', '));
