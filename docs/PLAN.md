# YouTube Downloader — Modernizasyon Planı

**Durum:** Taslak · **Tarih:** 2026-08-14 · **Hedef:** JavaFX masaüstü uygulamasını Electron + TypeScript ile bu repoda sıfırdan yeniden geliştirmek.

---

## 1. Amaç

Mevcut JavaFX uygulaması çalışıyor ama üç sınırı var:

1. **Dağıtım:** JRE/JavaFX bağımlılığı, platform başına ayrı `jpackage` yükleyici, kullanıcıda `yt-dlp` ve `ffmpeg` manuel kurulu olmak zorunda.
2. **UI:** FXML ile sabit koordinatlı (`layoutX/layoutY`) 1000x800 pencere; responsive değil, tema yok, ilerleme göstergesi yok.
3. **Mimari:** İndirme, UI thread'inde bloklayarak çalışıyor; hata durumunda kullanıcıya yanlış bilgi veriliyor.

Hedef: aynı işlevi (YouTube video/playlist → MP3/MP4/WEBM, albüm klasörü) modern bir masaüstü uygulaması olarak sunmak; `yt-dlp` ve `ffmpeg` bağımlılıklarını uygulamanın kendisinin yönetmesi; üç platformda tek kod tabanından yükleyici üretmek.

### Kapsam dışı (ilk sürüm)

- Kod imzalama / notarization (bkz. §14 Riskler)
- Otomatik uygulama güncellemesi (auto-update) — altyapı hazır bırakılır, açılmaz
- Giriş gerektiren (login/cookie) içerik indirme
- Çoklu dil desteği (i18n yapısı hazır bırakılır, tek dil ile başlanır)

---

## 2. Mevcut uygulamanın envanteri

Yeniden yazımda korunacak davranışlar ve düzeltilecek kusurlar:

| Mevcut davranış | Kaynak | Karar |
|---|---|---|
| Albüm adı → `~/yt-dlp/<albüm>/` klasörü | `DirectoryUtils.java:8` | Korunur, ama hedef klasör kullanıcı tarafından seçilebilir olur (varsayılan: `~/Downloads/YTDownloader/<albüm>`) |
| MP3 / MP4 / WEBM format seçimi | `Yt_DlpUtils.java` | Korunur, format profilleri aynı `-f` seçicileriyle |
| Çıktı şablonu `%(title)s.%(ext)s` | `Yt_DlpUtils.java:15` | Korunur; playlist için `%(playlist_index)s - %(title)s.%(ext)s` opsiyonu eklenir |
| "Tamamlandı" etiketine tıklayınca klasör açılır | `YoutubeDownloaderController.java:47` | Korunur (`shell.openPath`) |
| İndirme UI thread'ini blokluyor | `YoutubeDownloaderController.java:43` | **Düzeltilir** — indirme main process'te ayrı child process, UI hiç bloklanmaz |
| Hata olsa da "Download completed" yazıyor | `YoutubeDownloaderController.java:44` | **Düzeltilir** — her iş için gerçek durum (queued/running/done/error) |
| `catch (Exception e) { return false; }` — sessiz hata | `Yt_DlpUtils.java:32` | **Düzeltilir** — stderr yakalanır, kullanıcıya ve log dosyasına yazılır |
| ComboBox seçilmezse NPE | `YoutubeDownloaderController.java:54` | **Düzeltilir** — form doğrulama, varsayılan seçim |
| İlerleme yok | — | **Yeni** — yüzde, hız, ETA, dosya bazlı ve playlist bazlı |
| `yt-dlp` kurulu değilse çalışmıyor | — | **Yeni** — otomatik indirme/güncelleme (§6) |
| ControlsFX / Ikonli / BootstrapFX bağımlılıkları kullanılmıyor | `pom.xml:30-44` | Düşer |

---

## 3. Teknoloji seçimleri

| Katman | Seçim | Gerekçe |
|---|---|---|
| Runtime | Electron (mevcut stable major) | Üç platform tek kod tabanı; Node.js API'si sayesinde child process ve dosya sistemi doğrudan erişilebilir |
| Dil | TypeScript (strict) | Süreçler arası sözleşmelerin (IPC) tip güvenliği |
| UI | React 19 + Tailwind CSS v4 | En geniş ekosistem; hazır erişilebilir komponentler (shadcn/ui, Radix) |
| Build / paketleme | Electron Forge + Vite plugin (`vite-typescript` template) | Resmî Electron aracı; Vite HMR; makers ile dmg/exe/deb üretimi tek konfigürasyondan |
| State | React `useState` (Faz 3 kararı) | Kuyruk durumu tek bileşende yaşıyor ve main sürecinden olay olarak geliyor; ayrı bir state kütüphanesi (Zustand) eklemeye gerek kalmadı. Bileşenler Faz 4'te bölünürken yeniden değerlendirilir |
| Test | Vitest (birim) + Playwright `_electron` (uçtan uca) | Vite ile aynı konfigürasyon; Playwright Electron'u doğrudan başlatabiliyor |
| Log | `electron-log` | Ana süreç ve renderer loglarını tek dosyada toplar, hata raporlaması için gerekli |
| İndirme motoru | `yt-dlp` (uygulamanın yönettiği binary) | Mevcut çözümle aynı; alternatifsiz |
| Medya işleme | `ffmpeg` (uygulamanın yönettiği binary) | MP3 çıkarma ve MP4 merge için zorunlu |

> **Not:** Sürüm numaraları geliştirme başlangıcında `npm create electron-app` çıktısına göre sabitlenir; bu doküman major seçimleri belirtir, exact sürümleri `package.json` belirler.

---

## 4. Hedef mimari

Electron'un üç süreç sınırı, güvenlik modelinin temeli. Kural: **renderer hiçbir zaman Node API'sine veya child process'e doğrudan erişmez.**

```
┌─────────────────────────────────────────────────────────────┐
│ Main process (Node.js)                                      │
│  ├── binaries/    yt-dlp + ffmpeg indirme, doğrulama, sürüm │
│  ├── download/    kuyruk, child process yönetimi, iptal     │
│  ├── parser/      yt-dlp JSON progress + stderr ayrıştırma  │
│  ├── settings/    kalıcı ayarlar (electron-store)           │
│  └── ipc/         ipcMain.handle kayıtları                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ contextBridge (izole edilmiş, allowlist)
┌───────────────────────────┴─────────────────────────────────┐
│ Preload (izole dünya)                                       │
│  window.api = { probe, enqueue, cancel, onProgress, ... }   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│ Renderer (React, nodeIntegration: false, sandbox: true)     │
│  UI + kuyruk görünümü; iş mantığı yok                       │
└─────────────────────────────────────────────────────────────┘
```

`BrowserWindow` ayarları (pazarlıksız):

```ts
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,   // varsayılan, açık bırakılır
  nodeIntegration: false,   // varsayılan
  sandbox: true,
}
```

### Dizin yapısı

```
.
├── docs/
│   └── PLAN.md
├── src/
│   ├── main/
│   │   ├── index.ts               # app lifecycle, pencere
│   │   ├── ipc.ts                 # tüm ipcMain.handle kayıtları
│   │   ├── binaries/
│   │   │   ├── manager.ts         # ensureBinaries(), sürüm kontrolü
│   │   │   ├── ytdlp.ts           # platform asset eşlemesi, indirme
│   │   │   └── ffmpeg.ts
│   │   ├── download/
│   │   │   ├── queue.ts           # eşzamanlılık limiti, sıralama
│   │   │   ├── job.ts             # tek iş: spawn, progress, iptal
│   │   │   └── formats.ts         # MP3/MP4/WEBM → yt-dlp argümanları
│   │   └── settings.ts
│   ├── preload/
│   │   └── index.ts               # contextBridge yüzeyi
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── store/                 # zustand
│   │   └── styles.css
│   └── shared/
│       └── types.ts               # main ve renderer'ın paylaştığı tipler
├── resources/                     # ikonlar (icns/ico/png)
├── forge.config.ts
├── vite.*.config.ts
└── package.json
```

`src/shared/types.ts` tek doğruluk kaynağı: IPC'nin iki ucu da bu tipleri import eder.

### Eski Java kodu

`legacy/` klasörüne taşınır ve README'de "v1, JavaFX" olarak işaretlenir. Tamamen silmek yerine taşımanın nedeni: yt-dlp argüman seçimleri ve klasör düzeni referans olarak lazım. Faz 6 sonunda (yeni sürüm üç platformda doğrulandıktan sonra) silinir; git geçmişinde kalır.

---

## 5. IPC sözleşmesi

Tüm kanallar tek dosyada tanımlı, `invoke/handle` (istek-yanıt) ve `send/on` (olay akışı) ayrımıyla:

```ts
// src/shared/types.ts
export type Format = 'mp3' | 'mp4' | 'webm';

export interface MediaInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  isPlaylist: boolean;
  entryCount: number;   // tekil video için 1
}

export interface JobRequest {
  url: string;
  format: Format;
  albumName: string;
  destination: string;      // mutlak yol
  numberPlaylistItems: boolean;
}

export type JobStatus =
  | { kind: 'queued' }
  | { kind: 'running'; percent: number; speed?: string; eta?: string; currentItem?: number; totalItems?: number }
  | { kind: 'done'; outputDir: string; fileCount: number }
  | { kind: 'error'; message: string; logTail: string }
  | { kind: 'cancelled' };

export interface Job {
  id: string;
  request: JobRequest;
  info?: MediaInfo;
  status: JobStatus;
}

export type BinaryState =
  | { kind: 'checking' }
  | { kind: 'downloading'; name: 'yt-dlp' | 'ffmpeg'; percent: number }
  | { kind: 'ready'; ytdlpVersion: string; ffmpegVersion: string }
  | { kind: 'failed'; message: string };
```

Preload yüzeyi (allowlist — `ipcRenderer` hiçbir zaman doğrudan expose edilmez):

```ts
// src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  // istek-yanıt
  probe:        (url: string)        => ipcRenderer.invoke('media:probe', url),
  enqueue:      (req: JobRequest)    => ipcRenderer.invoke('job:enqueue', req),
  cancel:       (jobId: string)      => ipcRenderer.invoke('job:cancel', jobId),
  pickFolder:   ()                   => ipcRenderer.invoke('dialog:pickFolder'),
  openFolder:   (path: string)       => ipcRenderer.invoke('shell:openFolder', path),
  getSettings:  ()                   => ipcRenderer.invoke('settings:get'),
  setSettings:  (s: Partial<Settings>) => ipcRenderer.invoke('settings:set', s),
  ensureBinaries: ()                 => ipcRenderer.invoke('binaries:ensure'),

  // olay akışı — event nesnesi renderer'a ASLA geçirilmez
  onJobUpdate:     (cb: (job: Job) => void) =>
    ipcRenderer.on('job:update', (_e, job) => cb(job)),
  onBinaryState:   (cb: (s: BinaryState) => void) =>
    ipcRenderer.on('binaries:state', (_e, s) => cb(s)),
});
```

`(_e, value) => cb(value)` sarmalaması bilinçli: callback'e `IpcRendererEvent` geçirmek `event.sender` üzerinden `ipcRenderer`'ı renderer'a sızdırır — Electron güvenlik dokümanının açıkça uyardığı hata.

---

## 6. Binary yönetimi (yt-dlp + ffmpeg)

Bu, projenin en kritik ve mevcut uygulamanın en zayıf parçası. Seçilen strateji: **runtime indirme + otomatik güncelleme.**

### Neden runtime indirme

`yt-dlp`, YouTube tarafındaki değişikliklere göre çok sık (haftalık mertebede) sürüm çıkarır. Binary'yi installer'a gömmek, uygulamayı her yt-dlp sürümünde yeniden paketlemeyi gerektirir; aksi halde kullanıcının indirmeleri sessizce bozulur. Runtime indirme, uygulamayı dokunmadan güncel tutar.

### Akış

```
Uygulama açılışı
  └─ ensureBinaries()
       ├─ userData/bin/ içinde yt-dlp var mı?
       │    ├─ Hayır → GitHub releases API'sinden son sürüm  → indir → checksum doğrula → chmod +x
       │    └─ Evet  → son kontrol 24 saatten eskiyse arka planda sürüm kontrolü
       ├─ ffmpeg için aynı akış
       └─ durum renderer'a 'binaries:state' ile akıtılır
```

Konum: `app.getPath('userData')/bin/`. Installer'ın içine değil, kullanıcı verisine yazılır — yazma izni sorunu çıkmaz, uygulama güncellemesi binary'yi silmez.

### Platform asset eşlemesi (yt-dlp releases)

| `process.platform` / `arch` | Asset |
|---|---|
| `darwin` (universal) | `yt-dlp_macos` |
| `win32` x64 | `yt-dlp.exe` |
| `linux` x64 | `yt-dlp_linux` |
| `linux` arm64 | `yt-dlp_linux_aarch64` |

Bu isimler yt-dlp'nin release varlıklarına göre geliştirme başında doğrulanır ve tek bir tabloda (`src/main/binaries/ytdlp.ts`) tutulur.

### Güvenlik (pazarlıksız)

- İndirme yalnızca `https://github.com/yt-dlp/yt-dlp/releases/...` üzerinden.
- Her indirmede release'in `SHA2-256SUMS` dosyası da çekilir; binary'nin SHA-256 özeti karşılaştırılır. **Eşleşmezse dosya silinir ve işlem hata ile biter.**
- İndirilen dosya önce `.part` uzantısıyla yazılır, doğrulama sonrası `rename` edilir (yarım dosya asla çalıştırılmaz).
- Unix'te `chmod 0755`; macOS'ta karantina niteliği (`com.apple.quarantine`) temizlenir.

### ffmpeg

MP3 çıkarma (`-x --audio-format mp3`) ve MP4 merge (`bestvideo+bestaudio`) ffmpeg olmadan çalışmaz. İki seçenek:

- **A (varsayılan):** `ffmpeg-static` npm paketi ile uygulamaya gömmek. Platform binary'sini npm install anında indirir; bu yüzden her platformun installer'ı kendi CI runner'ında üretilmeli (zaten §12'deki matris bunu yapıyor). `asarUnpack` ile paketten çıkarılır. Artı: offline çalışır, sürüm sabit. Eksi: installer boyutu ~+80 MB.
- **B:** yt-dlp binary'si ile aynı runtime indirme akışı. Artı: küçük installer. Eksi: macOS için resmî tek dosya statik build kaynağı yt-dlp organizasyonunda yok; üçüncü parti kaynak gerekir — güven sınırı genişler.

**Karar: A.** Sebep: ffmpeg, yt-dlp gibi sık güncelleme gerektirmez; üçüncü parti indirme kaynağına güvenmemek daha değerli. B'ye geçiş kolay (aynı `manager.ts` arayüzü).

### JavaScript runtime (yt-dlp EJS) — açık konu

yt-dlp 2026.07 sürümü, JS runtime olmadan YouTube çıkarımını **kullanımdan kaldırılmış** sayıyor:

```
WARNING: [youtube] No supported JavaScript runtime could be found. Only deno is enabled
by default ... YouTube extraction without a JS runtime has been deprecated, and some
formats may be missing.
```

Desteklenen runtime'lar (öncelik sırasıyla): `deno`, `node`, `quickjs`, `bun`. Varsayılan olarak yalnızca `deno` etkin ve kullanıcı makinesinde deno bulunmuyor.

**Bulgu:** Electron kendi Node'unu içerir; `ELECTRON_RUN_AS_NODE=1` ortam değişkeni ile uygulama ikilisi node gibi davranır. yt-dlp'ye `--js-runtimes node:<electron-ikilisi>` verildiğinde runtime kabul edildi ve uyarı kayboldu:

```
[youtube] [jsc:node] Solving JS challenges using node
```

Yani **ek bir binary indirmeden** (deno paketlemeden) bu gereksinim karşılanabiliyor.

**Ölçüm (Faz 5, aynı video, `-F` çıktısı):**

| | Listelenen format satırı | İçinde mp4/m4a |
|---|---|---|
| Runtime kapalı | 31 | 17 |
| Runtime açık (Electron'un Node'u) | 37 | 23 |

Uyarı gerçek: JS runtime olmadan formatların bir kısmı hiç listelenmiyor ve eksilenler arasında mp4/m4a var — yani en çok MP4 profili (`bestvideo[ext=mp4]+bestaudio[ext=m4a]`) etkileniyor.

**Neden hâlâ açılmadı:** Paketlenmiş uygulamada `RunAsNode: false` fuse'u bu modu kapatıyor (bkz. §15/6). Fuse'u açmak uygulama ikilisini genel amaçlı Node yorumlayıcısına çevirir; bu güvenlik ödünü verilmeden önce alternatif (deno ikilisini yt-dlp gibi indirip yönetmek) değerlendirilmeli. Karar kullanıcıya bırakıldı.

### Komut çalıştırma (enjeksiyon güvenliği)

Kullanıcıdan gelen URL doğrudan kabuğa verilmez:

- `child_process.spawn(binaryPath, argsArray)` — `shell: true` **kullanılmaz**, `exec` kullanılmaz.
- URL, spawn'dan önce doğrulanır: `new URL()` ile ayrıştırılabilmeli, protokol `https:` olmalı, host allowlist'te olmalı (`youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`).
- Albüm adı dosya yolu olarak kullanılıyor: yol ayırıcılar ve `..` temizlenir, sonuç hedef klasörün altında kaldığı `path.resolve` ile doğrulanır.

### İlerleme ayrıştırma

Satır ayrıştırmak yerine yt-dlp'nin yapılandırılmış çıktısı kullanılır:

```
yt-dlp --newline --no-color --progress-template "download:%(progress)j" ...
```

**Dikkat (gerçek çıktıyla doğrulandı, yt-dlp 2026.07.04):** şablondaki `download:` bir **tip seçicidir**, çıktıya yazılmaz. Satırlar öneksiz, çıplak JSON olarak gelir:

```
{"status": "downloading", "downloaded_bytes": 130048, "total_bytes": 307453, ...}
```

Ayrıştırıcı bu yüzden `download:` öneki aramaz; satırın `{` ile başlamasına ve `downloaded_bytes` alanı taşımasına bakar. Sahte test ikilileri de aynı biçimi üretir — aksi halde testler yeşil kalırken gerçek ilerleme çubuğu hiç hareket etmez.

Her satır JSON: `downloaded_bytes`, `total_bytes`, `speed`, `eta`, `filename`. Playlist ilerlemesi için `%(info.playlist_index)s/%(info.n_entries)s` şablona eklenir. Bu, mevcut koddaki `line.contains("Downloading item")` string eşlemesinin yerini alır — yt-dlp çıktı metnini değiştirse bile bozulmaz.

İndirme öncesi metadata: `yt-dlp -J --flat-playlist <url>` ile başlık, süre, thumbnail, öğe sayısı çekilir; UI indirmeye başlamadan önce ne indireceğini gösterir.

---

## 7. Format profilleri

Mevcut argümanlar korunur, tek yerde tanımlanır (`src/main/download/formats.ts`):

```ts
const OUTPUT_TEMPLATE = (numbered: boolean) =>
  numbered ? '%(playlist_index)s - %(title)s.%(ext)s' : '%(title)s.%(ext)s';

export const PROFILES: Record<Format, string[]> = {
  mp3:  ['-x', '-f', 'bestaudio', '--audio-format', 'mp3'],
  mp4:  ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]', '--merge-output-format', 'mp4'],
  webm: ['-f', 'bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]'],
};
```

Ortak argümanlar: `--ffmpeg-location <path>`, `--no-color`, `--newline`, `--progress-template`, `-o <dest>/<template>`, `--no-playlist` (kullanıcı tekil video seçtiyse), `--embed-thumbnail --embed-metadata` (MP3 için, opsiyonel ayar).

---

## 8. UI / UX

Tek pencere, üç bölge. Sabit koordinat yok — Tailwind ile responsive, minimum 720x560, yeniden boyutlandırılabilir.

```
┌──────────────────────────────────────────────────────────┐
│  YouTube Downloader                       [tema] [ayar]  │  ← başlık çubuğu
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │ https://youtube.com/...              [Yapıştır]    │  │  ← URL girişi
│  └────────────────────────────────────────────────────┘  │
│  ┌──────┐  Bir Şarkı Adı — 4:12                          │  ← probe önizleme
│  │thumb │  Playlist · 24 öğe                             │     (URL girilince otomatik)
│  └──────┘                                                │
│  Format [MP3 ▾]   Albüm [____]   Klasör [~/... ] [Seç]   │
│                                          [  İNDİR  ]     │
├──────────────────────────────────────────────────────────┤
│  Kuyruk                                                  │
│  ▸ Album A · MP3    ████████░░ 78%  2.1MB/s  ETA 0:14  ✕ │  ← iş kartları
│  ▸ Album B · MP4    tamamlandı · 24 dosya      [Klasör]  │
│  ▸ Album C · WEBM   hata: video unavailable    [Detay]   │
└──────────────────────────────────────────────────────────┘
```

Davranış kuralları:

- URL yapıştırıldığında otomatik `probe` — kullanıcı ne indireceğini indirmeden önce görür.
- İndir'e basınca iş kuyruğa girer, form temizlenir; kullanıcı hemen ikinci URL girebilir. Eşzamanlı iş limiti varsayılan 2 (ayarlanabilir), gerisi sırada bekler.
- Her iş iptal edilebilir (`SIGTERM` → 3 sn sonra `SIGKILL`, yarım dosyalar temizlenir).
- Hata kartında "Detay" son 50 satır yt-dlp çıktısını gösterir — sessiz hata yok.
- İlk açılışta binary indirme durumu tam ekran bir hazırlık adımı olarak gösterilir; hazır olana kadar İndir devre dışı.
- Açık/koyu tema, sistem tercihine uyar (`prefers-color-scheme`).

### Erişilebilirlik (baştan, sonradan eklenmez)

- Tüm interaktif öğeler native (`<button>`, `<select>`, `<input>`) veya Radix tabanlı — `div onClick` yok.
- Her input'un `<label htmlFor>` bağı var; hata mesajları `aria-describedby` + `aria-invalid` ile input'a bağlı.
- Kuyruk ilerleme değişimleri `role="status" aria-live="polite"`; hata bildirimleri `role="alert"`.
- Klavye ile tam kullanım; `:focus-visible` görünür odak halkası; kontrast en az 4.5:1.
- Uzun ilerleme animasyonları `prefers-reduced-motion` ile kapatılır.

---

## 9. Ayarlar (kalıcı)

`electron-store` ile JSON olarak `userData` altında:

| Ayar | Varsayılan |
|---|---|
| `destination` | `~/Downloads/YTDownloader` |
| `defaultFormat` | `mp3` |
| `concurrency` | `2` |
| `numberPlaylistItems` | `true` |
| `embedMetadata` | `true` |
| `theme` | `system` |
| `ytdlpAutoUpdate` | `true` |

---

## 10. Test stratejisi

Kapsam, riskin yoğunlaştığı yere odaklanır — UI piksel testi değil, sözleşmeler:

| Katman | Araç | Ne test edilir |
|---|---|---|
| Birim | Vitest | `formats.ts` argüman üretimi; progress JSON ayrıştırıcı (gerçek yt-dlp çıktısı fixture'ları); URL doğrulama (allowlist dışı host reddi, `javascript:` reddi); albüm adı yol temizliği (`../` kaçışı reddi); checksum doğrulama (bozuk dosya reddedilir) |
| Entegrasyon | Vitest + sahte binary | Kuyruk davranışı: eşzamanlılık limiti, iptal, hata yayılımı — `yt-dlp` yerine kontrollü çıktı üreten sahte script |
| Uçtan uca | Playwright `_electron` | **Uygulanan (2 test):** paketlenmiş ana süreç açılıyor ve arayüz yükleniyor (üretim CSP'si doğrulanmış olur); URL → probe → kuyruğa ekle → "Tamamlandı" + dosya diskte. Binary'ler `YTDL_YTDLP_PATH` / `YTDL_FFMPEG_PATH` ile sahtelenir, ayarlar geçici `--user-data-dir` altına yazılır: ağsız ve kullanıcının klasörlerine dokunmadan çalışır. **Kapsam dışı bırakıldı:** iptal akışı ve hazırlık ekranı senaryoları — daha fazla test yüzeyi istenmedi |
| Duman (manuel) | — | Her platformda gerçek bir kısa video indirme, her üç formatta |

Ağ gerektiren gerçek indirme testleri CI'da varsayılan olarak çalışmaz (`@network` etiketi), yalnızca sürüm öncesi manuel tetiklenir.

---

## 11. Güvenlik kontrol listesi

- [x] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- [x] `ipcRenderer` renderer'a expose edilmiyor; yalnızca allowlist fonksiyonlar
- [x] Olay callback'lerine `IpcRendererEvent` geçirilmiyor
- [x] `spawn` argüman dizisiyle, `shell: true` yok, `exec` yok
- [x] URL protokol + host allowlist doğrulaması main tarafında (renderer doğrulamasına güvenilmez)
- [x] Albüm adı → yol geçişi (`path traversal`) engelleniyor
- [x] Binary indirmeleri yalnızca HTTPS + SHA-256 doğrulaması
- [x] `will-navigate` ve `setWindowOpenHandler` ile uygulama içi gezinme engelleniyor; dış bağlantılar `shell.openExternal`
- [x] Content-Security-Policy başlığı tanımlı (`default-src 'self'`); kapak görselleri için `img-src 'self' data: https://*.ytimg.com` istisnası var. Üretim politikasının arayüzü bozmadığı uçtan uca testle doğrulanıyor — CSP hatası doğrudan boş pencere demek olduğu için bu testin varlığı politikanın kendisi kadar önemli
- [x] Üretim derlemesinde DevTools kapalı (yalnızca geliştirme sunucusu varken açılıyor)

---

## 12. Build ve dağıtım

`forge.config.ts` makers:

```ts
makers: [
  new MakerDMG({}, ['darwin']),        // macOS .dmg
  new MakerZIP({}, ['darwin']),        // auto-update altyapısı için
  new MakerSquirrel({}, ['win32']),    // Windows Setup.exe
  new MakerDeb({}, ['linux']),
  new MakerRpm({}, ['linux']),
]
```

`packagerConfig`: `asar: true`, `asarUnpack` ile ffmpeg binary'si; `icon` platform başına (`resources/icon.icns|ico|png`).

**CI (GitHub Actions):** `macos-latest`, `windows-latest`, `ubuntu-latest` matrisi. Her runner kendi platformunun installer'ını üretir (ffmpeg-static seçimi bunu zorunlu kılıyor). Tag push'unda artefaktlar GitHub Release'e yüklenir.

**İmzalama yok (ilk sürüm):** macOS'ta Gatekeeper "doğrulanamadı" uyarısı, Windows'ta SmartScreen uyarısı çıkar. README'de ilk açılış talimatı (macOS: sağ tık → Aç) yer alır.

---

## 13. Yol haritası

Her faz sonunda uygulama çalışır durumda olur — yarım bırakılmış katman yok.

| Faz | İçerik | Çıktı / doğrulama |
|---|---|---|
| **0. İskelet** | `create-electron-app --template=vite-typescript`, React + Tailwind, TS strict, ESLint/Prettier, `legacy/` taşıması, README güncellemesi | `npm start` ile boş ama modern pencere açılıyor |
| **1. Binary yönetimi** | `binaries/manager.ts`, yt-dlp indirme + SHA-256 doğrulama, ffmpeg-static entegrasyonu, hazırlık ekranı | Temiz makinede uygulama açılıp "yt-dlp x.y.z hazır" diyor; birim testleri geçiyor |
| **2. İndirme çekirdeği** | `spawn` ile tek iş, progress JSON ayrıştırma, iptal, hata yakalama; UI'da tek işlik basit görünüm | Gerçek bir video MP3 olarak iniyor, yüzde akıyor, iptal çalışıyor |
| **3. Kuyruk + IPC tamamlanması** | Kuyruk, eşzamanlılık limiti, probe ekranı, ayarlar kalıcılığı | Üç iş sıraya alınıp doğru sırayla tamamlanıyor |
| **4. UI cilası** | Tasarım sistemi, tema, erişilebilirlik geçişi, boş/hata durumları, klasör açma | Erişilebilirlik kontrol listesi (§8) geçiyor; klavye ile tam kullanım |
| **5. Test + sertleştirme** | Vitest paketi, Playwright uçtan uca, güvenlik kontrol listesi (§11) tamamlanması | CI yeşil |
| **6. Paketleme** | forge makers, ikonlar, GitHub Actions matrisi, Release otomasyonu | Üç platformda kurulan ve çalışan installer; duman testi geçti |
| **7. Temizlik** | `legacy/` silinir, README + kullanım dokümanı, sürüm etiketi `v2.0.0` | Repo tek teknolojiye indi |

---

## 14. Riskler

| Risk | Etki | Karşılık |
|---|---|---|
| yt-dlp release asset isimleri değişir | İlk açılışta binary inmez | Asset eşlemesi tek dosyada; indirme hatası kullanıcıya "manuel yt-dlp yolu seç" seçeneği sunar |
| İmzasız uygulama macOS/Windows'ta uyarı veriyor | Kullanıcı güvensiz hissediyor / açamıyor | README'de açık talimat; imzalama Faz 7 sonrası opsiyon |
| ffmpeg installer boyutunu ~80 MB büyütüyor | İndirme süresi | Kabul edilir; gerekirse §6-B'ye geçilir |
| YouTube tarafındaki değişiklikler indirmeyi bozar | Uygulama işlevsiz kalır | yt-dlp otomatik güncelleme (24 saatlik kontrol) tam da bunun için |
| Electron ile ~150 MB'lık uygulama, JavaFX'e göre büyük | Disk / indirme | Kabul edilir; runtime bağımlılığı olmaması karşılığında |
| Telif / kullanım şartları | Hukuki | README'de kullanım sorumluluğu notu; uygulama DRM aşma özelliği içermez |

---

## 15. Açık kararlar

Geliştirme sırasında netleştirilecek, planı bloklamayan konular:

1. Uygulama adı ve bundle identifier (`com.caslanqa.ytdownloader` öneri).
2. İkon: mevcut `ytdownload.png` yeniden mi kullanılacak, yeni tasarım mı?
3. Arayüz dili: İngilizce mi Türkçe mi başlanacak (i18n yapısı her hâlükârda hazır bırakılır).
4. `legacy/` Faz 7'de gerçekten silinsin mi, yoksa arşiv olarak kalsın mı?
5. Auto-update (electron-updater) ne zaman devreye girsin — imzalama olmadan macOS'ta çalışmıyor.
6. yt-dlp JS runtime'ı (`--js-runtimes node:<electron>` + `ELECTRON_RUN_AS_NODE=1`) açılsın mı? Teknik olarak çalıştığı doğrulandı; açık/kapalı indirme başarısı karşılaştırması yapılmadı (bkz. §6). **Ek kısıt:** `forge.config.ts` içindeki `RunAsNode: false` fuse'u paketlenmiş uygulamada bu modu kapatır. Fuse'u açmak, uygulama ikilisinin genel amaçlı bir Node yorumlayıcısı olarak kullanılabilmesi demektir — güvenlik ödünü. Alternatif: deno ikilisini yt-dlp gibi indirip yönetmek (installer'ı büyütmez, indirme akışı zaten var).

---

## 16. Sonraki adım

Bu doküman onaylandığında **Faz 0** başlar: repo iskeleti, `legacy/` taşıması ve boş ama çalışan Electron + React + Tailwind penceresi.
