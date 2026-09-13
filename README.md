# XAU/USD SMC Vision Analyzer Pro — Siap Deploy Vercel

## Apa yang berubah dari versi asli
- API key Gemini **tidak lagi** ada di kode frontend (`index.html`).
- Semua panggilan ke Gemini API sekarang lewat 2 serverless function:
  - `api/analyze.js` — analisis chart utama (MSS, FVG, OB, IDM, $$$, Position Tool).
  - `api/ask.js` — fitur chat "Konsultasi Lanjutan".
- Key disimpan sebagai **Environment Variable** di server, aman dari browser.

## Cara Deploy ke Vercel

### 1. Dapatkan API Key Gemini
Buat API key gratis di https://aistudio.google.com/apikey (atau ai.google.dev).

### 2. Upload project ke GitHub
```bash
cd xau-smc-vercel
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

### 3. Import ke Vercel
1. Buka https://vercel.com/new
2. Pilih repo GitHub yang tadi di-push.
3. Framework preset: pilih **"Other"** (tidak perlu build command, karena ini static + serverless functions).
4. Sebelum klik Deploy, buka bagian **Environment Variables** dan tambahkan:
   - `GEMINI_API_KEY` = (API key kamu dari langkah 1)
5. Klik **Deploy**.

### 4. Selesai
Vercel akan otomatis:
- Melayani `index.html` sebagai halaman utama.
- Menjalankan `api/analyze.js` di endpoint `https://<domain-kamu>/api/analyze`.
- Menjalankan `api/ask.js` di endpoint `https://<domain-kamu>/api/ask`.

## Testing lokal (opsional)
Kalau mau coba dulu sebelum deploy:
```bash
npm install -g vercel
vercel dev
```
Vercel CLI akan minta kamu login & bisa baca `.env` lokal (buat file `.env` dari `.env.example`, isi API key asli, jangan di-commit).

### 5. (Opsional tapi disarankan) Tambah beberapa API key sekaligus
Kalau kuota gratis satu key sering habis (limit 20 request/hari untuk `gemini-3-flash-preview`), kamu bisa daftar beberapa API key (dari akun Google yang sama atau berbeda), lalu isi env var:
```
GEMINI_API_KEYS=key_pertama,key_kedua,key_ketiga
```
(pisahkan dengan koma, tanpa spasi). Server otomatis mencoba key berikutnya kalau key yang sedang dipakai kena limit 429 — kamu tidak perlu ganti apa pun secara manual, tinggal tambah key baru ke daftar ini kapan saja lalu redeploy.

## Bisa di-install sebagai aplikasi mandiri
App ini sudah dilengkapi `manifest.json` + service worker minimal, jadi setelah deploy:
- **Android/Chrome desktop**: akan muncul ikon "Install" di address bar, atau menu ⋮ > "Install app" / "Add to Home screen".
- **iOS Safari**: Share button > "Add to Home Screen".

Service worker-nya **tidak melakukan caching offline** — cuma syarat teknis biar browser mau menawarkan opsi install. Jadi kalau dibuka tanpa internet, tetap tidak akan berfungsi (memang bukan tujuannya) — tapi begitu terinstal, app terbuka sebagai jendela mandiri tanpa address bar/toolbar browser, seperti aplikasi asli.

## Struktur folder
```
xau-smc-vercel/
├── index.html          ← frontend (UI + canvas + logic)
├── manifest.json        ← metadata PWA (nama, ikon, warna)
├── sw.js                 ← service worker minimal (syarat installability)
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── api/
│   ├── _geminiClient.js ← utilitas rotasi multi API key
│   ├── analyze.js      ← serverless: analisis chart
│   └── ask.js           ← serverless: chat follow-up
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

## Catatan
- Model default: `gemini-3-flash-preview`. Kalau suatu saat model ini deprecated, tinggal set env var `GEMINI_MODEL` ke model baru — tidak perlu ubah kode.
- Kalau nanti mau tambah rate-limiting atau auth (biar orang lain nggak pakai API key kamu lewat endpoint publik), bisa ditambahkan di `api/analyze.js` dan `api/ask.js` — tinggal bilang, nanti saya bantu.
