// api/ask.js
// Serverless function untuk fitur "Konsultasi Lanjutan" (chat follow-up tentang chart).
// Pakai rotasi otomatis multi API key kalau salah satu kena limit kuota.

import { callGeminiWithRotation } from './_geminiClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    const response = await callGeminiWithRotation(model, payload);

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'Respons dari Gemini kosong.' });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: 'Gagal memproses pertanyaan: ' + err.message });
  }
}
