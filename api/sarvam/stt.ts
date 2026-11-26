interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: unknown) => void;
}

function toBcp47(lang: unknown): 'kn-IN' | 'hi-IN' | 'en-IN' {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'en') return 'en-IN';
  return 'kn-IN';
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = (process.env.SARVAM_API_KEY || '').trim();
  if (!apiKey) {
    res.status(503).json({
      error: 'SARVAM_API_KEY is not configured on the server.',
      code: 'SARVAM_NOT_CONFIGURED',
    });
    return;
  }

  const body = parseBody(req.body);
  const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'audio/wav';
  const lang = typeof body.lang === 'string' ? body.lang : 'kn';

  if (!audioBase64 || audioBase64.length > 10_000_000) {
    res.status(400).json({ error: 'Valid audio recording is required.' });
    return;
  }

  if (!mimeType.startsWith('audio/')) {
    res.status(400).json({ error: 'Invalid audio MIME type.' });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.byteLength < 100) {
      res.status(400).json({ error: 'Audio recording was too short. Please try speaking again.' });
      return;
    }

    const cleanMime = (mimeType.split(';')[0] || 'audio/wav').trim().toLowerCase();
    const ext = cleanMime.includes('wav')
      ? 'wav'
      : cleanMime.includes('mp4') || cleanMime.includes('m4a')
      ? 'm4a'
      : cleanMime.includes('ogg')
      ? 'ogg'
      : cleanMime.includes('mpeg') || cleanMime.includes('mp3')
      ? 'mp3'
      : 'webm';

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: cleanMime });
    formData.append('file', blob, `recording.${ext}`);
    formData.append('model', 'saaras:v4');
    formData.append('mode', 'transcribe');
    formData.append('language_code', lang === 'auto' ? 'unknown' : toBcp47(lang));

    let sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    });

    if (sarvamRes.status === 400 || sarvamRes.status === 422) {
      const fallbackForm = new FormData();
      fallbackForm.append('file', blob, `recording.${ext}`);
      fallbackForm.append('model', 'saarika:v2.5');
      fallbackForm.append('language_code', lang === 'auto' ? 'unknown' : toBcp47(lang));
      sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
        },
        body: fallbackForm,
      });
    }

    if (!sarvamRes.ok) {
      const errBody = await sarvamRes.text().catch(() => '');
      let parsedMsg = errBody.slice(0, 200);
      try {
        const parsed = JSON.parse(errBody) as { error?: { message?: string }; message?: string; detail?: string };
        parsedMsg = parsed?.error?.message || parsed?.message || parsed?.detail || parsedMsg;
      } catch {
        // keep text slice
      }
      res.status(sarvamRes.status).json({
        error: `Sarvam STT request failed (${sarvamRes.status}): ${parsedMsg}`,
        detail: parsedMsg,
      });
      return;
    }

    const data = (await sarvamRes.json()) as {
      transcript?: string;
      language_code?: string;
    };

    res.status(200).json({
      transcript: (data.transcript || '').trim(),
      languageCode: data.language_code || toBcp47(lang),
      model: 'saaras:v4',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sarvam STT proxy error';
    res.status(502).json({ error: message });
  }
}
