// Uygulama ikonlarını tek kaynak PNG'den üretir: resources/icon.{png,icns,ico}
// Kullanım: node scripts/make-icons.mjs [kaynak.png]
//
// icns üretimi macOS araçlarına (sips, iconutil) bağlı — ikonlar üretildikten sonra
// depoya işlendiği için diğer platformlarda derleme yaparken bu script gerekmiyor.
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

// macOS .icns: iconutil sabit isimlendirme bekler (retina varyantları dahil).
for (const size of [16, 32, 64, 128, 256, 512]) {
  resize(size, path.join(tmpIconset, `icon_${size}x${size}.png`));
  resize(size * 2, path.join(tmpIconset, `icon_${size}x${size}@2x.png`));
}
execFileSync('iconutil', ['-c', 'icns', tmpIconset, '-o', path.join(outDir, 'icon.icns')]);
fs.rmSync(tmpIconset, { recursive: true, force: true });

// Linux ve pencere ikonu için tek PNG.
resize(512, path.join(outDir, 'icon.png'));

// Windows .ico: birden çok çözünürlük tek dosyada.
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoSources = icoSizes.map((size) => {
  const file = path.join(outDir, `.ico-${size}.png`);
  resize(size, file);
  return file;
});
fs.writeFileSync(path.join(outDir, 'icon.ico'), await pngToIco(icoSources));
for (const file of icoSources) fs.rmSync(file, { force: true });

console.log('İkonlar üretildi:', fs.readdirSync(outDir).join(', '));
