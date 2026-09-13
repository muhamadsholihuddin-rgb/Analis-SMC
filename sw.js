// Service worker minimal.
// Tujuannya HANYA agar browser mengizinkan "Install app" / "Add to Home Screen".
// Tidak melakukan caching apa pun — semua request tetap ke jaringan seperti biasa,
// jadi analisis AI (yang butuh koneksi ke /api/analyze & /api/ask) tetap normal.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Passthrough murni — tidak mengubah/mencegat respons apa pun.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
