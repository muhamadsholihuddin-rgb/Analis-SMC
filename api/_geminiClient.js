// api/_geminiClient.js
// Utilitas bersama: menyimpan daftar API key & otomatis rotasi kalau kena limit (429).
//
// Cara pakai di Vercel Environment Variables:
//   GEMINI_API_KEYS = key_pertama,key_kedua,key_ketiga
// (pisahkan dengan koma, tanpa spasi). Bisa juga cuma isi 1 key, tetap jalan normal.
//
// Kalau masih pakai nama lama GEMINI_API_KEY (singular), tetap didukung sebagai fallback.

function getApiKeys() {
  const multi = process.env.GEMINI_API_KEYS; // "key1,key2,key3" (toleran juga terhadap newline/spasi/kutip)
  const single = process.env.GEMINI_API_KEY; // kompatibel dengan setup lama

  const keys = [];
  if (multi) {
    // Pisah berdasarkan koma ATAU baris baru, buang spasi & tanda kutip yang nyasar.
    multi
      .split(/[\n,]+/)
      .map(k => k.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
      .forEach(k => { if (!keys.includes(k)) keys.push(k); });
  }
  if (single) {
    // Toleran kalau orang tidak sengaja taruh banyak key (dipisah koma/baris baru)
    // di variable singular GEMINI_API_KEY, bukan di GEMINI_API_KEYS yang benar.
    single
      .split(/[\n,]+/)
      .map(k => k.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
      .forEach(k => { if (!keys.includes(k)) keys.push(k); });
  }
  return keys;
}

const RETRYABLE_STATUS = new Set([429, 500, 503]);

/**
 * Panggil Gemini generateContent, coba tiap API key satu per satu.
 * Kalau satu key kena 429 (quota habis) atau error server sementara, otomatis lanjut ke key berikutnya.
 * @param {string} model - nama model, misal 'gemini-3-flash-preview'
 * @param {object} payload - body request Gemini (contents, generationConfig, dst)
 * @returns {Promise<object>} parsed JSON response dari Gemini
 */
export async function callGeminiWithRotation(model, payload) {
  const keys = getApiKeys();

  if (keys.length === 0) {
    const err = new Error('Tidak ada API key yang dikonfigurasi. Set GEMINI_API_KEYS atau GEMINI_API_KEY di Environment Variables Vercel.');
    err.statusCode = 500;
    throw err;
  }

  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (response.ok) {
        return await response.json();
      }

      const status = response.status;
      const bodyText = await response.text();

      if (RETRYABLE_STATUS.has(status) && i < keys.length - 1) {
        // Key ini habis kuota / error sementara — coba key berikutnya.
        lastError = new Error(`Key #${i + 1} gagal (status ${status}): ${bodyText}`);
        continue;
      }

      // Status tidak retryable, atau ini sudah key terakhir — lempar error.
      const err = new Error(bodyText || `Gemini API error ${status}`);
      err.statusCode = status;
      throw err;

    } catch (e) {
      lastError = e;
      if (i === keys.length - 1) {
        // Semua key sudah dicoba dan gagal semua.
        const err = new Error(
          `Semua ${keys.length} API key gagal/kena limit. Detail terakhir: ${e.message}`
        );
        err.statusCode = e.statusCode || 429;
        throw err;
      }
      // Kalau bukan error dari fetch (network dsb), tetap lanjut coba key berikutnya.
    }
  }

  // Seharusnya tidak pernah sampai sini, tapi jaga-jaga.
  throw lastError || new Error('Gagal memanggil Gemini API.');
}
