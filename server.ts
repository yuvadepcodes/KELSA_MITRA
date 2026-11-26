import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

type SupportedLang = 'kn' | 'hi' | 'en';

function getSarvamApiKey(): string {
  return (process.env.SARVAM_API_KEY || '').trim();
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

async function createServer() {
  const app = express();

  app.use(express.json({ limit: '12mb' }));

  // Health & Sarvam configuration check (never exposes secret values)
  app.get('/api/sarvam/status', (_req: Request, res: Response) => {
    const configured = Boolean(getSarvamApiKey());
    res.json({
      configured,
      sttModel: 'saaras:v4',
      ttsModel: 'bulbul:v3',
    });
  });

  // Sarvam Text-to-Speech proxy (Bulbul v3 with v2 fallback)
  app.post('/api/sarvam/tts', async (req: Request, res: Response) => {
    const apiKey = getSarvamApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'SARVAM_API_KEY is not configured on the server.',
        code: 'SARVAM_NOT_CONFIGURED',
      });
      return;
    }

    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const lang = req.body?.lang as SupportedLang | undefined;

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

      // Fallback to bulbul:v2 inputs[] schema if an account key expects v2 schema
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

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
        model: 'bulbul:v3',
        languageCode,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sarvam TTS proxy error';
      res.status(502).json({ error: message });
    }
  });

  // Sarvam Speech-to-Text proxy (Saaras v4)
  app.post('/api/sarvam/stt', async (req: Request, res: Response) => {
    const apiKey = getSarvamApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'SARVAM_API_KEY is not configured on the server.',
        code: 'SARVAM_NOT_CONFIGURED',
      });
      return;
    }

    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : 'audio/webm';
    const lang = typeof req.body?.lang === 'string' ? req.body.lang : 'kn';

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

      // Fallback to saarika:v2.5 if an older key doesn't have saaras:v4 enabled
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

      res.json({
        transcript: (data.transcript || '').trim(),
        languageCode: data.language_code || toBcp47(lang),
        model: 'saaras:v4',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sarvam STT proxy error';
      res.status(502).json({ error: message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KELSA Mitra server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
