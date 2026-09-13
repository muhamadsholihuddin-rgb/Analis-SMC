// api/ask.js
// Serverless function untuk fitur "Konsultasi Lanjutan" (chat follow-up tentang chart).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di Environment Variables Vercel.' });
  }

  const { imageBase64, query } = req.body || {};
  if (!imageBase64 || !query) {
    return res.status(400).json({ error: 'imageBase64 dan query wajib diisi.' });
  }

  const prompt = `Pengguna bertanya tentang chart XAU/USD SMC ini: "${query}".
Jawablah berdasarkan prinsip Smart Money Concepts (MSS, FVG, Order Block, Inducement, SL, TP) secara lugas & profesional dalam Bahasa Indonesia.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } }
        ]
      }
    ]
  };

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'Respons dari Gemini kosong.' });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memproses pertanyaan: ' + err.message });
  }
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (i === maxRetries - 1) {
        const errBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errBody}`);
      }
    } catch (e) {
      if (i === maxRetries - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }
}
