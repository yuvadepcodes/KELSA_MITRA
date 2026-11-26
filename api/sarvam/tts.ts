type SupportedLang = 'kn' | 'hi' | 'en';

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

function getSpeakerForLang(lang: unknown): string {
  if (lang === 'hi') return 'ritu';
  if (lang === 'en') return 'shubh';
  return 'kavya';
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
  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  const lang = body.lang as SupportedLang | undefined;

  if (!rawText) {
    res.status(400).json({ error: 'Text is required for speech synthesis.' });
    return;
  }

  const safeText = rawText.slice(0, 2400);
  const languageCode = toBcp47(lang);
  const speaker = getSpeakerForLang(lang);

  try {
    let sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: safeText,
        target_language_code: languageCode,
        model: 'bulbul:v3',
        speaker,
        pace: 1.0,
        speech_sample_rate: 24000,
      }),
    });

    if (sarvamRes.status === 400 || sarvamRes.status === 422) {
      sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [safeText.slice(0, 500)],
          target_language_code: languageCode,
          speaker: 'anushka',
          model: 'bulbul:v2',
          pace: 1.0,
          speech_sample_rate: 22050,
          enable_preprocessing: true,
        }),
      });
    }

    if (!sarvamRes.ok) {
      const errBody = await sarvamRes.text().catch(() => '');
      res.status(sarvamRes.status).json({
        error: `Sarvam TTS request failed (${sarvamRes.status})`,
        detail: errBody.slice(0, 200),
      });
      return;
    }

    const data = (await sarvamRes.json()) as { audios?: string[] };
    const audioBase64 = Array.isArray(data?.audios) ? data.audios[0] : '';

    if (!audioBase64) {
      res.status(502).json({ error: 'Sarvam TTS returned empty audio.' });
      return;
    }

    res.status(200).json({
      audioBase64,
      mimeType: 'audio/wav',
      model: 'bulbul:v3',
      languageCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sarvam TTS proxy error';
    res.status(502).json({ error: message });
  }
}
