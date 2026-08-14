# YouTube Downloader

YouTube video ve oynatma listelerini MP3, MP4 veya WebM olarak indiren masaüstü uygulaması.
macOS, Windows ve Linux'ta çalışır. Electron + React + TypeScript.

> v1 JavaFX uygulamasının yeniden yazımıdır. Tasarım kararları ve gerekçeleri için
> [`docs/PLAN.md`](docs/PLAN.md); eski Java kaynakları git geçmişinde (`v1` öncesi commit'ler).

## Kullanım

1. Bağlantıyı yapıştırın — uygulama indirmeden önce başlığı, süreyi ve oynatma listesindeki
   öğe sayısını gösterir.
2. **Format** seçin: MP3 (ses), MP4 veya WebM (video).
3. **Albüm adı** yazın — dosyalar hedef klasörün altında bu adla bir alt klasöre iner
   (boş bırakılırsa `Indirilenler`). Bir oynatma listesinin dosyalarını bir arada tutar.
4. **Hedef klasör**: varsayılan `~/Downloads/YTDownloader`, "Seç" ile değiştirilir ve hatırlanır.
5. **Kuyruğa ekle**. İş kuyruğa girer, form temizlenir; beklemeden yeni bağlantı ekleyebilirsiniz.
   Varsayılan olarak aynı anda 2 indirme çalışır, gerisi sırada bekler.

Sağ üstteki dişli düğmesi: arayüz dili (Türkçe/İngilizce), tema (sistem/açık/koyu),
eşzamanlı indirme sayısı ve oynatma listesi dosyalarının numaralandırılması.

## İlk açılış

Uygulama, ihtiyaç duyduğu araçları kendisi indirir (SHA-256 doğrulamalı, `userData/bin/` altına):

| Araç | Boyut | Neden |
|---|---|---|
| `yt-dlp` | ~38 MB | İndirme motoru |
| `ffmpeg` | ~43 MB | MP3'e dönüştürme ve video+ses birleştirme |
| `deno` | ~37 MB (diskte ~81 MB) | yt-dlp'nin YouTube çıkarımı için gereken JavaScript runtime'ı |

Üçü de uygulamayla paketlenmez: yükleyici küçük kalır ve araçlar uygulamayı yeniden
yayınlamadan güncellenebilir. deno inemezse uygulama çalışmaya devam eder; yalnızca bazı
video formatları listelenmez. yt-dlp veya ffmpeg inemezse hazırlık ekranında hata görürsünüz.

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

CI yalnızca ilk üçünü çalıştırır; uçtan uca testler yerelde çalıştırılır
(bkz. [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Paketleme

```bash
npm run make          # çalışılan platformun yükleyicisini out/make altına üretir
```

Üretilenler: macOS `.dmg` + `.zip`, Windows `Setup.exe` (Squirrel), Linux `.deb` + `.rpm`.
Her platform kendi runner'ında derlenmeli — ffmpeg binary'si kurulum anında platforma göre iniyor.
CI, sürüm etiketi (`v*`) gönderildiğinde veya elle tetiklendiğinde üç platformu birden derler.

Yükleyiciler **imzalanmıyor**: macOS'ta ilk açılışta Gatekeeper uyarısı çıkar (sağ tık → Aç),
Windows'ta SmartScreen "yine de çalıştır" ister.

İkonlar tek kaynak PNG'den (`resources/icon-source.png`) üretilip depoya işlenmiştir;
yeniden üretmek için (macOS gerekir):

```bash
node scripts/make-icons.mjs
```

## Sorun giderme

- **"Bağımlılıklar hazırlanamadı"** — internet bağlantısını kontrol edip uygulamayı yeniden
  başlatın. Kurumsal ağ GitHub'ı engelliyorsa `yt-dlp`/`deno` ikililerini elle indirip
  `YTDL_YTDLP_PATH`, `YTDL_DENO_PATH`, `YTDL_FFMPEG_PATH` ortam değişkenleriyle gösterebilirsiniz.
- **İndirme "video unavailable" ile bitiyor** — video yaşa/bölgeye kısıtlı olabilir; hata
  kartındaki "Ayrıntı" yt-dlp'nin kendi çıktısını gösterir.
- **Uygulama eski sürüm indiriyor** — `userData/bin/` altındaki `yt-dlp` dosyasını silin,
  uygulama açılışta en son sürümü yeniden indirir.

## Lisanslar

Bu deponun kaynak kodu MIT lisanslıdır ([`LICENSE`](LICENSE)).

Kullanılan üç araç da **yükleyiciyle dağıtılmaz**; kullanıcının makinesinde çalışma zamanında
indirilir: `yt-dlp` (Unlicense), `ffmpeg` (GPL-3.0-or-later), `deno` (MIT). Bu nedenle
dağıtılan yükleyicide GPL bileşen bulunmaz.

## Sorumluluk

İndirdiğiniz içeriğin telif hakları ve YouTube kullanım şartları sizin sorumluluğunuzdadır.
Uygulama DRM koruması aşmaz.
