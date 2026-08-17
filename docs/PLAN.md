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

Önce `legacy/` klasörüne taşındı (yt-dlp argüman seçimleri ve klasör düzeni referans olarak lazımdı), **Faz 7'de kaldırıldı** — git geçmişinde duruyor. Uygulama ikonunun 4000×4000 kaynağı silinmeden önce `resources/icon-source.png` olarak korundu.

Not: plan bu silmeyi "üç platformda doğrulandıktan sonra" diye koşullamıştı; Windows ve Linux yükleyicileri CI'nin ilk sürüm derlemesine kadar üretilmemiş olacak. Silme yine de yapıldı, çünkü Java kaynakları git geçmişinden bire bir geri alınabilir ve yeni sürümün doğruluğu onlara bakmayı gerektirmiyor.

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
       ├─ userData/bin/ içinde yt-dlp var mı ve çalıştırılabilir mi?
       │    ├─ Hayır → GitHub releases API'sinden son sürüm → indir → checksum doğrula → chmod +x
       │    └─ Evet  → ytdlpAutoUpdate açıksa: --version ile GitHub'ın son tag_name'i karşılaştırılır,
       │                farklıysa aynı indir/doğrula akışıyla üzerine yazılır (en iyi çaba: ağ hatası
       │                mevcut kopyayla devam eder, hiçbir zaman açılışı bloklamaz)
       ├─ ffmpeg için aynı akış (güncelleme kontrolü olmadan)
       └─ durum renderer'a 'binaries:state' ile akıtılır
```

Konum: `app.getPath('userData')/bin/`. Installer'ın içine değil, kullanıcı verisine yazılır — yazma izni sorunu çıkmaz, uygulama güncellemesi binary'yi silmez.

**Sürüm kontrolü, Faz 7 sonrasında bir kullanıcı raporuyla tamamlandı.** Yukarıdaki akış aslında baştan böyle tasarlanmıştı ama kod hiç yazılmamıştı: `ensureYtDlp` yalnızca "dosya var mı ve çalışıyor mu" bakıyordu, sürümüne hiç bakmıyordu — bir kez inen yt-dlp, elle silinmedikçe sonsuza dek kullanılıyordu. Kullanıcı bir videoda ısrarla "403 Forbidden" alınca (yt-dlp YouTube'un JS zorluklarını çözemeyince tipik olarak bu hatayı verir) yerel sürümü GitHub'ın son sürümüyle karşılaştırdık; bu ortamda ikisi aynıydı ama kontrolün kodda hiç var olmadığı ortaya çıktı — başka bir makinede aylarca eski bir kopya sessizce kalabilirdi.

Orijinal tasarım "son kontrolün üzerinden 24 saat geçmişse" diye bir eşik öngörüyordu; onun yerine **her açılışta** kontrol edilecek şekilde basitleştirildi: GitHub'ın kimliksiz API sınırı (saatte 60 istek) tek kullanıcılı bir masaüstü uygulaması için bolca yeterli, eşik mekanizması eklemek 24 saat boyunca gerçek bir bozulmayı gizleme riskini taşıyor. Kontrol, mevcut `ytdlpAutoUpdate` ayarıyla (varsayılan açık) kapatılabiliyor; ayarlar açılır kutusuna bir onay kutusu eklendi. ffmpeg ve deno için aynı kontrol eklenmedi — ffmpeg ve deno, YouTube'daki değişikliklerle bozulan taraf değil, yalnızca yt-dlp'nin YouTube çıkarımı sürümle birebir bağlı.

Bu değişiklik ayrıca gizli bir riski ortaya çıkardı ve düzeltti: `downloadWithProgress` checksum'u dosya zaten `localPath`'e taşındıktan **sonra** doğruluyordu. İlk kurulumda zararsızdı (önceden hiçbir şey yoktu, silinecek bir şey de yoktu) ama güncelleme senaryosunda bozuk bir indirme, halihazırda çalışan eski binary'yi silip yerine hiçbir şey bırakmayabilirdi. Artık doğrulama `.part` dosyası üzerinde, `rename` ile yer değiştirmeden **önce** yapılıyor; doğrulama başarısız olursa mevcut çalışan binary'ye hiç dokunulmuyor.

Gerçek uçtan uca doğrulama: yerel `yt-dlp` sahte bir eski sürüm (`2025.01.01`) raporlayacak şekilde değiştirildi, uygulama açıldı, GitHub'ın son sürümüyle (`2026.07.04`) karşılaştırdı, otomatik indirip üzerine yazdı — yeni binary çalışıyor ve doğru sürümü raporluyor.

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

- **A:** `ffmpeg-static` npm paketi ile uygulamaya gömmek. Artı: offline çalışır, sürüm sabit. Eksi: yükleyici ~45 MB büyür ve GPL lisanslı bir ikili **dağıtılmış** olur — bildirim ve kaynak erişimi yükümlülüğü doğar.
- **B:** yt-dlp/deno ile aynı runtime indirme akışı. Artı: küçük yükleyici, GPL dağıtımı yok (kullanıcı kendi makinesine indiriyor), ffmpeg uygulamadan bağımsız güncellenebilir. Eksi: ilk açılışta bir indirme daha; ağsız kurulum çalışmaz.

**Karar: B** (Faz 7 sonrası, ilk sürümde A idi). Kaynak: `eugeneware/ffmpeg-static` GitHub release'indeki tek dosyalık statik derlemeler — npm paketiyle gelen ikililerin **aynısı**, yani davranış değişmiyor; darwin-arm64 dahil tüm platformlar var. Bütünlük GitHub'ın varlık başına verdiği `digest: sha256:…` alanıyla doğrulanır (bu repo ayrı bir SUMS dosyası yayınlamıyor; npm paketinin kendi kurulum betiği ise hiç doğrulama yapmıyor — yani indirmeyi kendimiz yapmak bütünlük açısından bir gerileme değil, iyileştirme).

ffmpeg **zorunlu**: MP3'e dönüştürme ve video+ses birleştirme onsuz çalışmaz. Bu yüzden deno'nun aksine "en iyi çaba" değil — inemezse hazırlık düşer ve kullanıcı hata ekranını görür.

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

**Karar: deno, yt-dlp gibi yönetilir.** Electron'un kendi Node'unu kullanmak paketlenmiş uygulamada `RunAsNode: false` fuse'unu açmayı gerektiriyordu; bu, uygulama ikilisini genel amaçlı bir Node yorumlayıcısına çevirir (makinede kod çalıştırabilen bir saldırgan için imzalı bir yaşama aracı). Bunun yerine deno ikilisi ilk açılışta `userData/bin/` altına iniyor:

- Asset adı hedef üçlüsüyle kurulur: `deno-<arch>-<platform>.zip` (ör. `deno-aarch64-apple-darwin.zip`), her asset'in kendi `.zip.sha256sum` dosyası doğrulanır — yt-dlp'deki tek `SHA2-256SUMS` dosyasından farklı
- Arşiv açma işletim sisteminin kendi aracıyla yapılır (`unzip`, Windows'ta `Expand-Archive`) — ek bağımlılık yok
- yt-dlp runtime'ı PATH üzerinden bulur; indirilen deno'nun klasörü alt süreçlerin PATH'inin başına eklenir (`src/main/binaries/runtimeEnv.ts`), böylece her spawn çağrısına yol parametresi taşımak gerekmez
- **En iyi çaba:** deno inemezse hazırlık düşmez, uygulama JS runtime olmadan devam eder (bazı formatlar listelenmez). Tek bir indirmenin uygulamayı kullanılamaz hale getirmesi kabul edilebilir değil

Bedeli: ilk açılışta ~37 MB ek indirme (arşivden çıkınca diskte ~81 MB) ve yönetilecek ikinci bir binary.

Doğrulandı (macOS arm64, deno 2.9.5): indirme + checksum + arşiv açma zinciri çalışıyor ve yt-dlp runtime'ı PATH'ten buluyor — `[youtube] [jsc:deno] Solving JS challenges using deno`, listelenen format 31 → 37.

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
- Ayarlar başlıktaki dişli düğmesinin **altında** açılan native Popover (`popover="auto"` + CSS anchor positioning) içinde: açma/kapama, dışarı tıklayınca kapanma, Escape ve odağın düğmeye dönmesi tarayıcıdan gelir — React state'i ve elle odak yönetimi yazılmaz. Konumun gerçekten düğmenin altında ve sağa hizalı olduğu uçtan uca testte ölçülüyor (modal olarak ekranın ortasında açılması bilinen bir regresyon biçimi).
- Hedef klasör ayarlarda değil, indirme formunda: indirme anında görülüp değiştirilebilmeli. Seçim ayarlara yazılır, sonraki indirmelerde varsayılan olur.
- Arayüz dili Türkçe/İngilizce; seçim `<html lang>` özniteliğine de yansır.

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
| `defaultQuality` | `best` |
| `concurrency` | `2` |
| `numberPlaylistItems` | `true` |
| `embedMetadata` | `true` |
| `theme` | `system` |
| `language` | sistem diline göre |
| `ytdlpAutoUpdate` | `true` |
| `youtubeApiKey` | `''` (boş — arama kapalı) |

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

**CI (GitHub Actions):** `macos-latest`, `windows-latest`, `ubuntu-latest` matrisi. Her runner kendi platformunun installer'ını üretir. Matris yalnızca sürüm etiketinde (`v*`) ve elle tetiklemede çalışır — her push'ta üç runner çalıştırmak gereksiz. Tag push'unda artefaktlar `gh release upload` ile GitHub Release'e yüklenir. Ubuntu runner'ında `MakerRpm` için `rpm` paketi kurulur.

**Doğrulama durumu:** macOS arm64 için `.dmg` (144 MB) ve `.zip` yerelde üretildi, paketlenmiş uygulama hatasız açıldı (asar bütünlük fuse'u ve `Resources/` altındaki ffmpeg yolu dahil), ikonun pakete işlendiği dosya özetiyle doğrulandı. **Windows ve Linux yükleyicileri henüz hiç üretilmedi** — ilk gerçek denemeleri CI matrisinin ilk çalışmasında olacak.

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
| ~~Yükleyici GPL lisanslı ffmpeg içeriyor~~ | Hukuki | **Çözüldü:** ffmpeg artık paketlenmiyor, kullanıcının makinesine çalışma zamanında iniyor (§6-B). Dağıtılan yükleyicide GPL bileşen kalmadı; depo MIT |
| Uygulama ikonu YouTube marka işaretine benziyor | Marka | Kişisel kullanımda sorun değil; genel dağıtımda özgün bir ikon tasarlanmalı |

---

## 15. Açık kararlar

Geliştirme sırasında netleştirilecek, planı bloklamayan konular:

1. Uygulama adı ve bundle identifier (`com.caslanqa.ytdownloader` öneri).
2. İkon: mevcut `ytdownload.png` yeniden mi kullanılacak, yeni tasarım mı?
3. ~~Arayüz dili~~ **Karara bağlandı:** Türkçe ve İngilizce birlikte. Sözlük tek dosyada (`src/renderer/i18n.tsx`), kütüphane yok; ilk açılışta sistem diline göre seçilir, ayarlardan değiştirilir. **Bilinen boşluk:** main sürecinden gelen hata mesajları (ör. "Desteklenmeyen host") henüz Türkçe sabit — çevrilmeleri için hata kodlarına dönüştürülmeleri gerekiyor.
4. ~~`legacy/` silinsin mi~~ **Karara bağlandı (Faz 7):** silindi; git geçmişi arşiv görevini görüyor.
5. Auto-update (electron-updater) ne zaman devreye girsin — imzalama olmadan macOS'ta çalışmıyor.
6. ~~yt-dlp JS runtime'ı~~ **Karara bağlandı (Faz 5):** deno ikilisi yt-dlp gibi indirilip yönetiliyor; `RunAsNode` fuse'u kapalı kalıyor. Ayrıntı ve ölçüm için bkz. §6.

---

## 16. YouTube arama (Data API v3)

v1'in tek yöntemi bağlantı yapıştırmaktı. Bu bölüm, kullanıcının video adıyla arayıp sonuçlar arasından seçebilmesini ekliyor.

### Neden yt-dlp'nin arama modu değil, resmî API

yt-dlp `ytsearch:` sözde-URL'siyle arama yapabiliyor, ama bu YouTube'un sayfa kazıma (scraping) yoluyla arama sonucu çıkarması demek — 403 araştırmasında (bkz. §6, JS runtime bölümü) gördüğümüz bot korumasına aynı şekilde takılabilir ve sonuç yapısı (küçük resim, süre, kanal adı) garantili değil. Resmî Data API v3, yapılandırılmış JSON döner ve YouTube'un kendi hız sınırlama/kota mekanizmasıyla çalışır — kırılgan değil, öngörülebilir.

### Mimari: main süreçte, ham REST çağrısı

`src/main/search/youtube.ts`, `binaries/manager.ts`'in GitHub API'ye yaptığı gibi doğrudan `fetch` kullanıyor; resmî `googleapis` npm paketi (tüm Google API'lerini kapsayan devasa bir SDK) iki salt-okunur GET isteği için gereksiz bir bağımlılık olurdu. API anahtarı yalnızca main süreçte tutulur ve kullanılır — renderer'a hiçbir zaman geçmez, güvenlik mimarisinin geri kalanıyla (yt-dlp/ffmpeg/deno indirmeleri de main'de) tutarlı.

İki çağrı zincirlenir:
1. `search.list?part=snippet&type=video&q=<sorgu>` — başlık, kanal adı, küçük resim.
2. `videos.list?part=contentDetails&id=<virgüllü id listesi>` — süre (ISO 8601, `PT4M13S` biçiminde; `parseIso8601Duration` saniyeye çevirir). Tek çağrıda 50'ye kadar video ID'si toplu sorgulanabildiği için bu ikinci çağrı sonuç başına değil, arama başına yalnızca **1 birim** daha maliyet çıkarır.

### Kota — tasarımı belirleyen kısıt

Context7 üzerinden doğrulanan güncel rakamlar: yeni bir Google Cloud projesinin günlük kotası **10.000 birim**; `search.list` başına **100 birim** düşüyor. Yani varsayılan bir anahtarla günde **~100 arama**. Bu, iki tasarım kararını doğrudan belirledi:

- **Arama yalnızca gönderimde çalışır, yazarken değil.** Debounce'lu "yazdıkça ara" (probe'un URL alanında yaptığı gibi) burada kotayı dakikalar içinde tüketirdi. Kullanıcı Enter'a basmalı veya Ara'ya tıklamalı.
- **Aynı oturumda tekrarlanan sorgu için basit bir önbellek** (`SearchPanel` içinde `Map<sorgu, sonuçlar>`), kazara aynı aramayı iki kez göndermenin kotayı boşa harcamasını engelliyor. Sayfalama (sonraki sayfa/`nextPageToken`) bilinçli olarak eklenmedi — kotayı ilk sayfanın ötesine yaymamak için.

### Sonuç seçince ne oluyor: ayrı indirme yolu yok

Arama sonucu kartına tıklamak yeni bir "arama sonucundan indir" akışı başlatmıyor — yalnızca URL alanını `https://www.youtube.com/watch?v=<id>` ile dolduruyor ve moda `link`'e geri dönüyor. Bu, mevcut `useProbe` + format/kalite/albüm/hedef klasör + kuyruğa ekleme akışının **tamamını olduğu gibi yeniden kullanıyor** — arama sonuçları için ayrı bir doğrulama, format seçimi veya kuyruk mantığı yazılmadı. Bedeli: seçimden sonra yt-dlp `-J` ile bir kez daha (yerel, YouTube API kotasına dokunmayan) probe çalışıyor; kazancı: tek bir indirme yolu, tek bir test yüzeyi.

### Hata sınıflandırması

`errors.ts`'deki (yt-dlp stderr'i düz dile çeviren) örüntüye paralel: `youtube.ts` Google API'nin `error.errors[0].reason` alanını okuyup üç durumu ayırt ediyor — `quotaExceeded` (net "bugünkü ücretsiz kota bitti, yarın tekrar deneyin veya bağlantıyı yapıştırın" mesajı), `keyInvalid`/400/403 ("bu API anahtarı reddedildi, Ayarlar'dan kontrol edin"), ve tanınmayan durumlar için Google'ın kendi `error.message`'ı.

### Ayarlar

`youtubeApiKey: string` (varsayılan boş — arama tamamen isteğe bağlı, anahtar yoksa "Ayarlar'dan API anahtarı ekleyin" mesajıyla nazikçe reddediyor). Ayarlar açılır kutusunda `type="password"` alan; README'de Google Cloud Console'da anahtar alma adımları var.

### Doğrulama durumu

Gerçek Google API anahtarıyla test edilmedi (kullanıcının kendi anahtarını gerektiriyor, elimizde yok). Doğrulanan: Context7 dokümantasyonundan alınan gerçek yanıt biçimleriyle sahte `fetch` üzerinden 9 birim test (süre ayrıştırma, kota/anahtar hata sınıflandırması, iki çağrının birleştirilmesi); yerel bir sahte HTTP sunucusuyla uçtan uca test (arama → sonuç → seçim → mevcut link akışına geçiş, sahte yt-dlp ile probe). CSP'ye dokunulmadı — main sürecin `fetch()` çağrıları renderer'ın CSP'sinden zaten muaf (GitHub API çağrılarıyla aynı emsal, bkz. §6).

---

## 17. Video oynatıcı ve indirme pop-up'ı

Bu, uygulamanın kimliğini değiştiren bir karar: "linki yapıştır, indir" aracından "videoyu izle, istersen indir" aracına geçiş. İndirme artık birincil eylem değil — oynatıcının altındaki bir düğmenin açtığı pop-up.

### Neden gömülü oynatıcı, yt-dlp değil

Oynatma için yt-dlp'ye hiç ihtiyaç yok. YouTube'un resmî `<iframe>` gömme mekanizması (`https://www.youtube-nocookie.com/embed/{id}`) tarayıcı seviyesinde çalışıyor — kendi oynatma kontrollerini, tam ekranını, hata durumlarını (video kaldırılmış, gömme kapalı) kendisi yönetiyor. Context7'nin resmî YouTube dokümantasyonundan doğrulanan iki URL şekli:

```
https://www.youtube.com/embed/VIDEO_ID                      # tekil video
https://www.youtube.com/embed?listType=playlist&list=PL_ID  # oynatma listesi
```

`youtube-nocookie.com` (youtube.com yerine) Google'ın "Gizlilik Geliştirilmiş Mod" alanı — oynatma başlamadan çerez bırakmıyor.

### Neden JS API değil, çıplak `<iframe>`

YouTube'un IFrame Player API'si (`enablejsapi=1` + `iframe_api` script'i + `postMessage` köprüsü) programatik kontrol sağlıyor (kendi arayüzümüzden oynat/durdur, oynatma pozisyonunu okuma). Bunların hiçbiri istenmedi — kullanıcı YouTube'un kendi oynatıcı arayüzüyle etkileşiyor. API'siz çıplak `<iframe>` yeterli ve çok daha az kod. Programatik kontrol istenirse (örn. "şu anki oynatma pozisyonundan indir") bu karar tek bir dosyada (`VideoPlayer.tsx`) değişir.

Gömme kapalıysa (hata kodu 101/150, "video owner does not allow embedding") YouTube'un kendi `<iframe>` içeriği bunu kendi arayüzüyle gösteriyor ("Watch on YouTube" bağlantısıyla) — bizim ele almamız gereken bir durum yok.

### CSP: `frame-src 'none'` → tek bir izinli köken

`frame-src` daha önce tüm iframe'leri engelliyordu; şimdi yalnızca `https://www.youtube-nocookie.com`'a izin veriyor. Bu direktif yalnızca iframe'in **ilk yükleneceği** kökeni kısıtlıyor — iframe içindeki YouTube sayfasının kendi alt kaynakları (googlevideo.com medya akışı, ytimg.com küçük resimleri) kendi belgesinin CSP'sine tabi, bizimkine değil. `will-navigate`/`setWindowOpenHandler` (docs/PLAN.md §11) zaten üst çerçeveyi koruyor; iframe içinden `target=_top` ile üst pencereyi ele geçirme denemesi de bu mekanizmadan geçiyor.

### İndirme pop-up'ı: ayrı bir kuyruk mantığı yok

Format/kalite/albüm adı/hedef klasör formu artık her zaman görünür değil — oynatıcının altındaki **İndir** düğmesi bunu bir pop-up olarak açıyor (Ayarlar için zaten kurulmuş native Popover API + CSS anchor positioning deseninin aynısı). Form mantığı (yt-dlp probe'undan albüm adı önerisi, kuyruğa ekleme) **hiç değişmedi** — sadece nereden görüntülendiği değişti. Kuyruk (`QueueList`) hâlâ oynatıcının altında, her zaman görünür.

### Gerçek bir konumlandırma hatası ve düzeltmesi

İlk uygulamada pop-up, Ayarlar'daki gibi düğmenin **altına** açılıyordu. Ayarlar düğmesi pencerenin en üstünde olduğu için bu sorun çıkarmıyordu; ama İndir düğmesi artık oynatıcının **altında**, pencerenin alt kısmına yakın duruyor — pop-up aşağı açılınca çoğu zaman görünür alanın dışına taşıyordu. Uçtan uca testle ölçüldü: 668px pencere yüksekliğinde pop-up'ın alt kenarı y=901'e kadar uzuyordu.

Düzeltme: `position-try-fallbacks: flip-block` — CSS Anchor Positioning ailesinin bir parçası, altta yer yoksa pop-up'ı otomatik olarak düğmenin **üstüne** çeviriyor. Bu Electron'un Chromium sürümünde çalıştığı doğrulandı (aynı düzeltme olmadan test gerçekten kırılıyor, geri konunca geçiyor — bkz. `e2e/app.spec.ts`'teki pop-up'ın pencere sınırları içinde kaldığını doğrulayan kalıcı regresyon testi). Desteklenmeyen bir Chromium sürümünde bu özellik sessizce yok sayılır (CSS'in bilinmeyen değerleri görmezden gelme kuralı) — en kötü ihtimalle eski (bazen kırpılan) davranışa döner, hiçbir şeyi bozmaz.

### Doğrulama durumu

Gerçek network erişimiyle uçtan uca doğrulandı: `framenavigated` olayı dinlenerek CSP'nin embed'i gerçekten yüklemesine izin verdiğini (yalnızca DOM'da `<iframe>` elemanının var olmasını değil) kanıtlayan bir test var. Ekran görüntüsüyle görsel olarak da kontrol edildi (oynatıcı, pop-up açık/kapalı halleri, karanlık tema).

---

## 18. Sonraki adım

Bu doküman onaylandığında **Faz 0** başlar: repo iskeleti, `legacy/` taşıması ve boş ama çalışan Electron + React + Tailwind penceresi.
