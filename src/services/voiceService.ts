// Unified Sarvam AI Voice Service (saaras:v4 STT + bulbul:v3 TTS via /api/sarvam/* proxy)
// Falls back cleanly to Built-in Browser Voice when SARVAM_API_KEY is not configured.

export type SupportedLang = 'kn' | 'hi' | 'en';
export type VoiceProvider = 'sarvam' | 'builtin';

export interface VoiceExtractionResult {
  transcript: string;
  language: SupportedLang;
  entities: {
    skill: string;
    area: string;
    radiusKm: number;
    minWage: number;
    timing: string;
    headcount?: number;
  };
  confidence: number;
  ttsReply: string;
}

export interface SarvamStatus {
  configured: boolean;
  sttModel: string;
  ttsModel: string;
}

let activeAudioEl: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activePlaybackResolve: (() => void) | null = null;

export async function fetchSarvamStatus(): Promise<SarvamStatus> {
  try {
    const res = await fetch('/api/sarvam/status');
    if (res.ok) {
      return (await res.json()) as SarvamStatus;
    }
  } catch {
    // Ignore network error
  }
  return { configured: false, sttModel: 'saaras:v4', ttsModel: 'bulbul:v3' };
}

export function stopBrowserSpeech(): void {
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // Ignore
    }
    activeAudioEl = null;
  }
  if (activeAudioUrl) {
    try {
      URL.revokeObjectURL(activeAudioUrl);
    } catch {
      // Ignore
    }
    activeAudioUrl = null;
  }
  if (activePlaybackResolve) {
    const fn = activePlaybackResolve;
    activePlaybackResolve = null;
    fn();
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

export function speakTextWithBrowserFallback(
  text: string,
  lang: SupportedLang
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(resolve, 900);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.96;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
      const fallbackMs = Math.min(9500, Math.max(2500, text.length * 80));
      setTimeout(finish, fallbackMs);
    } catch {
      setTimeout(finish, 900);
    }
  });
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function speakWithSarvamOrFallback(
  text: string,
  lang: SupportedLang,
  signal?: { cancelled?: boolean }
): Promise<{ provider: VoiceProvider; warning?: string }> {
  stopBrowserSpeech();
  if (signal?.cancelled) return { provider: 'builtin' };

  try {
    const res = await fetch('/api/sarvam/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });

    if (res.ok) {
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
      if (data.audioBase64 && !signal?.cancelled) {
        const url = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
        activeAudioUrl = url;

        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          activeAudioEl = audio;
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            if (activePlaybackResolve === finish) activePlaybackResolve = null;
            if (activeAudioEl === audio) activeAudioEl = null;
            if (activeAudioUrl === url) {
              URL.revokeObjectURL(url);
              activeAudioUrl = null;
            }
            resolve();
          };
          activePlaybackResolve = finish;
          audio.onended = finish;
          audio.onerror = finish;
          audio.play().catch(() => {
            finish();
          });
        });

        return { provider: 'sarvam' };
      }
    }

    const errJson = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    const warning =
      errJson.code === 'SARVAM_NOT_CONFIGURED'
        ? 'SARVAM_NOT_CONFIGURED'
        : errJson.error || `Sarvam TTS error (${res.status})`;

    if (!signal?.cancelled) {
      await speakTextWithBrowserFallback(text, lang);
    }
    return { provider: 'builtin', warning };
  } catch (err) {
    if (!signal?.cancelled) {
      await speakTextWithBrowserFallback(text, lang);
    }
    return {
      provider: 'builtin',
      warning: err instanceof Error ? err.message : 'Network error',
    };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudioWithSarvam(
  audioBlob: Blob,
  lang: SupportedLang | 'auto'
): Promise<{ transcript: string; provider: VoiceProvider; errorCode?: string; errorMessage?: string }> {
  try {
    const audioBase64 = await blobToBase64(audioBlob);
    const res = await fetch('/api/sarvam/stt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
        lang,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { transcript?: string };
      return {
        transcript: (data.transcript || '').trim(),
        provider: 'sarvam',
      };
    }

    const errJson = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    return {
      transcript: '',
      provider: 'builtin',
      errorCode: errJson.code,
      errorMessage: errJson.error || `Sarvam STT failed (${res.status})`,
    };
  } catch (err) {
    return {
      transcript: '',
      provider: 'builtin',
      errorMessage: err instanceof Error ? err.message : 'Failed to send audio to Sarvam STT',
    };
  }
}

export interface MicRecordingSession {
  stop: () => void;
}

function downsampleTo16kHz(samples: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === 16000) return samples;
  const ratio = sourceRate / 16000;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = samples[idx] ?? 0;
    const s1 = samples[Math.min(idx + 1, samples.length - 1)] ?? s0;
    result[i] = s0 + (s1 - s0) * frac;
  }
  return result;
}

function encodeMonoWav16kHz(chunks: Float32Array[], sourceRate: number): Blob {
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const merged = new Float32Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const resampled = downsampleTo16kHz(merged, sourceRate);
  const sampleRate = 16000;
  const dataBytes = resampled.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(pos + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let writePos = 44;
  for (let i = 0; i < resampled.length; i += 1) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(writePos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    writePos += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function startSarvamMicCapture(options: {
  maxDurationMs?: number;
  silenceDurationMs?: number;
  onStatusChange?: (phase: 'listening' | 'transcribing') => void;
  onAudioCaptured: (blob: Blob) => void;
  onError: (code: 'MIC_PERMISSION_DENIED' | 'NO_SPEECH' | 'UNSUPPORTED' | 'RECORDER_ERROR', message: string) => void;
}): MicRecordingSession {
  const maxDurationMs = options.maxDurationMs ?? 8000;
  const silenceDurationMs = options.silenceDurationMs ?? 1500;

  let stopped = false;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let processorNode: ScriptProcessorNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let gainNode: GainNode | null = null;
  let maxTimer: number | null = null;
  const pcmChunks: Float32Array[] = [];
  let sourceSampleRate = 16000;

  const cleanup = () => {
    if (maxTimer !== null) {
      window.clearTimeout(maxTimer);
      maxTimer = null;
    }
    try {
      processorNode?.disconnect();
      sourceNode?.disconnect();
      gainNode?.disconnect();
    } catch {
      // Ignore
    }
    processorNode = null;
    sourceNode = null;
    gainNode = null;
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };

  const stopRecording = () => {
    if (stopped) return;
    stopped = true;
    const chunksSnapshot = pcmChunks.slice();
    const rateSnapshot = sourceSampleRate;
    cleanup();

    let totalSamples = 0;
    for (const c of chunksSnapshot) totalSamples += c.length;

    if (totalSamples < rateSnapshot * 0.25) {
      options.onError('NO_SPEECH', 'No voice audio detected. Tap the mic and speak clearly.');
      return;
    }

    options.onStatusChange?.('transcribing');
    const wavBlob = encodeMonoWav16kHz(chunksSnapshot, rateSnapshot);
    options.onAudioCaptured(wavBlob);
  };

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    options.onError('UNSUPPORTED', 'Microphone access is not supported in this browser.');
    return { stop: () => {} };
  }

  navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    .then(async (mediaStream) => {
      if (stopped) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = mediaStream;

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        cleanup();
        options.onError('UNSUPPORTED', 'Audio recording is not supported in this browser.');
        return;
      }

      audioCtx = new AudioContextCtor();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      sourceSampleRate = audioCtx.sampleRate || 48000;

      sourceNode = audioCtx.createMediaStreamSource(mediaStream);
      processorNode = audioCtx.createScriptProcessor(4096, 1, 1);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;

      const startedAt = Date.now();
      let heardVoice = false;
      let lastVoiceAt = Date.now();

      processorNode.onaudioprocess = (ev) => {
        if (stopped) return;
        const input = ev.inputBuffer.getChannelData(0);
        pcmChunks.push(new Float32Array(input));

        let sum = 0;
        for (let i = 0; i < input.length; i += 1) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        const now = Date.now();

        if (rms > 0.018) {
          heardVoice = true;
          lastVoiceAt = now;
        } else if (heardVoice && now - lastVoiceAt > silenceDurationMs && now - startedAt > 1400) {
          stopRecording();
        }
      };

      sourceNode.connect(processorNode);
      processorNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      options.onStatusChange?.('listening');

      maxTimer = window.setTimeout(() => {
        stopRecording();
      }, maxDurationMs);
    })
    .catch((err) => {
      cleanup();
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : '';
      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('denied')
      ) {
        options.onError(
          'MIC_PERMISSION_DENIED',
          'Microphone permission is blocked in this preview frame or browser site settings. Allow Mic in the URL bar lock icon or open this app in a standalone tab.'
        );
      } else {
        options.onError('RECORDER_ERROR', msg || 'Could not access microphone.');
      }
    });

  return {
    stop: stopRecording,
  };
}

export function extractSpokenPhoneDigits(text: string): string {
  const digitWordMap: Record<string, string> = {
    zero: '0', oh: '0', o: '0', ಸೊನ್ನೆ: '0', शून्य: '0',
    one: '1', ಒಂದು: '1', एक: '1',
    two: '2', to: '2', too: '2', ಎರಡು: '2', दो: '2',
    three: '3', ಮೂರು: '3', तीन: '3',
    four: '4', for: '4', ನಾಲ್ಕು: '4', चार: '4',
    five: '5', ಐದು: '5', पांच: '5', पाँच: '5',
    six: '6', ಆರು: '6', छह: '6',
    seven: '7', ಏಳು: '7', सात: '7',
    eight: '8', ate: '8', ಎಂಟು: '8', आठ: '8',
    nine: '9', ಒಂಬತ್ತು: '9', नौ: '9',
  };
  // Convert Kannada / Devanagari numerals to ASCII 0-9 first
  const unicodeNormalized = text
    .replace(/[೦-೯]/g, (d) => String(d.charCodeAt(0) - 0x0ce6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));

  const tokens = unicodeNormalized
    .toLowerCase()
    .split(/[\s,.-]+/)
    .map((tok) => digitWordMap[tok] ?? tok)
    .join('');

  return tokens.replace(/\D/g, '').slice(-10);
}

export function parseVoiceMarketplaceCommand(
  transcript: string,
  currentRole: 'worker' | 'employer',
  lang: SupportedLang
): {
  intent: 'filterJobs' | 'createJob' | 'searchOnly';
  skill?: string;
  area?: string;
  minWage?: number;
  headcount?: number;
  reply: string;
} {
  const t = transcript.toLowerCase();

  let area: string | undefined;
  if (t.includes('kyath') || t.includes('ಕ್ಯಾತ್ಸಂದ್ರ') || t.includes('क्याथ')) area = 'Kyathsandra';
  else if (t.includes('apmc') || t.includes('ಎಪಿಎಂಸಿ') || t.includes('ಮಾರ್ಕೆಟ್')) area = 'APMC Yard';
  else if (t.includes('vasanth') || t.includes('ವಸಂತ') || t.includes('industrial')) area = 'Vasanthnarasapura';
  else if (t.includes('chickpet') || t.includes('ಚಿಕ್ಕಪೇಟೆ') || t.includes('चिकपेट')) area = 'Chickpet';
  else if (t.includes('siddaganga') || t.includes('ಸಿದ್ಧಗಂಗಾ')) area = 'Siddaganga';
  else if (t.includes('b.h') || t.includes('bh road') || t.includes('ಬಿ.ಹೆಚ್')) area = 'B.H. Road';

  let skill: string | undefined;
  if (t.includes('mason') || t.includes('ಗೌಂಡಿ') || t.includes('राजमिस्त्री') || t.includes('brick')) skill = 'Mason';
  else if (t.includes('load') || t.includes('unload') || t.includes('ಹಮಾಲಿ') || t.includes('ಇಳಿಸ') || t.includes('लदान')) skill = 'Loader';
  else if (t.includes('electric') || t.includes('ಎಲೆಕ್ಟ್ರಿ') || t.includes('बिजली')) skill = 'Electrician';
  else if (t.includes('mechanic') || t.includes('garage') || t.includes('ಮೆಕ್ಯಾನಿಕ್') || t.includes('ಗ್ಯಾರೇಜ್')) skill = 'Mechanic';
  else if (t.includes('shop') || t.includes('pack') || t.includes('ಅಂಗಡಿ') || t.includes('दुकान')) skill = 'Shop';
  else if (t.includes('helper') || t.includes('ಹೆಲ್ಪರ್') || t.includes('हेल्पर')) skill = 'Helper';

  const normalizedNums = transcript
    .replace(/[೦-೯]/g, (d) => String(d.charCodeAt(0) - 0x0ce6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  const wageMatch = normalizedNums.match(/\b([3-9]\d{2}|[1-4]\d{3})\b/);
  const minWage = wageMatch ? Number(wageMatch[1]) : undefined;

  const countMatch = normalizedNums.match(/\b([1-9]|1\d)\s*(workers?|helpers?|people|men|boys|ಹುಡುಗರು|ಜನ|लोग|लड़के)\b/i);
  const headcount = countMatch ? Number(countMatch[1]) : 1;

  const isPostingJob =
    currentRole === 'employer' ||
    t.includes('hire') ||
    t.includes('post') ||
    t.includes('ಕೆಲಸಗಾರರು ಬೇಕು') ||
    t.includes('ಹುಡುಗರು ಬೇಕು') ||
    t.includes('ಕೊಡುತ್ತೇನೆ') ||
    t.includes('लड़के चाहिए') ||
    t.includes('कामगार चाहिए');

  if (isPostingJob && (skill || minWage || t.length > 8)) {
    const jobTitle = skill ? `${skill} Helper` : transcript.slice(0, 48);
    const jobArea = area ? `${area}, Tumakuru` : 'B.H. Road, Tumakuru';
    const wage = minWage || 700;
    const reply =
      lang === 'kn'
        ? `${jobArea} ನಲ್ಲಿ ದಿನಕ್ಕೆ ₹${wage} ಸಂಬಳದ "${jobTitle}" ಕೆಲಸವನ್ನು ಪ್ರಕಟಿಸಲಾಗಿದೆ.`
        : lang === 'hi'
        ? `${jobArea} में ₹${wage}/दिन के लिए "${jobTitle}" काम पोस्ट कर दिया गया है।`
        : `Posted "${jobTitle}" in ${jobArea} at ₹${wage}/day.`;

    return {
      intent: 'createJob',
      skill: jobTitle,
      area: jobArea,
      minWage: wage,
      headcount,
      reply,
    };
  }

  const reply =
    lang === 'kn'
      ? `${area || 'ತುಮಕೂರು'} ಹತ್ತಿರ${skill ? ` ${skill}` : ''} ಕೆಲಸಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ.`
      : lang === 'hi'
      ? `${area || 'तुमकुरु'} के पास${skill ? ` ${skill}` : ''} काम दिखाए जा रहे हैं।`
      : `Showing matching${skill ? ` ${skill}` : ''} jobs near ${area || 'Tumakuru'}.`;

  return {
    intent: 'filterJobs',
    skill,
    area,
    minWage,
    reply,
  };
}
