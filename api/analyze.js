// api/analyze.js
// Serverless function (Vercel) — proxy aman ke Gemini API.
// API key TIDAK pernah dikirim ke browser; diambil dari environment variable server.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di Environment Variables Vercel.' });
  }

  const { imageBase64 } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 wajib diisi.' });
  }

  const prompt = `Anda adalah Analis Senior Smart Money Concepts (SMC) spesialis XAU/USD (Gold).
Analisis gambar chart ini secara presisi dan tentukan elemen-elemen berikut:
1. Position Tool Execution Area (SELL LIMIT atau BUY LIMIT): Area Entry zone, Stop Loss (SL), dan Take Profit (TP). Sertakan koordinat box posisi TradingView (ymin, xmin, ymax, xmax, entryY, slY, tpY) dalam rentang 0-1000.
2. MSS (Market Structure Shift) / CHoCH: Titik perubahan karakter struktur pasar.
3. BOS (Break of Structure): Break struktur kelanjutan trend.
4. FVG / Imbalance / OB-GAP: Celah fair value gap 3 candle.
5. OB (Order Block / Supply Zone / Demand Zone).
6. IDM (Inducement): Pullback pembawa jebakan retail.
7. $$$ Liquidity: Area sweep likuiditas (Equal Highs / Lows).

Kembalikan hasil analisis persis sesuai JSON Schema. Gunakan koordinat ter-normalisasi (0 sampai 1000) untuk semua struktur 'box'!`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          marketBias: { type: 'STRING', description: 'BULLISH / BEARISH / RANGING' },
          trendStrength: { type: 'STRING', description: 'Sangat Kuat / Sedang / Lemah' },
          timeframeEstimate: { type: 'STRING', description: 'misal 1M, 5M, 15M, 1H' },
          analysisSummary: { type: 'STRING', description: 'Penjelasan detail struktur dan setup trading SMC dalam Bahasa Indonesia' },
          structures: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING', description: 'BOS / MSS / CHOCH / FVG / IDM / OB / LIQUIDITY' },
                label: { type: 'STRING', description: "Label persis misal 'LTF CHOCH', 'OB-GAP', 'SUPPLY H15', '$$$'" },
                confidence: { type: 'STRING', description: 'Tinggi / Sedang' },
                box: {
                  type: 'OBJECT',
                  properties: {
                    ymin: { type: 'NUMBER' },
                    xmin: { type: 'NUMBER' },
                    ymax: { type: 'NUMBER' },
                    xmax: { type: 'NUMBER' }
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax']
                },
                explanation: { type: 'STRING', description: 'Keterangan detail' }
              },
              required: ['type', 'label', 'confidence', 'box', 'explanation']
            }
          },
          tradeSetup: {
            type: 'OBJECT',
            properties: {
              recommendation: { type: 'STRING', description: 'SELL LIMIT / BUY LIMIT / WAIT FOR IDM' },
              entryZone: { type: 'STRING', description: 'Harga Entry misal 4417.00 - 4419.00' },
              stopLoss: { type: 'STRING', description: 'Harga SL misal 4421.00' },
              takeProfit1: { type: 'STRING', description: 'Harga TP misal 4404.00' },
              riskRewardRatio: { type: 'STRING', description: 'misal 1:3.5' },
              positionBox: {
                type: 'OBJECT',
                properties: {
                  xmin: { type: 'NUMBER' },
                  xmax: { type: 'NUMBER' },
                  ymin: { type: 'NUMBER' },
                  ymax: { type: 'NUMBER' },
                  entryY: { type: 'NUMBER' },
                  slY: { type: 'NUMBER' },
                  tpY: { type: 'NUMBER' }
                },
                required: ['xmin', 'xmax', 'ymin', 'ymax', 'entryY', 'slY', 'tpY']
              },
              keyConfluences: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              }
            },
            required: ['recommendation', 'entryZone', 'stopLoss', 'takeProfit1', 'riskRewardRatio', 'keyConfluences']
          }
        },
        required: ['marketBias', 'analysisSummary', 'structures', 'tradeSetup']
      }
    }
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
      return res.status(502).json({ error: 'Respons dari Gemini kosong atau tidak sesuai format.' });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memproses analisis: ' + err.message });
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
